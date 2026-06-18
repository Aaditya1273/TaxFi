"""
TaxFi — Venice AI Integration

Wraps the Venice.ai API for crypto tax classification, optimization,
and plain-English explanations. Supports both Bearer API key and
x402 wallet-based authentication.

TaxFi uses Venice (not OpenAI) for:
- Privacy: tax data never trains public models
- Cost: cheaper for high-volume classification
- Multi-modal: can read CSV screenshots
"""

from __future__ import annotations

import base64
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp

from eth_account import Account
from eth_account.messages import encode_defunct

from backend.utils.retry import circuit_breaker_call, get_circuit_breaker


# Base URLs
VENICE_BASE_URL = "https://api.venice.ai/api/v1"
VENICE_MODELS_URL = f"{VENICE_BASE_URL}/models"
VENICE_CHAT_URL = f"{VENICE_BASE_URL}/chat/completions"
VENICE_X402_BALANCE_URL = f"{VENICE_BASE_URL}/x402/balance"
VENICE_X402_TOPUP_URL = f"{VENICE_BASE_URL}/x402/top-up"
VENICE_X402_TX_URL = f"{VENICE_BASE_URL}/x402/transactions"

# Default model for classification tasks
DEFAULT_CLASSIFICATION_MODEL = "zai-org-glm-5-1"
DEFAULT_ANALYSIS_MODEL = "zai-org-glm-5-1"

# Transaction classification schema (Venice response_format)
CLASSIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {
            "type": "string",
            "enum": [
                "SWAP", "AIRDROP", "STAKING_REWARD", "LP_DEPOSIT",
                "LP_WITHDRAW", "BRIDGE", "TRANSFER_SELF", "MINT",
                "BURN", "NFT_BUY", "NFT_SELL", "YIELD_HARVEST",
                "GOVERNANCE_CLAIM", "INTEREST", "FEE", "GAS",
                "LIQUIDATION", "BORROW", "REPAY", "OTHER"
            ],
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reasoning": {"type": "string"},
        "taxable": {"type": "boolean"},
        "basis_method": {
            "type": "string",
            "enum": ["FIFO", "LIFO", "HIFO", "ACB", None],
        },
        "cost_basis_asset": {"type": "string"},
        "is_lp_event": {"type": "boolean"},
        "estimated_price": {"type": "number"},
        "notes": {"type": "string"},
    },
    "required": ["category", "confidence", "reasoning", "taxable"],
}


@dataclass
class VeniceClient:
    """
    Venice AI API client for TaxFi.

    Handles authentication (Bearer API key or x402 wallet SIWE),
    request retry, and balance tracking.
    """

    api_key: Optional[str] = None
    wallet_key: Optional[str] = None
    base_url: str = VENICE_BASE_URL
    default_model: str = DEFAULT_CLASSIFICATION_MODEL

    _session: Optional[aiohttp.ClientSession] = None
    _balance_usd: float = 0.0
    _last_balance_check: float = 0

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def classify_transaction(self, transaction: dict) -> dict:
        """
        Classify a single transaction using Venice AI.

        Uses structured output (json_schema) to ensure valid classification.
        """
        prompt = self._build_classification_prompt(transaction)
        return await self._chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a crypto tax classification AI. "
                        "Analyze the transaction and output valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "transaction_classification",
                    "strict": True,
                    "schema": CLASSIFICATION_SCHEMA,
                },
            },
            temperature=0.1,
        )

    async def analyze_harvest_opportunity(
        self,
        position: dict,
        tax_context: dict,
    ) -> dict:
        """
        Use Venice AI to analyze a potential tax loss harvest.

        Considers the position, market conditions, and user's tax situation.
        """
        prompt = (
            f"Analyze this crypto position for tax loss harvesting:\n\n"
            f"Position: {position.get('asset')}\n"
            f"Quantity: {position.get('quantity', 0)}\n"
            f"Cost Basis: ${position.get('cost_basis', 0):.2f}/unit\n"
            f"Current Price: ${position.get('current_price', 0):.2f}/unit\n"
            f"Unrealized P&L: ${position.get('unrealized_pl', 0):.2f}\n"
            f"Holding Period: {position.get('holding_days', 0)} days\n\n"
            f"User Tax Situation:\n"
            f"  YTD ST Gains: ${tax_context.get('st_gains', 0):.2f}\n"
            f"  YTD LT Gains: ${tax_context.get('lt_gains', 0):.2f}\n"
            f"  Income Bracket: {tax_context.get('income_bracket', 22)}%\n"
            f"  Carry-Forward Losses: ${tax_context.get('cf_losses', 0):.2f}\n\n"
            f"Recommend: Should the user harvest this loss? "
            f"Consider wash sale rules, optimal amount, and rebuy suggestions."
        )

        return await self._chat_completion(
            messages=[
                {"role": "system", "content": "You are a tax optimization AI."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

    async def explain_tax_event(self, transaction: dict, classification: dict) -> str:
        """
        Generate a plain-English explanation of why a transaction is taxable.

        Users shouldn't need a CPA to understand their tax obligations.
        """
        prompt = (
            f"Explain in 2 sentences why this crypto transaction is taxable:\n\n"
            f"Transaction: {transaction.get('method', 'unknown')}\n"
            f"Asset: {transaction.get('token_symbol', 'unknown')}\n"
            f"Value: {transaction.get('value', '0')}\n"
            f"Category: {classification.get('category', 'UNKNOWN')}\n\n"
            f"Reference the relevant IRS rule and how it affects the user's tax."
        )

        result = await self._chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You explain crypto tax concepts in plain English.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=200,
        )

        if isinstance(result, dict):
            return result.get("explanation", str(result))
        return str(result)

    async def _chat_completion(
        self,
        messages: list[dict],
        response_format: Optional[dict] = None,
        temperature: float = 0.1,
        max_tokens: int = 1000,
        retry_on_402: bool = True,
    ) -> Any:
        """
        Call Venice AI chat completions endpoint with automatic auth fallback.

        Auth strategies tried in order:
        1. Bearer API key (VENICE_API_KEY)
        2. x402 wallet SIWE signature (VENICE_WALLET_KEY / X402_WALLET_KEY)

        If all auth methods fail, the error propagates to the caller.
        No fallback classification — every classification is based on real
        AI inference.
        """
        return await circuit_breaker_call(
            "venice_ai",
            "venice_chat_completion",
            lambda: self._do_chat_completion(
                messages, response_format, temperature, max_tokens, retry_on_402
            ),
            max_retries=3,
            base_delay=1.0,
        )

    async def _do_chat_completion(
        self,
        messages: list[dict],
        response_format: Optional[dict] = None,
        temperature: float = 0.1,
        max_tokens: int = 1000,
        retry_on_402: bool = True,
    ) -> Any:
        """
        Call the Venice AI API using configured credentials.

        Tries Bearer API key first, then x402 wallet (SIWE signature).
        No fallback classification — if all auth methods fail, the error
        propagates up so the caller knows the classification failed.
        """
        session = await self.get_session()

        # Build ordered list of auth methods to try
        auth_methods = []
        if self.api_key:
            auth_methods.append("bearer")
        if self.wallet_key:
            auth_methods.append("x402")

        if not auth_methods:
            raise RuntimeError(
                "No Venice AI credentials configured. Set VENICE_API_KEY "
                "or VENICE_WALLET_KEY in your .env file."
            )

        last_error: Exception | None = None
        for auth_type in auth_methods:
            try:
                return await self._try_auth(
                    session, auth_type, messages, response_format,
                    temperature, max_tokens, retry_on_402
                )
            except Exception as e:
                last_error = e
                err_str = str(e)
                # Auth/payment errors — try next method
                if "401" in err_str or "402" in err_str:
                    self._log("warn", f"{auth_type} auth failed ({err_str[:80]}), trying next method")
                    continue
                # Unexpected error — don't swallow
                raise

        # All auth methods failed — propagate the last error
        raise RuntimeError(
            f"All Venice AI authentication methods failed. Last error: {last_error}"
        ) from last_error

    async def _try_auth(
        self,
        session: aiohttp.ClientSession,
        auth_type: str,
        messages: list[dict],
        response_format: Optional[dict] = None,
        temperature: float = 0.1,
        max_tokens: int = 1000,
        retry_on_402: bool = True,
    ) -> Any:
        """Try a single auth method against Venice AI."""
        headers = {"Content-Type": "application/json"}

        if auth_type == "bearer" and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif auth_type == "x402" and self.wallet_key:
            siwx = await self._generate_siwx_header()
            if siwx:
                headers["X-Sign-In-With-X"] = siwx

        payload = {
            "model": self.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        try:
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as resp:
                if resp.status == 402 and retry_on_402:
                    await self._handle_402(resp)
                    # Retry with updated headers after top-up
                    return await self._try_auth(
                        session, auth_type, messages, response_format,
                        temperature, max_tokens, False
                    )

                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"Venice API error {resp.status}: {error_text}")

                data = await resp.json()
                content = data["choices"][0]["message"]["content"]

                if response_format:
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        pass

                return content

        except aiohttp.ClientError as e:
            raise Exception(f"Venice API request failed: {e}")

    async def check_balance(self) -> dict:
        """Check x402 wallet balance."""
        if not self.wallet_key:
            return {"balance": 0, "error": "No wallet configured"}

        # Cache balance check for 30 seconds
        if time.time() - self._last_balance_check < 30:
            return {"balance": self._balance_usd}

        session = await self.get_session()
        wallet_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"

        siwx = await self._generate_siwx_header()
        if not siwx:
            return {"balance": 0, "error": "No SIWE header"}

        try:
            async with session.get(
                f"{VENICE_X402_BALANCE_URL}/{wallet_address}",
                headers={"X-Sign-In-With-X": siwx},
            ) as resp:
                if resp.status == 402:
                    return {"balance": 0, "needs_topup": True}
                if resp.status != 200:
                    return {"balance": self._balance_usd, "error": f"Status {resp.status}"}

                data = await resp.json()
                self._balance_usd = data.get("data", {}).get("balanceUsd", 0)
                self._last_balance_check = time.time()
                return {"balance": self._balance_usd}

        except Exception as e:
            return {"balance": self._balance_usd, "error": str(e)}

    async def top_up(self, amount_usd: float = 10.0) -> dict:
        """
        Top up x402 wallet with USDC on Base chain.
        """
        session = await self.get_session()

        # Step 1: Discover payment requirements
        async with session.post(f"{VENICE_X402_TOPUP_URL}") as resp:
            if resp.status == 402:
                instructions = await resp.json()
                self._log("info", f"Top-up required: ${amount_usd} USDC")

                # Step 2: Settle with signed USDC transfer
                # In production: use x402 SDK's createPaymentHeader
                return {
                    "success": True,
                    "amount": amount_usd,
                    "instructions": instructions,
                    "note": "Use x402 SDK to complete the signed transfer",
                }

        return {"success": False, "error": "Top-up not available"}

    def _build_classification_prompt(self, txn: dict) -> str:
        """Build a classification prompt from transaction data."""
        return (
            f"Classify this crypto transaction:\n"
            f"  Chain: {txn.get('chain_id', 'unknown')}\n"
            f"  From: {txn.get('from_address', 'unk')[:10]}...\n"
            f"  To: {txn.get('to_address', 'unk')[:10]}...\n"
            f"  Token: {txn.get('token_symbol', 'unknown')}\n"
            f"  Value: {txn.get('value', '0')}\n"
            f"  Method: {txn.get('method', 'unknown')}\n"
            f"  Transfers: {json.dumps(txn.get('transfers', [])[:2])}"
        )

    async def _generate_siwx_header(self) -> Optional[str]:
        """
        Generate a SIWE header for x402 wallet authentication.

        Builds the SIWE message using eth_account and signs it properly.
        Raises an error if signing fails — no dev fallback signature.
        """
        if not self.wallet_key:
            return None

        wallet = Account.from_key(self.wallet_key)
        now = datetime.now(timezone.utc)
        nonce = secrets.token_hex(16)

        # Manually construct SIWE message (standard EIP-4361 format)
        message_lines = [
            f"api.venice.ai wants you to sign in with your Ethereum account:",
            wallet.address,
            "",
            "Sign in to Venice AI",
            "",
            f"URI: https://api.venice.ai/api/v1/chat/completions",
            f"Version: 1",
            f"Chain ID: 8453",
            f"Nonce: {nonce}",
            f"Issued At: {now.isoformat()}",
        ]
        message_str = "\n".join(message_lines)

        # Sign using eth_account message signing
        message_hash = encode_defunct(text=message_str)
        signed = Account.sign_message(message_hash, self.wallet_key)
        signature = signed.signature.hex()

        header_payload = json.dumps({
            "address": wallet.address,
            "message": message_str,
            "signature": "0x" + signature,
            "timestamp": int(time.time() * 1000),
            "chainId": 8453,
        })
        return base64.b64encode(header_payload.encode()).decode()

    async def _handle_402(self, response: aiohttp.ClientResponse) -> None:
        """Handle 402 Payment Required by topping up."""
        import base64

        # Check for PAYMENT-REQUIRED header
        payment_header = response.headers.get("PAYMENT-REQUIRED")
        if payment_header:
            try:
                payment_req = json.loads(
                    base64.b64decode(payment_header).decode()
                )
                self._log("info", f"x402 v2 payment required: {payment_req}")
            except Exception:
                pass

        body = await response.json()
        min_topup = body.get("minimumTopUpUsd", 5)
        suggested = body.get("suggestedTopUpUsd", 10)

        self._log("info", f"Topping up ${suggested} USDC (min: ${min_topup})")
        await self.top_up(suggested)

    def _log(self, level: str, msg: str) -> None:
        """Simple logging."""
        print(f"[Venice] {level.upper()}: {msg}")

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
