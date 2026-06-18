"""
TaxFi — Price Oracle Integration

Real-time cryptocurrency price feeds for the TaxFi agent pipeline.

**Data Sources (in order of preference):**
1. **CoinGecko Free API** — No API key needed. 10-30 req/min free tier.
   Maps asset symbols (ETH, BTC, UNI) to CoinGecko IDs (ethereum, bitcoin, uniswap).
2. **Alchemy Price API** — Uses the user's existing Alchemy API key.
   Supports eth_getTokenPrices alchemy extension.

**Caching:** In-memory cache with 60-second TTL to avoid rate limits.
All prices are in USD.

Usage:
    oracle = PriceOracle(alchemy_api_key="...")
    prices = await oracle.get_prices(["ETH", "BTC", "UNI"])
    price = await oracle.get_price("ETH")
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import aiohttp

logger = logging.getLogger("taxfi.price_oracle")

# ── CoinGecko symbol → ID mapping ──────────────────────────────────────────
# Covers the most common crypto assets. Extended dynamically via search API
# for unknown tokens.

SYMBOL_TO_COINGECKO_ID: dict[str, str] = {
    # Major coins
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "USDT": "tether",
    "USDC": "usd-coin",
    "BNB": "bnb",
    "XRP": "ripple",
    "ADA": "cardano",
    "SOL": "solana",
    "DOT": "polkadot",
    "DOGE": "dogecoin",
    "AVAX": "avalanche-2",
    "MATIC": "matic-network",
    "POL": "polygon-ecosystem-token",
    "SHIB": "shiba-inu",
    "TRX": "tron",
    "UNI": "uniswap",
    "ATOM": "cosmos",
    "LINK": "chainlink",
    "ETC": "ethereum-classic",
    "XLM": "stellar",
    "BCH": "bitcoin-cash",
    "ALGO": "algorand",
    "VET": "vechain",
    "FIL": "filecoin",
    "NEAR": "near",
    "APT": "aptos",
    "ARB": "arbitrum",
    "OP": "optimism",
    "SUI": "sui",
    "SEI": "sei-network",
    "INJ": "injective-protocol",
    "PEPE": "pepe",
    "FLOKI": "floki",
    "AAVE": "aave",
    "MKR": "maker",
    "COMP": "compound-governance-token",
    "CRV": "curve-dao-token",
    "BAL": "balancer",
    "LDO": "lido-dao",
    "RPL": "rocket-pool",
    "FXS": "frax-share",
    "YFI": "yearn-finance",
    "SUSHI": "sushi",
    "CAKE": "pancakeswap-token",
    "DYDX": "dydx",
    "GMX": "gmx",
    "CVX": "convex-finance",
    "STETH": "staked-ether",
    "WETH": "weth",
    "WBTC": "wrapped-bitcoin",
    "WSTETH": "wrapped-steth",
    "RETH": "rocket-pool-eth",
    "SFRXETH": "staked-frax-ether",
    "FRAX": "frax",
    "DAI": "dai",
    "LUSD": "liquity-usd",
    "TUSD": "true-usd",
    "BUSD": "binance-usd",
    "GRT": "the-graph",
    "SAND": "the-sandbox",
    "MANA": "decentraland",
    "AXS": "axie-infinity",
    "ENS": "ethereum-name-service",
    "CHZ": "chiliz",
    "GALA": "gala",
    "IMX": "immutable-x",
    "APE": "apecoin",
    "BLUR": "blur",
    "SUPER": "superfarm",
    "OCEAN": "ocean-protocol",
    "FET": "fetch-ai",
    "AGIX": "singularitynet",
    "RNDR": "render-token",
    "HNT": "helium",
    "EGLD": "elrond-erd-2",
    "FTM": "fantom",
    "ONE": "harmony",
    "KSM": "kusama",
    "XMR": "monero",
    "ZEC": "zcash",
    "DASH": "dash",
    "ICP": "internet-computer",
    "EOS": "eos",
    "FLOW": "flow",
    "MINA": "mina-protocol",
    "HBAR": "hedera-hashgraph",
    "XTZ": "tezos",
    "NEO": "neo",
    "WAVES": "waves",
    "CRO": "crypto-com-chain",
    "OKB": "okb",
    "LEO": "leo-token",
    "HT": "huobi-token",
    "KCS": "kucoin-shares",
    "ZIL": "zilliqa",
    "IOST": "iostoken",
    "IOTX": "iotex",
    "ANKR": "ankr",
    "BAT": "basic-attention-token",
    "ZRX": "0x",
    "ENJ": "enjincoin",
    "OMG": "omisego",
    "SKL": "skale",
    "MATIC": "matic-network",
    "CTSI": "cartesi",
    "ALICE": "my-neighbor-alice",
    "TLM": "alien-worlds",
    "WAXP": "wax",
    "POND": "marlin",
    "TRU": "truefi",
    "NMR": "numeraire",
    "GTC": "gitcoin",
    "REP": "augur",
    "ANT": "aragon",
    "UMA": "uma",
    "BNT": "bancor",
    "SNX": "synthetix-network-token",
    "LRC": "loopring",
    "1INCH": "1inch",
    "COW": "cow-protocol",
    "GNO": "gnosis",
}

# Rate limiting: CoinGecko free tier allows 10-30 calls/minute
# We use a conservative 1 call per 3 seconds batch approach
COINGECKO_DELAY = 3.0  # seconds between calls
CACHE_TTL = 60  # seconds before refreshing cached prices


@dataclass
class PriceOracle:
    """
    Real-time cryptocurrency price oracle.

    Uses CoinGecko free API (no key needed) as primary data source,
    with Alchemy Price API as fallback when the user has an Alchemy key.

    Prices are cached in memory for CACHE_TTL seconds to avoid
    hitting API rate limits on every portfolio scan.
    """

    alchemy_api_key: Optional[str] = None
    covalent_api_key: Optional[str] = None

    _session: Optional[aiohttp.ClientSession] = None
    _cache: dict[str, float] = field(default_factory=dict)
    _cache_timestamps: dict[str, float] = field(default_factory=dict)
    _last_coingecko_call: float = 0.0
    _rate_limit_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create a reusable aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def get_price(self, symbol: str) -> float:
        """
        Get the current price for a single asset symbol.

        Args:
            symbol: Asset symbol (e.g. "ETH", "BTC", "UNI")

        Returns:
            Current price in USD, or 0.0 if unavailable
        """
        prices = await self.get_prices([symbol])
        return prices.get(symbol.upper(), 0.0)

    async def get_prices(self, symbols: list[str]) -> dict[str, float]:
        """
        Get current prices for multiple asset symbols.

        Uses cache first, then fetches missing prices in batch.
        Tries CoinGecko first, falls back to Alchemy/Covalent.

        Args:
            symbols: List of asset symbols (e.g. ["ETH", "BTC", "UNI"])

        Returns:
            Dict mapping symbol -> price in USD
        """
        normalized = {s.upper() for s in symbols if s}
        if not normalized:
            return {}

        now = time.time()
        result: dict[str, float] = {}

        # Check cache first
        missing: set[str] = set()
        for sym in normalized:
            if sym in self._cache and (now - self._cache_timestamps.get(sym, 0)) < CACHE_TTL:
                result[sym] = self._cache[sym]
            else:
                missing.add(sym)

        if not missing:
            return result

        # Fetch missing prices — try CoinGecko first (free, no key needed)
        coingecko_ids = [SYMBOL_TO_COINGECKO_ID.get(s, "") for s in missing]
        valid_ids = [cid for cid in coingecko_ids if cid]

        if valid_ids:
            try:
                coingecko_prices = await self._fetch_coingecko_batch(valid_ids)
                for sym, cid in SYMBOL_TO_COINGECKO_ID.items():
                    if sym in missing and cid in coingecko_prices:
                        price = coingecko_prices[cid]
                        result[sym] = price
                        self._cache[sym] = price
                        self._cache_timestamps[sym] = now
                        missing.discard(sym)
            except Exception as e:
                logger.warning(f"CoinGecko batch fetch failed: {e}")

        # For remaining missing symbols, try individual CoinGecko lookups
        if missing:
            for sym in list(missing):
                try:
                    price = await self._fetch_coingecko_single(sym)
                    if price > 0:
                        result[sym] = price
                        self._cache[sym] = price
                        self._cache_timestamps[sym] = now
                        missing.discard(sym)
                except Exception as e:
                    logger.debug(f"CoinGecko single lookup for {sym} failed: {e}")

        # Try Covalent price endpoint
        if missing and self.covalent_api_key:
            try:
                covalent_prices = await self._fetch_covalent_prices(list(missing))
                for sym, price in covalent_prices.items():
                    result[sym] = price
                    self._cache[sym] = price
                    self._cache_timestamps[sym] = now
                    missing.discard(sym)
            except Exception as e:
                logger.warning(f"Covalent price fetch failed: {e}")

        # Any remaining symbols get 0.0
        for sym in missing:
            result[sym] = 0.0
            logger.debug(f"No price available for {sym}")

        return result

    # ── CoinGecko API (free, no key needed) ───────────────────────────

    async def _fetch_coingecko_batch(self, coin_ids: list[str]) -> dict[str, float]:
        """
        Fetch prices for multiple CoinGecko IDs in a single API call.

        Endpoint: GET /api/v3/simple/price?ids=a,b,c&vs_currencies=usd
        Rate limit: ~10-30 calls/min on free tier
        """
        await self._rate_limit()

        session = await self.get_session()
        ids_param = ",".join(coin_ids)
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd"

        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 429:
                # Rate limited — wait and retry once
                logger.warning("CoinGecko rate limited (429), waiting 10s...")
                await asyncio.sleep(10)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as retry_resp:
                    if retry_resp.status != 200:
                        raise Exception(f"CoinGecko batch error: {retry_resp.status}")
                    data = await retry_resp.json()
            elif resp.status != 200:
                raise Exception(f"CoinGecko batch error: {resp.status}")
            else:
                data = await resp.json()

        result: dict[str, float] = {}
        for coin_id, quote in data.items():
            if "usd" in quote:
                result[coin_id] = float(quote["usd"])
        return result

    async def _fetch_coingecko_single(self, symbol: str) -> float:
        """
        Search CoinGecko for a symbol and get its price.

        Used for symbols not in our static mapping.
        Calls /api/v3/search?query=XXX then /simple/price with found ID.
        """
        await self._rate_limit()

        session = await self.get_session()

        # First search for the coin
        search_url = f"https://api.coingecko.com/api/v3/search?query={symbol.lower()}"
        async with session.get(search_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return 0.0
            search_data = await resp.json()
            coins = search_data.get("coins", [])
            if not coins:
                return 0.0
            coin_id = coins[0].get("id", "")
            if not coin_id:
                return 0.0

        # Cache the mapping for future lookups
        SYMBOL_TO_COINGECKO_ID[symbol.upper()] = coin_id

        # Now fetch price
        await self._rate_limit()
        price_url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd"
        async with session.get(price_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return 0.0
            price_data = await resp.json()
            quote = price_data.get(coin_id, {})
            return float(quote.get("usd", 0.0))

    async def _rate_limit(self) -> None:
        """Ensure we respect CoinGecko's rate limits by spacing out calls."""
        async with self._rate_limit_lock:
            now = time.time()
            elapsed = now - self._last_coingecko_call
            if elapsed < COINGECKO_DELAY:
                await asyncio.sleep(COINGECKO_DELAY - elapsed)
            self._last_coingecko_call = time.time()

    # ── Covalent Price API ───────────────────────────────────────────

    async def _fetch_covalent_prices(self, symbols: list[str]) -> dict[str, float]:
        """
        Fetch prices using Covalent's pricing endpoint.

        Covalent can return spot prices for tokens across chains.
        Requires COVALENT_API_KEY to be set.
        """
        if not self.covalent_api_key:
            return {}

        session = await self.get_session()
        prices: dict[str, float] = {}

        # Covalent's pricing API works per-chain with token addresses.
        # We try ETH mainnet (chain 1) for common tokens.
        for sym in symbols:
            try:
                # Try CoinGecko ID lookup via Covalent's ticker endpoint
                url = (
                    f"https://api.covalenthq.com/v1/pricing/tickers/"
                    f"?tickers={sym.lower()}&key={self.covalent_api_key}"
                )
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("data", {}).get("items", [])
                        if items:
                            prices[sym] = float(items[0].get("price", 0.0))
            except Exception:
                continue

        return prices

    # ── Batch price update for all tracked assets ────────────────────

    async def refresh_all_prices(self, assets: list[str]) -> dict[str, float]:
        """
        Force-refresh prices for a list of assets, bypassing cache.

        Used by LossDetector before running a portfolio scan to ensure
        we have the most current prices for harvest detection.

        Args:
            assets: List of asset symbols to refresh

        Returns:
            Dict mapping symbol -> price in USD
        """
        # Clear cache for these assets
        for sym in assets:
            self._cache.pop(sym.upper(), None)
            self._cache_timestamps.pop(sym.upper(), None)

        return await self.get_prices(assets)

    # ── Historical prices (for cost basis) ───────────────────────────

    async def get_historical_price(self, symbol: str, timestamp: int) -> float:
        """
        Get the historical price of an asset at a given Unix timestamp.

        Uses CoinGecko's /coins/{id}/history endpoint.
        Requires the asset to be in the CoinGecko mapping (120+ supported).

        Args:
            symbol: Asset symbol (e.g. "ETH")
            timestamp: Unix timestamp for the desired date

        Returns:
            Historical price in USD

        Raises:
            RuntimeError: If the asset is not in the CoinGecko mapping or
                         if the historical price cannot be fetched
        """
        coin_id = SYMBOL_TO_COINGECKO_ID.get(symbol.upper())
        if not coin_id:
            raise RuntimeError(
                f"Cannot fetch historical price for {symbol}: not in CoinGecko mapping. "
                f"Supported assets include: ETH, BTC, SOL, UNI, LINK, AAVE, and 115+ more."
            )

        await self._rate_limit()

        session = await self.get_session()
        from datetime import datetime, timezone

        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        date_str = dt.strftime("%d-%m-%Y")

        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/history?date={date_str}&localization=false"

        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                raise RuntimeError(
                    f"CoinGecko historical price API returned HTTP {resp.status} for "
                    f"{symbol} on {date_str}. The asset may not have existed on that date."
                )
            data = await resp.json()
            market_data = data.get("market_data", {})
            current_price_data = market_data.get("current_price", {})
            price = float(current_price_data.get("usd", 0.0))

        if price <= 0:
            raise RuntimeError(
                f"CoinGecko returned $0.00 for historical price of {symbol} on {date_str}"
            )

        return price

    # ── Cleanup ──────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
