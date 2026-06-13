"""
TaxFi — FastAPI Server

REST API for the TaxFi multi-agent pipeline.
Exposes all orchestrator operations so the frontend can:
- Register/manage users
- Trigger pipeline runs and monitor status
- View cost basis ledgers and harvest opportunities
- Execute tax loss harvests
- Generate IRS tax forms
- Export database snapshots
- Authenticate via JWT or static API key

Run with: uvicorn backend.api:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Dynamically add Render URL to CORS if deployed there
_render_url = os.getenv("RENDER_EXTERNAL_URL", "")

from backend.auth_middleware import (
    create_jwt_token,
    create_login_router,
    limiter,
    metrics_endpoint,
    setup_middleware,
    track_db_operation,
)
from backend.config import TaxFiConfig, load_config
from backend.taxfi import TaxFiOrchestrator
from backend.utils.retry import all_circuit_stats

# ── Swagger metadata ────────────────────────────────────────────────────────

APP_TITLE = "TaxFi API"
APP_DESC = """
TaxFi — Crypto Tax Optimization Agent Pipeline

**Endpoints:**
- **Auth** — Login via wallet address, get JWT token
- **Users** — Register, list, delete wallet addresses
- **Pipeline** — Trigger scans, monitor status, view history
- **Opportunities** — Browse pending/executed tax loss harvests
- **Harvest Execution** — Execute harvests via 1Shot relayer
- **Cost Basis** — View ledgers and acquisition lots
- **Tax Forms** — Generate IRS Form 8949, Schedule D, Schedule 1
- **Continuous Mode** — Start/stop automatic periodic scanning
- **Database** — Export snapshots for backup
- **Metrics** — Prometheus metrics
- **Health** — Server status and configuration
"""

# ── Orchestrator singleton ──────────────────────────────────────────────────

_orchestrator: Optional[TaxFiOrchestrator] = None
_continuous_task: Optional[asyncio.Task] = None
_ws_connections: list[WebSocket] = []


def get_orchestrator() -> TaxFiOrchestrator:
    """Get the global orchestrator instance (lazy initialised)."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = TaxFiOrchestrator(config=load_config())
    return _orchestrator


# ── Pydantic models ────────────────────────────────────────────────────────


class RegisterUserRequest(BaseModel):
    address: str
    display_name: str = ""
    permission_context: Optional[dict] = None


class PipelineRunResponse(BaseModel):
    success: bool
    run_id: Optional[int] = None
    status: str = "started"
    message: str = ""


class ExecuteHarvestRequest(BaseModel):
    opportunity_index: int = 0
    user_address: Optional[str] = None
    permission_context: Optional[dict] = None


class GenerateFormsRequest(BaseModel):
    tax_year: Optional[int] = None


class ContinuousModeRequest(BaseModel):
    interval_seconds: int = 3600


class ConfigUpdateRequest(BaseModel):
    cost_basis_method: Optional[str] = None
    harvest_threshold_usd: Optional[float] = None
    agent_fee_bps: Optional[int] = None


# ── Lifecycle ───────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect database and restore state. Shutdown: clean up."""
    orchestrator = get_orchestrator()
    await orchestrator.start()
    logger = logging.getLogger("taxfi.api")
    logger.info(
        "TaxFi API started — %d user(s) restored from database",
        len(orchestrator._user_addresses),
    )
    yield
    # Shutdown
    global _continuous_task
    if _continuous_task and not _continuous_task.done():
        _continuous_task.cancel()
        try:
            await _continuous_task
        except asyncio.CancelledError:
            pass
    await orchestrator.cleanup()
    logger.info("TaxFi API shutdown complete")


# ── App factory ─────────────────────────────────────────────────────────────


app = FastAPI(
    title=APP_TITLE,
    description=APP_DESC,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the frontend dev server, Docker compose, and any production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (dev mode — restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Middleware: Auth, Rate Limiting, Structured Logging, Metrics ────────────

setup_middleware(app)

# ── Auth routes: POST /auth/login ──────────────────────────────────────────

app.include_router(create_login_router())

# ── Metrics endpoint (no auth) ──────────────────────────────────────────────


@app.get("/metrics", tags=["System"])
@limiter.exempt
async def metrics(request: Request):
    """Prometheus metrics endpoint — returns metrics in text format (exempt from rate limiting)."""
    return await metrics_endpoint(request)


# ── WebSocket helpers ──────────────────────────────────────────────────────


async def _broadcast(event_type: str, payload: dict) -> None:
    """Broadcast an event to all connected WebSocket clients."""
    msg = json.dumps(
        {"type": event_type, "data": payload, "timestamp": datetime.now(timezone.utc).isoformat()}
    )
    dead: list[WebSocket] = []
    for ws in list(_ws_connections):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _ws_connections:
            _ws_connections.remove(ws)


# ── Health & Config ─────────────────────────────────────────────────────────


@app.get("/", tags=["System"])
@limiter.exempt
async def root():
    """Root endpoint - returns API information."""
    return {
        "name": "TaxFi API",
        "version": "0.1.0",
        "description": "Crypto Tax Optimization Agent Pipeline",
        "endpoints": {
            "health": "/health",
            "config": "/config",
            "metrics": "/metrics",
            "docs": "/docs",
            "users": "/users",
            "pipeline": "/pipeline",
            "opportunities": "/opportunities",
            "ledgers": "/ledgers",
            "forms": "/forms",
        },
    }


@app.get("/favicon.ico", tags=["System"])
@limiter.exempt
async def favicon():
    """Favicon endpoint - returns 204 to prevent 404 errors."""
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/health", tags=["System"])
@limiter.exempt
async def health(request: Request):
    """Server health check with orchestrator and circuit breaker status."""
    orch = get_orchestrator()
    return {
        "status": "ok",
        "database_connected": orch.db.is_connected,
        "pipeline_running": orch._pipeline_running,
        "users_registered": len(orch._user_addresses),
        "last_scan": orch._last_scan_time.isoformat() if orch._last_scan_time else None,
        "version": "0.1.0",
        "circuit_breakers": all_circuit_stats(),
    }


@app.get("/config", tags=["System"])
async def get_config():
    """Return the current runtime configuration."""
    orch = get_orchestrator()
    return {
        "cost_basis_method": orch.config.get("cost_basis_method", "HIFO"),
        "harvest_threshold_usd": orch.config.get("harvest_threshold_usd", 100.0),
        "agent_fee_bps": orch.config.get("agent_fee_bps", 500),
        "supported_chains": orch.config.get("supported_chains", []),
        "batch_size": orch.config.get("batch_size", 100),
        "scan_interval_seconds": orch.config.get("scan_interval_seconds", 3600),
        "db_path": _get_db_path(orch),
    }


def _get_db_path(orch) -> str:
    """Get the database path/URL for display."""
    if hasattr(orch.db, "_path"):
        return orch.db._path.as_posix()
    if hasattr(orch.db, "_dsn"):
        # Mask password in DSN for logging
        dsn = orch.db._dsn
        if ":" in dsn and "@" in dsn:
            parts = dsn.split("@")
            creds = parts[0].split(":")
            if len(creds) > 2:
                creds[2] = "****"
            parts[0] = ":".join(creds)
            dsn = "@".join(parts)
        return dsn
    return "~/.taxfi/taxfi.db"


# ── Users ───────────────────────────────────────────────────────────────────


@app.post("/users", tags=["Users"])
async def register_user(req: RegisterUserRequest):
    """Register a wallet address with TaxFi (persisted to database)."""
    orch = get_orchestrator()
    async with track_db_operation("register_user"):
        result = await orch.register_user(
            address=req.address,
            permission_context=req.permission_context,
            display_name=req.display_name,
        )
    await _broadcast("user_registered", {"address": req.address})
    return result


@app.get("/users", tags=["Users"])
async def list_users():
    """List all registered user addresses."""
    orch = get_orchestrator()
    async with track_db_operation("list_users"):
        addresses = await orch.db.list_users()
        users = []
        for addr in addresses:
            user = await orch.db.get_user(addr)
            users.append(user)
    return {"users": users, "count": len(users)}


@app.get("/users/{address}", tags=["Users"])
async def get_user(address: str):
    """Get details for a specific user."""
    orch = get_orchestrator()
    async with track_db_operation("get_user"):
        user = await orch.db.get_user(address)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.delete("/users/{address}", tags=["Users"])
async def delete_user(address: str):
    """Delete a user and all associated data."""
    orch = get_orchestrator()
    async with track_db_operation("delete_user"):
        await orch.db.delete_user(address)
    if address in orch._user_addresses:
        orch._user_addresses.remove(address)
    await _broadcast("user_deleted", {"address": address})
    return {"success": True, "address": address}


# ── Pipeline ────────────────────────────────────────────────────────────────


@app.post("/pipeline/run", tags=["Pipeline"])
async def run_pipeline(
    addresses: str = Query("", description="Comma-separated address list"),
    chains: str = Query("", description="Comma-separated chain IDs"),
):
    """Trigger a full pipeline run: Ingest → Classify → Basis → Detect."""
    orch = get_orchestrator()
    target_addrs = [a.strip() for a in addresses.split(",") if a.strip()] if addresses else None
    target_chains = [c.strip() for c in chains.split(",") if c.strip()] if chains else None

    # Use background task so we can return immediately
    async def _run_and_broadcast():
        try:
            await _broadcast(
                "pipeline_started", {"addresses": target_addrs or orch._user_addresses}
            )
            async with track_db_operation("pipeline_run"):
                results = await orch.run_full_pipeline(
                    addresses=target_addrs,
                    scan_chains=target_chains,
                )
            await _broadcast(
                "pipeline_completed",
                {
                    "success": results.get("success", False),
                    "total_txns": results.get("ingest", {}).get("total_txns", 0),
                    "opportunities": len(results.get("loss_detector", {}).get("opportunities", [])),
                    "total_savings": results.get("loss_detector", {}).get("total_savings", 0),
                    "error": results.get("error"),
                },
            )
        except Exception as e:
            await _broadcast("pipeline_error", {"error": str(e)})

    asyncio.create_task(_run_and_broadcast())

    return {
        "success": True,
        "message": "Pipeline started in background",
        "addresses": target_addrs or orch._user_addresses,
    }


@app.get("/pipeline/status", tags=["Pipeline"])
async def pipeline_status():
    """Get current pipeline status."""
    orch = get_orchestrator()
    return orch.get_status()


@app.get("/pipeline/runs", tags=["Pipeline"])
async def pipeline_runs(
    address: str = "",
    limit: int = Query(default=20, le=100),
):
    """Get pipeline run history for a user."""
    orch = get_orchestrator()
    target = address or (orch._user_addresses[0] if orch._user_addresses else "")
    if not target:
        raise HTTPException(status_code=404, detail="No users registered")
    async with track_db_operation("pipeline_runs"):
        runs = await orch.db.get_pipeline_runs(target, limit=limit)
    return {"runs": runs, "count": len(runs)}


# ── Opportunities ───────────────────────────────────────────────────────────


@app.get("/opportunities", tags=["Opportunities"])
async def get_opportunities():
    """Get current harvest opportunities from the last pipeline run."""
    orch = get_orchestrator()
    return {
        "opportunities": orch.get_opportunities(),
        "count": len(orch.get_opportunities()),
    }


@app.get("/opportunities/pending", tags=["Opportunities"])
async def get_pending_opportunities(
    address: str = "",
    limit: int = Query(default=50, le=200),
):
    """Get pending harvest opportunities from the database."""
    orch = get_orchestrator()
    target = address or (orch._user_addresses[0] if orch._user_addresses else "")
    if not target:
        return {"opportunities": [], "count": 0}
    async with track_db_operation("get_pending_opps"):
        pending = await orch.db.get_pending_opportunities(target, limit=limit)
    return {"opportunities": pending, "count": len(pending)}


@app.get("/opportunities/executed", tags=["Opportunities"])
async def get_executed_opportunities(
    address: str = "",
    limit: int = Query(default=50, le=200),
):
    """Get executed harvest opportunities from the database."""
    orch = get_orchestrator()
    target = address or (orch._user_addresses[0] if orch._user_addresses else "")
    if not target:
        return {"opportunities": [], "count": 0}
    async with track_db_operation("get_executed_opps"):
        executed = await orch.db.get_executed_opportunities(target, limit=limit)
    return {"opportunities": executed, "count": len(executed)}


@app.post("/opportunities/{index}/execute", tags=["Opportunities"])
async def execute_harvest(
    index: int,
    req: ExecuteHarvestRequest,
):
    """Execute a tax loss harvest."""
    orch = get_orchestrator()
    result = await orch.execute_harvest(
        opportunity_index=index,
        user_address=req.user_address,
        permission_context=req.permission_context,
    )
    if result.get("success"):
        await _broadcast(
            "harvest_executed",
            {
                "opportunity_index": index,
                "result": result,
            },
        )
    return result


# ── Tax Forms ───────────────────────────────────────────────────────────────


@app.post("/forms", tags=["Tax Forms"])
async def generate_forms(req: GenerateFormsRequest):
    """Generate IRS tax forms from processed cost basis data."""
    orch = get_orchestrator()
    forms = await orch.generate_tax_forms(tax_year=req.tax_year)
    return forms


# ── Cost Basis ──────────────────────────────────────────────────────────────


@app.get("/ledgers", tags=["Cost Basis"])
async def get_ledgers():
    """Get all cost basis ledgers for the first registered user."""
    orch = get_orchestrator()
    summary = orch.basis.get_summary() if hasattr(orch.basis, "get_summary") else {}
    return summary


@app.get("/ledgers/{asset}", tags=["Cost Basis"])
async def get_ledger(asset: str):
    """Get cost basis ledger for a specific asset."""
    orch = get_orchestrator()
    ledger = orch.basis.ledgers.get(asset)
    if ledger is None:
        raise HTTPException(status_code=404, detail=f"No ledger found for {asset}")
    return {
        "asset": ledger.asset,
        "method": ledger.method.value,
        "total_acquired": ledger.total_acquired,
        "total_sold": ledger.total_sold,
        "realized_gain_loss": ledger.realized_gain_loss,
        "lot_count": len(ledger.lots),
        "lots": [
            {
                "lot_id": l.lot_id,
                "amount": l.amount,
                "remaining": l.remaining_amount,
                "rate": l.rate,
                "cost_basis": l.cost_basis,
                "timestamp": l.timestamp,
                "chain_id": l.chain_id,
                "tx_hash": l.tx_hash,
            }
            for l in ledger.lots
        ],
    }


@app.get("/lots", tags=["Cost Basis"])
async def get_open_lots(
    address: str = "",
    asset: str = "",
):
    """Get open acquisition lots from the database."""
    orch = get_orchestrator()
    target = address or (orch._user_addresses[0] if orch._user_addresses else "")
    if not target:
        return {"lots": [], "count": 0}
    async with track_db_operation("get_open_lots"):
        lots = await orch.db.get_open_lots(target, asset=asset or None)
    return {"lots": lots, "count": len(lots)}


# ── Continuous Mode ────────────────────────────────────────────────────────


@app.post("/continuous/start", tags=["Continuous Mode"])
async def start_continuous(req: ContinuousModeRequest):
    """Start background continuous scanning."""
    global _continuous_task
    orch = get_orchestrator()

    if _continuous_task and not _continuous_task.done():
        return {"success": False, "message": "Continuous mode already running"}

    async def _continuous_wrapper():
        try:
            await orch.run_continuous(interval_seconds=req.interval_seconds)
        except asyncio.CancelledError:
            logging.getLogger("taxfi.api").info("Continuous mode task cancelled")

    _continuous_task = asyncio.create_task(_continuous_wrapper())
    await _broadcast("continuous_started", {"interval_seconds": req.interval_seconds})
    return {
        "success": True,
        "message": f"Continuous scanning started (interval: {req.interval_seconds}s)",
    }


@app.post("/continuous/stop", tags=["Continuous Mode"])
async def stop_continuous():
    """Stop background continuous scanning."""
    global _continuous_task
    if _continuous_task and not _continuous_task.done():
        _continuous_task.cancel()
        try:
            await _continuous_task
        except asyncio.CancelledError:
            pass
        _continuous_task = None
        await _broadcast("continuous_stopped", {})
        return {"success": True, "message": "Continuous scanning stopped"}
    return {"success": False, "message": "Continuous mode was not running"}


@app.get("/continuous/status", tags=["Continuous Mode"])
async def continuous_status():
    """Check if continuous mode is active."""
    global _continuous_task
    return {
        "running": _continuous_task is not None and not _continuous_task.done(),
    }


# ── Database ────────────────────────────────────────────────────────────────


@app.get("/database/export/{address}", tags=["Database"])
async def export_snapshot(address: str):
    """Export all data for a user as a JSON snapshot."""
    orch = get_orchestrator()
    async with track_db_operation("export_snapshot"):
        snapshot = await orch.db.export_snapshot(address)
    return snapshot


# ── WebSocket ──────────────────────────────────────────────────────────────


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket for real-time pipeline events.

    Events broadcast:
    - `user_registered` — new user added
    - `pipeline_started` — pipeline execution began
    - `pipeline_completed` — pipeline finished with results
    - `pipeline_error` — pipeline failed
    - `harvest_executed` — a harvest was executed
    - `continuous_started/stopped` — continuous mode changes
    """
    await websocket.accept()
    _ws_connections.append(websocket)
    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "connected",
                    "data": {"message": "Connected to TaxFi real-time events"},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        )
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except WebSocketDisconnect:
                break
    except Exception:
        pass
    finally:
        if websocket in _ws_connections:
            _ws_connections.remove(websocket)


# ── Direct entry point ──────────────────────────────────────────────────────


def main():
    """Run the FastAPI server with uvicorn."""
    import uvicorn

    port = int(os.getenv("TAXFI_API_PORT", "8000"))
    host = os.getenv("TAXFI_API_HOST", "0.0.0.0")
    uvicorn.run("backend.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
