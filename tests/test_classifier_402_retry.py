"""
Tests for ClassifierAgent._call_venice_api — no more 402 retry.

The classifier now requires a VENICE_API_KEY and raises RuntimeError
on any non-200 HTTP response. The old _handle_402_and_retry flow has
been removed entirely — 402 is treated like any other error status.

Mocking approach:
  - Use MagicMock for the session (session.post() is a regular method,
    not async — it returns a context manager, not a coroutine)
  - Each mock response has __aenter__ configured to return itself
    so `async with resp_mock as resp` produces the expected object
"""
from __future__ import annotations

import json
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest
import pytest_asyncio

from backend.agents.classifier_agent import ClassifierAgent

# ──────────────────────────────────────────────────────
# Helpers — build mock aiohttp responses
# ──────────────────────────────────────────────────────


def mock_response(status: int, json_data: dict | None = None, text: str = "") -> MagicMock:
    """
    Build a MagicMock that behaves like an aiohttp.ClientResponse
    inside a context manager:

        async with session.post(...) as resp:
            resp.status      # = status
            await resp.json()  # = json_data
            await resp.text()  # = text
    """
    resp = MagicMock(spec=aiohttp.ClientResponse)
    resp.status = status
    resp.json = AsyncMock(return_value=json_data or {})
    resp.text = AsyncMock(return_value=text or str(json_data or {}))
    # Make `async with resp_mock as x` return the mock itself
    resp.__aenter__.return_value = resp
    resp.__aexit__.return_value = None
    return resp


def mock_venice_success(content: str) -> MagicMock:
    """Venice API 200 response with JSON content in choices[0].message.content."""
    return mock_response(
        status=200,
        json_data={
            "choices": [{"message": {"content": content}}],
        },
    )


VALID_CLASSIFICATION_JSON = json.dumps({
    "category": "SWAP",
    "confidence": 0.95,
    "reasoning": "Token A for Token B exchange detected",
    "taxable": True,
    "basis_method": "HIFO",
    "cost_basis_asset": "ETH",
    "is_lp_event": False,
    "notes": "",
})


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def agent() -> AsyncGenerator[ClassifierAgent, None]:
    """ClassifierAgent with an API key configured so Bearer auth is used."""
    a = ClassifierAgent(config={"venice_api_key": "sk-test-fake"})
    try:
        yield a
    finally:
        await a.close()


# ──────────────────────────────────────────────────────
# _call_venice_api tests (no 402 retry — all non-200 raises RuntimeError)
# ──────────────────────────────────────────────────────


class TestCallVeniceApi:
    """_call_venice_api() raises RuntimeError on non-200 responses."""

    @pytest.mark.asyncio
    async def test_200_returns_parsed_json(self, agent: ClassifierAgent):
        """200 with valid JSON → returns parsed classification."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_venice_success(VALID_CLASSIFICATION_JSON)
        agent._session = mock_sess

        result = await agent._call_venice_api("Classify this transaction...")

        assert result["category"] == "SWAP"
        assert result["confidence"] == 0.95
        assert result["taxable"] is True

    @pytest.mark.asyncio
    async def test_402_raises_runtime_error(self, agent: ClassifierAgent):
        """402 is treated as an error — raises RuntimeError."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_response(
            status=402,
            json_data={"error": "x402 balance insufficient"},
            text="x402 balance insufficient",
        )
        agent._session = mock_sess

        with pytest.raises(RuntimeError, match="Venice API error 402"):
            await agent._call_venice_api("Classify this transaction...")

    @pytest.mark.asyncio
    async def test_500_raises_runtime_error(self, agent: ClassifierAgent):
        """500 Internal Server Error → raises RuntimeError."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_response(
            status=500,
            text="Internal Server Error",
        )
        agent._session = mock_sess

        with pytest.raises(RuntimeError, match="Venice API error 500"):
            await agent._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_bad_json_response_raises(self, agent: ClassifierAgent):
        """200 but invalid JSON content → raises JSONDecodeError."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_venice_success("NOT JSON")
        agent._session = mock_sess

        with pytest.raises(json.JSONDecodeError):
            await agent._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_missing_choices_raises(self, agent: ClassifierAgent):
        """200 but response missing 'choices' key → raises KeyError."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_response(
            status=200,
            json_data={"not": "expected"},
        )
        agent._session = mock_sess

        with pytest.raises(KeyError):
            await agent._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_payload_contains_api_key(self, agent: ClassifierAgent):
        """Verify the Authorization header is sent with the Bearer key."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_venice_success(VALID_CLASSIFICATION_JSON)
        agent._session = mock_sess

        await agent._call_venice_api("Classify...")

        # Verify headers were passed
        call_kwargs = mock_sess.post.call_args.kwargs
        assert "headers" in call_kwargs
        assert call_kwargs["headers"]["Authorization"] == "Bearer sk-test-fake"

    @pytest.mark.asyncio
    async def test_reuses_shared_session(self, agent: ClassifierAgent):
        """Multiple calls reuse the same session object."""
        mock_sess = MagicMock(spec=aiohttp.ClientSession)
        mock_sess.closed = False
        mock_sess.post.return_value = mock_venice_success(VALID_CLASSIFICATION_JSON)
        agent._session = mock_sess

        await agent._call_venice_api("First call")
        await agent._call_venice_api("Second call")

        assert mock_sess.post.call_count == 2
        for call in mock_sess.post.call_args_list:
            assert "api.venice.ai/api/v1/chat/completions" in call[0][0]

    @pytest.mark.asyncio
    async def test_no_api_key_raises(self):
        """No VENICE_API_KEY configured → raises RuntimeError."""
        a = ClassifierAgent(config={})  # No api key
        with pytest.raises(RuntimeError, match="No VENICE_API_KEY configured"):
            await a._call_venice_api("Classify...")
        await a.close()
