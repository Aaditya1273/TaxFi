"""
TaxFi — Monitoring and Health Check Utilities

Provides health checks, metrics, and system status endpoints.
"""

import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)


# ── Metrics ─────────────────────────────────────────────────────────────────

# Pipeline metrics
PIPELINE_RUNS_TOTAL = Counter(
    'taxfi_pipeline_runs_total',
    'Total number of pipeline runs',
    ['status'],  # success, failed, no_data
)

PIPELINE_DURATION_SECONDS = Histogram(
    'taxfi_pipeline_duration_seconds',
    'Pipeline execution duration in seconds',
    ['phase'],  # ingest, classify, basis, detect
)

TRANSACTIONS_PROCESSED = Counter(
    'taxfi_transactions_processed_total',
    'Total transactions processed',
    ['status'],  # classified, failed
)

HARVEST_OPPORTUNITIES_TOTAL = Counter(
    'taxfi_harvest_opportunities_total',
    'Total harvest opportunities found',
    ['chain'],
)

HARVEST_EXECUTIONS_TOTAL = Counter(
    'taxfi_harvest_executions_total',
    'Total harvest executions',
    ['status'],  # success, failed
)

USERS_REGISTERED_TOTAL = Gauge(
    'taxfi_users_registered_total',
    'Number of registered users',
)

LEDGERS_TOTAL = Gauge(
    'taxfi_ledgers_total',
    'Number of cost basis ledgers',
)

API_REQUESTS_TOTAL = Counter(
    'taxfi_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status'],
)

API_DURATION_SECONDS = Histogram(
    'taxfi_api_duration_seconds',
    'API request duration in seconds',
    ['method', 'endpoint'],
)


# ── Health Check ────────────────────────────────────────────────────────────


@dataclass
class HealthStatus:
    """Health check result."""
    status: str  # healthy, degraded, unhealthy
    checks: dict[str, dict[str, Any]]
    timestamp: str
    version: str = "0.1.0"


async def check_database_health(db) -> dict[str, Any]:
    """Check database connectivity."""
    try:
        if hasattr(db, 'is_connected'):
            connected = db.is_connected
        else:
            # Try a simple query
            await db.execute("SELECT 1")
            connected = True
        
        return {
            "status": "healthy" if connected else "unhealthy",
            "connected": connected,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e),
        }


async def check_external_services_health(config: dict) -> dict[str, dict]:
    """Check external service dependencies."""
    checks = {}
    
    # Venice AI
    try:
        venice_key = config.get('venice_api_key') or config.get('venice_wallet_key')
        checks['venice_ai'] = {
            "status": "healthy" if venice_key else "degraded",
            "configured": bool(venice_key),
        }
    except Exception as e:
        checks['venice_ai'] = {"status": "unhealthy", "error": str(e)}

    # Covalent
    try:
        covalent_key = config.get('covalent_api_key')
        checks['covalent'] = {
            "status": "healthy" if covalent_key else "degraded",
            "configured": bool(covalent_key),
        }
    except Exception as e:
        checks['covalent'] = {"status": "unhealthy", "error": str(e)}

    # 1Shot
    try:
        oneshot_key = config.get('oneshot_api_key')
        checks['oneshot'] = {
            "status": "healthy" if oneshot_key else "degraded",
            "configured": bool(oneshot_key),
        }
    except Exception as e:
        checks['oneshot'] = {"status": "unhealthy", "error": str(e)}

    return checks


async def perform_health_check(db, config: dict) -> HealthStatus:
    """Perform full health check."""
    checks = {
        "database": await check_database_health(db),
        "external_services": await check_external_services_health(config),
    }

    # Determine overall status
    db_status = checks["database"]["status"]
    
    external_statuses = [
        s["status"] for s in checks["external_services"].values()
    ]
    
    if db_status == "unhealthy":
        overall = "unhealthy"
    elif "unhealthy" in external_statuses:
        overall = "degraded"
    elif "degraded" in external_statuses:
        overall = "degraded"
    else:
        overall = "healthy"

    return HealthStatus(
        status=overall,
        checks=checks,
        timestamp=datetime.utcnow().isoformat(),
    )


def get_metrics() -> bytes:
    """Get Prometheus metrics in text format."""
    return generate_latest()


def get_metrics_content_type() -> str:
    """Get the content type for metrics."""
    return CONTENT_TYPE_LATEST


# ── Status Reporting ─────────────────────────────────────────────────────────


def get_system_status() -> dict[str, Any]:
    """Get system status for API responses."""
    return {
        "version": "0.1.0",
        "environment": os.getenv("TAXFI_ENV", "development"),
        "uptime_seconds": int(time.time() - __import__('time').time()),
        "python_version": f"{__import__('sys').version_info.major}.{__import__('sys').version_info.minor}",
    }