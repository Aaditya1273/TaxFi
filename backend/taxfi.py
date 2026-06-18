"""
TaxFi — Main Orchestrator

Coordinates the multi-agent pipeline:
1. IngestAgent  → Pull transactions from all chains
2. ClassifierAgent → Classify via Venice AI
3. BasisAgent → Track cost basis
4. LossDetector → Find harvest opportunities
5. ExecutorAgent → Execute harvests via 1Shot relayer
6. FormGenerator → Generate IRS forms

The pipeline runs continuously, not just at year-end.
All state is persisted to SQLite so data survives restarts.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

from backend.agents import (
    BasisAgent,
    ClassifierAgent,
    ExecutorAgent,
    FormGenerator,
    IngestAgent,
    LossDetector,
)
from backend.config import TaxFiConfig, load_config
from backend.database_factory import create_database
from backend.integrations.price_oracle import PriceOracle

logger = logging.getLogger("taxfi")


class TaxFiOrchestrator:
    """
    Main orchestrator for the TaxFi agent pipeline.

    Manages the lifecycle of all agents, handles the pipeline
    execution, and provides a unified API for the frontend.

    Database:
      All persistent state (users, cost basis ledgers, harvest
      opportunities, pipeline runs) is stored in SQLite via
      TaxFiDatabase. The orchestrator connects at init and
      restores prior state automatically.
    """

    def __init__(
        self,
        config: Optional[dict] = None,
        db_path: Optional[str] = None,
    ):
        self.config = config or {}
        self._validate_config()

        # Initialize agents
        self.ingest = IngestAgent(self.config)
        self.classifier = ClassifierAgent(self.config)
        self.basis = BasisAgent(self.config)
        self.loss_detector = LossDetector(self.config)
        self.executor = ExecutorAgent(self.config)
        self.form_generator = FormGenerator(self.config)

        # Initialize the price oracle (CoinGecko free API + Alchemy/Covalent fallback)
        self.price_oracle = PriceOracle(
            alchemy_api_key=self.config.get("alchemy_api_key"),
            covalent_api_key=self.config.get("covalent_api_key"),
        )

        # Wire the price oracle into the agents that need real market data
        self.basis.set_price_oracle(self.price_oracle)
        self.loss_detector.set_price_oracle(self.price_oracle)

        # Database (SQLite or PostgreSQL based on TAXFI_DB_TYPE env var)
        resolved_path = db_path or self.config.get("db_path", "~/.taxfi/taxfi.db")
        if resolved_path:
            self.config["db_path"] = resolved_path
        self.db = create_database(self.config)

        # Pipeline state (in-memory cache; authoritative copy is in SQLite)
        self._pipeline_running = False
        self._last_scan_time: Optional[datetime] = None
        self._user_addresses: list[str] = []
        self._pipeline_results: dict[str, Any] = {}

        self.log("info", f"TaxFi orchestrator initialized — db: {resolved_path}")

    async def start(self) -> None:
        """
        Connect to the database and restore previous state.

        Must be called once before any pipeline operations.
        Safe to call multiple times (idempotent).
        """
        await self.db.connect()
        await self._restore_state()
        self.log("info", f"Restored {len(self._user_addresses)} user(s) from database")

    async def _restore_state(self) -> None:
        """Restore in-memory state from the SQLite database."""
        # Restore registered users
        self._user_addresses = await self.db.list_users()

        # Restore last pipeline results from the most recent run (first user)
        if self._user_addresses:
            last_run = await self.db.get_last_pipeline_run(self._user_addresses[0])
            if last_run:
                finished = last_run.get("finished_at")
                if finished:
                    try:
                        self._last_scan_time = datetime.fromisoformat(finished)
                    except (ValueError, TypeError):
                        self._last_scan_time = None
                result = last_run.get("result")
                if result:
                    self._pipeline_results = result

        # Restore cost basis ledgers into BasisAgent
        if self._user_addresses:
            ledgers = await self.db.get_all_ledgers(self._user_addresses[0])
            for ledger in ledgers:
                asset = ledger["asset"]
                method = ledger.get("method", "HIFO")
                if hasattr(self.basis, "restore_ledger_from_db"):
                    lots = await self.db.get_open_lots(self._user_addresses[0], asset)
                    await self.basis.restore_ledger_from_db(
                        asset=asset,
                        method=method,
                        total_acquired=ledger.get("total_acquired", 0.0),
                        total_sold=ledger.get("total_sold", 0.0),
                        realized_gain_loss=ledger.get("realized_gain_loss", 0.0),
                        lots=lots,
                    )

        # Restore pending harvest opportunities into LossDetector
        if self._user_addresses:
            pending = await self.db.get_pending_opportunities(self._user_addresses[0])
            if pending and hasattr(self.loss_detector, "restore_opportunities_from_db"):
                self.loss_detector.restore_opportunities_from_db(pending)

    def _validate_config(self) -> None:
        """Validate required configuration."""
        missing = TaxFiConfig.from_env().validate()
        if missing:
            logger.warning(f"Missing config (some features may be limited): {', '.join(missing)}")

    def log(self, level: str, msg: str) -> None:
        getattr(logger, level.lower(), logger.info)(f"[TaxFi] {msg}")

    # --- User Management ---

    async def register_user(
        self,
        address: str,
        permission_context: Optional[dict] = None,
        display_name: str = "",
    ) -> dict:
        """
        Register a user with TaxFi.

        Persists the user to SQLite so they survive orchestrator restarts.

        Args:
            address: User's wallet address
            permission_context: ERC-7715 permission context for read access

        Returns:
            User registration result
        """
        if address not in self._user_addresses:
            self._user_addresses.append(address)
            # Persist to database
            chains = self.config.get(
                "supported_chains",
                ["eip155:1", "eip155:8453", "eip155:42161"],
            )
            await self.db.upsert_user(
                address=address,
                display_name=display_name,
                chains=chains,
            )

        self.log("info", f"User registered: {address[:8]}...")

        return {
            "success": True,
            "user_address": address,
            "permission_granted": permission_context is not None,
            "supported_chains": self.config.get(
                "supported_chains",
                ["eip155:1", "eip155:8453", "eip155:42161"],
            ),
            "cost_basis_method": self.config.get("cost_basis_method", "HIFO"),
        }

    # --- Pipeline Execution ---

    async def run_full_pipeline(
        self,
        addresses: Optional[list[str]] = None,
        scan_chains: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Run the full TaxFi pipeline: Ingest → Classify → Basis → Detect.

        All results are persisted to SQLite so they survive restarts.

        Args:
            addresses: Addresses to scan (defaults to all registered)
            scan_chains: Chains to scan (defaults to configured)

        Returns:
            Pipeline results with classified transactions, basis data,
            and harvest opportunities
        """
        self.log("info", "Starting full pipeline execution")
        targets = addresses or self._user_addresses

        if not targets:
            return {"error": "No addresses configured", "success": False}

        self._pipeline_running = True
        results = {}
        user_address = targets[0]
        run_id: Optional[int] = None

        try:
            # Record pipeline run start
            run_id = await self.db.start_pipeline_run(user_address)

            # Phase 1: Ingest transactions from all addresses × chains
            self.log("info", f"Phase 1: Ingesting for {len(targets)} addresses")
            all_transactions = []
            for addr in targets:
                ingest_result = await self.ingest.process(
                    address=addr,
                    chains=scan_chains,
                )
                if ingest_result.success and ingest_result.data:
                    all_transactions.extend(ingest_result.data.get("transactions", []))
            results["ingest"] = {
                "status": "complete",
                "total_txns": len(all_transactions),
                "addresses": targets,
            }
            self.log("info", f"Ingested {len(all_transactions)} total transactions")

            if not all_transactions:
                self.log("warn", "No transactions found")
                results["status"] = "no_data"
                await self.db.finish_pipeline_run(
                    run_id,
                    "no_data",
                    total_txns=0,
                )
                return results

            # Phase 2: Classify all transactions via Venice AI
            self.log("info", f"Phase 2: Classifying {len(all_transactions)} transactions")
            classify_result = await self.classifier.process(all_transactions)
            if not classify_result.success:
                self.log("error", f"Classification failed: {classify_result.error}")
                results["classifier"] = {"status": "failed", "error": classify_result.error}
                await self.db.finish_pipeline_run(
                    run_id,
                    "failed",
                    total_txns=len(all_transactions),
                    error_message=classify_result.error,
                )
                return results

            classified_txns = classify_result.data.get("transactions", [])
            results["classifier"] = {
                "status": "complete",
                "classified": classify_result.data.get("stats", {}).get("classified", 0),
                "failed": classify_result.data.get("stats", {}).get("failed", 0),
                "categories": classify_result.data.get("stats", {}).get("by_category", {}),
            }
            self.log(
                "info",
                f"Classification complete: {results['classifier']['classified']} OK, {results['classifier']['failed']} failed",
            )

            # Phase 3: Update cost basis
            self.log("info", "Phase 3: Updating cost basis")
            basis_result = await self.basis.process(classified_txns)
            results["basis"] = {
                "status": "complete",
                "acquisitions": basis_result.data.get("acquisitions", 0)
                if basis_result.data
                else 0,
                "disposals": basis_result.data.get("disposals", 0) if basis_result.data else 0,
                "gain_loss": basis_result.data.get("total_gain_loss", 0)
                if basis_result.data
                else 0,
            }
            self.log(
                "info",
                f"Cost basis updated: {results['basis']['acquisitions']} in, {results['basis']['disposals']} out",
            )

            # Persist cost basis ledgers to database
            await self._persist_cost_basis(user_address)

            # Phase 4: Detect harvest opportunities
            self.log("info", "Phase 4: Detecting harvest opportunities")
            basis_summary = self.basis.get_summary() if hasattr(self.basis, "get_summary") else {}
            detect_result = await self.loss_detector.process(
                cost_basis_data=basis_result.data or {},
            )
            opportunities = (
                detect_result.data.get("opportunities", []) if detect_result.data else []
            )
            total_savings = (
                detect_result.data.get("portfolio_summary", {}).get("estimated_tax_savings", 0)
                if detect_result.data
                else 0
            )

            results["loss_detector"] = {
                "status": "complete",
                "opportunities": opportunities,
                "total_savings": total_savings,
            }
            self.log("info", f"Found {len(opportunities)} harvest opportunities")

            # Persist harvest opportunities to database
            await self._persist_opportunities(user_address, opportunities)

            results["success"] = True
            self._last_scan_time = datetime.now(timezone.utc)
            results["last_scan"] = self._last_scan_time.isoformat()
            self._pipeline_results = results

            # Finalise pipeline run in DB
            await self.db.finish_pipeline_run(
                run_id,
                "complete",
                total_txns=len(all_transactions),
                classified=results["classifier"].get("classified", 0),
                opportunities=len(opportunities),
                total_savings=total_savings,
                result_json=json.dumps(results, default=str),
            )

        except Exception as e:
            self.log("error", f"Pipeline failed: {e}")
            results["success"] = False
            results["error"] = str(e)
            if run_id:
                await self.db.finish_pipeline_run(
                    run_id,
                    "failed",
                    error_message=str(e),
                )
        finally:
            self._pipeline_running = False

        return results

    async def _persist_cost_basis(self, user_address: str) -> None:
        """Persist current cost basis ledgers and open lots to database."""
        for asset, ledger in self.basis.ledgers.items():
            # Upsert the ledger summary
            await self.db.upsert_ledger(
                user_address=user_address,
                asset=asset,
                method=ledger.method.value
                if hasattr(ledger.method, "value")
                else str(ledger.method),
                total_acquired=ledger.total_acquired,
                total_sold=ledger.total_sold,
                realized_gain_loss=ledger.realized_gain_loss,
            )
            # Replace open lots for this asset
            await self.db.delete_all_lots(user_address, asset)
            for lot in ledger.lots:
                await self.db.insert_lot(
                    user_address,
                    {
                        "asset": lot.asset,
                        "lot_id": lot.lot_id,
                        "amount": lot.amount,
                        "remaining_amount": lot.remaining_amount,
                        "rate": lot.rate,
                        "cost_basis": lot.cost_basis,
                        "timestamp": lot.timestamp,
                        "tx_hash": lot.tx_hash,
                        "chain_id": lot.chain_id,
                    },
                )

    async def _persist_opportunities(self, user_address: str, opportunities: list[dict]) -> None:
        """Persist harvest opportunities to database, replacing old pending ones."""
        # Clear old pending opportunities
        await self.db.clear_opportunities(user_address)
        # Insert new ones
        for opp in opportunities:
            await self.db.insert_opportunity(user_address, opp)

    # --- Harvest Execution ---

    async def execute_harvest(
        self,
        opportunity_index: int = 0,
        user_address: Optional[str] = None,
        permission_context: Optional[dict] = None,
    ) -> dict:
        """
        Execute a tax loss harvest.

        Args:
            opportunity_index: Index of the harvest opportunity to execute
            user_address: User's address (defaults to first registered)
            permission_context: ERC-7715 permission for execution

        Returns:
            Execution result
        """
        user = user_address or (self._user_addresses[0] if self._user_addresses else "")

        if not user:
            return {"success": False, "error": "No user address"}

        pending = await self.db.get_pending_opportunities(user)
        if not pending or opportunity_index >= len(pending):
            return {"success": False, "error": "No harvest opportunities available"}

        opportunity = pending[opportunity_index]

        self.log(
            "info",
            f"Executing harvest: {opportunity['quantity']} {opportunity['asset']} "
            f"for {user[:8]}... — estimated savings: ${opportunity['estimated_savings']:.2f}",
        )

        # Build harvest plan
        harvest_plan = {
            "asset": opportunity["asset"],
            "token_address": opportunity.get("asset_address") or opportunity.get("address", ""),
            "quantity": opportunity["quantity"],
            "user_address": user,
            "chain_id": opportunity.get("chain_id")
            or opportunity.get("chain", self.config.get("default_chain", "eip155:84532")),
            "permission_context": permission_context,
            "slippage_tolerance": 0.005,  # 0.5%
        }

        # Execute via executor agent
        result = await self.executor.process(harvest_plan)

        # If successful, mark the opportunity as executed in DB
        if result.success and result.data:
            opp_id = opportunity.get("id") or opportunity.get("db_id")
            if opp_id:
                await self.db.mark_opportunity_executed(int(opp_id))

        return result.data if result.data else {"success": result.success, "error": result.error}

    # --- Form Generation ---

    async def generate_tax_forms(self, tax_year: Optional[int] = None) -> dict:
        """
        Generate IRS tax forms from processed data.

        Args:
            tax_year: Tax year to generate forms for (defaults to last year)

        Returns:
            Generated forms with onchain hashes
        """
        year = tax_year or (datetime.now(timezone.utc).year - 1)

        self.log("info", f"Generating tax forms for {year}")

        basis_summary = self.basis.get_summary() if hasattr(self.basis, "get_summary") else {}

        cost_basis_data = {
            "user_address": self._user_addresses[0] if self._user_addresses else "",
            "ledgers": basis_summary.get("ledgers", {}),
            "harvest_savings": (
                self._pipeline_results.get("loss_detector", {}).get("total_savings", 0)
            ),
        }

        result = await self.form_generator.process(
            {
                **cost_basis_data,
                "tax_year": year,
            }
        )

        if result.data:
            return result.data
        return {"success": False, "tax_year": year, "error": result.error}

    # --- Status & Data Access ---

    def get_status(self) -> dict:
        """Get current pipeline status."""
        return {
            "running": self._pipeline_running,
            "users_registered": len(self._user_addresses),
            "last_scan": self._last_scan_time.isoformat() if self._last_scan_time else None,
            "last_results_summary": {
                "transactions": self._pipeline_results.get("ingest", {}).get("total_txns", 0),
                "opportunities": len(
                    self._pipeline_results.get("loss_detector", {}).get("opportunities", [])
                ),
                "total_savings": self._pipeline_results.get("loss_detector", {}).get(
                    "total_savings", 0
                ),
            }
            if self._pipeline_results
            else None,
            "cost_basis_method": self.config.get("cost_basis_method", "HIFO"),
            "supported_chains": self.config.get("supported_chains", []),
        }

    def get_opportunities(self) -> list[dict]:
        """Get current harvest opportunities."""
        return self._pipeline_results.get("loss_detector", {}).get("opportunities", [])

    async def run_continuous(self, interval_seconds: int = 3600):
        """
        Run the pipeline continuously.

        Scans every `interval_seconds` and alerts on new opportunities.
        """
        self.log("info", f"Starting continuous mode (interval: {interval_seconds}s)")

        while True:
            try:
                results = await self.run_full_pipeline()
                if results.get("success"):
                    opp_count = len(results.get("loss_detector", {}).get("opportunities", []))
                    if opp_count > 0:
                        self.log("info", f"🎯 {opp_count} harvest opportunities found!")
                        # In production: send push notification
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                self.log("info", "Continuous mode stopped")
                break
            except Exception as e:
                self.log("error", f"Continuous scan error: {e}")
                await asyncio.sleep(60)

    async def cleanup(self):
        """Clean up all shared aiohttp sessions and close the database."""
        await self.ingest.close()
        await self.classifier.close()
        await self.price_oracle.close()
        await self.loss_detector.close()
        await self.db.close()

    # --- CLI Entry Point ---

    @classmethod
    async def run_cli(cls):
        """CLI entry point for running TaxFi."""
        import argparse

        parser = argparse.ArgumentParser(description="TaxFi — Crypto Tax Optimization Agent")
        parser.add_argument("--address", help="Wallet address to scan", required=True)
        parser.add_argument("--scan", action="store_true", help="Run a scan")
        parser.add_argument(
            "--harvest", type=int, default=-1, help="Execute harvest opportunity index"
        )
        parser.add_argument("--forms", action="store_true", help="Generate tax forms")
        parser.add_argument("--continuous", action="store_true", help="Run in continuous mode")
        parser.add_argument("--chains", nargs="+", default=[], help="Chains to scan")
        parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

        args = parser.parse_args()

        # Configure logging
        logging.basicConfig(
            level=logging.DEBUG if args.verbose else logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
        )

        orchestrator = cls(load_config())

        # Connect to database and restore prior state
        await orchestrator.start()

        # Register user (persisted to SQLite)
        await orchestrator.register_user(args.address)

        if args.scan:
            print(f"\n🔍 Scanning {args.address}...\n")
            results = await orchestrator.run_full_pipeline(
                scan_chains=args.chains or None,
            )
            print(json.dumps(results, indent=2, default=str))

        if args.harvest >= 0:
            print(f"\n💰 Executing harvest #{args.harvest}...\n")
            result = await orchestrator.execute_harvest(args.harvest)
            print(json.dumps(result, indent=2, default=str))

        if args.forms:
            print(f"\n📋 Generating tax forms...\n")
            forms = await orchestrator.generate_tax_forms()
            print(json.dumps(forms, indent=2, default=str))

        if args.continuous:
            print(f"\n🔄 Running in continuous mode...\n")
            await orchestrator.run_continuous()

        await orchestrator.cleanup()


async def main():
    """Main entry point."""
    await TaxFiOrchestrator.run_cli()


if __name__ == "__main__":
    asyncio.run(main())
