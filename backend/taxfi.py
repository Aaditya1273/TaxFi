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
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

from agents import (
    IngestAgent,
    ClassifierAgent,
    BasisAgent,
    LossDetector,
    FormGenerator,
    ExecutorAgent,
)
from config import TaxFiConfig

logger = logging.getLogger("taxfi")


class TaxFiOrchestrator:
    """
    Main orchestrator for the TaxFi agent pipeline.

    Manages the lifecycle of all agents, handles the pipeline
    execution, and provides a unified API for the frontend.
    """

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self._validate_config()

        # Initialize agents
        self.ingest = IngestAgent(self.config)
        self.classifier = ClassifierAgent(self.config)
        self.basis = BasisAgent(self.config)
        self.loss_detector = LossDetector(self.config)
        self.executor = ExecutorAgent(self.config)
        self.form_generator = FormGenerator(self.config)

        # Pipeline state
        self._pipeline_running = False
        self._last_scan_time: Optional[datetime] = None
        self._user_addresses: list[str] = []
        self._pipeline_results: dict[str, Any] = {}

        self.log("info", "TaxFi orchestrator initialized")

    def _validate_config(self) -> None:
        """Validate required configuration."""
        missing = TaxFiConfig.validate()
        if missing:
            logger.warning(f"Missing config (some features may be limited): {', '.join(missing)}")

    def log(self, level: str, msg: str) -> None:
        getattr(logger, level.lower(), logger.info)(f"[TaxFi] {msg}")

    # --- User Management ---

    async def register_user(
        self,
        address: str,
        permission_context: Optional[dict] = None,
    ) -> dict:
        """
        Register a user with TaxFi.

        Args:
            address: User's wallet address
            permission_context: ERC-7715 permission context for read access

        Returns:
            User registration result
        """
        if address not in self._user_addresses:
            self._user_addresses.append(address)

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

        try:
            # Phase 1: Ingest transactions from all addresses × chains
            self.log("info", f"Phase 1: Ingesting for {len(targets)} addresses")
            all_transactions = []
            for addr in targets:
                ingest_result = await self.ingest.process(
                    address=addr,
                    chains=scan_chains,
                )
                if ingest_result.success and ingest_result.data:
                    all_transactions.extend(
                        ingest_result.data.get("transactions", [])
                    )
            results["ingest"] = {
                "status": "complete",
                "total_txns": len(all_transactions),
                "addresses": targets,
            }
            self.log("info", f"Ingested {len(all_transactions)} total transactions")

            if not all_transactions:
                self.log("warn", "No transactions found")
                results["status"] = "no_data"
                return results

            # Phase 2: Classify all transactions via Venice AI
            self.log("info", f"Phase 2: Classifying {len(all_transactions)} transactions")
            classify_result = await self.classifier.process(all_transactions)
            if not classify_result.success:
                self.log("error", f"Classification failed: {classify_result.error}")
                results["classifier"] = {"status": "failed", "error": classify_result.error}
                return results

            classified_txns = classify_result.data.get("transactions", [])
            results["classifier"] = {
                "status": "complete",
                "classified": classify_result.data.get("stats", {}).get("classified", 0),
                "failed": classify_result.data.get("stats", {}).get("failed", 0),
                "categories": classify_result.data.get("stats", {}).get("by_category", {}),
            }
            self.log("info", f"Classification complete: {results['classifier']['classified']} OK, {results['classifier']['failed']} failed")

            # Phase 3: Update cost basis
            self.log("info", "Phase 3: Updating cost basis")
            basis_result = await self.basis.process(classified_txns)
            results["basis"] = {
                "status": "complete",
                "acquisitions": basis_result.data.get("acquisitions", 0) if basis_result.data else 0,
                "disposals": basis_result.data.get("disposals", 0) if basis_result.data else 0,
                "gain_loss": basis_result.data.get("total_gain_loss", 0) if basis_result.data else 0,
            }
            self.log("info", f"Cost basis updated: {results['basis']['acquisitions']} in, {results['basis']['disposals']} out")

            # Phase 4: Detect harvest opportunities
            self.log("info", "Phase 4: Detecting harvest opportunities")
            basis_summary = self.basis.get_summary() if hasattr(self.basis, 'get_summary') else {}
            detect_result = await self.loss_detector.process(
                cost_basis_data=basis_result.data or {},
            )
            results["loss_detector"] = {
                "status": "complete",
                "opportunities": detect_result.data.get("opportunities", []) if detect_result.data else [],
                "total_savings": detect_result.data.get("portfolio_summary", {}).get("estimated_tax_savings", 0) if detect_result.data else 0,
            }
            self.log("info", f"Found {len(results['loss_detector']['opportunities'])} harvest opportunities")

            results["success"] = True
            self._last_scan_time = datetime.now(timezone.utc)
            results["last_scan"] = self._last_scan_time.isoformat()
            self._pipeline_results = results

        except Exception as e:
            self.log("error", f"Pipeline failed: {e}")
            results["success"] = False
            results["error"] = str(e)
        finally:
            self._pipeline_running = False

        return results

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
        opportunities = (
            self._pipeline_results.get("loss_detector", {})
            .get("opportunities", [])
        )

        if not opportunities or opportunity_index >= len(opportunities):
            return {"success": False, "error": "No harvest opportunities available"}

        opportunity = opportunities[opportunity_index]
        user = user_address or (self._user_addresses[0] if self._user_addresses else "")

        if not user:
            return {"success": False, "error": "No user address"}

        self.log(
            "info",
            f"Executing harvest: {opportunity['quantity']} {opportunity['asset']} "
            f"for {user[:8]}... — estimated savings: ${opportunity['estimated_savings']:.2f}"
        )

        # Build harvest plan
        harvest_plan = {
            "asset": opportunity["asset"],
            "token_address": opportunity.get("address", ""),
            "quantity": opportunity["quantity"],
            "user_address": user,
            "chain_id": opportunity.get("chain", self.config.get("default_chain", "eip155:84532")),
            "permission_context": permission_context,
            "slippage_tolerance": 0.005,  # 0.5%
        }

        # Execute via executor agent
        result = await self.executor.process(harvest_plan)
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

        basis_summary = self.basis.get_summary() if hasattr(self.basis, 'get_summary') else {}

        cost_basis_data = {
            "user_address": self._user_addresses[0] if self._user_addresses else "",
            "ledgers": basis_summary.get("ledgers", {}),
            "harvest_savings": (
                self._pipeline_results.get("loss_detector", {})
                .get("total_savings", 0)
            ),
        }

        result = await self.form_generator.process({
            **cost_basis_data,
            "tax_year": year,
        })

        return result.data if result.data else {"success": False}

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
                "total_savings": self._pipeline_results.get("loss_detector", {}).get("total_savings", 0),
            } if self._pipeline_results else None,
            "cost_basis_method": self.config.get("cost_basis_method", "HIFO"),
            "supported_chains": self.config.get("supported_chains", []),
        }

    def get_opportunities(self) -> list[dict]:
        """Get current harvest opportunities."""
        return (
            self._pipeline_results.get("loss_detector", {})
            .get("opportunities", [])
        )

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
        """Clean up all shared aiohttp sessions across all agents."""
        await self.ingest.close()
        await self.classifier.close()
        await self.loss_detector.close()
        # Close other resources as needed

    # --- CLI Entry Point ---

    @classmethod
    async def run_cli(cls):
        """CLI entry point for running TaxFi."""
        import argparse

        parser = argparse.ArgumentParser(description="TaxFi — Crypto Tax Optimization Agent")
        parser.add_argument("--address", help="Wallet address to scan", required=True)
        parser.add_argument("--scan", action="store_true", help="Run a scan")
        parser.add_argument("--harvest", type=int, default=-1, help="Execute harvest opportunity index")
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

        config = TaxFiConfig.__dict__
        orchestrator = cls(config)

        # Register user
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
