"""
TaxFi — Basis Agent

Tracks cost basis for all assets using the configured method (default: HIFO).
Operates as a standalone cost basis engine with continuous, real-time tracking across chains.
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from backend.integrations.price_oracle import PriceOracle
from .base_agent import BaseAgent, AgentResult


class CostBasisMethod(Enum):
    FIFO = "FIFO"
    LIFO = "LIFO"
    HIFO = "HIFO"
    ACB = "ACB"  # Average Cost Basis
    SPEC_ID = "SPEC_ID"  # Specific Identification


@dataclass
class AcquisitionLot:
    """Represents a single acquisition lot for cost basis tracking."""
    amount: float
    remaining_amount: float
    timestamp: int
    rate: float  # Price in USD at acquisition
    cost_basis: float  # Total cost = amount * rate
    tx_hash: str
    chain_id: str
    asset: str
    lot_id: str  # Unique identifier


@dataclass
class CostBasisLedger:
    """Ledger tracking all cost basis events per asset."""
    asset: str
    method: CostBasisMethod
    lots: list[AcquisitionLot] = field(default_factory=list)
    total_acquired: float = 0.0
    total_sold: float = 0.0
    realized_gain_loss: float = 0.0
    unrealized_gain_loss: float = 0.0


class BasisAgent(BaseAgent):
    """
    Tracks cost basis across all assets.

    Supports FIFO, LIFO, HIFO, Average Cost Basis, and Specific ID methods.
    Operates as a standalone cost basis engine.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__("BasisAgent", config)
        method_str = config.get("cost_basis_method", "HIFO").upper()
        self.method = CostBasisMethod(method_str) if method_str in CostBasisMethod._member_map_ else CostBasisMethod.HIFO
        self.ledgers: dict[str, CostBasisLedger] = {}
        self._lot_counter = 0
        self._price_oracle: Optional[PriceOracle] = None

    def set_price_oracle(self, oracle: PriceOracle) -> None:
        """Set the price oracle for fetching real market prices."""
        self._price_oracle = oracle

    async def process(self, classified_txns: list[dict], **kwargs) -> AgentResult:
        """
        Process classified transactions to update cost basis ledgers.

        Args:
            classified_txns: List of transactions with Venice AI classifications

        Returns:
            AgentResult with updated cost basis data
        """
        self.start_timer()
        self.log("info", f"Processing cost basis for {len(classified_txns)} transactions")

        acquisitions = 0
        disposals = 0
        gain_loss_total = 0.0

        for txn in classified_txns:
            classification = txn.get("classification", {})
            category = classification.get("category", "OTHER")
            taxable = classification.get("taxable", False)

            if category in ("SWAP", "NFT_SELL", "LIQUIDATION"):
                # Disposal event
                result = self._process_disposal(txn)
                disposals += 1
                gain_loss_total += result
            elif category in ("AIRDROP", "STAKING_REWARD", "YIELD_HARVEST", "INTEREST"):
                # Acquisition event at FMV
                await self._process_acquisition(txn, is_income=True)
                acquisitions += 1
            elif category in ("BORROW",):
                # Loan - not taxable, but track
                await self._process_acquisition(txn, is_income=False)
                acquisitions += 1
            elif category in ("TRANSFER_SELF",):
                # Self-transfer - carry cost basis
                self._process_transfer(txn)
            elif category in ("LP_DEPOSIT",):
                # LP deposit - carry basis
                self._process_lp_deposit(txn)
            elif category in ("LP_WITHDRAW",):
                self._process_lp_withdraw(txn)

        return self.success(
            message=f"Updated cost basis: {acquisitions} acquisitions, {disposals} disposals",
            data={
                "acquisitions": acquisitions,
                "disposals": disposals,
                "total_gain_loss": gain_loss_total,
                "ledgers": {k: self._serialize_ledger(v) for k, v in self.ledgers.items()},
                "method": self.method.value,
            },
            acquisitions=acquisitions,
            disposals=disposals,
            gain_loss=gain_loss_total,
        )

    def _get_ledger(self, asset: str) -> CostBasisLedger:
        """Get or create a cost basis ledger for an asset."""
        if asset not in self.ledgers:
            self.ledgers[asset] = CostBasisLedger(
                asset=asset,
                method=self.method,
            )
        return self.ledgers[asset]

    async def _process_acquisition(self, txn: dict, is_income: bool = False) -> AcquisitionLot:
        """Process an acquisition event."""
        token_symbol = txn.get("token_symbol") or txn.get("asset", "UNKNOWN")
        if not token_symbol or token_symbol == "UNKNOWN":
            token_symbol = txn.get("classification", {}).get("cost_basis_asset", "UNKNOWN")

        ledger = self._get_ledger(token_symbol)

        # Use human-readable amount (already normalized by IngestAgent)
        amount = float(txn.get("value", 0) or 0)
        if amount == 0:
            return None  # Skip zero-value acquisitions

        # Prefer USD value from Covalent, fallback to price oracle
        value_usd = float(txn.get("value_usd", 0) or 0)
        if value_usd > 0 and amount > 0:
            rate = value_usd / amount
        else:
            rate = float(txn.get("price_usd", txn.get("classification", {}).get("estimated_price", 0)) or 0)

        if rate == 0 and is_income:
            rate = await self._fetch_price(
                token_symbol,
                txn.get("timestamp", ""),
            )

        self._lot_counter += 1
        lot = AcquisitionLot(
            amount=amount,
            remaining_amount=amount,
            timestamp=self._parse_timestamp(txn.get("timestamp", "")),
            rate=rate,
            cost_basis=amount * rate,
            tx_hash=txn.get("tx_hash", ""),
            chain_id=txn.get("chain_id", ""),
            asset=token_symbol,
            lot_id=f"lot_{self._lot_counter}_{txn.get('tx_hash', '')[:8]}",
        )

        ledger.lots.append(lot)
        ledger.total_acquired += amount

        self.log("debug", f"Acquired {amount} {lot.asset} @ ${rate:.2f} = ${lot.cost_basis:.2f}")
        return lot

    def _process_disposal(self, txn: dict) -> float:
        """
        Process a disposal event, calculating gain/loss.
        Returns the realized gain/loss amount.
        """
        asset = txn.get("token_symbol", "UNKNOWN")
        amount = float(txn.get("value", 0))
        sale_rate = float(txn.get("classification", {}).get("sale_price", 0))
        sale_value = amount * sale_rate

        ledger = self._get_ledger(asset)
        remaining = amount
        total_cost = 0.0

        # Apply cost basis method to select lots
        selected_lots = self._select_lots(ledger, amount)

        for lot in selected_lots:
            used = min(remaining, lot.remaining_amount)
            cost = used * lot.rate
            total_cost += cost
            lot.remaining_amount -= used
            remaining -= used

        realized_gl = sale_value - total_cost
        ledger.realized_gain_loss += realized_gl
        ledger.total_sold += amount

        # Clean up fully consumed lots
        ledger.lots = [l for l in ledger.lots if l.remaining_amount > 0]

        self.log(
            "debug",
            f"Sold {amount} {asset} for ${sale_value:.2f}, "
            f"cost basis ${total_cost:.2f}, "
            f"gain/loss ${realized_gl:.2f}"
        )

        return realized_gl

    def _process_transfer(self, txn: dict) -> None:
        """
        Process a self-transfer: preserve cost basis.
        No taxable event, just update lot tracking.
        """
        from_address = txn.get("from_address", "")
        to_address = txn.get("to_address", "")

        self.log("debug", f"Self-transfer: {from_address[:8]}... → {to_address[:8]}... (no tax event)")

    def _process_lp_deposit(self, txn: dict) -> None:
        """
        Process an LP deposit: carry cost basis to LP token.
        The deposit itself may be taxable (exchanging tokens for LP tokens)
        depending on jurisdiction.
        """
        classification = txn.get("classification", {})
        if classification.get("taxable", True):
            self._process_disposal(txn)
        else:
            self.log("debug", f"LP deposit treated as non-taxable basis carry: {txn.get('tx_hash', '')[:8]}")

    def _process_lp_withdraw(self, txn: dict) -> None:
        """
        Process an LP withdrawal: reverse of deposit.
        """
        classification = txn.get("classification", {})
        if classification.get("taxable", True):
            self._process_disposal(txn)

    def _select_lots(self, ledger: CostBasisLedger, amount: float) -> list[AcquisitionLot]:
        """
        Select acquisition lots based on cost basis method.

        FIFO: Oldest lots first
        LIFO: Newest lots first
        HIFO: Highest rate lots first (tax-optimal)
        ACB: Average cost across all lots
        SPEC_ID: Specific lots (requires user input)
        """
        available = [l for l in ledger.lots if l.remaining_amount > 0]

        if self.method == CostBasisMethod.FIFO:
            available.sort(key=lambda l: l.timestamp)
        elif self.method == CostBasisMethod.LIFO:
            available.sort(key=lambda l: l.timestamp, reverse=True)
        elif self.method == CostBasisMethod.HIFO:
            available.sort(key=lambda l: l.rate, reverse=True)
        elif self.method == CostBasisMethod.SPEC_ID:
            available.sort(key=lambda l: l.lot_id)

        return available

    async def _fetch_price(self, asset: str, timestamp: int | str) -> float:
        """
        Fetch real market price for an asset from the PriceOracle.

        Uses CoinGecko API (no key needed) then Covalent API (key in .env)
        for real-time crypto prices. Raises an error if the price cannot
        be fetched — no fallback to hardcoded values.

        Returns:
            Current price in USD

        Raises:
            RuntimeError: If no PriceOracle is configured or if the price
                         cannot be fetched from any real data source
        """
        if self._price_oracle is None:
            raise RuntimeError(
                f"Cannot fetch price for {asset}: no PriceOracle configured. "
                f"The orchestrator must wire a PriceOracle into BasisAgent."
            )

        ts: int = 0
        if isinstance(timestamp, str):
            from datetime import datetime, timezone
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                ts = int(dt.timestamp())
            except (ValueError, AttributeError):
                ts = 0
        elif isinstance(timestamp, int):
            ts = timestamp

        if ts > 0:
            price = await self._price_oracle.get_historical_price(asset, ts)
        else:
            price = await self._price_oracle.get_price(asset)

        if price <= 0:
            raise RuntimeError(
                f"PriceOracle returned $0.00 for {asset}. "
                f"CoinGecko and Covalent APIs were both unable to resolve this asset."
            )

        return price

    @staticmethod
    def _parse_timestamp(ts: str) -> int:
        """Parse various timestamp formats to Unix timestamp."""
        if isinstance(ts, (int, float)):
            return int(ts)
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return int(dt.timestamp())
        except (ValueError, AttributeError):
            return 0

    @staticmethod
    def _serialize_ledger(ledger: CostBasisLedger) -> dict:
        """Serialize ledger to dict for JSON output."""
        return {
            "asset": ledger.asset,
            "method": ledger.method.value,
            "total_acquired": ledger.total_acquired,
            "total_sold": ledger.total_sold,
            "realized_gain_loss": ledger.realized_gain_loss,
            "lot_count": len(ledger.lots),
            "remaining_lots": [
                {
                    "amount": l.amount,
                    "remaining": l.remaining_amount,
                    "timestamp": l.timestamp,
                    "rate": l.rate,
                    "cost_basis": l.cost_basis,
                    "chain_id": l.chain_id,
                    "lot_id": l.lot_id,
                }
                for l in ledger.lots
            ],
        }

    async def restore_ledger_from_db(
        self,
        asset: str,
        method: str,
        total_acquired: float,
        total_sold: float,
        realized_gain_loss: float,
        lots: list[dict],
    ) -> None:
        """Restore a cost basis ledger from database rows."""
        method_enum = CostBasisMethod(method) if method in CostBasisMethod._member_map_ else CostBasisMethod.HIFO
        ledger = CostBasisLedger(
            asset=asset,
            method=method_enum,
            total_acquired=total_acquired,
            total_sold=total_sold,
            realized_gain_loss=realized_gain_loss,
        )
        for lot_dict in lots:
            lot = AcquisitionLot(
                amount=lot_dict["amount"],
                remaining_amount=lot_dict.get("remaining_amount", lot_dict["amount"]),
                timestamp=lot_dict.get("timestamp", 0),
                rate=lot_dict.get("rate", 0.0),
                cost_basis=lot_dict.get("cost_basis", lot_dict["amount"] * lot_dict.get("rate", 0.0)),
                tx_hash=lot_dict.get("tx_hash", ""),
                chain_id=lot_dict.get("chain_id", ""),
                asset=asset,
                lot_id=lot_dict["lot_id"],
            )
            ledger.lots.append(lot)
            # Update lot counter to avoid ID collisions
            lot_num = int(lot.lot_id.split("_")[1]) if "_" in lot.lot_id else 0
            self._lot_counter = max(self._lot_counter, lot_num)

        self.ledgers[asset] = ledger
        self.log("info", f"Restored ledger for {asset}: {len(lots)} lots, {total_acquired} acquired")

    def get_summary(self) -> dict[str, Any]:
        """Get a summary of all cost basis ledgers."""
        total_gain_loss = sum(l.realized_gain_loss for l in self.ledgers.values())
        total_assets = sum(l.total_acquired for l in self.ledgers.values())

        return {
            "method": self.method.value,
            "assets_tracked": len(self.ledgers),
            "total_acquired": total_assets,
            "total_realized_gl": total_gain_loss,
            "ledgers": {
                k: {
                    "total_acquired": v.total_acquired,
                    "total_sold": v.total_sold,
                    "realized_gl": v.realized_gain_loss,
                    "open_lots": len([l for l in v.lots if l.remaining_amount > 0]),
                }
                for k, v in self.ledgers.items()
            },
        }
