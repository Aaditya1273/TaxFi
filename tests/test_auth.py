"""
Integration tests for TaxFi JWT authentication, API key auth, and rate limiting.

Uses a separate fixture from test_api.py that enables JWT auth (does NOT set
TAXFI_AUTH_DISABLED). Tests cover:
- Public endpoints are accessible without auth
- Protected endpoints return 401 without credentials
- /auth/login returns a valid JWT token
- Valid JWT grants access to protected endpoints
- Invalid/expired JWT is rejected
- Static API key via X-API-Key header works
- X-Request-ID header is propagated
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import uuid

import pytest
import pytest_asyncio

SAMPLE_ADDR = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
TEST_JWT_SECRET = "test-jwt-secret-for-testing-only"
TEST_API_KEY = "test-api-key-12345"


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _reload_api_with_auth(db_path: str):
    """Reload backend modules with auth ENABLED.

    Explicitly clears TAXFI_AUTH_DISABLED so this setting from test_api.py's
    fixture doesn't leak into auth tests.
    Must be called BEFORE the event loop starts (synchronous).
    """
    os.environ["TAXFI_DB_PATH"] = db_path
    os.environ["TAXFI_JWT_SECRET"] = TEST_JWT_SECRET
    os.environ["TAXFI_API_KEY"] = TEST_API_KEY
    # CRITICAL: ensure auth is ENABLED for these tests
    # Must be set BEFORE module reload because config.py now has load_dotenv()
    # which would re-set TAXFI_AUTH_DISABLED=true from .env file
    os.environ["TAXFI_AUTH_DISABLED"] = "false"

    # Clear Prometheus metrics before module reload
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
        pass

    # Force-reload all backend modules
    for mod_name in list(sys.modules.keys()):
        if mod_name.startswith("backend.") or mod_name in ("backend", "config", "taxfi", "database"):
            del sys.modules[mod_name]

    import backend.api as api_mod
    api_mod._orchestrator = None
    api_mod._continuous_task = None
    api_mod._ws_connections.clear()
    return api_mod


@pytest_asyncio.fixture(autouse=True)
async def _auth_isolated_db():
    """Create a temp DB and reload backend modules with AUTH ENABLED.

    Uses a unique JWT secret and API key for deterministic testing.
    Each test gets a clean DB and fresh module state.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    old_db = os.environ.get("TAXFI_DB_PATH")
    old_jwt = os.environ.get("TAXFI_JWT_SECRET")
    old_key = os.environ.get("TAXFI_API_KEY")
    old_auth = os.environ.get("TAXFI_AUTH_DISABLED")

    api_mod = _reload_api_with_auth(db_path)

    # Trigger startup
    orch = api_mod.get_orchestrator()
    await orch.start()

    yield api_mod

    # Cleanup env
    if old_auth is None:
        os.environ.pop("TAXFI_AUTH_DISABLED", None)
    else:
        os.environ["TAXFI_AUTH_DISABLED"] = old_auth
    if old_key is None:
        os.environ.pop("TAXFI_API_KEY", None)
    else:
        os.environ["TAXFI_API_KEY"] = old_key
    if old_jwt is None:
        os.environ.pop("TAXFI_JWT_SECRET", None)
    else:
        os.environ["TAXFI_JWT_SECRET"] = old_jwt
    if old_db is None:
        os.environ.pop("TAXFI_DB_PATH", None)
    else:
        os.environ["TAXFI_DB_PATH"] = old_db

    try:
        if api_mod._orchestrator is not None:
            try:
                await api_mod._orchestrator.db.close()
            except Exception:
                pass
        os.unlink(db_path)
    except (OSError, PermissionError, FileNotFoundError):
        pass


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_token(subject: str = SAMPLE_ADDR, expires_in: int = 3600) -> str:
    """Create a signed JWT using the test secret (mirrors auth_middleware.create_jwt_token)."""
    import jwt as pyjwt
    now = int(time.time())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_in,
        "jti": str(uuid.uuid4()),
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


# ── 1. Public endpoints are accessible without auth ─────────────────────────


@pytest.mark.asyncio
async def test_health_no_auth(_auth_isolated_db):
    """GET /health should work without any auth headers."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_metrics_no_auth(_auth_isolated_db):
    """GET /metrics should work without any auth headers."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/metrics")
        assert resp.status_code == 200
        text = resp.text
        assert "HELP" in text
        assert "taxfi_" in text


@pytest.mark.asyncio
async def test_auth_login_no_auth_header(_auth_isolated_db):
    """POST /auth/login should be accessible without an Authorization header."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "Bearer"


# ── 2. Protected endpoints return 401 without credentials ────────────────────


@pytest.mark.asyncio
async def test_config_requires_auth(_auth_isolated_db):
    """GET /config should return 401 without auth."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/config")
        assert resp.status_code == 401
        assert "Authorization" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_user_requires_auth(_auth_isolated_db):
    """POST /users should return 401 without auth."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/users", json={"address": SAMPLE_ADDR})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_pipeline_run_requires_auth(_auth_isolated_db):
    """POST /pipeline/run should return 401 without auth."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/pipeline/run")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_all_protected_endpoints_return_401(_auth_isolated_db):
    """Several protected endpoints should all return 401 without auth."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        endpoints = [
            ("GET", "/config"),
            ("GET", "/users"),
            ("GET", "/pipeline/status"),
            ("GET", "/opportunities"),
            ("GET", "/continuous/status"),
            ("GET", "/ledgers"),
        ]
        for method, path in endpoints:
            resp = await client.request(method, path)
            assert resp.status_code == 401, f"{method} {path} should 401, got {resp.status_code}"


# ── 3. /auth/login returns a valid JWT token ────────────────────────────────


@pytest.mark.asyncio
async def test_login_returns_access_token(_auth_isolated_db):
    """POST /auth/login should return a valid JWT token."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert data["expires_in"] == 86400

        import jwt as pyjwt
        payload = pyjwt.decode(data["access_token"], TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == SAMPLE_ADDR
        assert "iat" in payload
        assert "exp" in payload
        assert "jti" in payload


@pytest.mark.asyncio
async def test_login_with_empty_address(_auth_isolated_db):
    """POST /auth/login with invalid address should return 400."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty address
        resp = await client.post("/auth/login", json={"wallet_address": ""})
        assert resp.status_code == 400

        # Too short
        resp2 = await client.post("/auth/login", json={"wallet_address": "0xshort"})
        assert resp2.status_code == 400


@pytest.mark.asyncio
async def test_login_returns_different_tokens_each_time(_auth_isolated_db):
    """Each POST /auth/login should return a unique token (different jti)."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp1 = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        resp2 = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        data1 = resp1.json()
        data2 = resp2.json()
        assert data1["access_token"] != data2["access_token"]


# ── 4. Valid JWT grants access to protected endpoints ────────────────────────


@pytest.mark.asyncio
async def test_jwt_token_grants_access(_auth_isolated_db):
    """Protected endpoints should work with a valid Bearer token."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp1 = await client.get("/config", headers=headers)
        assert resp1.status_code == 200
        assert "cost_basis_method" in resp1.json()

        resp2 = await client.post("/users", headers=headers, json={"address": SAMPLE_ADDR})
        assert resp2.status_code == 200
        assert resp2.json()["success"] is True

        resp3 = await client.get("/pipeline/status", headers=headers)
        assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_jwt_with_wallet_subject(_auth_isolated_db):
    """Token's 'sub' claim should match the wallet address used to login."""
    from httpx import AsyncClient, ASGITransport
    import jwt as pyjwt
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        payload = pyjwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == SAMPLE_ADDR


# ── 5. Invalid / expired JWT is rejected ────────────────────────────────────


@pytest.mark.asyncio
async def test_invalid_token_rejected(_auth_isolated_db):
    """A malformed JWT should return 401."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/config",
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_rejected(_auth_isolated_db):
    """An expired JWT should return 401 with 'Token has expired' message."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        expired_token = _make_token(expires_in=1)
        time.sleep(1.1)

        resp = await client.get(
            "/config",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_wrong_secret_rejected(_auth_isolated_db):
    """A token signed with the wrong secret should return 401."""
    from httpx import AsyncClient, ASGITransport
    import jwt as pyjwt
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        wrong_payload = {
            "sub": SAMPLE_ADDR,
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "jti": str(uuid.uuid4()),
        }
        wrong_token = pyjwt.encode(wrong_payload, "wrong-secret", algorithm="HS256")

        resp = await client.get(
            "/config",
            headers={"Authorization": f"Bearer {wrong_token}"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_missing_bearer_prefix(_auth_isolated_db):
    """Authorization without 'Bearer ' prefix should be rejected."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = _make_token()
        resp = await client.get(
            "/config",
            headers={"Authorization": f"Token {token}"},
        )
        assert resp.status_code == 401


# ── 6. Static API key via X-API-Key header ──────────────────────────────────


@pytest.mark.asyncio
async def test_static_api_key_grants_access(_auth_isolated_db):
    """X-API-Key header should grant access to protected endpoints."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/config",
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 200
        assert "cost_basis_method" in resp.json()


@pytest.mark.asyncio
async def test_wrong_api_key_rejected(_auth_isolated_db):
    """An incorrect X-API-Key should return 401."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/config",
            headers={"X-API-Key": "wrong-key-99999"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_auth_works_after_login_via_x_api_key(_auth_isolated_db):
    """After using API key to register a user, JWT from login should also work."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/users",
            headers={"X-API-Key": TEST_API_KEY},
            json={"address": SAMPLE_ADDR},
        )
        assert resp.status_code == 200

        login_resp = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        resp2 = await client.get(
            "/config",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 200


# ── 7. X-Request-ID header propagation ──────────────────────────────────────


@pytest.mark.asyncio
async def test_request_id_header(_auth_isolated_db):
    """Every response should include an X-Request-ID header."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert "X-Request-ID" in resp.headers
        assert len(resp.headers["X-Request-ID"]) > 0


@pytest.mark.asyncio
async def test_request_id_passthrough(_auth_isolated_db):
    """If client sends X-Request-ID, the same value should be echoed back."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        custom_id = "my-custom-trace-id-12345"
        resp = await client.get("/health", headers={"X-Request-ID": custom_id})
        assert resp.headers["X-Request-ID"] == custom_id


# ── 8. Auth + pipeline operations end-to-end ───────────────────────────────


@pytest.mark.asyncio
async def test_pipeline_with_auth_flow(_auth_isolated_db):
    """Full auth flow: login → register user → run pipeline → check status."""
    from httpx import AsyncClient, ASGITransport
    m = _auth_isolated_db
    transport = ASGITransport(app=m.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/auth/login", json={"wallet_address": SAMPLE_ADDR})
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        reg = await client.post("/users", headers=headers, json={"address": SAMPLE_ADDR})
        assert reg.status_code == 200
        assert reg.json()["success"] is True

        pipeline = await client.post("/pipeline/run", headers=headers)
        assert pipeline.status_code == 200
        assert pipeline.json()["success"] is True

        status = await client.get("/pipeline/status", headers=headers)
        assert status.status_code == 200
        assert status.json()["users_registered"] >= 1

        opps = await client.get("/opportunities", headers=headers)
        assert opps.status_code == 200
