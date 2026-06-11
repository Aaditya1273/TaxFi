"""
Tests for the 1Shot API relayer integration.

Tests the OneshotClient's ability to:
- Discover relayer capabilities
- Estimate fees
- Build harvest execution delegations
- Handle errors gracefully with fallbacks
- Circuit breaker integration
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def oneshot_client():
    """Create a OneshotClient with test settings."""
    from backend.integrations.oneshot import OneshotClient

    return OneshotClient(
        api_key="test-key",
        api_secret="test-secret",
        chain_id="eip155:11155111",
    )


@pytest.mark.asyncio
async def test_default_capabilities_fallback(oneshot_client):
    """When the relayer is unreachable, should return sensible defaults."""
    with patch("aiohttp.ClientSession.post", side_effect=Exception("Connection refused")):
        caps = await oneshot_client.get_capabilities()

    assert "targetAddress" in caps
    assert "feeCollector" in caps
    assert "tokens" in caps
    assert "minFee" in caps
    assert caps["minFee"] == "10000"


@pytest.mark.asyncio
async def test_default_fee_estimate(oneshot_client):
    """When fee estimation fails, should return default values."""
    with patch("aiohttp.ClientSession.post", side_effect=Exception("API error")):
        estimate = await oneshot_client.estimate_fee(delegation={"executions": []})

    assert estimate["success"] is True
    assert estimate["required_payment"] == "1000000"


@pytest.mark.asyncio
async def test_build_harvest_execution(oneshot_client):
    """Harvest execution bundle should contain proper ERC-20 transfer."""
    delegation = await oneshot_client.build_harvest_execution(
        user_address="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
        token_address="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        amount="1000000",
        fee_amount="10000",
        fee_collector="0x1111111111111111111111111111111111111111",
    )

    assert delegation["from"] == "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
    assert delegation["scope"]["type"] == "erc20-transfer-amount"
    assert delegation["scope"]["token"] == "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
    assert len(delegation["executions"]) == 1
    assert delegation["executions"][0]["data"].startswith("0xa9059cbb")


@pytest.mark.asyncio
async def test_send_transaction_circuit_breaker(oneshot_client):
    """send_transaction should return success with a task_id on valid response."""
    mock_post = AsyncMock()
    mock_post.__aenter__.return_value = mock_post
    mock_post.__aexit__.return_value = None
    mock_post.status = 200

    async def mock_json():
        return {"result": "task-123"}

    mock_post.json = mock_json

    with patch("aiohttp.ClientSession.post", return_value=mock_post):
        result = await oneshot_client.send_transaction(
            delegation={"signed_delegation": {"test": "data"}, "executions": []},
            memo="test-harvest-001",
        )

    assert result["success"] is True
    assert result["task_id"] == "task-123"
    assert result["status"] == "submitted"


@pytest.mark.asyncio
async def test_send_transaction_retry(oneshot_client):
    """send_transaction should handle errors gracefully (circuit breaker)."""
    mock_post = AsyncMock()
    mock_post.__aenter__.return_value = mock_post
    mock_post.__aexit__.return_value = None
    mock_post.status = 503
    mock_post.text = AsyncMock(return_value="Service Unavailable")

    with patch("aiohttp.ClientSession.post", return_value=mock_post):
        result = await oneshot_client.send_transaction(
            delegation={"signed_delegation": {"test": "data"}, "executions": []},
        )

    # Should handle the error gracefully
    assert result["success"] is False or "error" in result


@pytest.mark.asyncio
async def test_check_status(oneshot_client):
    """check_status should correctly parse relayer status codes."""
    mock_post = AsyncMock()
    mock_post.__aenter__.return_value = mock_post
    mock_post.__aexit__.return_value = None
    mock_post.status = 200

    async def mock_json():
        return {"result": {"status": 200, "hash": "0xabc123", "message": "Confirmed"}}

    mock_post.json = mock_json

    with patch("aiohttp.ClientSession.post", return_value=mock_post):
        result = await oneshot_client.check_status("task-789")

    assert result["success"] is True
    assert result["status_code"] == 200
    assert result["status"] == "confirmed"
    assert result["is_terminal"] is True
    assert result["tx_hash"] == "0xabc123"


@pytest.mark.asyncio
async def test_status_labels():
    """Status label mapping should cover all known codes."""
    from backend.integrations.oneshot import OneshotClient

    assert OneshotClient._status_label(100) == "pending"
    assert OneshotClient._status_label(200) == "confirmed"
    assert OneshotClient._status_label(500) == "reverted"
    assert OneshotClient._status_label(999) == "unknown_999"


@pytest.mark.asyncio
async def test_supported_chains():
    """SUPPORTED_CHAINS should include Sepolia."""
    from backend.integrations.oneshot import SUPPORTED_CHAINS

    assert "eip155:11155111" in SUPPORTED_CHAINS
    assert SUPPORTED_CHAINS["eip155:11155111"]["name"] == "Sepolia"
    assert "dev" in SUPPORTED_CHAINS["eip155:11155111"]["relayer"]
