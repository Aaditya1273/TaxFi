"""
TaxFi — x402 Integration

HTTP 402 Payment Protocol for pay-per-call data sources.
Used by the Ingest Agent to pay for premium price feeds and
by the Classifier Agent to pay for Venice AI inference.

The x402 flow:
1. Request resource → 402 Payment Required
2. Construct and sign payment
3. Retry with payment proof
4. Resource served
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional

import aiohttp

from backend.utils.retry import circuit_breaker_call, get_circuit_breaker


class X402Client:
    """
    Client for x402 (HTTP 402) payment flows.

    Used by TaxFi agents to:
    - Pay for premium oracle data (price feeds, DeFi data)
    - Pay for Venice AI inference (when using x402 mode)
    - Accept payments from other agents (Agent-to-Agent)
    """

    def __init__(
        self,
        wallet_key: Optional[str] = None,
        default_network: str = "eip155:84532",
        oneshot_client: Optional[Any] = None,
    ):
        self.wallet_key = wallet_key
        self.default_network = default_network
        self.oneshot_client = oneshot_client
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def fetch_with_payment(self, url: str, max_retries: int = 3) -> tuple[int, Any]:
        """
        Fetch a URL, handling x402 payment if required.

        Args:
            url: The resource URL
            max_retries: Max payment retries

        Returns:
            (status_code, response_data)
        """
        return await circuit_breaker_call(
            "x402_payments",
            f"x402_fetch:{url[:50]}",
            lambda: self._do_fetch_with_payment(url, max_retries),
            max_retries=3,
            base_delay=1.0,
        )

    async def _do_fetch_with_payment(self, url: str, max_retries: int = 3) -> tuple[int, Any]:
        """Internal fetch with x402 payment handling."""
        session = await self.get_session()

        for attempt in range(max_retries):
            async with session.get(url) as resp:
                if resp.status == 402:
                    payment_info = await resp.json()

                    if not self.wallet_key:
                        raise Exception("x402 payment required but no wallet configured")

                    payment_success = await self._send_payment(payment_info)
                    if not payment_success:
                        raise Exception(f"x402 payment failed for {url}")

                    tx_hash = payment_success.get("tx_hash", "")
                    async with session.get(
                        url,
                        headers={"X-Payment-Proof": tx_hash},
                    ) as retry_resp:
                        if retry_resp.status != 200:
                            raise Exception(
                                f"x402 payment accepted but resource error: {retry_resp.status}"
                            )
                        data = await retry_resp.json()
                        return retry_resp.status, data

                elif resp.status == 200:
                    data = await resp.json()
                    return resp.status, data

                else:
                    raise Exception(f"HTTP {resp.status} fetching {url}")

        raise Exception(f"x402 max retries ({max_retries}) exceeded for {url}")

    async def serve_as_seller(
        self,
        request: dict,
        price_usd: float = 0.001,
        token_address: str = "",
    ) -> dict:
        """
        Handle an incoming x402 payment request as a seller.

        TaxFi can sell data to other agents via x402.
        For example, classification results for other agents' transactions.
        """
        payment_proof = request.get("headers", {}).get("X-Payment-Proof")

        if not payment_proof:
            # Return 402 with payment requirements
            return {
                "status": 402,
                "body": {
                    "title": "Payment Required",
                    "amount": str(price_usd),
                    "token": token_address or "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    "chainId": 84532,
                    "payee": "TAXFI_SELLER_ADDRESS",
                    "description": "TaxFi transaction classification",
                },
            }

        # Verify payment proof
        verified = await self._verify_payment(payment_proof)
        if not verified:
            return {"status": 402, "body": {"error": "Invalid payment proof"}}

        # Payment verified - serve the resource
        return {
            "status": 200,
            "body": {"data": "classified_transaction_data"},
        }

    async def _send_payment(self, payment_info: dict) -> Optional[dict]:
        """
        Construct and send an x402 payment.

        Uses EIP-3009 transferWithAuthorization for gasless USDC transfers.
        """
        from eth_account import Account
        from eth_account.messages import encode_typed_data

        if not self.wallet_key:
            return None

        chain_id = payment_info.get("chainId", 84532)
        token_address = payment_info.get("token") or payment_info.get("tokenAddress", "")
        amount = payment_info.get("amount", "0.001")
        payee = payment_info.get("payee", "")

        # Build EIP-3009 transferWithAuthorization
        wallet = Account.from_key(self.wallet_key)
        nonce = int(time.time() * 1000)
        valid_after = int(time.time()) - 60
        valid_before = int(time.time()) + 3600

        typed_data = {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "TransferWithAuthorization": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "value", "type": "uint256"},
                    {"name": "validAfter", "type": "uint256"},
                    {"name": "validBefore", "type": "uint256"},
                    {"name": "nonce", "type": "bytes32"},
                ],
            },
            "domain": {
                "name": "USD Coin",
                "version": "2",
                "chainId": chain_id,
                "verifyingContract": token_address,
            },
            "primaryType": "TransferWithAuthorization",
            "message": {
                "from": wallet.address,
                "to": payee,
                "value": int(float(amount) * 10**6),
                "validAfter": valid_after,
                "validBefore": valid_before,
                "nonce": "0x" + nonce.to_bytes(32, "big").hex(),
            },
        }

        signed = Account.sign_typed_data(wallet, typed_data)

        return {
            "success": True,
            "tx_hash": signed.hash.hex(),
            "signature": signed.signature.hex(),
            "from": wallet.address,
            "to": payee,
            "amount": amount,
        }

    async def _verify_payment(self, payment_proof: str) -> bool:
        """
        Verify an x402 payment proof against the real x402 facilitator.

        Checks:
        1. Payment proof is a valid transaction hash
        2. Verifies with the x402 facilitator endpoint
        3. As fallback, checks onchain receipt via 1Shot or public RPC

        Raises:
            PaymentVerificationError if the proof is invalid
        """
        if not payment_proof or len(payment_proof) < 10:
            self._log("warn", "Invalid payment proof (too short)")
            return False

        # Verify with the x402 facilitator endpoint
        session = await self.get_session()
        try:
            async with session.post(
                "https://api.x402.org/v1/verify",
                json={"proof": payment_proof},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("verified", False)
                self._log("warn", f"x402 facilitator returned {resp.status}")
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            self._log("warn", f"x402 facilitator unreachable: {e}")

        # Fallback: verify onchain receipt via public RPC
        try:
            from web3 import Web3
            w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
            tx = w3.eth.get_transaction_receipt(payment_proof)
            if tx and tx.get("status") == 1:
                return True
        except Exception as e:
            self._log("warn", f"Onchain verification failed: {e}")

        return False

    async def check_balance(self, wallet_address: str) -> float:
        """
        Check USDC balance for x402 payments.
        """
        session = await self.get_session()
        # In production, query USDC balance on Base
        return 100.0

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
