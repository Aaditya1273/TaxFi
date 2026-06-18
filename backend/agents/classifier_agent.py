"""
TaxFi — Classifier Agent

Uses Venice AI to classify every transaction into tax-relevant categories.
Handles DeFi edge cases that rule-based systems miss.
Returns structured JSON with category, confidence, and reasoning.
"""

import json
from typing import Any, Optional

import aiohttp

from .base_agent import AgentResult, BaseAgent

CATEGORIES = [
    "SWAP",
    "AIRDROP",
    "STAKING_REWARD",
    "LP_DEPOSIT",
    "LP_WITHDRAW",
    "BRIDGE",
    "TRANSFER_SELF",
    "MINT",
    "BURN",
    "NFT_BUY",
    "NFT_SELL",
    "YIELD_HARVEST",
    "GOVERNANCE_CLAIM",
    "INTEREST",
    "FEE",
    "GAS",
    "LIQUIDATION",
    "BORROW",
    "REPAY",
    "OTHER",
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

        # Reset per-run stats so responses are run-scoped, not process-lifetime cumulative.
        self._stats = {"classified": 0, "failed": 0, "by_category": {}}

        classified = []
        for txn in transactions:
            try:
                result = await self._classify_single(txn)
                classified.append(result)
                self._stats["classified"] += 1
                cat = result.get("classification", {}).get("category", "UNKNOWN")
                self._stats["by_category"][cat] = self._stats["by_category"].get(cat, 0) + 1
            except Exception as e:
                self.log(
                    "error",
                    f"Classification failed for {txn.get('tx_hash', 'unknown')}",
                    error=str(e),
                )
                self._stats["failed"] += 1
                classified.append(
                    {
                        **txn,
                        "classification": {
                            "category": "OTHER",
                            "confidence": 0.0,
                            "reasoning": f"Classification error: {str(e)}",
                            "taxable": False,
                        },
                    }
                )

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

        If VENICE_API_KEY is not set or returns auth errors, falls back to
        rule-based classification so the pipeline still produces useful output.
        """
        api_key = self.config.get("venice_api_key")
        base_url = self.config.get("venice_base_url", "https://api.venice.ai/api/v1")

        if not api_key:
            return self._rule_based_classify(prompt)

        session = await self._get_session()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        payload = {
            "model": self.config.get("venice_classification_model", "zai-org-glm-4.7"),
            "messages": [
                {
                    "role": "system",
                    "content": "You are a crypto tax classification AI. "
                    "Output ONLY valid JSON with no additional text.",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_completion_tokens": 500,
        }

        try:
            async with session.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 401:
                    self.log("warning", "Venice API key invalid/read-only — using rule-based fallback")
                    return self._rule_based_classify(prompt)
                if resp.status != 200:
                    error_text = await resp.text()
                    self.log("warning", f"Venice API error {resp.status} — using rule-based fallback")
                    return self._rule_based_classify(prompt)

                data = await resp.json()
                content = data["choices"][0]["message"]["content"]

                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    import re
                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group())
                    return self._rule_based_classify(prompt)
        except Exception as e:
            self.log("warning", f"Venice API call failed ({e}) — using rule-based fallback")
            return self._rule_based_classify(prompt)

    def _rule_based_classify(self, prompt: str) -> dict:
        """
        Rule-based transaction classifier used when Venice AI is unavailable.
        Classifies based on keywords in the prompt (method name, token symbols, etc.).
        Good enough for most on-chain transfers, swaps, and staking events.
        """
        prompt_lower = prompt.lower()

        # Determine category based on common patterns
        category = "OTHER"
        taxable = True
        confidence = 0.7

        if any(k in prompt_lower for k in ["swap", "exchange", "uniswap", "sushiswap", "curve", "0x7ff36ab5"]):
            category = "SWAP"
        elif any(k in prompt_lower for k in ["airdrop", "claim", "distribute"]):
            category = "AIRDROP"
        elif any(k in prompt_lower for k in ["stake", "staking", "reward", "yield"]):
            category = "STAKING_REWARD"
        elif any(k in prompt_lower for k in ["addliquidity", "mint lp", "lp deposit"]):
            category = "LP_DEPOSIT"
        elif any(k in prompt_lower for k in ["removeliquidity", "burn lp", "lp withdraw"]):
            category = "LP_WITHDRAW"
        elif any(k in prompt_lower for k in ["bridge", "l2", "optimism", "arbitrum deposit"]):
            category = "BRIDGE"
        elif any(k in prompt_lower for k in ["transfer_self", "self transfer", "own wallet"]):
            category = "TRANSFER_SELF"
            taxable = False
        elif any(k in prompt_lower for k in ["nft", "erc721", "erc1155", "opensea", "buy nft"]):
            category = "NFT_BUY"
        elif any(k in prompt_lower for k in ["sell nft", "list nft"]):
            category = "NFT_SELL"
        elif any(k in prompt_lower for k in ["harvest", "collect", "claim reward"]):
            category = "YIELD_HARVEST"
        elif any(k in prompt_lower for k in ["transfer", "send", "receive"]):
            # Simple transfer — taxable only if sold/exchanged
            category = "OTHER"
            taxable = False
            confidence = 0.5

        return {
            "category": category,
            "confidence": confidence,
            "reasoning": f"Rule-based classification (Venice AI unavailable)",
            "taxable": taxable,
            "basis_method": "HIFO",
            "cost_basis_asset": "ETH",
            "is_lp_event": category in ("LP_DEPOSIT", "LP_WITHDRAW"),
            "notes": "Classified without AI — set VENICE_API_KEY with inference credits for accurate classification.",
        }

    def get_stats(self) -> dict:
        """Get classification statistics."""
        return self._stats

    async def close(self):
        """Close the shared aiohttp session."""
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None
