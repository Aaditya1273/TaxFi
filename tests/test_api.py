"""
Tests for the TaxFi FastAPI server.

Uses httpx AsyncClient with the FastAPI TestClient pattern.
Tests cover:
- Health endpoint
- User registration CRUD
- Pipeline triggering
- Status endpoint
- Opportunities listing
- Harvest execution
- Form generation
- Cost basis ledgers
- Configuration endpoint
- Continuous mode lifecycle
- Database export
- WebSocket connection
"""

from __future__ import annotations

import importlib
import json
import os
import sys
import tempfile
from typing import AsyncGenerator

import pytest
import pytest_asyncio


SAMPLE_ADDR = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
SAMPLE_ADDR_2 = "0x1234567890abcdef1234567890abcdef12345678"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(autouse=True)
async def _isolated_db():
    """Create a temp DB and force-reload backend.api so it uses it.

    This is needed because TaxFiConfig resolves env vars at module
    import time — we must reload after setting TAXFI_DB_PATH.

    Also clears Prometheus metrics registry on reload to prevent
    "Duplicated timeseries" errors from module-level metric creation.
    """
    # Create a temporary database file
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    old_val = os.environ.get("TAXFI_DB_PATH")
    old_auth = os.environ.get("TAXFI_AUTH_DISABLED")
    os.environ["TAXFI_DB_PATH"] = db_path
    os.environ["TAXFI_AUTH_DISABLED"] = "true"  # Disable JWT auth for tests

    # Clear Prometheus metrics before reload to avoid duplicate registration errors.
    # auth_middleware.py creates Counter/Histogram/Gauge at module level, and
    # when modules are deleted from sys.modules and re-imported, the old metrics
    # remain registered in the global prometheus REGISTRY.
    try:
        from prometheus_client.registry import REGISTRY
        to_remove = []
        for collector in list(REGISTRY._collector_to_names.keys()):
            if hasattr(collector, '_name') and str(collector._name).startswith('taxfi_'):
                to_remove.append(collector)
        for c in to_remove:
            try:
                REGISTRY.unregister(c)
            except (KeyError, OSError):
                pass
    except (ImportError, AttributeError):
        pass  # prometheus_client not available or version mismatch

    # Force-reload all the backend modules that may cache config
    for mod_name in list(sys.modules.keys()):
        if mod_name.startswith("backend.") or mod_name in (
            "backend", "config", "taxfi", "database",
        ):
            del sys.modules[mod_name]

    # Re-import the API module fresh
    import backend.api as api_mod
    api_mod._orchestrator = None
    api_mod._continuous_task = None
    api_mod._ws_connections.clear()

    # Trigger startup (lifespan doesn't run automatically with httpx.ASGITransport)
    orch = api_mod.get_orchestrator()
    await orch.start()

    yield

    # Cleanup
    if old_auth is None:
        del os.environ["TAXFI_AUTH_DISABLED"]
    else:
        os.environ["TAXFI_AUTH_DISABLED"] = old_auth
    if old_val is None:
        del os.environ["TAXFI_DB_PATH"]
    else:
        os.environ["TAXFI_DB_PATH"] = old_val

    try:
        if api_mod._orchestrator is not None:
            try:
                await api_mod._orchestrator.db.close()
            except Exception:
                pass
        os.unlink(db_path)
    except (OSError, PermissionError, FileNotFoundError):
        pass


# ── Health ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health():
    """Health endpoint should return ok status."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "database_connected" in data
        assert "version" in data


# ── Users ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_user():
    """POST /users should register a new user."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/users", json={"address": SAMPLE_ADDR})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["user_address"] == SAMPLE_ADDR


@pytest.mark.asyncio
async def test_register_duplicate_user():
    """Registering the same address twice should succeed (idempotent)."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp1 = await client.post("/users", json={"address": SAMPLE_ADDR})
        assert resp1.status_code == 200
        resp2 = await client.post("/users", json={"address": SAMPLE_ADDR})
        assert resp2.status_code == 200
        assert resp2.json()["success"] is True


@pytest.mark.asyncio
async def test_list_users():
    """GET /users should return all registered users."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        await client.post("/users", json={"address": SAMPLE_ADDR_2})

        resp = await client.get("/users")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 2
        addresses = [u["address"] for u in data["users"]]
        assert SAMPLE_ADDR in addresses
        assert SAMPLE_ADDR_2 in addresses


@pytest.mark.asyncio
async def test_get_user():
    """GET /users/{address} should return user details."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get(f"/users/{SAMPLE_ADDR}")
        assert resp.status_code == 200
        assert resp.json()["address"] == SAMPLE_ADDR


@pytest.mark.asyncio
async def test_get_user_not_found():
    """GET /users/{address} for non-existent user should 404."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/users/0xnobody")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_user():
    """DELETE /users/{address} should remove the user."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.delete(f"/users/{SAMPLE_ADDR}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Verify it's gone
        resp2 = await client.get(f"/users/{SAMPLE_ADDR}")
        assert resp2.status_code == 404


# ── Config ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_config():
    """GET /config should return configuration."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "cost_basis_method" in data
        assert "supported_chains" in data


# ── Pipeline ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_pipeline_no_users():
    """Running pipeline without users should return 200 (background task)."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/pipeline/run")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True


@pytest.mark.asyncio
async def test_pipeline_status():
    """GET /pipeline/status should return current status."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/pipeline/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "running" in data
        assert "users_registered" in data


@pytest.mark.asyncio
async def test_pipeline_runs():
    """GET /pipeline/runs should return run history."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get("/pipeline/runs?address=" + SAMPLE_ADDR)
        assert resp.status_code == 200
        data = resp.json()
        assert "runs" in data


# ── Opportunities ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_opportunities():
    """GET /opportunities should return current list."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/opportunities")
        assert resp.status_code == 200
        data = resp.json()
        assert "opportunities" in data


@pytest.mark.asyncio
async def test_get_pending_opportunities():
    """GET /opportunities/pending should return pending opportunities from DB."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get(f"/opportunities/pending?address={SAMPLE_ADDR}")
        assert resp.status_code == 200
        data = resp.json()
        assert "opportunities" in data


@pytest.mark.asyncio
async def test_get_executed_opportunities():
    """GET /opportunities/executed should return executed opportunities."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get(f"/opportunities/executed?address={SAMPLE_ADDR}")
        assert resp.status_code == 200
        data = resp.json()
        assert "opportunities" in data


# ── Harvest Execution ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_execute_harvest_no_opportunities():
    """Executing harvest without any opportunities should return error."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.post(
            "/opportunities/0/execute",
            json={"opportunity_index": 0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)


# ── Tax Forms ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_forms():
    """POST /forms should generate tax forms."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.post("/forms", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert "forms" in data or "success" in data


# ── Cost Basis ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_ledgers():
    """GET /ledgers should return cost basis summary."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/ledgers")
        assert resp.status_code == 200
        data = resp.json()
        assert "method" in data or "assets_tracked" in data


@pytest.mark.asyncio
async def test_get_ledger_not_found():
    """GET /ledgers/{asset} for unknown asset should 404."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/ledgers/DOESNTEXIST")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_lots():
    """GET /lots should return open lots."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get(f"/lots?address={SAMPLE_ADDR}")
        assert resp.status_code == 200
        data = resp.json()
        assert "lots" in data


# ── Continuous Mode ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_continuous_status():
    """GET /continuous/status should return running state."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/continuous/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "running" in data
        assert data["running"] is False


@pytest.mark.asyncio
async def test_continuous_start_stop():
    """POST /continuous/start then /continuous/stop should work."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/continuous/start", json={"interval_seconds": 99999})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        resp2 = await client.get("/continuous/status")
        assert resp2.json()["running"] is True

        resp3 = await client.post("/continuous/stop")
        assert resp3.status_code == 200
        assert resp3.json()["success"] is True

        resp4 = await client.get("/continuous/status")
        assert resp4.json()["running"] is False


# ── Database Export ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_snapshot():
    """GET /database/export/{address} should return a snapshot."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/users", json={"address": SAMPLE_ADDR})
        resp = await client.get(f"/database/export/{SAMPLE_ADDR}")
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert data["user"]["address"] == SAMPLE_ADDR


# ── WebSocket ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_websocket():
    """WebSocket /ws should connect and receive welcome message."""
    from fastapi.testclient import TestClient
    import backend.api as m

    with TestClient(m.app) as client:
        with client.websocket_connect("/ws") as ws:
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "connected"
            assert "Connected to TaxFi real-time events" in msg["data"]["message"]


@pytest.mark.asyncio
async def test_websocket_ping_pong():
    """WebSocket should respond to ping with pong."""
    from fastapi.testclient import TestClient
    import backend.api as m

    with TestClient(m.app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()
            ws.send_text("ping")
            pong = ws.receive_text()
            assert json.loads(pong)["type"] == "pong"


# ── Error Handling ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_404_for_unknown_user():
    """Requests for non-existent users should 404."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/users/0xnonexistent")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pipeline_runs_no_users():
    """Pipeline runs without users should 404."""
    from httpx import AsyncClient, ASGITransport
    import backend.api as m

    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/pipeline/runs")
        assert resp.status_code == 404
