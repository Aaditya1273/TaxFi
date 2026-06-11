"""
TaxFi — PostgreSQL Persistence Layer

Asynchronous PostgreSQL backend for the TaxFi multi-agent pipeline.
Implements the same interface as TaxFiDatabase (SQLite) so the
orchestrator can switch between backends via TAXFI_DB_TYPE=postgres.

Usage:
    TAXFI_DB_TYPE=postgres
    TAXFI_PG_DSN=postgresql://taxfi:password@localhost:5432/taxfi

Schema is auto-created on connect via CREATE TABLE IF NOT EXISTS.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import asyncpg

logger = logging.getLogger("taxfi.database.postgres")

# ── Schema — mirrors database.py exactly ────────────────────────────────────

SCHEMA_VERSION = 1

CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS schema_version (
        version   INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        address      TEXT PRIMARY KEY,
        display_name TEXT DEFAULT '',
        chains       TEXT DEFAULT '[]',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pipeline_runs (
        id            SERIAL PRIMARY KEY,
        user_address  TEXT NOT NULL REFERENCES users(address),
        status        TEXT NOT NULL DEFAULT 'started',
        total_txns    INTEGER DEFAULT 0,
        classified    INTEGER DEFAULT 0,
        opportunities INTEGER DEFAULT 0,
        total_savings REAL    DEFAULT 0.0,
        error_message TEXT DEFAULT NULL,
        started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at   TIMESTAMPTZ DEFAULT NULL,
        result_json   TEXT DEFAULT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS cost_basis_ledgers (
        id                 SERIAL PRIMARY KEY,
        user_address       TEXT NOT NULL REFERENCES users(address),
        asset              TEXT NOT NULL,
        method             TEXT NOT NULL DEFAULT 'HIFO',
        total_acquired     REAL DEFAULT 0.0,
        total_sold         REAL DEFAULT 0.0,
        realized_gain_loss REAL DEFAULT 0.0,
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_address, asset)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS acquisition_lots (
        id               SERIAL PRIMARY KEY,
        user_address     TEXT NOT NULL REFERENCES users(address),
        asset            TEXT NOT NULL,
        lot_id           TEXT NOT NULL,
        amount           REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        rate             REAL NOT NULL DEFAULT 0.0,
        cost_basis       REAL NOT NULL DEFAULT 0.0,
        timestamp        BIGINT NOT NULL DEFAULT 0,
        tx_hash          TEXT DEFAULT '',
        chain_id         TEXT DEFAULT '',
        consumed         INTEGER DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_lots_user_asset_pg
        ON acquisition_lots(user_address, asset);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_lots_remaining_pg
        ON acquisition_lots(user_address, remaining_amount);
    """,
    """
    CREATE TABLE IF NOT EXISTS harvest_opportunities (
        id                  SERIAL PRIMARY KEY,
        user_address        TEXT NOT NULL REFERENCES users(address),
        asset               TEXT NOT NULL,
        asset_address       TEXT DEFAULT '',
        quantity            REAL NOT NULL,
        cost_basis_per_unit REAL NOT NULL,
        current_price       REAL NOT NULL,
        unrealized_loss     REAL NOT NULL,
        loss_pct            REAL NOT NULL,
        holding_days        INTEGER NOT NULL,
        is_short_term       INTEGER NOT NULL DEFAULT 1,
        estimated_savings   REAL NOT NULL,
        confidence          REAL DEFAULT 0.0,
        reasoning           TEXT DEFAULT '',
        recommended_rebuy   TEXT DEFAULT NULL,
        chain_id            TEXT DEFAULT '',
        priority            INTEGER DEFAULT 5,
        executed            INTEGER DEFAULT 0,
        executed_at         TIMESTAMPTZ DEFAULT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_opps_user_pg
        ON harvest_opportunities(user_address);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_opps_pending_pg
        ON harvest_opportunities(executed, priority);
    """,
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── PostgreSQL Database ─────────────────────────────────────────────────────


class TaxFiPostgresDatabase:
    """PostgreSQL persistence layer, same interface as TaxFiDatabase."""

    def __init__(self, dsn: Optional[str] = None) -> None:
        self._dsn = dsn or os.getenv(
            "TAXFI_PG_DSN",
            "postgresql://taxfi:taxfi@localhost:5432/taxfi",
        )
        self._pool: Optional[asyncpg.Pool] = None
        self._closed = False

    @property
    def is_connected(self) -> bool:
        return self._pool is not None and not self._closed

    async def connect(self) -> None:
        """Create connection pool and run migrations."""
        if self._pool is not None:
            return

        self._pool = await asyncpg.create_pool(
            self._dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        await self._migrate()
        logger.info("PostgreSQL connected: %s", self._dsn.split("@")[-1] if "@" in self._dsn else self._dsn)

    async def close(self) -> None:
        if self._pool and not self._closed:
            await self._pool.close()
            self._pool = None
            self._closed = True
            logger.info("PostgreSQL connection closed")

    async def _migrate(self) -> None:
        """Run schema migrations."""
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            # Check current version
            row = await conn.fetchrow(
                "SELECT COUNT(*) as cnt FROM information_schema.tables "
                "WHERE table_name = 'schema_version'"
            )
            existing_version = 0
            if row and row["cnt"] > 0:
                version_row = await conn.fetchrow("SELECT MAX(version) as v FROM schema_version")
                existing_version = version_row["v"] if version_row and version_row["v"] else 0

            if existing_version < SCHEMA_VERSION:
                logger.info("Running PG schema migration %d → %d", existing_version, SCHEMA_VERSION)
                for ddl in CREATE_TABLES_SQL:
                    await conn.execute(ddl)
                await conn.execute(
                    "INSERT INTO schema_version (version) VALUES ($1) "
                    "ON CONFLICT (version) DO NOTHING",
                    SCHEMA_VERSION,
                )
                logger.info("PG schema migration complete (v%d)", SCHEMA_VERSION)

    # ── Users ────────────────────────────────────────────────────────────

    async def upsert_user(
        self,
        address: str,
        display_name: str = "",
        chains: Optional[list[str]] = None,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO users (address, display_name, chains, updated_at)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (address) DO UPDATE SET
                     display_name = EXCLUDED.display_name,
                     chains       = EXCLUDED.chains,
                     updated_at   = EXCLUDED.updated_at""",
                address,
                display_name,
                json.dumps(chains or []),
                _now_iso(),
            )

    async def get_user(self, address: str) -> Optional[dict]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE address = $1", address)
            if row:
                return dict(row)
            return None

    async def list_users(self) -> list[str]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT address FROM users ORDER BY created_at")
            return [r["address"] for r in rows]

    async def delete_user(self, address: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute("DELETE FROM harvest_opportunities WHERE user_address = $1", address)
            await conn.execute("DELETE FROM acquisition_lots WHERE user_address = $1", address)
            await conn.execute("DELETE FROM cost_basis_ledgers WHERE user_address = $1", address)
            await conn.execute("DELETE FROM pipeline_runs WHERE user_address = $1", address)
            await conn.execute("DELETE FROM users WHERE address = $1", address)

    # ── Pipeline runs ───────────────────────────────────────────────────

    async def start_pipeline_run(self, user_address: str) -> int:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO pipeline_runs (user_address, status, started_at) "
                "VALUES ($1, 'started', $2) RETURNING id",
                user_address,
                _now_iso(),
            )
            return row["id"]

    async def finish_pipeline_run(
        self,
        run_id: int,
        status: str,
        total_txns: int = 0,
        classified: int = 0,
        opportunities: int = 0,
        total_savings: float = 0.0,
        error_message: Optional[str] = None,
        result_json: Optional[str] = None,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """UPDATE pipeline_runs SET
                     status=$1, total_txns=$2, classified=$3, opportunities=$4,
                     total_savings=$5, error_message=$6, finished_at=$7,
                     result_json=$8
                   WHERE id=$9""",
                status, total_txns, classified, opportunities,
                total_savings, error_message, _now_iso(),
                result_json, run_id,
            )

    async def get_last_pipeline_run(self, user_address: str) -> Optional[dict]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM pipeline_runs WHERE user_address = $1 ORDER BY id DESC LIMIT 1",
                user_address,
            )
            if row:
                d = dict(row)
                if d.get("result_json"):
                    try:
                        d["result"] = json.loads(d["result_json"])
                    except (json.JSONDecodeError, TypeError):
                        d["result"] = {}
                return d
            return None

    async def get_pipeline_runs(self, user_address: str, limit: int = 20) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, status, total_txns, classified, opportunities,
                          total_savings, error_message, started_at, finished_at
                   FROM pipeline_runs
                   WHERE user_address = $1
                   ORDER BY started_at DESC LIMIT $2""",
                user_address, limit,
            )
            return [dict(r) for r in rows]

    # ── Cost basis ledgers ───────────────────────────────────────────────

    async def upsert_ledger(
        self,
        user_address: str,
        asset: str,
        method: str = "HIFO",
        total_acquired: float = 0.0,
        total_sold: float = 0.0,
        realized_gain_loss: float = 0.0,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO cost_basis_ledgers
                     (user_address, asset, method, total_acquired, total_sold,
                      realized_gain_loss, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (user_address, asset) DO UPDATE SET
                     method             = EXCLUDED.method,
                     total_acquired     = EXCLUDED.total_acquired,
                     total_sold         = EXCLUDED.total_sold,
                     realized_gain_loss = EXCLUDED.realized_gain_loss,
                     updated_at         = EXCLUDED.updated_at""",
                user_address, asset, method, total_acquired, total_sold,
                realized_gain_loss, _now_iso(),
            )

    async def get_all_ledgers(self, user_address: str) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM cost_basis_ledgers WHERE user_address = $1 ORDER BY asset",
                user_address,
            )
            return [dict(r) for r in rows]

    async def get_ledger(self, user_address: str, asset: str) -> Optional[dict]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM cost_basis_ledgers WHERE user_address = $1 AND asset = $2",
                user_address, asset,
            )
            return dict(row) if row else None

    # ── Acquisition lots ─────────────────────────────────────────────────

    async def insert_lot(self, user_address: str, lot: dict) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO acquisition_lots
                     (user_address, asset, lot_id, amount, remaining_amount,
                      rate, cost_basis, timestamp, tx_hash, chain_id, consumed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                user_address,
                lot["asset"],
                lot["lot_id"],
                lot["amount"],
                lot.get("remaining_amount", lot["amount"]),
                lot["rate"],
                lot["cost_basis"],
                lot.get("timestamp", 0),
                lot.get("tx_hash", ""),
                lot.get("chain_id", ""),
                0,
            )

    async def get_open_lots(self, user_address: str, asset: Optional[str] = None) -> list[dict]:
        async with self._pool.acquire() as conn:
            if asset:
                rows = await conn.fetch(
                    """SELECT * FROM acquisition_lots
                       WHERE user_address = $1 AND asset = $2 AND consumed = 0
                         AND remaining_amount > 0
                       ORDER BY timestamp""",
                    user_address, asset,
                )
            else:
                rows = await conn.fetch(
                    """SELECT * FROM acquisition_lots
                       WHERE user_address = $1 AND consumed = 0 AND remaining_amount > 0
                       ORDER BY asset, timestamp""",
                    user_address,
                )
            return [dict(r) for r in rows]

    async def consume_lot(self, lot_id: str, remaining_amount: float, consumed: bool = False) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE acquisition_lots SET remaining_amount = $1, consumed = $2 WHERE lot_id = $3",
                remaining_amount, 1 if consumed else 0, lot_id,
            )

    async def delete_all_lots(self, user_address: str, asset: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM acquisition_lots WHERE user_address = $1 AND asset = $2",
                user_address, asset,
            )

    # ── Harvest opportunities ────────────────────────────────────────────

    async def insert_opportunity(self, user_address: str, opp: dict) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO harvest_opportunities
                     (user_address, asset, asset_address, quantity,
                      cost_basis_per_unit, current_price, unrealized_loss,
                      loss_pct, holding_days, is_short_term, estimated_savings,
                      confidence, reasoning, recommended_rebuy, chain_id, priority)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)""",
                user_address,
                opp["asset"],
                opp.get("address", ""),
                opp["quantity"],
                opp["cost_basis"],
                opp["current_price"],
                opp["unrealized_loss"],
                opp["loss_pct"],
                opp["holding_days"],
                1 if opp.get("is_short_term") else 0,
                opp["estimated_savings"],
                opp.get("confidence", 0.0),
                opp.get("reasoning", ""),
                opp.get("recommended_rebuy"),
                opp.get("chain", ""),
                opp.get("priority", 5),
            )

    async def get_pending_opportunities(self, user_address: str, limit: int = 50) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM harvest_opportunities
                   WHERE user_address = $1 AND executed = 0
                   ORDER BY priority, estimated_savings DESC
                   LIMIT $2""",
                user_address, limit,
            )
            return [dict(r) for r in rows]

    async def mark_opportunity_executed(self, opp_id: int) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE harvest_opportunities SET executed = 1, executed_at = $1 WHERE id = $2",
                _now_iso(), opp_id,
            )

    async def get_executed_opportunities(self, user_address: str, limit: int = 50) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM harvest_opportunities WHERE user_address = $1 AND executed = 1 "
                "ORDER BY executed_at DESC LIMIT $2",
                user_address, limit,
            )
            return [dict(r) for r in rows]

    async def clear_opportunities(self, user_address: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM harvest_opportunities WHERE user_address = $1 AND executed = 0",
                user_address,
            )

    # ── Snapshot / restore ───────────────────────────────────────────────

    async def export_snapshot(self, user_address: str) -> dict[str, Any]:
        return {
            "user": await self.get_user(user_address),
            "last_pipeline_run": await self.get_last_pipeline_run(user_address),
            "ledgers": await self.get_all_ledgers(user_address),
            "open_lots": await self.get_open_lots(user_address),
            "pending_opportunities": await self.get_pending_opportunities(user_address),
            "executed_opportunities": await self.get_executed_opportunities(user_address),
        }

    async def import_snapshot(self, user_address: str, snapshot: dict[str, Any]) -> None:
        user = snapshot.get("user")
        if user:
            await self.upsert_user(
                user_address,
                display_name=user.get("display_name", ""),
                chains=json.loads(user.get("chains", "[]")),
            )
        for ledger in snapshot.get("ledgers", []):
            await self.upsert_ledger(
                user_address,
                ledger["asset"],
                method=ledger.get("method", "HIFO"),
                total_acquired=ledger.get("total_acquired", 0.0),
                total_sold=ledger.get("total_sold", 0.0),
                realized_gain_loss=ledger.get("realized_gain_loss", 0.0),
            )
        for lot in snapshot.get("open_lots", []):
            await self.insert_lot(user_address, lot)
        for opp in snapshot.get("pending_opportunities", []):
            await self.insert_opportunity(user_address, opp)
        for opp in snapshot.get("executed_opportunities", []):
            await self.insert_opportunity(user_address, opp)
            if opp.get("id"):
                await self.mark_opportunity_executed(opp["id"])
