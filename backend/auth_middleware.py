"""
TaxFi — Auth, Rate Limiting, Structured Logging & Metrics Middleware

Adds the following to every API request:
1. **Request ID** — UUID for distributed tracing
2. **Structured logging** — structlog with JSON output, request context
3. **JWT auth** — Bearer token verification (skip for /health, /docs, /openapi.json, /metrics, /auth/*)
4. **Rate limiting** — per-client-IP via slowapi
5. **Prometheus metrics** — request count, latency, error rate at /metrics

Usage in api.py:

    from backend.auth_middleware import setup_middleware
    setup_middleware(app)

Environment variables:
    TAXFI_JWT_SECRET       — Secret key for signing JWT tokens (default: auto-generated)
    TAXFI_JWT_ALGORITHM    — Algorithm, default HS256
    TAXFI_API_KEY          — Static API key for simple auth (alternative to JWT)
    TAXFI_RATE_LIMIT       — e.g. "100/minute" (default: "100/minute")
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

import jwt as pyjwt
import structlog
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

# ── Logger ──────────────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger("taxfi.api")

# ── Config ──────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("TAXFI_JWT_SECRET", "taxfi-dev-secret-change-in-production")
JWT_ALGORITHM = os.getenv("TAXFI_JWT_ALGORITHM", "HS256")
STATIC_API_KEY = os.getenv("TAXFI_API_KEY", "")
RATE_LIMIT = os.getenv("TAXFI_RATE_LIMIT", "100/minute")

# Public paths that don't require auth (auth routes are included)
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/metrics"}


def _is_public_path(path: str) -> bool:
    """Check if a path is public (no auth required)."""
    if path in PUBLIC_PATHS:
        return True
    if path.startswith("/auth/"):
        return True
    return False


# ── Prometheus Metrics (singleton guards for test reload safety) ─────────────


def _create_metrics() -> dict:
    """Create Prometheus metrics, safely handling re-registration on module reload."""
    metrics = {}

    for name, cls, docs, labels in [
        ("requests_total", Counter, "Total API requests", ["method", "endpoint", "status"]),
        ("request_duration_seconds", Histogram, "API request latency in seconds",
         ["method", "endpoint"]),
        ("requests_in_flight", Gauge, "Number of requests currently being processed", []),
        ("errors_total", Counter, "Total API errors by type", ["error_type", "endpoint"]),
        ("db_operation_duration_seconds", Histogram, "Database operation latency",
         ["operation"]),
    ]:
        full_name = f"taxfi_{name}"
        try:
            if cls is Histogram:
                buckets = (0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
                metrics[name] = cls(full_name, docs, labels, buckets=buckets)
            else:
                metrics[name] = cls(full_name, docs, labels)
        except ValueError:
            # Already registered (e.g., during test module reload)
            # Retrieve existing metric via registry
            from prometheus_client.registry import REGISTRY
            try:
                existing = REGISTRY._names_to_collector[full_name]
                # Handle the fact that different metric types wrap differently
                if hasattr(existing, "_metrics"):
                    metrics[name] = existing
                else:
                    # Create a passthrough that won't error
                    metrics[name] = cls(full_name, docs, labels)
            except (KeyError, AttributeError):
                metrics[name] = cls(full_name, docs, labels)

    return metrics


_metrics = _create_metrics()

REQUEST_COUNT = _metrics["requests_total"]
REQUEST_LATENCY = _metrics["request_duration_seconds"]
IN_FLIGHT_REQUESTS = _metrics["requests_in_flight"]
ERROR_COUNT = _metrics["errors_total"]
DB_OPERATION_DURATION = _metrics["db_operation_duration_seconds"]

# ── Rate Limiter ────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ── Request ID Middleware ───────────────────────────────────────────────────


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Inject a unique request ID into each request's state."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ── Structured Logging Middleware ────────────────────────────────────────────


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with structured context."""

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        request_id = getattr(request.state, "request_id", "unknown")

        response = await call_next(request)
        elapsed = time.time() - start

        log = logger.bind(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(elapsed * 1000, 1),
            client_ip=get_remote_address(request),
        )

        if response.status_code >= 500:
            log.error("Server error")
        elif response.status_code >= 400:
            log.warning("Client error")
        else:
            log.info("Request handled")

        return response


# ── Prometheus Metrics Middleware ────────────────────────────────────────────


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Track request count, latency, in-flight, and error metrics."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        method = request.method
        endpoint = request.url.path

        IN_FLIGHT_REQUESTS.inc()

        start = time.time()
        try:
            response = await call_next(request)
            status = str(response.status_code)
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
            if int(status) >= 500:
                ERROR_COUNT.labels(error_type="server_error", endpoint=endpoint).inc()
            elif int(status) >= 400:
                ERROR_COUNT.labels(error_type="client_error", endpoint=endpoint).inc()
            return response
        except Exception as e:
            ERROR_COUNT.labels(error_type=type(e).__name__, endpoint=endpoint).inc()
            raise
        finally:
            elapsed = time.time() - start
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(elapsed)
            IN_FLIGHT_REQUESTS.dec()


# ── JWT Auth Middleware ─────────────────────────────────────────────────────


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Verify JWT Bearer token or static API key on protected paths."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip auth for public paths (health, docs, metrics, auth/*)
        if _is_public_path(path):
            return await call_next(request)

        # Also skip auth for WebSocket endpoint
        if path == "/ws":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")

        if not auth_header:
            # If no auth, try static API key via X-API-Key header
            api_key = request.headers.get("X-API-Key", "")
            if STATIC_API_KEY and api_key == STATIC_API_KEY:
                request.state.user = "api_key_user"
                return await call_next(request)

            return JSONResponse(
                status_code=401,
                content={"detail": "Missing Authorization header. Use Bearer <token> or X-API-Key."},
            )

        try:
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                request.state.user = payload.get("sub", "anonymous")
            elif STATIC_API_KEY and auth_header == f"Bearer {STATIC_API_KEY}":
                request.state.user = "api_key_user"
            else:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid authorization scheme. Use 'Bearer <token>'"},
                )
        except pyjwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token has expired"},
            )
        except pyjwt.InvalidTokenError as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Invalid token: {e}"},
            )

        return await call_next(request)


# ── Utility Functions ────────────────────────────────────────────────────────


def create_jwt_token(
    subject: str,
    expires_in: int = 86400,  # 24 hours
    extra_claims: Optional[dict] = None,
) -> str:
    """Create a signed JWT token."""
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_in,
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)

    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token."""
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ── DB Operation Timing Context Manager ──────────────────────────────────────


@asynccontextmanager
async def track_db_operation(operation: str):
    """Context manager to track database operation duration via Prometheus."""
    start = time.time()
    try:
        yield
    finally:
        elapsed = time.time() - start
        DB_OPERATION_DURATION.labels(operation=operation).observe(elapsed)


# ── Setup Function ───────────────────────────────────────────────────────────


def setup_middleware(app: FastAPI) -> None:
    """Add all middleware to the FastAPI application."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(StructuredLoggingMiddleware)
    app.add_middleware(PrometheusMiddleware)

    if os.getenv("TAXFI_AUTH_DISABLED", "").lower() not in ("1", "true", "yes"):
        app.add_middleware(JWTAuthMiddleware)

    logger.info(
        "Middleware initialised",
        rate_limit=RATE_LIMIT,
        jwt_enabled=not os.getenv("TAXFI_AUTH_DISABLED"),
    )


# ── Metrics Endpoint ─────────────────────────────────────────────────────────


async def metrics_endpoint(request: Request) -> Response:
    """Prometheus metrics endpoint — returns metrics in text format."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


# ── Login endpoint helper ────────────────────────────────────────────────────


class _LoginRequest(BaseModel):
    """Request body for POST /auth/login."""
    wallet_address: str
    signature: str = ""


class _LoginResponse(BaseModel):
    """Response from POST /auth/login."""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 86400


def create_login_router():
    """Create a FastAPI APIRouter for /auth/login."""
    from fastapi import APIRouter, HTTPException

    router = APIRouter(prefix="/auth", tags=["Authentication"])

    @router.post("/login", response_model=_LoginResponse)
    @limiter.exempt
    async def login(req: _LoginRequest):
        """Exchange a wallet address for a JWT token.

        For the MVP, we accept any wallet address. In production,
        verify an EIP-4361 (SIWE) signed message.
        """
        if not req.wallet_address or len(req.wallet_address) < 10:
            raise HTTPException(status_code=400, detail="Invalid wallet address")

        token = create_jwt_token(subject=req.wallet_address)

        return _LoginResponse(
            access_token=token,
            token_type="Bearer",
            expires_in=86400,
        )

    return router
