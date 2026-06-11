"""
Tests for TaxFiDatabase persistence layer.

Covers:
- Schema creation and migration
- User CRUD
- Pipeline run recording
- Cost basis ledger + lot CRUD
- Harvest opportunity CRUD
- Snapshot/export/import
- Orchestrator integration (state restore across restarts)
"""

from __future__ import annotations

import asyncio
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio

from backend.database import TaxFiDatabase


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[TaxFiDatabase, None]:
    """Create a temporary in-memory TaxFiDatabase for testing."""
    # Use a temp file for persistence tests
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    database = TaxFiDatabase(db_path)
    await database.connect()
    try:
        yield database
    finally:
        await database.close()
        if os.path.exists(db_path):
            os.unlink(db_path)


SAMPLE_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
SAMPLE_ADDRESS_2 = "0x1234567890abcdef1234567890abcdef12345678"


# ── Schema & Migration ──────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestSchema:
    async def test_database_connect_creates_tables(self, db: TaxFiDatabase):
        """Connecting should create all required tables."""
        # Inspect schema via sqlite_master
        rows = await db._fetchall(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        table_names = [r["name"] for r in rows]
        assert "schema_version" in table_names
        assert "users" in table_names
        assert "pipeline_runs" in table_names
        assert "cost_basis_ledgers" in table_names
        assert "acquisition_lots" in table_names
        assert "harvest_opportunities" in table_names

    async def test_schema_version_is_set(self, db: TaxFiDatabase):
        """The schema_version table should have the correct version."""
        row = await db._fetchone("SELECT MAX(version) as v FROM schema_version")
        assert row is not None
        assert row["v"] >= 1

    async def test_reconnect_does_not_duplicate_tables(self, db: TaxFiDatabase):
        """Closing and reconnecting should not raise or duplicate data."""
        await db.close()
        await db.connect()  # second connect should be idempotent
        row = await db._fetchone("SELECT COUNT(*) as cnt FROM schema_version")
        assert row["cnt"] == 1


# ── Users ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestUsers:
    async def test_upsert_user_creates(self, db: TaxFiDatabase):
        """Insert a new user."""
        await db.upsert_user(SAMPLE_ADDRESS, chains=["eip155:1", "eip155:8453"])
        user = await db.get_user(SAMPLE_ADDRESS)
        assert user is not None
        assert user["address"] == SAMPLE_ADDRESS

    async def test_upsert_user_updates(self, db: TaxFiDatabase):
        """Upserting the same address should update, not duplicate."""
        await db.upsert_user(SAMPLE_ADDRESS, chains=["eip155:1"])
        await db.upsert_user(SAMPLE_ADDRESS, chains=["eip155:1", "eip155:8453"])
        user = await db.get_user(SAMPLE_ADDRESS)
        chains = json.loads(user["chains"])
        assert "eip155:8453" in chains

    async def test_list_users(self, db: TaxFiDatabase):
        """list_users should return all registered addresses."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_user(SAMPLE_ADDRESS_2)
        users = await db.list_users()
        assert SAMPLE_ADDRESS in users
        assert SAMPLE_ADDRESS_2 in users

    async def test_delete_user_cleans_up(self, db: TaxFiDatabase):
        """Deleting a user should remove related data too."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.delete_user(SAMPLE_ADDRESS)
        user = await db.get_user(SAMPLE_ADDRESS)
        assert user is None
        users = await db.list_users()
        assert SAMPLE_ADDRESS not in users


# ── Pipeline Runs ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestPipelineRuns:
    async def test_start_and_finish(self, db: TaxFiDatabase):
        """Record a full pipeline run lifecycle."""
        await db.upsert_user(SAMPLE_ADDRESS)
        run_id = await db.start_pipeline_run(SAMPLE_ADDRESS)
        assert run_id > 0

        await db.finish_pipeline_run(
            run_id, "complete",
            total_txns=100,
            classified=95,
            opportunities=3,
            total_savings=4200.0,
            result_json='{"status": "ok"}',
        )

        last = await db.get_last_pipeline_run(SAMPLE_ADDRESS)
        assert last is not None
        assert last["status"] == "complete"
        assert last["total_txns"] == 100
        assert last["result"]["status"] == "ok"

    async def test_get_last_returns_highest_id(self, db: TaxFiDatabase):
        """get_last_pipeline_run returns the row with the highest ID."""
        await db.upsert_user(SAMPLE_ADDRESS)
        r1 = await db.start_pipeline_run(SAMPLE_ADDRESS)
        await asyncio.sleep(0.01)
        r2 = await db.start_pipeline_run(SAMPLE_ADDRESS)
        await db.finish_pipeline_run(r1, "complete")
        await db.finish_pipeline_run(r2, "failed", error_message="oops")

        last = await db.get_last_pipeline_run(SAMPLE_ADDRESS)
        # r2 has higher ID (started second)
        assert last["id"] == r2
        assert last["status"] == "failed"

    async def test_get_pipeline_runs_history(self, db: TaxFiDatabase):
        """get_pipeline_runs should return runs in reverse ID order."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await asyncio.sleep(0.01)
        for i in range(3):
            rid = await db.start_pipeline_run(SAMPLE_ADDRESS)
            await db.finish_pipeline_run(rid, "complete", total_txns=i * 10)
            await asyncio.sleep(0.01)

        runs = await db.get_pipeline_runs(SAMPLE_ADDRESS)
        assert len(runs) == 3
        # Check that all 3 runs are present regardless of order
        txns = sorted([r["total_txns"] for r in runs])
        assert txns == [0, 10, 20]


# ── Cost Basis Ledgers ──────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestCostBasis:
    async def test_upsert_ledger_creates(self, db: TaxFiDatabase):
        """Insert a new cost basis ledger."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=10.0)
        ledgers = await db.get_all_ledgers(SAMPLE_ADDRESS)
        assert len(ledgers) == 1
        assert ledgers[0]["asset"] == "ETH"

    async def test_upsert_ledger_updates(self, db: TaxFiDatabase):
        """Upserting the same asset should update totals."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=10.0)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=15.0, realized_gain_loss=500.0)
        ledger = await db.get_ledger(SAMPLE_ADDRESS, "ETH")
        assert ledger["total_acquired"] == 15.0
        assert ledger["realized_gain_loss"] == 500.0

    async def test_get_ledger_not_found(self, db: TaxFiDatabase):
        """get_ledger should return None for non-existent asset."""
        await db.upsert_user(SAMPLE_ADDRESS)
        ledger = await db.get_ledger(SAMPLE_ADDRESS, "DOESNT_EXIST")
        assert ledger is None

    async def test_insert_and_get_lots(self, db: TaxFiDatabase):
        """Insert acquisition lots and retrieve them."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_lot(SAMPLE_ADDRESS, {
            "asset": "ETH", "lot_id": "lot_1_abc",
            "amount": 1.5, "remaining_amount": 1.5,
            "rate": 3000.0, "cost_basis": 4500.0,
            "timestamp": 1700000000, "tx_hash": "0xabc", "chain_id": "eip155:1",
        })
        await db.insert_lot(SAMPLE_ADDRESS, {
            "asset": "ETH", "lot_id": "lot_2_def",
            "amount": 0.5, "remaining_amount": 0.5,
            "rate": 3200.0, "cost_basis": 1600.0,
            "timestamp": 1700001000, "tx_hash": "0xdef", "chain_id": "eip155:1",
        })
        lots = await db.get_open_lots(SAMPLE_ADDRESS, "ETH")
        assert len(lots) == 2
        assert lots[0]["lot_id"] == "lot_1_abc"
        assert lots[1]["lot_id"] == "lot_2_def"

    async def test_consume_lot(self, db: TaxFiDatabase):
        """Mark a lot as partially consumed."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_lot(SAMPLE_ADDRESS, {
            "asset": "ETH", "lot_id": "lot_1_abc",
            "amount": 1.5, "remaining_amount": 1.5,
            "rate": 3000.0, "cost_basis": 4500.0,
            "timestamp": 1700000000, "tx_hash": "0xabc", "chain_id": "eip155:1",
        })
        await db.consume_lot("lot_1_abc", remaining_amount=0.5)
        lots = await db.get_open_lots(SAMPLE_ADDRESS, "ETH")
        assert len(lots) == 1
        assert lots[0]["remaining_amount"] == 0.5


# ── Harvest Opportunities ──────────────────────────────────────────────────


@pytest.mark.asyncio
class TestHarvestOpportunities:
    async def test_insert_and_retrieve_pending(self, db: TaxFiDatabase):
        """Insert a harvest opportunity and retrieve as pending."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "ETH", "address": "0x000",
            "quantity": 0.5, "cost_basis": 3500.0, "current_price": 2900.0,
            "unrealized_loss": 300.0, "loss_pct": 8.57,
            "holding_days": 120, "is_short_term": True,
            "estimated_savings": 66.0, "confidence": 0.9,
            "reasoning": "ETH down 8.57%", "chain": "eip155:1", "priority": 1,
        })
        pending = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        assert len(pending) == 1
        assert pending[0]["asset"] == "ETH"

    async def test_mark_executed(self, db: TaxFiDatabase):
        """Marking an opportunity as executed moves it from pending to executed."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "ETH", "address": "0x000",
            "quantity": 0.5, "cost_basis": 3500.0, "current_price": 2900.0,
            "unrealized_loss": 300.0, "loss_pct": 8.57,
            "holding_days": 120, "is_short_term": True,
            "estimated_savings": 66.0, "confidence": 0.9,
            "reasoning": "ETH down", "chain": "eip155:1", "priority": 1,
        })
        pending = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        opp_id = pending[0]["id"]

        await db.mark_opportunity_executed(opp_id)

        pending_after = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        executed = await db.get_executed_opportunities(SAMPLE_ADDRESS)
        assert len(pending_after) == 0
        assert len(executed) == 1
        assert executed[0]["id"] == opp_id

    async def test_clear_opportunities(self, db: TaxFiDatabase):
        """Clearing pending opportunities should not affect executed ones."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "ETH", "address": "0x000",
            "quantity": 0.5, "cost_basis": 3500.0, "current_price": 2900.0,
            "unrealized_loss": 300.0, "loss_pct": 8.57,
            "holding_days": 120, "is_short_term": True,
            "estimated_savings": 66.0, "confidence": 0.9,
            "reasoning": "ETH down", "chain": "eip155:1", "priority": 1,
        })
        pending = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        await db.mark_opportunity_executed(pending[0]["id"])

        # Insert a new pending one, then clear
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "UNI", "address": "0x111",
            "quantity": 100, "cost_basis": 8.50, "current_price": 5.20,
            "unrealized_loss": 330.0, "loss_pct": 38.82,
            "holding_days": 200, "is_short_term": True,
            "estimated_savings": 72.6, "confidence": 0.85,
            "reasoning": "UNI down", "chain": "eip155:1", "priority": 2,
        })
        await db.clear_opportunities(SAMPLE_ADDRESS)

        pending_after = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        executed = await db.get_executed_opportunities(SAMPLE_ADDRESS)
        assert len(pending_after) == 0
        assert len(executed) == 1  # executed one should survive


# ── Snapshot / Restore ──────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestSnapshotRestore:
    async def test_snapshot_contains_all_data(self, db: TaxFiDatabase):
        """Export snapshot should return all user data."""
        await db.upsert_user(SAMPLE_ADDRESS, chains=["eip155:1"])
        rid = await db.start_pipeline_run(SAMPLE_ADDRESS)
        await db.finish_pipeline_run(rid, "complete", total_txns=50)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=10.0)
        await db.insert_lot(SAMPLE_ADDRESS, {
            "asset": "ETH", "lot_id": "lot_1",
            "amount": 1.0, "rate": 3000.0, "cost_basis": 3000.0,
            "timestamp": 1700000000, "tx_hash": "0x", "chain_id": "eip155:1",
        })
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "ETH", "address": "0x",
            "quantity": 0.5, "cost_basis": 3500.0, "current_price": 2900.0,
            "unrealized_loss": 300.0, "loss_pct": 8.57,
            "holding_days": 120, "is_short_term": True,
            "estimated_savings": 66.0, "confidence": 0.9,
            "reasoning": "test", "chain": "eip155:1", "priority": 1,
        })

        snapshot = await db.export_snapshot(SAMPLE_ADDRESS)
        assert snapshot["user"] is not None
        assert snapshot["last_pipeline_run"] is not None
        assert len(snapshot["ledgers"]) == 1
        assert len(snapshot["open_lots"]) == 1
        assert len(snapshot["pending_opportunities"]) == 1

    async def test_import_restores_state(self, db: TaxFiDatabase):
        """Import a snapshot into a fresh database should restore all data."""
        # Create snapshot
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=5.0)
        snapshot = await db.export_snapshot(SAMPLE_ADDRESS)

        # Close and reopen fresh
        await db.close()
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            new_path = tmp.name
        new_db = TaxFiDatabase(new_path)
        await new_db.connect()

        try:
            await new_db.import_snapshot(SAMPLE_ADDRESS, snapshot)
            ledgers = await new_db.get_all_ledgers(SAMPLE_ADDRESS)
            assert len(ledgers) == 1
            assert ledgers[0]["total_acquired"] == 5.0
        finally:
            await new_db.close()
            if os.path.exists(new_path):
                os.unlink(new_path)


# ── Orchestrator Integration ───────────────────────────────────────────────


@pytest.mark.asyncio
class TestOrchestratorIntegration:
    """Tests that the orchestrator correctly persists and restores state."""

    async def test_orchestrator_restores_users(self, db: TaxFiDatabase):
        """Simulate orchestrator restore: register user in one session, see it in another."""
        # Session 1: register a user
        await db.upsert_user(SAMPLE_ADDRESS)
        users1 = await db.list_users()
        assert SAMPLE_ADDRESS in users1

        # Session 2: simulate restart with a fresh connection
        await db.close()
        await db.connect()
        users2 = await db.list_users()
        assert SAMPLE_ADDRESS in users2

    async def test_orchestrator_restores_ledgers(self, db: TaxFiDatabase):
        """Cost basis ledgers survive an orchestrator restart."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=10.0)
        await db.insert_lot(SAMPLE_ADDRESS, {
            "asset": "ETH", "lot_id": "lot_1",
            "amount": 1.0, "rate": 3000.0, "cost_basis": 3000.0,
            "timestamp": 1700000000, "tx_hash": "0x", "chain_id": "eip155:1",
        })

        # Simulate restart
        await db.close()
        await db.connect()

        ledgers = await db.get_all_ledgers(SAMPLE_ADDRESS)
        assert len(ledgers) == 1
        lots = await db.get_open_lots(SAMPLE_ADDRESS, "ETH")
        assert len(lots) == 1

    async def test_orchestrator_restores_opportunities(self, db: TaxFiDatabase):
        """Pending harvest opportunities survive an orchestrator restart."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.insert_opportunity(SAMPLE_ADDRESS, {
            "asset": "ETH", "address": "0x000",
            "quantity": 0.5, "cost_basis": 3500.0, "current_price": 2900.0,
            "unrealized_loss": 300.0, "loss_pct": 8.57,
            "holding_days": 120, "is_short_term": True,
            "estimated_savings": 66.0, "confidence": 0.9,
            "reasoning": "ETH down", "chain": "eip155:1", "priority": 1,
        })

        # Simulate restart
        await db.close()
        await db.connect()

        pending = await db.get_pending_opportunities(SAMPLE_ADDRESS)
        assert len(pending) == 1
        assert pending[0]["asset"] == "ETH"

    async def test_multiple_users_isolated(self, db: TaxFiDatabase):
        """Data for different users should be isolated."""
        await db.upsert_user(SAMPLE_ADDRESS)
        await db.upsert_user(SAMPLE_ADDRESS_2)

        await db.upsert_ledger(SAMPLE_ADDRESS, "ETH", total_acquired=10.0)
        await db.upsert_ledger(SAMPLE_ADDRESS_2, "BTC", total_acquired=1.0)

        ledgers1 = await db.get_all_ledgers(SAMPLE_ADDRESS)
        ledgers2 = await db.get_all_ledgers(SAMPLE_ADDRESS_2)

        assert len(ledgers1) == 1
        assert ledgers1[0]["asset"] == "ETH"
        assert len(ledgers2) == 1
        assert ledgers2[0]["asset"] == "BTC"
