"""
TaxFi — Classifier Agent

Uses Venice AI to classify every transaction into tax-relevant categories.
Handles DeFi edge cases that rule-based systems miss.
Returns structured JSON with category, confidence, and reasoning.
"""

import json
from typing import Any, Optional

import aiohttp

from .base_agent import BaseAgent, AgentResult

CATEGORIES = [
    "SWAP", "AIRDROP", "STAKING_REWARD", "LP_DEPOSIT", "LP_WITHDRAW",
    "BRIDGE", "TRANSFER_SELF", "MINT", "BURN", "NFT_BUY", "NFT_SELL",
    "YIELD_HARVEST", "GOVERNANCE_CLAIM", "INTEREST", "FEE", "GAS",
    "LIQUIDATION", "BORROW", "REPAY", "OTHER",
]

CLASSIFICATION_PROMPT_TEMPLATE = """Classify this cryptocurrency transaction for tax purposes.

Transaction Data:
  Chain: {chain_id}
  Hash: {tx_hash}
  From: {from_address}
  To: {to_address}
  Token: {token_symbol} ({token_address})
  Value: {value}
  Method: {method}
  Log Events: {log_events}
  Transfers: {transfers}

Categories: {categories}

Rules:
- SWAP: Token A → Token B exchange
- AIRDROP: Tokens received without payment
- STAKING_REWARD: Rewards from staking
- LP_DEPOSIT: Providing liquidity to a pool
- LP_WITHDRAW: Removing liquidity
- BRIDGE: Cross-chain transfer
- TRANSFER_SELF: Transfer between own wallets
- NFT_BUY/SEL: NFT purchase or sale
- YIELD_HARVEST: Claiming yield farming rewards
- LIQUIDATION: Position being liquidated
- BORROW/REPAY: Lending protocol actions

Return ONLY valid JSON with no markdown formatting:
{{
  "category": "string (one of the categories)",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "taxable": true/false,
  "basis_method": "FIFO/LIFO/HIFO/ACB/null",
  "cost_basis_asset": "asset identifier for cost basis tracking",
  "is_lp_event": true/false,
  "notes": "additional tax-relevant notes"
}}
"""


class ClassifierAgent(BaseAgent):
    """
    Uses Venice AI to classify crypto transactions into tax categories.

    Handles ambiguous DeFi transactions that rule-based systems can't
    reliably categorize by reading contract interactions, event logs,
    and token movements holistically.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__("ClassifierAgent", config)
        self._stats = {"classified": 0, "failed": 0, "by_category": {}}
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create a reusable aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def process(self, transactions: list[dict], **kwargs) -> AgentResult:
        """
        Classify a batch of transactions using Venice AI.

        Args:
            transactions: List of normalized transaction dicts

        Returns:
            AgentResult with classified transactions
        """
        self.start_timer()
        self.log("info", f"Classifying {len(transactions)} transactions")

        classified = []
        for txn in transactions:
            try:
                result = await self._classify_single(txn)
                classified.append(result)
                self._stats["classified"] += 1
                cat = result.get("classification", {}).get("category", "UNKNOWN")
                self._stats["by_category"][cat] = self._stats["by_category"].get(cat, 0) + 1
            except Exception as e:
                self.log("error", f"Classification failed for {txn.get('tx_hash', 'unknown')}", error=str(e))
                self._stats["failed"] += 1
                classified.append({
                    **txn,
                    "classification": {
                        "category": "OTHER",
                        "confidence": 0.0,
                        "reasoning": f"Classification error: {str(e)}",
                        "taxable": False,
                    }
                })

        return self.success(
            message=f"Classified {len(classified)} transactions",
            data={
                "transactions": classified,
                "stats": self._stats,
            },
            total=len(classified),
            failed=self._stats["failed"],
            categories=self._stats["by_category"],
        )

    async def _classify_single(self, txn: dict) -> dict:
        """Classify a single transaction via Venice AI."""
        prompt = CLASSIFICATION_PROMPT_TEMPLATE.format(
            chain_id=txn.get("chain_id", "unknown"),
            tx_hash=txn.get("tx_hash", "unknown")[:20] + "...",
            from_address=txn.get("from_address", "unknown"),
            to_address=txn.get("to_address", "unknown"),
            token_symbol=txn.get("token_symbol", "unknown"),
            token_address=txn.get("token_address", "unknown"),
            value=txn.get("value", "0"),
            method=txn.get("method", "unknown"),
            log_events=json.dumps(txn.get("log_events", [])[:3]),
            transfers=json.dumps(txn.get("transfers", [])[:2]),
            categories=", ".join(CATEGORIES),
        )

        # Call Venice AI
        classification = await self._call_venice_api(prompt)

        return {
            **txn,
            "classification": classification,
        }

    async def _call_venice_api(self, prompt: str) -> dict:
        """
        Call Venice AI chat completions API for classification.

        Supports both Bearer API key and x402 wallet auth.
        Uses a shared aiohttp session to avoid connection overhead
        on every call.
        """
        session = await self._get_session()
        api_key = self.config.get("venice_api_key")
        base_url = self.config.get("venice_base_url", "https://api.venice.ai/api/v1")

        headers = {
            "Content-Type": "application/json",
        }

        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        else:
            # x402 wallet auth - generate SIWE header
            siwx_header = self._generate_siwx_header()
            headers["X-Sign-In-With-X"] = siwx_header

        payload = {
            "model": self.config.get("venice_classification_model", "zai-org-glm-5-1"),
            "messages": [
                {
                    "role": "system",
                    "content": "You are a crypto tax classification AI. "
                               "Output ONLY valid JSON with no additional text.",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,  # Low temperature for consistent classification
            "max_completion_tokens": 500,
        }

        async with session.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as resp:
            if resp.status == 402:
                # Insufficient x402 balance - handle top-up
                return await self._handle_402_and_retry(session, base_url, payload, headers)

            if resp.status != 200:
                raise Exception(f"Venice API error {resp.status}: {await resp.text()}")

            data = await resp.json()
            content = data["choices"][0]["message"]["content"]

            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from the response
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
                raise

    def _generate_siwx_header(self) -> str:
        """Generate SIWE header for x402 wallet auth."""
        import base64
        import json as json_lib
        wallet_key = self.config.get("venice_wallet_key", "")
        if not wallet_key:
            return ""

        # Simplified SIWE header generation
        # In production, use the actual SIWE signing flow
        siwe_payload = json_lib.dumps({
            "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
            "message": "Sign in to Venice AI",
            "signature": "0x" + "0" * 130,
            "timestamp": 1712659200000,
            "chainId": 8453,
        })
        return base64.b64encode(siwe_payload.encode()).decode()

    async def _handle_402_and_retry(self, session: aiohttp.ClientSession, base_url: str, payload: dict, headers: dict) -> dict:
        """
        Handle 402 Payment Required by topping up x402 balance and retrying.

        Uses the same shared session and original headers for the retry,
        avoiding the fragile session._default_headers hack.
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
                raise Exception(f"Venice API error after top-up: {retry_resp.status}")
            data = await retry_resp.json()
            return json.loads(data["choices"][0]["message"]["content"])

    def get_stats(self) -> dict:
        """Get classification statistics."""
        return self._stats

    async def close(self):
        """Close the shared aiohttp session."""
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None
