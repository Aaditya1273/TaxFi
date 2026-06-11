from __future__ import annotations

import tempfile

import pytest

from backend.taxfi import TaxFiOrchestrator

SAMPLE_ADDR = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"


@pytest.mark.asyncio
async def test_register_user_persists_display_name() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        orch = TaxFiOrchestrator(config={"require_permission": False}, db_path=tmp.name)
        await orch.start()
        try:
            await orch.register_user(SAMPLE_ADDR, display_name="Alice")
            user = await orch.db.get_user(SAMPLE_ADDR)
            assert user is not None
            assert user["display_name"] == "Alice"
        finally:
            await orch.cleanup()


@pytest.mark.asyncio
async def test_generate_forms_respects_requested_tax_year() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        orch = TaxFiOrchestrator(config={"require_permission": False}, db_path=tmp.name)
        await orch.start()
        try:
            await orch.register_user(SAMPLE_ADDR)
            forms = await orch.generate_tax_forms(tax_year=2030)
            assert forms.get("tax_year") == 2030
        finally:
            await orch.cleanup()


@pytest.mark.asyncio
async def test_execute_harvest_marks_db_opportunity_executed() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        orch = TaxFiOrchestrator(config={"require_permission": False}, db_path=tmp.name)
        await orch.start()
        try:
            await orch.register_user(SAMPLE_ADDR)
            await orch.db.insert_opportunity(
                SAMPLE_ADDR,
                {
                    "asset": "ETH",
                    "address": "0x0000000000000000000000000000000000000000",
                    "quantity": 1.0,
                    "cost_basis": 3000.0,
                    "current_price": 2500.0,
                    "unrealized_loss": 500.0,
                    "loss_pct": 16.67,
                    "holding_days": 120,
                    "is_short_term": True,
                    "estimated_savings": 110.0,
                    "confidence": 0.9,
                    "reasoning": "test opportunity",
                    "chain": "eip155:84532",
                    "priority": 1,
                },
            )

            async def _fake_executor(_plan):
                class _R:
                    success = True
                    error = None
                    data = {"success": True, "tx_hash": "0xabc"}

                return _R()

            orch.executor.process = _fake_executor

            result = await orch.execute_harvest(opportunity_index=0, user_address=SAMPLE_ADDR)
            assert result.get("success") is True

            pending = await orch.db.get_pending_opportunities(SAMPLE_ADDR)
            executed = await orch.db.get_executed_opportunities(SAMPLE_ADDR)
            assert len(pending) == 0
            assert len(executed) == 1
        finally:
            await orch.cleanup()
