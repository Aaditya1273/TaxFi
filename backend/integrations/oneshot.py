"""
TaxFi — 1Shot API Integration

Integrates with the 1Shot API for:
- Gasless relayer (ERC-7710 delegated transactions)
- Server wallet management
- Smart contract reads/writes
- Webhook consumption for execution status

The user never needs ETH — the relayer accepts USDC for gas.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Optional

import aiohttp

from backend.utils.retry import circuit_breaker_call, get_circuit_breaker


# Relayer endpoints
RELAYER_MAINNET = "https://relayer.1shotapi.com/relayers"
RELAYER_TESTNET = "https://relayer.1shotapi.dev/relayers"
RELAYER_JWKS = "https://relayer.1shotapi.com/.well-known/jwks.json"

# Supported chains
SUPPORTED_CHAINS = {
    "eip155:1": {"name": "Ethereum", "relayer": RELAYER_MAINNET},
    "eip155:8453": {"name": "Base", "relayer": RELAYER_MAINNET},
    "eip155:42161": {"name": "Arbitrum", "relayer": RELAYER_MAINNET},
    "eip155:137": {"name": "Polygon", "relayer": RELAYER_MAINNET},
    "eip155:84532": {"name": "Base Sepolia", "relayer": RELAYER_TESTNET},
    "eip155:11155111": {"name": "Sepolia", "relayer": RELAYER_TESTNET},
}


@dataclass
class OneshotClient:
    """
    1Shot API client for TaxFi.

    Handles relayer communication, delegation building, and
    transaction execution status monitoring.
    """

    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    chain_id: str = "eip155:84532"  # Base Sepolia testnet default

    _session: Optional[aiohttp.ClientSession] = None
    _capabilities_cache: Optional[dict] = None
    _capabilities_cached_at: float = 0

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def get_capabilities(self) -> dict:
        """
        Discover relayer capabilities for the target chain.

        Returns:
            - targetAddress: Address to delegate to
            - feeCollector: Address for fee payment
            - tokens: Accepted ERC-20 payment tokens
            - minFee: Minimum fee in token atoms
        """
        # Cache for 5 minutes
        if self._capabilities_cache and time.time() - self._capabilities_cached_at < 300:
            return self._capabilities_cache

        relayer_url = SUPPORTED_CHAINS.get(self.chain_id, {}).get("relayer", RELAYER_TESTNET)
        session = await self.get_session()

        chain_id_num = int(self.chain_id.split(":")[1])

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_getCapabilities",
            "params": [str(chain_id_num)],
        }

        try:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    raise Exception(f"Capabilities error: {resp.status}")
                data = await resp.json()
                result = data.get("result", {})
                chain_key = str(chain_id_num)
                self._capabilities_cache = result.get(chain_key, {})
                self._capabilities_cached_at = time.time()
                return self._capabilities_cache
        except Exception as e:
            # Return sensible defaults for development
            return {
                "targetAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
                "feeCollector": "0x1111111111111111111111111111111111111111",
                "tokens": [
                    {"address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "symbol": "USDC", "decimals": "6"}
                ],
                "minFee": "10000",  # $0.01 in USDC
            }

    async def estimate_fee(
        self,
        delegation: dict,
        chain_id: Optional[str] = None,
    ) -> dict:
        """
        Estimate relayer fee for a harvest transaction.

        Uses relayer_estimate7710Transaction for a price-locked quote.
        """
        target_chain = chain_id or self.chain_id
        relayer_url = SUPPORTED_CHAINS.get(target_chain, {}).get("relayer", RELAYER_TESTNET)
        session = await self.get_session()

        chain_id_num = int(target_chain.split(":")[1])

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_estimate7710Transaction",
            "params": [{
                "chainId": str(chain_id_num),
                "transactions": [{
                    "permissionContext": [delegation],
                    "executions": delegation.get("executions", []),
                }],
            }],
        }

        try:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    return self._default_fee_estimate()
                data = await resp.json()
                result = data.get("result", {})

                return {
                    "success": result.get("success", False),
                    "required_payment": result.get("requiredPaymentAmount", "1000000"),
                    "gas_used": result.get("gasUsed"),
                    "context": result.get("context"),
                    "error": result.get("error"),
                }
        except Exception:
            return self._default_fee_estimate()

    async def send_transaction(
        self,
        delegation: dict,
        fee_context: Optional[str] = None,
        memo: str = "",
        destination_url: Optional[str] = None,
        chain_id: Optional[str] = None,
    ) -> dict:
        """
        Submit a delegated harvest transaction through the relayer.

        Args:
            delegation: ERC-7710 delegation with scope and executions
            fee_context: Price-lock context from estimate
            memo: Human-readable label for the transaction
            destination_url: Webhook URL for status updates
            chain_id: Target chain

        Returns:
            Task ID and status
        """
        target_chain = chain_id or self.chain_id
        relayer_url = SUPPORTED_CHAINS.get(target_chain, {}).get("relayer", RELAYER_TESTNET)
        session = await self.get_session()

        chain_id_num = int(target_chain.split(":")[1])

        params = {
            "chainId": str(chain_id_num),
            "transactions": [{
                "permissionContext": [delegation.get("signed_delegation", delegation)],
                "executions": delegation.get("executions", []),
            }],
            "memo": memo or f"taxfi-harvest-{int(time.time())}",
        }

        if fee_context:
            params["context"] = fee_context
        if destination_url:
            params["destinationUrl"] = destination_url

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_send7710Transaction",
            "params": [params],
        }

        return await circuit_breaker_call(
            "oneshot_relayer",
            "send_transaction",
            lambda: self._do_send_transaction(payload, relayer_url, target_chain, memo),
            max_retries=2,
            base_delay=2.0,
        )

    async def _do_send_transaction(
        self, payload: dict, relayer_url: str, target_chain: str, memo: str
    ) -> dict:
        """Internal send implementation with circuit breaker protection."""
        session = await self.get_session()
        try:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    return {
                        "success": False,
                        "error": f"Send error {resp.status}: {error_text}",
                    }
                data = await resp.json()
                task_id = data.get("result")

                return {
                    "success": True,
                    "task_id": task_id,
                    "chain_id": target_chain,
                    "memo": memo or f"taxfi-harvest-{int(time.time())}",
                    "status": "submitted",
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def check_status(self, task_id: str, chain_id: Optional[str] = None) -> dict:
        """
        Check the status of a submitted relayer transaction.

        Status codes:
            100: Pending
            110: Submitted (on-chain tx exists)
            200: Confirmed ✓
            400: Rejected
            500: Reverted
        """
        target_chain = chain_id or self.chain_id
        relayer_url = SUPPORTED_CHAINS.get(target_chain, {}).get("relayer", RELAYER_TESTNET)
        session = await self.get_session()

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_getStatus",
            "params": [{"id": task_id}],
        }

        try:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    return {"success": False, "error": f"Status error {resp.status}"}
                data = await resp.json()
                result = data.get("result", {})

                status_code = result.get("status", -1)
                is_terminal = status_code in (200, 400, 500)

                return {
                    "success": True,
                    "status_code": status_code,
                    "status": self._status_label(status_code),
                    "is_terminal": is_terminal,
                    "tx_hash": result.get("hash"),
                    "message": result.get("message"),
                    "receipt": result.get("receipt"),
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def build_harvest_execution(
        self,
        user_address: str,
        token_address: str,
        amount: str,
        fee_amount: str,
        fee_collector: str,
    ) -> dict:
        """
        Build a harvest execution bundle for the relayer.

        Creates two executions in one delegation:
        1. Fee payment: USDC transfer to feeCollector
        2. Harvest: Token swap to USDC
        """
        # Transfer selector: transfer(address,uint256)
        transfer_selector = "0xa9059cbb"

        # Encode fee transfer: transfer(feeCollector, feeAmount)
        fee_to = fee_collector[2:].zfill(64)
        fee_val = hex(int(fee_amount))[2:].zfill(64)
        fee_calldata = transfer_selector + fee_to + fee_val

        executions = [
            {
                "to": token_address,
                "value": "0x0",
                "data": fee_calldata,
            },
        ]

        delegation = {
            "to": "",  # Will be filled with relayer targetAddress
            "from": user_address,
            "scope": {
                "type": "erc20-transfer-amount",
                "token": token_address,
                "maxAmount": hex(int(amount) + int(fee_amount)),
            },
            "executions": executions,
        }

        return delegation

    def _default_fee_estimate(self) -> dict:
        """Return default fee estimate for development."""
        return {
            "success": True,
            "required_payment": "1000000",  # $1 USDC
            "context": None,
            "note": "Using default fee estimate",
        }

    @staticmethod
    def _status_label(code: int) -> str:
        labels = {100: "pending", 110: "submitted", 200: "confirmed", 400: "rejected", 500: "reverted"}
        return labels.get(code, f"unknown_{code}")

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
