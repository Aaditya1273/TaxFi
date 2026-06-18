"""
Tests for LossDetector's shared aiohttp session lifecycle.

Verifies that the session is:
- Created lazily on first call
- Reused across both _call_venice_analysis() and _fetch_market_prices()
- Re-created if the old session was closed externally
- Properly cleaned up by close()
- close() is safe to call multiple times

LossDetector has two HTTP methods that use the shared session:
  - _call_venice_analysis(): always calls _get_session()
  - _fetch_market_prices(): only calls _get_session() when an API key is configured
"""
from __future__ import annotations

from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest
import pytest_asyncio

from backend.agents.loss_detector import LossDetector, HarvestOpportunity


@pytest_asyncio.fixture
async def agent() -> AsyncGenerator[LossDetector, None]:
    """Create a LossDetector with empty config and clean up after."""
    a = LossDetector(config={})
    try:
        yield a
    finally:
        await a.close()


@pytest_asyncio.fixture
async def agent_with_price_oracle() -> AsyncGenerator[LossDetector, None]:
    """LossDetector with a PriceOracle wired in for real market prices."""
    from backend.integrations.price_oracle import PriceOracle
    a = LossDetector(config={})
    oracle = PriceOracle()
    a.set_price_oracle(oracle)
    try:
        yield a
    finally:
        await oracle.close()
        await a.close()


# ──────────────────────────────────────────────────────
# Session Creation  (lazy initialisation)
# ──────────────────────────────────────────────────────


class TestSessionCreation:
    """Tests for _get_session() lazy initialisation."""

    @pytest.mark.asyncio
    async def test_session_is_none_initial(self, agent: LossDetector):
        assert agent._session is None

    @pytest.mark.asyncio
    async def test_get_session_creates_on_first_call(self, agent: LossDetector):
        session = await agent._get_session()
        assert session is not None
        assert not session.closed
        assert isinstance(session, aiohttp.ClientSession)

    @pytest.mark.asyncio
    async def test_get_session_sets_internal_state(self, agent: LossDetector):
        session = await agent._get_session()
        assert agent._session is session


# ──────────────────────────────────────────────────────
# Session Reuse
# ──────────────────────────────────────────────────────


class TestSessionReuse:
    """Tests that _get_session() reuses the existing session."""

    @pytest.mark.asyncio
    async def test_get_session_returns_same_object(self, agent: LossDetector):
        s1 = await agent._get_session()
        s2 = await agent._get_session()
        assert s1 is s2

    @pytest.mark.asyncio
    async def test_session_remains_open_after_multiple_gets(self, agent: LossDetector):
        await agent._get_session()
        await agent._get_session()
        s3 = await agent._get_session()
        assert not s3.closed


# ──────────────────────────────────────────────────────
# Session Recreation
# ──────────────────────────────────────────────────────


class TestSessionRecreation:
    """Tests that _get_session() handles closed sessions gracefully."""

    @pytest.mark.asyncio
    async def test_get_session_after_close_creates_new(self, agent: LossDetector):
        s1 = await agent._get_session()
        await s1.close()
        s2 = await agent._get_session()
        assert s2 is not s1
        assert not s2.closed

    @pytest.mark.asyncio
    async def test_get_session_replaces_closed_reference(self, agent: LossDetector):
        s1 = await agent._get_session()
        await s1.close()
        s2 = await agent._get_session()
        assert agent._session is s2
        assert agent._session is not s1


# ──────────────────────────────────────────────────────
# Close lifecycle
# ──────────────────────────────────────────────────────


class TestClose:
    """Tests for the close() cleanup method."""

    @pytest.mark.asyncio
    async def test_close_closes_session(self, agent: LossDetector):
        session = await agent._get_session()
        await agent.close()
        assert session.closed

    @pytest.mark.asyncio
    async def test_close_sets_session_to_none(self, agent: LossDetector):
        await agent._get_session()
        await agent.close()
        assert agent._session is None

    @pytest.mark.asyncio
    async def test_close_idempotent(self, agent: LossDetector):
        await agent._get_session()
        await agent.close()
        await agent.close()
        assert agent._session is None

    @pytest.mark.asyncio
    async def test_close_when_session_is_none(self, agent: LossDetector):
        assert agent._session is None
        await agent.close()

    @pytest.mark.asyncio
    async def test_close_then_get_new_session(self, agent: LossDetector):
        s1 = await agent._get_session()
        await agent.close()
        s2 = await agent._get_session()
        assert s2 is not s1
        assert not s2.closed
        assert agent._session is s2


# ──────────────────────────────────────────────────────
# Both HTTP methods share the same session
# ──────────────────────────────────────────────────────


class TestSharedSessionAcrossMethods:
    """Both _call_venice_analysis() and _fetch_market_prices() use the same session."""

    @pytest.mark.asyncio
    async def test_venice_analysis_uses_and_reuses_session(self, agent: LossDetector):
        """Calling _call_venice_analysis triggers session creation
        and a subsequent call reuses the same session."""
        assert agent._session is None

        # First call — session is created even though the HTTP request fails
        # (no API key, so we expect an API error response)
        result = await agent._call_venice_analysis("test prompt")
        assert agent._session is not None
        assert not agent._session.closed
        # The call should fail gracefully with a fallback result
        assert not result.get("recommend_harvest", True)

        # Save the session reference
        s1 = agent._session

        # Second call — same session reused
        _ = await agent._call_venice_analysis("another prompt")
        assert agent._session is s1
        assert not agent._session.closed

    @pytest.mark.asyncio
    async def test_fetch_prices_uses_price_oracle(self, agent_with_price_oracle: LossDetector):
        """_fetch_market_prices should use the PriceOracle when wired in,
        not the LossDetector's own session."""
        cost_basis_data = {
            "ledgers": {
                "ETH": {
                    "remaining_lots": [],
                },
            },
        }

        result = await agent_with_price_oracle._fetch_market_prices(cost_basis_data)
        # PriceOracle manages its own session - LossDetector's session stays None
        # Result should be a dict (even if prices are 0 because no real API call)
        assert isinstance(result, dict)
        assert "ETH" in result

    @pytest.mark.asyncio
    async def test_price_oracle_manages_its_own_session(self, agent_with_price_oracle: LossDetector):
        """PriceOracle has its own session separate from LossDetector's.
        _fetch_market_prices delegates to PriceOracle, not to _get_session()."""
        # Trigger a venice call first — creates LossDetector's session
        _ = await agent_with_price_oracle._call_venice_analysis("hello")
        s_venice = agent_with_price_oracle._session
        assert s_venice is not None

        # Now use _fetch_market_prices — uses PriceOracle, not LossDetector session
        cost_basis_data = {
            "ledgers": {
                "ETH": {
                    "remaining_lots": [],
                },
            },
        }
        _ = await agent_with_price_oracle._fetch_market_prices(cost_basis_data)
        # LossDetector's own session is unchanged
        assert agent_with_price_oracle._session is s_venice


# ──────────────────────────────────────────────────────
# Session-trigger paths
# ──────────────────────────────────────────────────────


class TestSessionTriggerPaths:
    """Tests which code paths trigger (or don't trigger) session creation."""

    @pytest.mark.asyncio
    async def test_venice_analysis_triggers_session(self, agent: LossDetector):
        """_call_venice_analysis always calls _get_session(),
        even when the HTTP request will fail."""
        assert agent._session is None
        await agent._call_venice_analysis("test")
        assert agent._session is not None

    @pytest.mark.asyncio
    async def test_fetch_prices_without_oracle_returns_zeroes(self, agent: LossDetector):
        """_fetch_market_prices should return zero prices when no
        PriceOracle is wired in (no real API data source)."""
        cost_basis_data = {
            "ledgers": {
                "ETH": {
                    "remaining_lots": [],
                },
            },
        }
        result = await agent._fetch_market_prices(cost_basis_data)
        assert agent._session is None
        assert isinstance(result, dict)
        # Without PriceOracle, prices are 0
        assert result.get("ETH", -1) == 0.0

    @pytest.mark.asyncio
    async def test_fetch_prices_with_oracle_uses_price_oracle(self, agent_with_price_oracle: LossDetector):
        """_fetch_market_prices should use the PriceOracle when one is wired."""
        cost_basis_data = {
            "ledgers": {
                "ETH": {
                    "remaining_lots": [],
                },
            },
        }
        result = await agent_with_price_oracle._fetch_market_prices(cost_basis_data)
        # PriceOracle returns 0.0 for assets it can't fetch (no API call in test)
        assert agent_with_price_oracle._session is None  # LossDetector session not used
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_process_with_empty_data_does_not_trigger_session(self, agent: LossDetector):
        """process() with empty cost basis data and no market_prices should
        not trigger any HTTP calls — no assets to fetch prices for."""
        result = await agent.process(cost_basis_data={})
        assert result.success
        assert agent._session is None

    @pytest.mark.asyncio
    async def test_analyze_with_venice_triggers_session(self, agent: LossDetector):
        """The public analyze_with_venice() method triggers session creation
        since it calls _call_venice_analysis."""
        opp = HarvestOpportunity(
            asset="ETH",
            asset_address="0x0000000000000000000000000000000000000000",
            quantity=1.0,
            cost_basis_per_unit=3500.0,
            current_price_per_unit=2900.0,
            unrealized_loss=600.0,
            loss_percentage=17.14,
            holding_period_days=200,
            is_short_term=True,
            estimated_tax_savings=600.0 * 0.22,
            confidence=0.85,
            reasoning="Test",
            recommended_rebuy=None,
            chain_id="eip155:1",
            harvest_priority=1,
        )
        ctx = {"short_term_gains": 5000, "long_term_gains": 1000}

        # This should trigger session creation via _call_venice_analysis
        result = await agent.analyze_with_venice(opp, ctx)
        assert agent._session is not None
        # API call will fail gracefully (no real API key)
        assert isinstance(result, dict)


# ──────────────────────────────────────────────────────
# Full lifecycle
# ──────────────────────────────────────────────────────


class TestIntegration:
    """Integration-level tests — complete lifecycle."""

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, agent: LossDetector):
        """Create → use → close → create → close."""
        s1 = await agent._get_session()
        assert not s1.closed

        await agent.close()
        assert s1.closed
        assert agent._session is None

        s2 = await agent._get_session()
        assert s2 is not s1
        assert not s2.closed

        await agent.close()
        assert s2.closed
        assert agent._session is None

    @pytest.mark.asyncio
    async def test_concurrent_gets_return_same_session(self, agent: LossDetector):
        """Multiple concurrent _get_session() calls return the same session."""
        import asyncio

        async def get():
            return await agent._get_session()

        results = await asyncio.gather(*[get() for _ in range(10)])
        first = results[0]
        for s in results[1:]:
            assert s is first
        assert not first.closed
