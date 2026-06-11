"""
TaxFi — Database Persistence Layer

SQLite-backed persistence for the multi-agent pipeline.
Ensures cost basis ledgers, harvest opportunities, and pipeline
state survive application restarts.

Designed for:
- Single-process async access via aiosqlite
- Schema versioning with forward migrations
- Thread-safe serialised writes
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite

logger = logging.getLogger("taxfi.database")

# ── Schema ──────────────────────────────────────────────────────────────────

SCHEMA_VERSION = 1

CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS schema_version (
        version   INTEGER PRIMARY KEY,
        applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        address      TEXT PRIMARY KEY,
        display_name TEXT DEFAULT '',
        chains       TEXT DEFAULT '[]',      -- JSON list of chain IDs
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pipeline_runs (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address  TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'started',  -- started | running | complete | failed
        total_txns    INTEGER DEFAULT 0,
        classified    INTEGER DEFAULT 0,
        opportunities INTEGER DEFAULT 0,
        total_savings REAL    DEFAULT 0.0,
        error_message TEXT DEFAULT NULL,
        started_at    TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at   TEXT DEFAULT NULL,
        result_json   TEXT DEFAULT NULL,     -- full pipeline results snapshot
        FOREIGN KEY (user_address) REFERENCES users(address)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS cost_basis_ledgers (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address     TEXT NOT NULL,
        asset            TEXT NOT NULL,
        method           TEXT NOT NULL DEFAULT 'HIFO',
        total_acquired   REAL DEFAULT 0.0,
        total_sold       REAL DEFAULT 0.0,
        realized_gain_loss REAL DEFAULT 0.0,
        updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_address, asset),
        FOREIGN KEY (user_address) REFERENCES users(address)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS acquisition_lots (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address     TEXT NOT NULL,
        asset            TEXT NOT NULL,
        lot_id           TEXT NOT NULL,
        amount           REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        rate             REAL NOT NULL DEFAULT 0.0,
        cost_basis       REAL NOT NULL DEFAULT 0.0,
        timestamp        INTEGER NOT NULL DEFAULT 0,
        tx_hash          TEXT DEFAULT '',
        chain_id         TEXT DEFAULT '',
        consumed         INTEGER DEFAULT 0,  -- 0 = open, 1 = fully consumed
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_address) REFERENCES users(address)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_lots_user_asset ON acquisition_lots(user_address, asset);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_lots_remaining ON acquisition_lots(user_address, remaining_amount);
    """,
    """
    CREATE TABLE IF NOT EXISTS harvest_opportunities (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address        TEXT NOT NULL,
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
        executed            INTEGER DEFAULT 0,     -- 0 = pending, 1 = executed
        executed_at         TEXT DEFAULT NULL,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_address) REFERENCES users(address)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_opps_user ON harvest_opportunities(user_address);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_opps_pending ON harvest_opportunities(executed, priority);
    """,
]

# ── Helpers ─────────────────────────────────────────────────────────────────

_SCHEMA_CHECK_CACHE: dict[str, bool] = {}  # path -> already verified


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _now_ts() -> int:
    return int(time.time())


# ── Database ────────────────────────────────────────────────────────────────


class TaxFiDatabase:
    """
    SQLite persistence layer used by all TaxFi agents.

    Thread-safety:
      aiosqlite serialises writes automatically (single-writer mode).
      Reads are non-locking. This is sufficient for a single-process
      async application like TaxFi.
    """

    def __init__(self, db_path: str | Path) -> None:
        self._path = Path(db_path)
        self._conn: Optional[aiosqlite.Connection] = None
        self._closed = False

    # ── Connection lifecycle ─────────────────────────────────────────────

    async def connect(self) -> None:
        """Open the database connection and apply pending migrations."""
        if self._conn is not None:
            return

        # Ensure parent directory exists
        self._path.parent.mkdir(parents=True, exist_ok=True)

        self._conn = await aiosqlite.connect(str(self._path))
        self._conn.row_factory = aiosqlite.Row

        await self._migrate()

        logger.info("Database connected: %s", self._path)

    async def close(self) -> None:
        if self._conn and not self._closed:
            await self._conn.close()
            self._conn = None
            self._closed = True
            logger.info("Database closed")

    @property
    def is_connected(self) -> bool:
        return self._conn is not None and not self._closed

    async def __aenter__(self) -> "TaxFiDatabase":
        await self.connect()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    # ── Migrations ───────────────────────────────────────────────────────

    async def _migrate(self) -> None:
        """Run pending schema migrations."""
        assert self._conn is not None
        cursor = await self._conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='schema_version'"
        )
        row = await cursor.fetchone()
        existing_version = 0
        if row and row[0] == 1:
            cur2 = await self._conn.execute("SELECT MAX(version) FROM schema_version")
            r2 = await cur2.fetchone()
            existing_version = r2[0] if r2 and r2[0] else 0

        if existing_version < SCHEMA_VERSION:
            logger.info(
                "Running schema migration %d → %d", existing_version, SCHEMA_VERSION
            )
            for ddl in CREATE_TABLES_SQL:
                await self._conn.execute(ddl)
            await self._conn.execute(
                "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
                (SCHEMA_VERSION,),
            )
            await self._conn.commit()
            logger.info("Schema migration complete (v%d)", SCHEMA_VERSION)

    # ── Users ────────────────────────────────────────────────────────────

    async def upsert_user(
        self,
        address: str,
        display_name: str = "",
        chains: Optional[list[str]] = None,
    ) -> None:
        await self._execute(
            """INSERT INTO users (address, display_name, chains, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(address) DO UPDATE SET
                 display_name = excluded.display_name,
                 chains       = excluded.chains,
                 updated_at   = excluded.updated_at""",
            (address, display_name, json.dumps(chains or []), _now_iso()),
        )

    async def get_user(self, address: str) -> Optional[dict]:
        row = await self._fetchone(
            "SELECT * FROM users WHERE address = ?", (address,)
        )
        if row:
            return dict(row)
        return None

    async def list_users(self) -> list[str]:
        rows = await self._fetchall("SELECT address FROM users ORDER BY created_at")
        return [r["address"] for r in rows]

    async def delete_user(self, address: str) -> None:
        await self._execute("DELETE FROM harvest_opportunities WHERE user_address = ?", (address,))
        await self._execute("DELETE FROM acquisition_lots WHERE user_address = ?", (address,))
        await self._execute("DELETE FROM cost_basis_ledgers WHERE user_address = ?", (address,))
        await self._execute("DELETE FROM pipeline_runs WHERE user_address = ?", (address,))
        await self._execute("DELETE FROM users WHERE address = ?", (address,))

    # ── Pipeline runs ───────────────────────────────────────────────────

    async def start_pipeline_run(self, user_address: str) -> int:
        cursor = await self._execute(
            """INSERT INTO pipeline_runs (user_address, status, started_at)
               VALUES (?, 'started', ?)""",
            (user_address, _now_iso()),
        )
        assert cursor.lastrowid is not None
        return cursor.lastrowid

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
        await self._execute(
            """UPDATE pipeline_runs SET
                 status=?, total_txns=?, classified=?, opportunities=?,
                 total_savings=?, error_message=?, finished_at=?,
                 result_json=?
               WHERE id=?""",
            (
                status, total_txns, classified, opportunities,
                total_savings, error_message, _now_iso(),
                result_json, run_id,
            ),
        )

    async def get_last_pipeline_run(self, user_address: str) -> Optional[dict]:
        row = await self._fetchone(
            """SELECT * FROM pipeline_runs
               WHERE user_address = ?
               ORDER BY id DESC LIMIT 1""",
            (user_address,),
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

    async def get_pipeline_runs(
        self, user_address: str, limit: int = 20
    ) -> list[dict]:
        rows = await self._fetchall(
            """SELECT id, status, total_txns, classified, opportunities,
                      total_savings, error_message, started_at, finished_at
               FROM pipeline_runs
               WHERE user_address = ?
               ORDER BY started_at DESC LIMIT ?""",
            (user_address, limit),
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
        await self._execute(
            """INSERT INTO cost_basis_ledgers
                 (user_address, asset, method, total_acquired, total_sold,
                  realized_gain_loss, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_address, asset) DO UPDATE SET
                 method             = excluded.method,
                 total_acquired     = excluded.total_acquired,
                 total_sold         = excluded.total_sold,
                 realized_gain_loss = excluded.realized_gain_loss,
                 updated_at         = excluded.updated_at""",
            (user_address, asset, method, total_acquired, total_sold,
             realized_gain_loss, _now_iso()),
        )

    async def get_all_ledgers(self, user_address: str) -> list[dict]:
        rows = await self._fetchall(
            """SELECT * FROM cost_basis_ledgers
               WHERE user_address = ?
               ORDER BY asset""",
            (user_address,),
        )
        return [dict(r) for r in rows]

    async def get_ledger(self, user_address: str, asset: str) -> Optional[dict]:
        row = await self._fetchone(
            "SELECT * FROM cost_basis_ledgers WHERE user_address=? AND asset=?",
            (user_address, asset),
        )
        return dict(row) if row else None

    # ── Acquisition lots ─────────────────────────────────────────────────

    async def insert_lot(self, user_address: str, lot: dict) -> None:
        await self._execute(
            """INSERT INTO acquisition_lots
                 (user_address, asset, lot_id, amount, remaining_amount,
                  rate, cost_basis, timestamp, tx_hash, chain_id, consumed)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
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
            ),
        )

    async def get_open_lots(
        self, user_address: str, asset: Optional[str] = None
    ) -> list[dict]:
        if asset:
            rows = await self._fetchall(
                """SELECT * FROM acquisition_lots
                   WHERE user_address=? AND asset=? AND consumed=0
                     AND remaining_amount > 0
                   ORDER BY timestamp""",
                (user_address, asset),
            )
        else:
            rows = await self._fetchall(
                """SELECT * FROM acquisition_lots
                   WHERE user_address=? AND consumed=0 AND remaining_amount > 0
                   ORDER BY asset, timestamp""",
                (user_address,),
            )
        return [dict(r) for r in rows]

    async def consume_lot(
        self, lot_id: str, remaining_amount: float, consumed: bool = False
    ) -> None:
        await self._execute(
            """UPDATE acquisition_lots
               SET remaining_amount=?, consumed=?
               WHERE lot_id=?""",
            (remaining_amount, 1 if consumed else 0, lot_id),
        )

    async def delete_all_lots(self, user_address: str, asset: str) -> None:
        await self._execute(
            "DELETE FROM acquisition_lots WHERE user_address=? AND asset=?",
            (user_address, asset),
        )

    # ── Harvest opportunities ────────────────────────────────────────────

    async def insert_opportunity(self, user_address: str, opp: dict) -> None:
        await self._execute(
            """INSERT INTO harvest_opportunities
                 (user_address, asset, asset_address, quantity,
                  cost_basis_per_unit, current_price, unrealized_loss,
                  loss_pct, holding_days, is_short_term, estimated_savings,
                  confidence, reasoning, recommended_rebuy, chain_id, priority)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
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
            ),
        )

    async def get_pending_opportunities(
        self, user_address: str, limit: int = 50
    ) -> list[dict]:
        rows = await self._fetchall(
            """SELECT * FROM harvest_opportunities
               WHERE user_address=? AND executed=0
               ORDER BY priority, estimated_savings DESC
               LIMIT ?""",
            (user_address, limit),
        )
        return [dict(r) for r in rows]

    async def mark_opportunity_executed(self, opp_id: int) -> None:
        await self._execute(
            """UPDATE harvest_opportunities
               SET executed=1, executed_at=?
               WHERE id=?""",
            (_now_iso(), opp_id),
        )

    async def get_executed_opportunities(
        self, user_address: str, limit: int = 50
    ) -> list[dict]:
        rows = await self._fetchall(
            """SELECT * FROM harvest_opportunities
               WHERE user_address=? AND executed=1
               ORDER BY executed_at DESC
               LIMIT ?""",
            (user_address, limit),
        )
        return [dict(r) for r in rows]

    async def clear_opportunities(self, user_address: str) -> None:
        await self._execute(
            "DELETE FROM harvest_opportunities WHERE user_address=? AND executed=0",
            (user_address,),
        )

    # ── Helpers ──────────────────────────────────────────────────────────

    async def _execute(self, sql: str, params: tuple = ()) -> aiosqlite.Cursor:
        assert self._conn is not None, "Database not connected"
        cursor = await self._conn.execute(sql, params)
        await self._conn.commit()
        return cursor

    async def _fetchone(self, sql: str, params: tuple = ()) -> Optional[aiosqlite.Row]:
        assert self._conn is not None
        cursor = await self._conn.execute(sql, params)
        return await cursor.fetchone()

    async def _fetchall(self, sql: str, params: tuple = ()) -> list[aiosqlite.Row]:
        assert self._conn is not None
        cursor = await self._conn.execute(sql, params)
        return await cursor.fetchall()

    # ── Snapshot / restore (for testing & backup) ────────────────────────

    async def export_snapshot(self, user_address: str) -> dict[str, Any]:
        """Export all data for a user as a JSON-serialisable dict."""
        return {
            "user": await self.get_user(user_address),
            "last_pipeline_run": await self.get_last_pipeline_run(user_address),
            "ledgers": await self.get_all_ledgers(user_address),
            "open_lots": [dict(r) for r in await self.get_open_lots(user_address)],
            "pending_opportunities": await self.get_pending_opportunities(user_address),
            "executed_opportunities": await self.get_executed_opportunities(user_address),
        }

    async def import_snapshot(self, user_address: str, snapshot: dict[str, Any]) -> None:
        """Restore a previously exported snapshot (for testing)."""
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
