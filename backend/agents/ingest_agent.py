"""
TaxFi — Ingest Agent

Pulls all transactions across supported chains for a user's addresses.
Normalizes them into a canonical format for classification.
Supports Covalent API and Alchemy SDK as data sources.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urljoin

import aiohttp

from .base_agent import AgentResult, BaseAgent


class IngestAgent(BaseAgent):
    """
    Ingests transaction data from multiple blockchain data sources.

    Normalizes raw chain data into a canonical TransactionEvent format
    that the ClassifierAgent can process.
    """

    TRANSACTION_CACHE_SIZE = 10000

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__("IngestAgent", config)
        self._cache: dict[str, list[dict]] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def process(self, address: str, chains: list[str] | None = None, **kwargs) -> AgentResult:
        """
        Ingest all transactions for a given address across specified chains.

        Args:
            address: The wallet address to scan
            chains: List of chain IDs to scan. Defaults to configured chains.

        Returns:
            AgentResult with normalized transaction events
        """
        self.start_timer()
        target_chains = chains or self.config.get(
            "supported_chains",
            [
                "eip155:1",  # Ethereum
                "eip155:8453",  # Base
                "eip155:42161",  # Arbitrum
            ],
        )

        self.log("info", f"Ingesting transactions for {address} across {len(target_chains)} chains")

        all_transactions = []
        errors = []

        # Scan all chains in parallel
        tasks = [self._scan_chain(address, chain) for chain in target_chains]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for chain, result in zip(target_chains, results):
            if isinstance(result, Exception):
                errors.append(f"Chain {chain}: {str(result)}")
                self.log("error", f"Failed to scan chain {chain}", error=str(result))
                continue
            normalized = self._normalize_transactions(result, chain, address)
            all_transactions.extend(normalized)
            self.log("info", f"Found {len(normalized)} txns on chain {chain}")

        self._cache[address] = all_transactions

        return self.success(
            message=f"Ingested {len(all_transactions)} transactions for {address}",
            data={
                "address": address,
                "chains_scanned": len(target_chains),
                "total_transactions": len(all_transactions),
                "transactions": all_transactions,
                "errors": errors,
            },
            chains_ok=len(target_chains) - len(errors),
            chains_error=len(errors),
        )

    async def _scan_chain(self, address: str, chain_id: str) -> list[dict[str, Any]]:
        """
        Scan a single chain using Covalent API or Alchemy SDK.

        Falls back between data sources if one is unavailable.
        """
        covalent_key = self.config.get("covalent_api_key")
        if covalent_key:
            return await self._scan_covalent(address, chain_id, covalent_key)

        alchemy_key = self.config.get("alchemy_api_key")
        if alchemy_key:
            return await self._scan_alchemy(address, chain_id, alchemy_key)

        # No data sources configured — return empty instead of mock data
        self.log("warn", f"No data source configured for chain {chain_id} — returning empty results."
                 f" Set COVALENT_API_KEY or ALCHEMY_API_KEY in .env")
        return []

    async def _scan_covalent(
        self, address: str, chain_id: str, api_key: str
    ) -> list[dict[str, Any]]:
        """Use Covalent API to fetch transactions."""
        covalent_chain_id = self._to_covalent_chain_id(chain_id)
        session = await self._get_session()

        url = (
            f"https://api.covalenthq.com/v1/{covalent_chain_id}/address/{address}/"
            f"transactions_v2/?key={api_key}&page-size=100"
        )

        async with session.get(url) as resp:
            if resp.status != 200:
                raise Exception(f"Covalent API error: {resp.status}")
            data = await resp.json()
            return data.get("data", {}).get("items", [])

    async def _scan_alchemy(
        self, address: str, chain_id: str, api_key: str
    ) -> list[dict[str, Any]]:
        """Use Alchemy SDK to fetch transactions."""
        alchemy_chain = self._to_alchemy_chain(chain_id)
        session = await self._get_session()

        url = f"https://{alchemy_chain}.g.alchemy.com/v2/{api_key}"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "alchemy_getAssetTransfers",
            "params": [
                {
                    "fromBlock": "0x0",
                    "toBlock": "latest",
                    "fromAddress": address,
                    "toAddress": address,
                    "category": ["external", "internal", "erc20", "erc721", "erc1155"],
                    "maxCount": "0x64",
                }
            ],
        }

        async with session.post(url, json=payload) as resp:
            if resp.status != 200:
                raise Exception(f"Alchemy API error: {resp.status}")
            data = await resp.json()
            return data.get("result", {}).get("transfers", [])

    def _normalize_transactions(
        self, raw_txns: list[dict], chain_id: str, address: str
    ) -> list[dict[str, Any]]:
        """Normalize raw transaction data into canonical format."""
        normalized = []
        for txn in raw_txns:
            # ── Value normalization ──────────────────────────────────────
            # Covalent returns values in the token's smallest unit (wei for ETH).
            # We store amounts in human-readable units (ETH, not wei).
            # Covalent also provides `transfers[].delta` or `value` in wei.
            raw_value = txn.get("value", "0") or "0"
            try:
                raw_value_int = int(raw_value) if isinstance(raw_value, str) else int(raw_value)
            except (ValueError, TypeError):
                raw_value_int = 0

            # Detect token decimals — default 18 for ETH/ERC-20
            decimals = txn.get("contract_decimals", 18) or 18
            try:
                decimals = int(decimals)
            except (ValueError, TypeError):
                decimals = 18
            human_value = raw_value_int / (10 ** decimals) if raw_value_int else 0.0

            # ── Token symbol ──────────────────────────────────────────────
            token_symbol = (
                txn.get("contract_ticker_symbol")
                or txn.get("from_currency_symbol")
                or txn.get("to_currency_symbol")
                or ""
            ).strip()

            # For native ETH transfers (no contract), use "ETH"
            if not token_symbol:
                if txn.get("from_address") or txn.get("from"):
                    token_symbol = "ETH"
                else:
                    token_symbol = "UNKNOWN"

            # ── Filter: skip zero-value and contract-deploy txns ──────────
            if human_value == 0 and not txn.get("log_events") and not txn.get("transfers"):
                # Likely a failed tx or contract deployment with no transfers
                continue

            method_name = ""
            method_calls = txn.get("method_calls")
            if isinstance(method_calls, list) and method_calls:
                method_name = method_calls[0].get("name", "")

            normalized.append(
                {
                    "chain_id": chain_id,
                    "tx_hash": txn.get("tx_hash") or txn.get("hash", ""),
                    "block_number": txn.get("block_height") or txn.get("blockNum", 0),
                    "from_address": (txn.get("from_address") or txn.get("from", "")).lower(),
                    "to_address": (txn.get("to_address") or txn.get("to", "")).lower(),
                    # Store as human-readable token amount
                    "value": human_value,
                    "token_address": txn.get("contract_address") or "",
                    "token_symbol": token_symbol,
                    "method": method_name,
                    "timestamp": txn.get("block_signed_at")
                    or txn.get("metadata", {}).get("blockTimestamp", ""),
                    "log_events": txn.get("log_events", []),
                    "transfers": txn.get("transfers", []),
                    "gas_used": str(txn.get("gas_spent", "0")),
                    "gas_price": str(txn.get("gas_price", "0")),
                    "successful": txn.get("successful", True),
                    # USD value from Covalent if available
                    "value_usd": float(txn.get("value_quote", 0) or 0),
                }
            )
        return normalized

    @staticmethod
    def _to_covalent_chain_id(chain_id: str) -> int:
        """Convert CAIP-2 chain ID to Covalent chain ID."""
        mapping = {
            "eip155:1": 1,  # Ethereum
            "eip155:8453": 8453,  # Base
            "eip155:42161": 42161,  # Arbitrum
            "eip155:137": 137,  # Polygon
            "eip155:10": 10,  # Optimism
            "eip155:11155111": 11155111,  # Sepolia
        }
        return mapping.get(chain_id, 1)

    @staticmethod
    def _to_alchemy_chain(chain_id: str) -> str:
        """Convert CAIP-2 chain ID to Alchemy chain name."""
        mapping = {
            "eip155:1": "eth-mainnet",
            "eip155:8453": "base-mainnet",
            "eip155:42161": "arb-mainnet",
            "eip155:137": "polygon-mainnet",
            "eip155:10": "opt-mainnet",
            "eip155:11155111": "eth-sepolia",
        }
        return mapping.get(chain_id, "eth-mainnet")

    async def close(self):
        """Clean up resources."""
        if self._session and not self._session.closed:
            await self._session.close()
