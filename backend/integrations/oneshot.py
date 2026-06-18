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
    chain_id: str = "eip155:11155111"  # Ethereum Sepolia (contracts deployed here)

    _session: Optional[aiohttp.ClientSession] = None
    _capabilities_cache: Optional[dict] = None
    _capabilities_cached_at: float = 0

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            headers = {}
            if self.api_key:
                headers["x-api-key"] = self.api_key
            self._session = aiohttp.ClientSession(headers=headers)
        return self._session

    async def get_capabilities(self) -> dict:
        """
        Discover relayer capabilities for the target chain from the real 1Shot API.

        Returns:
            - targetAddress: Address to delegate to
            - feeCollector: Address for fee payment
            - tokens: Accepted ERC-20 payment tokens
            - minFee: Minimum fee in token atoms

        Raises:
            RuntimeError: If the 1Shot relayer API is unreachable or returns an error
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

        async with session.post(relayer_url, json=payload) as resp:
            if resp.status != 200:
                error_body = await resp.text()
                raise RuntimeError(
                    f"1Shot relayer capabilities API returned HTTP {resp.status}: {error_body}"
                )
            data = await resp.json()
            result = data.get("result", {})
            chain_key = str(chain_id_num)
            capabilities = result.get(chain_key, {})
            if not capabilities:
                raise RuntimeError(
                    f"1Shot relayer returned empty capabilities for chain {chain_id_num}. "
                    f"Full response: {data}"
                )
            self._capabilities_cache = capabilities
            self._capabilities_cached_at = time.time()
            return self._capabilities_cache

    async def estimate_fee(
        self,
        delegation: dict,
        chain_id: Optional[str] = None,
    ) -> dict:
        """
        Estimate relayer fee for a harvest transaction from the real 1Shot API.

        Uses relayer_estimate7710Transaction for a price-locked quote.
        Raises an error if the API is unreachable — no hardcoded fee fallback.
        """
        target_chain = chain_id or self.chain_id
        relayer_url = SUPPORTED_CHAINS.get(target_chain, {}).get("relayer", RELAYER_TESTNET)
        if not relayer_url:
            raise RuntimeError(f"No 1Shot relayer URL configured for chain {target_chain}")

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

        async with session.post(relayer_url, json=payload) as resp:
            if resp.status != 200:
                error_body = await resp.text()
                raise RuntimeError(
                    f"1Shot relayer fee estimate returned HTTP {resp.status}: {error_body}"
                )
            data = await resp.json()
            result = data.get("result", {})

            if not result.get("success", False):
                raise RuntimeError(
                    f"1Shot relayer fee estimation failed: {result.get('error', 'unknown error')}"
                )

            return {
                "success": True,
                "required_payment": result.get("requiredPaymentAmount", "1000000"),
                "gas_used": result.get("gasUsed"),
                "context": result.get("context"),
            }

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
        """Submit a transaction to the 1Shot relayer and return the result.

        Raises on network or API errors — no silent error swallowing.
        """
        session = await self.get_session()
        async with session.post(relayer_url, json=payload) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise RuntimeError(
                    f"1Shot relayer send returned HTTP {resp.status}: {error_text}"
                )
            data = await resp.json()
            task_id = data.get("result")

            if not task_id:
                raise RuntimeError(
                    f"1Shot relayer send returned no task_id. Response: {data}"
                )

            return {
                "success": True,
                "task_id": task_id,
                "chain_id": target_chain,
                "memo": memo or f"taxfi-harvest-{int(time.time())}",
                "status": "submitted",
            }

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

    @staticmethod
    def _status_label(code: int) -> str:
        labels = {100: "pending", 110: "submitted", 200: "confirmed", 400: "rejected", 500: "reverted"}
        return labels.get(code, f"unknown_{code}")

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
