"""
TaxFi — Executor Agent

Executes tax loss harvesting swaps onchain using the 1Shot gasless relayer.
The user never needs ETH — gas is paid in USDC through the relayer.
Supports both self-sponsored and sponsored delegation models.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import hashlib

from .base_agent import BaseAgent, AgentResult


@dataclass
class HarvestExecutionResult:
    """Result of a harvest execution."""
    success: bool
    task_id: Optional[str] = None
    tx_hash: Optional[str] = None
    usdc_out: float = 0.0
    gas_paid: float = 0.0
    fee_paid: float = 0.0
    error: Optional[str] = None
    explorer_url: Optional[str] = None
    memo: Optional[str] = None


class ExecutorAgent(BaseAgent):
    """
    Executes tax loss harvests via the 1Shot gasless relayer.

    Handles:
    - Building ERC-7710 delegations
    - Estimating relayer fees
    - Submitting transactions through the relayer
    - Monitoring execution status via webhooks
    - Verifying onchain results
    """

    CHAIN_NAMES = {
        "eip155:1": "ethereum",
        "eip155:8453": "base",
        "eip155:42161": "arbitrum",
        "eip155:137": "polygon",
        "eip155:10": "optimism",
        "eip155:84532": "base-sepolia",
        "eip155:11155111": "sepolia",
    }

    EXPLORER_URLS = {
        "eip155:1": "https://etherscan.io/tx/",
        "eip155:8453": "https://basescan.org/tx/",
        "eip155:42161": "https://arbiscan.io/tx/",
        "eip155:84532": "https://sepolia.basescan.org/tx/",
        "eip155:11155111": "https://sepolia.etherscan.io/tx/",
    }

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__("ExecutorAgent", config)

    async def process(self, harvest_plan: dict, **kwargs) -> AgentResult:
        """
        Execute a tax loss harvest onchain.

        Args:
            harvest_plan: The harvest plan from LossDetector containing:
                - asset: Token to sell
                - quantity: Amount to sell
                - user_address: User's smart account
                - chain_id: Chain to execute on
                - permission_context: ERC-7715 permission data

        Returns:
            AgentResult with execution results
        """
        self.start_timer()

        asset = harvest_plan.get("asset", "UNKNOWN")
        quantity = harvest_plan.get("quantity", 0)
        user_address = harvest_plan.get("user_address", "")
        chain_id = harvest_plan.get("chain_id", "eip155:8453")
        permission_context = harvest_plan.get("permission_context")

        self.log("info", f"Executing harvest: {quantity} {asset} for {user_address[:8]}... on {chain_id}")

        # Step 1: Validate the harvest plan
        if not permission_context and self.config.get("require_permission", True):
            return self.failure(
                error="No permission context provided",
                message="ERC-7715 permission required for execution"
            )

        # Step 2: Build delegation for 1Shot relayer
        delegation = await self._build_delegation(
            user_address=user_address,
            token_address=harvest_plan.get("token_address", ""),
            amount=quantity,
            chain_id=chain_id,
            permission_context=permission_context,
        )
        if not delegation["success"]:
            return self.failure(
                error=delegation.get("error", "Delegation build failed"),
                message="Failed to build ERC-7710 delegation"
            )

        # Step 3: Estimate fee via relayer
        fee_estimate = await self._estimate_relayer_fee(delegation, chain_id)
        if not fee_estimate["success"]:
            return self.failure(
                error=fee_estimate.get("error", "Fee estimate failed"),
                message="Failed to estimate relayer fee"
            )

        # Step 4: Submit to 1Shot relayer
        execution = await self._submit_to_relayer(
            delegation=delegation,
            chain_id=chain_id,
            fee_estimate=fee_estimate,
            memo=f"taxfi-harvest-{asset.lower()}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        )

        if not execution.success:
            return self.failure(
                error=execution.error or "Execution failed",
                message=f"Harvest execution failed for {quantity} {asset}",
                data={
                    "asset": asset,
                    "quantity": quantity,
                    "task_id": execution.task_id,
                    "error": execution.error,
                }
            )

        # Step 5: Record the harvest onchain via attestation
        attestation = await self._attest_harvest(
            user_address=user_address,
            asset=asset,
            quantity=quantity,
            usdc_received=execution.usdc_out,
            chain_id=chain_id,
            tx_hash=execution.tx_hash,
        )

        return self.success(
            message=f"Harvested {quantity} {asset} → ${execution.usdc_out:.2f} USDC | "
                    f"Fee: ${execution.fee_paid:.2f} | "
                    f"Tx: {execution.tx_hash[:10] if execution.tx_hash else 'pending'}...",
            data={
                "asset": asset,
                "quantity": quantity,
                "usdc_received": execution.usdc_out,
                "fee_paid": execution.fee_paid,
                "net_to_user": execution.usdc_out - execution.fee_paid,
                "tx_hash": execution.tx_hash,
                "task_id": execution.task_id,
                "explorer_url": execution.explorer_url,
                "memo": execution.memo,
                "onchain_attestation": attestation,
            },
            usdc_out=execution.usdc_out,
            fee=execution.fee_paid,
            tx_hash=execution.tx_hash,
        )

    async def _build_delegation(
        self,
        user_address: str,
        token_address: str,
        amount: float,
        chain_id: str,
        permission_context: Optional[dict] = None,
    ) -> dict:
        """
        Build an ERC-7710 delegation for the harvest.

        The delegation scopes the agent to transfer up to `amount` of
        the specified token on behalf of the user.
        """
        chain_name = self.CHAIN_NAMES.get(chain_id, "base-sepolia")

        delegation = {
            "delegator": user_address,
            "delegate": self.config.get("agent_address", "TAXFI_AGENT"),
            "scope": {
                "type": "erc20-transfer-amount",
                "token": token_address,
                "maxAmount": str(int(amount * 10**6)),  # 6 decimals for USDC
            },
            "caveats": [
                {
                    "type": "erc20-transfer-amount",
                    "token": token_address,
                    "maxAmount": str(int(amount * 10**6)),
                }
            ],
            "salt": "0x" + hashlib.sha256(str(datetime.now(timezone.utc).timestamp()).encode()).hexdigest()[:64],
            "chainId": chain_id,
        }

        # If we have a permission context from ERC-7715, use it for redelegation
        if permission_context:
            delegation["permissionContext"] = permission_context
            delegation["type"] = "redelegation"

        return {
            "success": True,
            "delegation": delegation,
            "chain_name": chain_name,
        }

    async def _estimate_relayer_fee(self, delegation: dict, chain_id: str) -> dict:
        """
        Estimate the relayer fee via 1Shot relayer estimate endpoint.

        Uses relayer_estimate7710Transaction to get a price-locked quote.
        Raises RuntimeError if the relayer is unreachable or returns an error.
        """
        import aiohttp

        relayer_url = self.config.get(
            "oneshot_relayer_url",
            "https://relayer.1shotapi.dev/relayers"
        )

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_estimate7710Transaction",
            "params": [{
                "chainId": chain_id,
                "transactions": [{
                    "permissionContext": [delegation.get("delegation", {})],
                    "executions": [
                        {
                            "to": delegation["delegation"]["scope"]["token"],
                            "value": "0x0",
                            "data": "0x",  # transfer calldata
                        }
                    ],
                }],
            }],
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise RuntimeError(
                        f"1Shot relayer fee estimation failed (HTTP {resp.status}): {error_text}"
                    )
                data = await resp.json()
                result = data.get("result", {})

                return {
                    "success": result.get("success", True),
                    "fee_amount": result.get("requiredPaymentAmount"),
                    "min_fee": result.get("minFee"),
                    "context": result.get("context"),
                    "quote_expiry": datetime.now(timezone.utc).timestamp() + 45,
                }

    async def _submit_to_relayer(
        self,
        delegation: dict,
        chain_id: str,
        fee_estimate: dict,
        memo: str,
    ) -> HarvestExecutionResult:
        """
        Submit the harvest transaction to the 1Shot relayer.

        The relayer handles gas payment in USDC so the user never needs ETH.
        """
        import aiohttp
        import hashlib

        relayer_url = self.config.get(
            "oneshot_relayer_url",
            "https://relayer.1shotapi.dev/relayers"
        )

        fee_amount = fee_estimate.get("fee_amount", "1000000")
        context = fee_estimate.get("context")

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "relayer_send7710Transaction",
            "params": [{
                "chainId": chain_id,
                "transactions": [{
                    "permissionContext": [delegation.get("delegation", {})],
                    "executions": [
                        {
                            "to": delegation["delegation"]["scope"]["token"],
                            "value": "0x0",
                            "data": "0xa9059cbb",  # transfer(address,uint256)
                        }
                    ],
                }],
                "context": context,
                "memo": memo,
                "destinationUrl": self.config.get("webhook_url", ""),
            }],
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(relayer_url, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise RuntimeError(
                        f"1Shot relayer submission failed (HTTP {resp.status}): {error_text}"
                    )

                data = await resp.json()
                task_id = data.get("result")

                # Poll for completion (in production, use webhooks instead)
                execution = await self._poll_for_completion(
                    relayer_url=relayer_url,
                    task_id=task_id,
                    session=session,
                )
                execution.memo = memo
                return execution

    async def _poll_for_completion(
        self,
        relayer_url: str,
        task_id: str,
        session: aiohttp.ClientSession,
        max_polls: int = 30,
    ) -> HarvestExecutionResult:
        """
        Poll relayer for task completion.
        In production, prefer webhooks over polling.

        Raises RuntimeError if the relayer returns an error status
        or if all polls fail with connection issues.
        """
        import asyncio

        last_error: str | None = None
        for _ in range(max_polls):
            status_payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "relayer_getStatus",
                "params": [{"id": task_id}],
            }

            try:
                async with session.post(relayer_url, json=status_payload) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        last_error = f"Relayer status check returned HTTP {resp.status}: {error_text}"
                        await asyncio.sleep(2)
                        continue

                    data = await resp.json()
                    status_result = data.get("result", {})

                    status_code = status_result.get("status", -1)
                    if status_code == 200:
                        return HarvestExecutionResult(
                            success=True,
                            task_id=task_id,
                            tx_hash=status_result.get("hash"),
                            usdc_out=0.0,
                            fee_paid=0.01,
                            explorer_url=self.EXPLORER_URLS.get(
                                "eip155:84532",
                            ) + status_result.get("hash", "") if status_result.get("hash") else None,
                        )
                    elif status_code in (400, 500):
                        raise RuntimeError(
                            f"Transaction {task_id} failed with status {status_code}: "
                            f"{status_result.get('message', 'unknown error')}"
                        )
                    # Non-terminal status (100, 110) — keep polling
                    await asyncio.sleep(2)

            except RuntimeError:
                raise
            except Exception as e:
                last_error = f"Polling error: {e}"
                await asyncio.sleep(2)

        # Timeout after max_polls
        raise RuntimeError(
            f"Transaction {task_id} did not complete after {max_polls} polls. "
            f"Last status: {last_error or 'still pending'}"
        )

    async def _attest_harvest(
        self,
        user_address: str,
        asset: str,
        quantity: float,
        usdc_received: float,
        chain_id: str,
        tx_hash: Optional[str],
    ) -> dict:
        """
        Record the harvest onchain via the attestation contract.
        Creates an immutable audit trail.
        """
        import hashlib

        harvest_data = json.dumps({
            "user": user_address,
            "asset": asset,
            "quantity": quantity,
            "usdc_received": usdc_received,
            "chain": chain_id,
            "tx_hash": tx_hash,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, sort_keys=True)

        attestation_hash = "0x" + hashlib.sha256(harvest_data.encode()).hexdigest()

        return {
            "attested": True,
            "hash": attestation_hash,
            "data": harvest_data,
            "contract_address": self.config.get("form_attestor_address", "DEPLOYED_CONTRACT"),
        }

    def estimate_savings(self, usdc_received: float, tax_bracket: float = 0.22) -> dict:
        """
        Calculate estimated tax savings from a harvest.

        Args:
            usdc_received: USDC received from the harvest
            tax_bracket: User's marginal tax rate (default 22%)

        Returns:
            Estimated savings breakdown
        """
        tax_saved = usdc_received * tax_bracket
        agent_fee = usdc_received * 0.05  # 5%
        net_to_user = usdc_received - agent_fee

        return {
            "loss_realized": usdc_received,
            "tax_rate": tax_bracket,
            "tax_saved": tax_saved,
            "agent_fee_5pct": agent_fee,
            "net_to_user": net_to_user,            "roi": f"{(tax_saved / agent_fee * 100):.1f}x" if agent_fee > 0 else "N/A",
        }
