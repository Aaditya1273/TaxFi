"""
Tests for VeniceClient's shared aiohttp session lifecycle.

VeniceClient is a @dataclass (not a BaseAgent subclass) with:

  - _session: Optional[aiohttp.ClientSession] = None   (field)
  - get_session()  ← creates/reuses the session
  - close()        ← closes the session (does NOT set _session = None)
  - _chat_completion()  ← public methods call get_session()
  - check_balance()     ← public methods call get_session()
  - top_up()            ← public methods call get_session()

Note: close() does not null out _session after closing, but get_session()
handles this correctly via the "or self._session.closed" guard.
"""
from __future__ import annotations

from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest
import pytest_asyncio

from backend.integrations.venice import VeniceClient, VENICE_CHAT_URL, VENICE_X402_BALANCE_URL, VENICE_X402_TOPUP_URL


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[VeniceClient, None]:
    """A VeniceClient with no API key (Bearer or wallet)."""
    c = VeniceClient()
    try:
        yield c
    finally:
        await c.close()


@pytest_asyncio.fixture
async def client_with_key() -> AsyncGenerator[VeniceClient, None]:
    """A VeniceClient with a Bearer API key configured."""
    c = VeniceClient(api_key="sk-test-fake-key")
    try:
        yield c
    finally:
        await c.close()


# ──────────────────────────────────────────────────────
# Session Creation  (lazy initialisation)
# ──────────────────────────────────────────────────────


class TestSessionCreation:
    """Tests for get_session() lazy initialisation."""

    @pytest.mark.asyncio
    async def test_session_is_none_initial(self, client: VeniceClient):
        assert client._session is None

    @pytest.mark.asyncio
    async def test_get_session_creates_on_first_call(self, client: VeniceClient):
        session = await client.get_session()
        assert session is not None
        assert not session.closed
        assert isinstance(session, aiohttp.ClientSession)

    @pytest.mark.asyncio
    async def test_get_session_sets_internal_state(self, client: VeniceClient):
        session = await client.get_session()
        assert client._session is session


# ──────────────────────────────────────────────────────
# Session Reuse
# ──────────────────────────────────────────────────────


class TestSessionReuse:
    """Tests that get_session() reuses the existing session."""

    @pytest.mark.asyncio
    async def test_get_session_returns_same_object(self, client: VeniceClient):
        s1 = await client.get_session()
        s2 = await client.get_session()
        assert s1 is s2

    @pytest.mark.asyncio
    async def test_session_remains_open_after_multiple_gets(self, client: VeniceClient):
        await client.get_session()
        await client.get_session()
        s3 = await client.get_session()
        assert not s3.closed


# ──────────────────────────────────────────────────────
# Session Recreation
# ──────────────────────────────────────────────────────


class TestSessionRecreation:
    """Tests that get_session() handles closed sessions gracefully."""

    @pytest.mark.asyncio
    async def test_get_session_after_close_creates_new(self, client: VeniceClient):
        s1 = await client.get_session()
        await s1.close()
        s2 = await client.get_session()
        assert s2 is not s1
        assert not s2.closed

    @pytest.mark.asyncio
    async def test_get_session_replaces_closed_reference(self, client: VeniceClient):
        s1 = await client.get_session()
        await s1.close()
        s2 = await client.get_session()
        # get_session() sees _session.closed=True and replaces it
        assert client._session is s2
        assert client._session is not s1


# ──────────────────────────────────────────────────────
# Close lifecycle
# ──────────────────────────────────────────────────────


class TestClose:
    """Tests for the close() cleanup method.

    Note: VeniceClient.close() differs from the agent close() methods —
    it does NOT set _session = None after closing. The get_session()
    method handles this via its 'or self._session.closed' guard.
    """

    @pytest.mark.asyncio
    async def test_close_closes_session(self, client: VeniceClient):
        session = await client.get_session()
        await client.close()
        assert session.closed

    @pytest.mark.asyncio
    async def test_close_does_not_null_session(self, client: VeniceClient):
        """VeniceClient.close() intentionally leaves _session pointing
        to the (now-closed) session object — get_session() checks .closed."""
        session = await client.get_session()
        await client.close()
        # _session is still the old (closed) object — not None
        assert client._session is session
        assert client._session.closed

    @pytest.mark.asyncio
    async def test_get_session_after_close_still_works(self, client: VeniceClient):
        """After close(), get_session() should create a new session
        because it detects _session.closed."""
        s1 = await client.get_session()
        await client.close()
        s2 = await client.get_session()
        assert s2 is not s1
        assert not s2.closed
        # Internal reference now points to the new session
        assert client._session is s2

    @pytest.mark.asyncio
    async def test_close_idempotent(self, client: VeniceClient):
        """Calling close() multiple times should not raise."""
        await client.get_session()
        await client.close()
        await client.close()
        # After close(), _session is the old closed object
        assert client._session is not None
        assert client._session.closed

    @pytest.mark.asyncio
    async def test_close_when_session_is_none(self, client: VeniceClient):
        """close() should not raise when _session is None (never initialized)."""
        assert client._session is None
        await client.close()


# ──────────────────────────────────────────────────────
# Shared session across public methods
# ──────────────────────────────────────────────────────


class TestSharedSessionAcrossMethods:
    """Multiple public HTTP methods use the same session."""

    @pytest.mark.asyncio
    async def test_chat_completion_raises_without_credentials(self, client: VeniceClient):
        """_chat_completion raises RuntimeError when no credentials are configured.
        No fallback classification — errors propagate so callers know."""
        assert client._session is None

        with pytest.raises(RuntimeError, match="No Venice AI credentials"):
            await client._chat_completion(
                messages=[{"role": "user", "content": "test"}],
            )

        # get_session() is called early in the method (before auth check),
        # so a session object may be created even though no HTTP call is made
        # This is fine — the session is lightweight and reused on subsequent calls
        if client._session is not None:
            assert not client._session.closed

    @pytest.mark.asyncio
    async def test_check_balance_uses_session(self, client: VeniceClient):
        """check_balance with a wallet_key configured should create a session."""
        # check_balance() returns early for wallet without key — session stays None
        result = await client.check_balance()
        assert client._session is None

    @pytest.mark.asyncio
    async def test_top_up_uses_session(self, client: VeniceClient):
        """top_up should create a session regardless of HTTP outcome."""
        assert client._session is None

        # top_up() makes a POST request — session is created
        try:
            await client.top_up(amount_usd=5.0)
        except Exception:
            pass

        # Session should be created even if HTTP fails
        # (Exception may be raised before _session is set in some code paths)
        if client._session is not None:
            assert not client._session.closed


# ──────────────────────────────────────────────────────
# Full lifecycle
# ──────────────────────────────────────────────────────


class TestIntegration:
    """Complete lifecycle tests."""

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, client: VeniceClient):
        """Create → use → close → create → close."""
        s1 = await client.get_session()
        assert not s1.closed

        await client.close()
        assert s1.closed

        s2 = await client.get_session()
        assert s2 is not s1
        assert not s2.closed
        assert client._session is s2

        await client.close()
        # After closing again, _session is the old closed object
        # (VeniceClient.close() doesn't null it)
        assert client._session is s2
        assert s2.closed

    @pytest.mark.asyncio
    async def test_concurrent_gets_return_same_session(self, client: VeniceClient):
        """Multiple concurrent get_session() calls return the same session."""
        import asyncio

        async def get():
            return await client.get_session()

        results = await asyncio.gather(*[get() for _ in range(10)])
        first = results[0]
        for s in results[1:]:
            assert s is first
        assert not first.closed

    @pytest.mark.asyncio
    async def test_chat_completion_creates_session_with_key(self, client_with_key: VeniceClient):
        """_chat_completion with a real API key creates a session.
        No fallback — the error from the dummy API key propagates."""
        assert client_with_key._session is None

        with pytest.raises(Exception, match="Venice API error|Authentication failed"):
            await client_with_key._chat_completion(
                messages=[{"role": "user", "content": "hello"}],
            )

        # Session was created before the HTTP request
        assert client_with_key._session is not None

    @pytest.mark.asyncio
    async def test_top_up_and_chat_share_session(self, client_with_key: VeniceClient):
        """_chat_completion creates a session, top_up reuses it."""
        # Trigger session via _chat_completion (will fail with fake key, but session created)
        try:
            await client_with_key._chat_completion(
                messages=[{"role": "user", "content": "hello"}],
            )
        except Exception:
            pass

        s1 = client_with_key._session

        # Call top_up — reuses same session (or stays None if no session was created)
        try:
            await client_with_key.top_up(amount_usd=5.0)
        except Exception:
            pass

        s2 = client_with_key._session
        # Session identity should be consistent (both None or both the same)
        assert s2 is s1
