"""
Integration tests for _call_venice_api using aioresponses.

No more 402 retry path — the classifier now raises RuntimeError on any
non-200 HTTP response. These tests verify:

  - 200 returns parsed JSON correctly
  - 402, 500, and other errors raise RuntimeError
  - Authorization header is sent with Bearer key
  - Session is reused across calls
"""
from __future__ import annotations

import json
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from aioresponses import aioresponses

from backend.agents.classifier_agent import ClassifierAgent

# ──────────────────────────────────────────────────────
# Shared test data
# ──────────────────────────────────────────────────────

VENICE_BASE = "https://api.venice.ai/api/v1"
CHAT_URL = f"{VENICE_BASE}/chat/completions"

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


def chat_response(content: str) -> dict:
    """Shape of a successful Venice chat/completions response."""
    return {"choices": [{"message": {"content": content}}]}


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def classifier() -> AsyncGenerator[ClassifierAgent, None]:
    a = ClassifierAgent(config={"venice_api_key": "sk-test-fake"})
    try:
        yield a
    finally:
        await a.close()


# ──────────────────────────────────────────────────────
# ClassifierAgent — _call_venice_api via real aiohttp + aioresponses
# ──────────────────────────────────────────────────────


class TestClassifierAio:
    """ClassifierAgent _call_venice_api via real aiohttp + aioresponses."""

    @pytest.mark.asyncio
    async def test_classifier_200_returns_json(self, classifier: ClassifierAgent):
        """200 with valid JSON → returns parsed classification."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=200, payload=chat_response(VALID_CLASSIFICATION_JSON))
            result = await classifier._call_venice_api("Classify this transaction...")

        assert result["category"] == "SWAP"
        assert result["confidence"] == 0.95
        assert result["taxable"] is True

    @pytest.mark.asyncio
    async def test_classifier_402_raises(self, classifier: ClassifierAgent):
        """402 is treated as an error — raises RuntimeError."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=402, body="x402 balance insufficient")

            with pytest.raises(RuntimeError, match="Venice API error 402"):
                await classifier._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_classifier_500_raises(self, classifier: ClassifierAgent):
        """500 → raises RuntimeError."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=500, body="Internal Server Error")

            with pytest.raises(RuntimeError, match="Venice API error 500"):
                await classifier._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_classifier_429_raises(self, classifier: ClassifierAgent):
        """429 rate limit → raises RuntimeError."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=429, body="Rate limited")

            with pytest.raises(RuntimeError, match="Venice API error 429"):
                await classifier._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_classifier_bad_json_raises(self, classifier: ClassifierAgent):
        """200 but invalid JSON in content → raises JSONDecodeError."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=200, payload=chat_response("NOT JSON"))

            with pytest.raises(json.JSONDecodeError):
                await classifier._call_venice_api("Classify...")

    @pytest.mark.asyncio
    async def test_classifier_payload_contains_api_key(self, classifier: ClassifierAgent):
        """Verify the Authorization header is sent with the Bearer key."""
        with aioresponses() as m:
            async def check_headers(url, **kwargs):
                assert "Authorization" in kwargs.get("headers", {})
                assert kwargs["headers"]["Authorization"] == "Bearer sk-test-fake"
                return None

            m.post(CHAT_URL, callback=check_headers, status=200,
                   payload=chat_response(VALID_CLASSIFICATION_JSON))
            result = await classifier._call_venice_api("Classify...")

        assert result["category"] == "SWAP"

    @pytest.mark.asyncio
    async def test_classifier_session_reused(self, classifier: ClassifierAgent):
        """Multiple calls reuse the same session object."""
        with aioresponses() as m:
            m.post(CHAT_URL, status=200, payload=chat_response(VALID_CLASSIFICATION_JSON))
            m.post(CHAT_URL, status=200, payload=chat_response(VALID_CLASSIFICATION_JSON))

            s1 = classifier._session
            await classifier._call_venice_api("First call")
            session_after_first = classifier._session

            await classifier._call_venice_api("Second call")
            session_after_second = classifier._session

        assert s1 is None  # Session was None before first call
        assert session_after_first is not None
        assert session_after_second is session_after_first  # Same session reused
