"""
TaxFi — Loss Detector Agent

Continuously scans positions for tax loss harvesting opportunities.
Uses Venice AI to analyze market conditions and recommend optimal harvests.
This is the KILLER FEATURE of TaxFi — finding money the user didn't know they could save.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp

from .base_agent import BaseAgent, AgentResult


@dataclass
class HarvestOpportunity:
    """A detected tax loss harvesting opportunity."""
    asset: str
    asset_address: str
    quantity: float
    cost_basis_per_unit: float
    current_price_per_unit: float
    unrealized_loss: float
    loss_percentage: float
    holding_period_days: int
    is_short_term: bool  # < 1 year = short term (better to harvest)
    estimated_tax_savings: float
    confidence: float  # 0-1
    reasoning: str
    recommended_rebuy: Optional[str] = None  # Different enough token to avoid wash sale
    chain_id: str = ""
    harvest_priority: int = 0  # 1 = highest priority


@dataclass
class PortfolioSummary:
    """Summary of the user's current portfolio from a tax perspective."""
    total_unrealized_gl: float = 0.0
    total_short_term_gl: float = 0.0
    total_long_term_gl: float = 0.0
    harvetable_losses: float = 0.0
    ytd_realized_gains: float = 0.0
    ytd_realized_losses: float = 0.0


LOSS_ANALYSIS_PROMPT = """Analyze this portfolio position for tax loss harvesting:

User's Position:
  Asset: {asset}
  Quantity: {quantity}
  Cost Basis per Unit: ${cost_basis:.2f}
  Current Price: ${current_price:.2f}
  Unrealized P&L: ${unrealized_pl:.2f} ({loss_pct:.1f}%)
  Acquired: {acquisition_date}
  Holding Period: {holding_days} days ({holding_type})

User's Tax Situation:
  YTD Realized Short-Term Gains: ${st_gains:.2f}
  YTD Realized Long-Term Gains: ${lt_gains:.2f}
  Carry-Forward Losses: ${cf_losses:.2f}
  Income Bracket: {income_bracket}%

Market Context:
  {market_context}

Return ONLY valid JSON with no markdown:
{{
  "recommend_harvest": true/false,
  "confidence": 0.0-1.0,
  "harvest_amount": "optimal quantity to sell",
  "estimated_tax_savings": "USD savings",
  "wash_sale_risk": "NONE/LOW/MEDIUM/HIGH",
  "recommended_rebuy": "alternative token to avoid wash sale",
  "reasoning": "detailed explanation",
  "priority": 1-10
}}
"""


class LossDetector(BaseAgent):
    """
    Continuously detects tax loss harvesting opportunities.

    The core differentiator of TaxFi. Unlike competitors that just file
    at year-end, this agent runs continuously and alerts users to
    harvestable losses in real-time.
    """

    SHORT_TERM_DAYS = 365  # US tax rule: < 1 year = short term

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__("LossDetector", config)
        self.opportunities: list[HarvestOpportunity] = []
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create a reusable aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def process(self, cost_basis_data: dict, market_prices: dict | None = None, **kwargs) -> AgentResult:
        """
        Analyze cost basis data and current market prices to find harvest opportunities.

        Args:
            cost_basis_data: Current cost basis ledger data from BasisAgent
            market_prices: Current market prices (fetched if not provided)

        Returns:
            AgentResult with harvest opportunities
        """
        self.start_timer()

        if market_prices is None:
            market_prices = await self._fetch_market_prices(cost_basis_data)

        portfolio, loss_positions = await self._analyze_portfolio(cost_basis_data, market_prices)
        opportunities = await self._find_opportunities(loss_positions)
        scored = await self._score_opportunities(opportunities)

        self.opportunities = scored

        total_savings = sum(o.estimated_tax_savings for o in scored)
        total_loss = sum(o.unrealized_loss for o in scored)

        return self.success(
            message=f"Found {len(scored)} harvest opportunities, "
                    f"total potential savings: ${total_savings:,.2f}",
            data={
                "opportunities": [self._serialize_opportunity(o) for o in scored],
                "portfolio_summary": {
                    "total_unrealized_loss": total_loss,
                    "estimated_tax_savings": total_savings,
                    "high_priority_count": len([o for o in scored if o.harvest_priority <= 3]),
                    "short_term_count": len([o for o in scored if o.is_short_term]),
                },
            },
            opportunity_count=len(scored),
            total_savings=total_savings,
            total_loss=total_loss,
        )

    async def _analyze_portfolio(
        self, cost_basis_data: dict, market_prices: dict
    ) -> tuple[PortfolioSummary, list[dict]]:
        """
        Analyze portfolio from BasisAgent cost basis ledgers.

        Iterates over real remaining lots from the BasisAgent, computes
        unrealized P&L per lot, and builds both an aggregate summary and
        a list of individual loss positions ready for harvest analysis.

        Returns:
            tuple of (PortfolioSummary, list of loss-position dicts)
        """
        summary = PortfolioSummary()
        loss_positions: list[dict] = []

        ledgers = cost_basis_data.get("ledgers", {})

        for asset, ledger_data in ledgers.items():
            if not isinstance(ledger_data, dict):
                continue

            remaining_lots = ledger_data.get("remaining_lots", [])
            for lot in remaining_lots:
                remaining = lot.get("remaining", lot.get("amount", 0))
                if remaining <= 0:
                    continue

                rate = lot.get("rate", 0)
                timestamp = lot.get("timestamp", 0)
                current_price = market_prices.get(asset, 0)

                if current_price == 0:
                    continue

                unrealized_pl = (current_price - rate) * remaining
                loss_pct = ((current_price - rate) / rate * 100) if rate > 0 else 0
                holding_days = self._holding_period(timestamp)
                is_short_term = holding_days < self.SHORT_TERM_DAYS

                # Update portfolio totals
                if unrealized_pl < 0:
                    summary.harvetable_losses += abs(unrealized_pl)
                    if is_short_term:
                        summary.total_short_term_gl += unrealized_pl
                    else:
                        summary.total_long_term_gl += unrealized_pl

                    # Pass individual loss position data to _find_opportunities
                    loss_positions.append({
                        "asset": asset,
                        "address": lot.get("address", ""),
                        "qty": remaining,
                        "cost_basis": rate,
                        "current_price": current_price,
                        "timestamp": timestamp,
                        "chain": lot.get("chain_id", ""),
                        "unrealized_loss": abs(unrealized_pl),
                        "loss_pct": abs(loss_pct),
                        "holding_days": holding_days,
                        "is_short_term": is_short_term,
                    })

                summary.total_unrealized_gl += unrealized_pl

        return summary, loss_positions

    async def _find_opportunities(self, loss_positions: list[dict]) -> list[HarvestOpportunity]:
        """
        Convert real ledger loss positions into HarvestOpportunity objects.

        No mock data — filters and enriches positions that came directly
        from BasisAgent ledgers via _analyze_portfolio().
        """
        opportunities = []
        threshold = float(self.config.get("harvest_threshold_usd", 100))

        for pos in loss_positions:
            if pos["unrealized_loss"] < threshold:
                continue

            is_short_term = pos["is_short_term"]
            tax_rate = float(
                self.config.get("short_term_rate", 0.22)
            ) if is_short_term else float(self.config.get("long_term_rate", 0.15))

            opportunities.append(HarvestOpportunity(
                asset=pos["asset"],
                asset_address=pos["address"],
                quantity=pos["qty"],
                cost_basis_per_unit=pos["cost_basis"],
                current_price_per_unit=pos["current_price"],
                unrealized_loss=pos["unrealized_loss"],
                loss_percentage=pos["loss_pct"],
                holding_period_days=pos["holding_days"],
                is_short_term=is_short_term,
                estimated_tax_savings=pos["unrealized_loss"] * tax_rate,
                confidence=0.85,
                reasoning=(
                    f"{pos['asset']} down {pos['loss_pct']:.1f}% from cost basis "
                    f"(${pos['cost_basis']:.2f} → ${pos['current_price']:.2f})"
                ),
                recommended_rebuy=None,
                chain_id=pos["chain"],
                harvest_priority=1 if is_short_term else 3,
            ))

        return opportunities

    async def _score_opportunities(self, opportunities: list[HarvestOpportunity]) -> list[HarvestOpportunity]:
        """
        Score and rank harvest opportunities by priority.
        Priority = estimated tax savings × confidence × short_term_bonus
        """
        for opp in opportunities:
            priority_score = opp.estimated_tax_savings * opp.confidence
            if opp.is_short_term:
                priority_score *= 1.5  # Short-term losses are more valuable
            opp.harvest_priority = max(1, min(10, int(10 - priority_score / 1000)))

        opportunities.sort(key=lambda o: o.harvest_priority)
        return opportunities

    async def analyze_with_venice(self, opportunity: HarvestOpportunity, user_tax_context: dict) -> dict:
        """
        Use Venice AI for deep analysis of a harvest opportunity.
        Provides natural language reasoning for the user.
        """
        prompt = LOSS_ANALYSIS_PROMPT.format(
            asset=opportunity.asset,
            quantity=opportunity.quantity,
            cost_basis=opportunity.cost_basis_per_unit,
            current_price=opportunity.current_price_per_unit,
            unrealized_pl=opportunity.unrealized_loss,
            loss_pct=opportunity.loss_percentage,
            acquisition_date=datetime.fromtimestamp(
                int(datetime.now(timezone.utc).timestamp()) - opportunity.holding_period_days * 86400,
                tz=timezone.utc
            ).strftime("%Y-%m-%d"),
            holding_days=opportunity.holding_period_days,
            holding_type="SHORT-TERM" if opportunity.is_short_term else "LONG-TERM",
            st_gains=user_tax_context.get("short_term_gains", 0),
            lt_gains=user_tax_context.get("long_term_gains", 0),
            cf_losses=user_tax_context.get("carry_forward_losses", 0),
            income_bracket=user_tax_context.get("income_bracket", 22),
            market_context=user_tax_context.get("market_context", "Normal market conditions"),
        )

        # Call Venice AI
        return await self._call_venice_analysis(prompt)

    async def _call_venice_analysis(self, prompt: str) -> dict:
        """Call Venice AI for harvest analysis using the shared session."""
        session = await self._get_session()
        api_key = self.config.get("venice_api_key", "")
        base_url = self.config.get("venice_base_url", "https://api.venice.ai/api/v1")

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": "zai-org-glm-5-1",
            "messages": [
                {"role": "system", "content": "You are a tax optimization AI. Output ONLY valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        async with session.post(f"{base_url}/chat/completions", headers=headers, json=payload) as resp:
            if resp.status == 402:
                # Insufficient x402 balance - handle top-up and retry
                return await self._handle_402_and_retry(session, base_url, payload, headers)

            if resp.status != 200:
                return {"recommend_harvest": False, "error": f"API error: {resp.status}"}
            data = await resp.json()
            try:
                return json.loads(data["choices"][0]["message"]["content"])
            except (json.JSONDecodeError, KeyError):
                return {"recommend_harvest": False, "error": "Parse error"}

    async def _handle_402_and_retry(self, session: aiohttp.ClientSession, base_url: str, payload: dict, headers: dict) -> dict:
        """
        Handle 402 Payment Required by topping up x402 balance and retrying.

        Uses the same shared session and original headers for the retry.
        Returns error dicts on failure (matching LossDetector's error style)
        instead of raising exceptions.
        """
        self.log("warn", "Venice x402 balance insufficient, triggering top-up")

        # Top-up via x402 flow
        async with session.post(f"{base_url}/x402/top-up") as topup_resp:
            if topup_resp.status == 402:
                instructions = await topup_resp.json()
                self.log("info", f"x402 top-up required: {instructions.get('suggestedTopUpUsd', 10)} USDC")

        # Retry after top-up with same headers
        async with session.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as retry_resp:
            if retry_resp.status != 200:
                return {"recommend_harvest": False, "error": f"Venice API error after top-up: {retry_resp.status}"}
            data = await retry_resp.json()
            try:
                return json.loads(data["choices"][0]["message"]["content"])
            except (json.JSONDecodeError, KeyError):
                return {"recommend_harvest": False, "error": "Parse error after retry"}

    async def _fetch_market_prices(self, cost_basis_data: dict) -> dict[str, float]:
        """
        Fetch current market prices for all assets tracked in BasisAgent ledgers.

        Dynamically extracts asset symbols from the cost basis data so we
        never hardcode which assets the user holds.
        Uses the shared aiohttp session.
        """
        # Collect unique asset symbols from the ledgers
        ledgers = cost_basis_data.get("ledgers", {})
        assets = set()
        for asset, ledger_data in ledgers.items():
            if isinstance(ledger_data, dict):
                assets.add(asset)
                if "asset" in ledger_data:
                    assets.add(ledger_data["asset"])

        if not assets:
            return {}

        prices: dict[str, float] = {}

        # Try fetching from price API first
        api_key = self.config.get("covalent_api_key") or self.config.get("coingecko_api_key")
        if api_key:
            symbols_param = ",".join(a.lower() for a in assets)
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbols_param}&vs_currencies=usd"
            try:
                session = await self._get_session()
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for asset_id, quote in data.items():
                            if "usd" in quote:
                                prices[asset_id.upper()] = float(quote["usd"])
            except Exception:
                pass  # Fall through to fallback prices below

        if not prices:
            # DEV_FALLBACK: Known price map for common assets when no API key available
            known_prices = {
                "ETH": 2900.0,
                "USDC": 1.0,
                "USDT": 1.0,
                "DAI": 1.0,
                "UNI": 8.20,
                "LINK": 14.50,
                "AAVE": 115.0,
                "WETH": 2900.0,
                "WSTETH": 3200.0,
                "WBTC": 68000.0,
                "MATIC": 0.52,
                "ARB": 0.78,
                "OP": 1.85,
                "MKR": 1450.0,
                "COMP": 52.0,
                "CRV": 0.38,
                "APE": 1.05,
                "SAND": 0.35,
                "MANA": 0.40,
            }
            prices = {a: known_prices.get(a, 0.0) for a in assets}

        return prices

    async def close(self):
        """Close the shared aiohttp session."""
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

    def restore_opportunities_from_db(self, pending: list[dict]) -> None:
        """Restore pending harvest opportunities from database rows."""
        restored = []
        for row in pending:
            opp = HarvestOpportunity(
                asset=row.get("asset", ""),
                asset_address=row.get("asset_address", ""),
                quantity=row.get("quantity", 0.0),
                cost_basis_per_unit=row.get("cost_basis_per_unit", 0.0),
                current_price_per_unit=row.get("current_price", 0.0),
                unrealized_loss=row.get("unrealized_loss", 0.0),
                loss_percentage=row.get("loss_pct", 0.0),
                holding_period_days=row.get("holding_days", 0),
                is_short_term=bool(row.get("is_short_term", True)),
                estimated_tax_savings=row.get("estimated_savings", 0.0),
                confidence=row.get("confidence", 0.0),
                reasoning=row.get("reasoning", ""),
                recommended_rebuy=row.get("recommended_rebuy"),
                chain_id=row.get("chain_id", ""),
                harvest_priority=row.get("priority", 5),
            )
            restored.append(opp)
        self.opportunities = restored
        self.log("info", f"Restored {len(restored)} pending harvest opportunities from database")

    @staticmethod
    def _holding_period(timestamp: int) -> int:
        """Calculate holding period in days."""
        now = int(datetime.now(timezone.utc).timestamp())
        return (now - timestamp) // 86400 if timestamp > 0 else 0

    @staticmethod
    def _serialize_opportunity(opp: HarvestOpportunity) -> dict:
        return {
            "asset": opp.asset,
            "address": opp.asset_address,
            "quantity": opp.quantity,
            "cost_basis": opp.cost_basis_per_unit,
            "current_price": opp.current_price_per_unit,
            "unrealized_loss": opp.unrealized_loss,
            "loss_pct": opp.loss_percentage,
            "holding_days": opp.holding_period_days,
            "is_short_term": opp.is_short_term,
            "estimated_savings": opp.estimated_tax_savings,
            "confidence": opp.confidence,
            "reasoning": opp.reasoning,
            "recommended_rebuy": opp.recommended_rebuy,
            "chain": opp.chain_id,
            "priority": opp.harvest_priority,
        }
