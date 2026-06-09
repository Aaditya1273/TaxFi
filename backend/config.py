"""
TaxFi — Configuration Module

Central configuration for the TaxFi backend agent system.
All settings loaded from environment with sensible defaults.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TaxFiConfig:
    """TaxFi agent system configuration."""

    # --- Venice AI ---
    venice_api_key: Optional[str] = os.getenv("VENICE_API_KEY")
    venice_wallet_key: Optional[str] = os.getenv("VENICE_WALLET_KEY")
    venice_base_url: str = os.getenv("VENICE_BASE_URL", "https://api.venice.ai/api/v1")
    venice_model: str = os.getenv("VENICE_MODEL", "zai-org-glm-5-1")
    venice_classification_model: str = os.getenv(
        "VENICE_CLASSIFICATION_MODEL", "zai-org-glm-5-1"
    )

    # --- 1Shot API ---
    oneshot_api_key: Optional[str] = os.getenv("ONESHOT_API_KEY")
    oneshot_api_secret: Optional[str] = os.getenv("ONESHOT_API_SECRET")
    oneshot_relayer_url: str = os.getenv(
        "ONESHOT_RELAYER_URL",
        "https://relayer.1shotapi.dev/relayers"  # Sepolia testnet
    )

    # --- x402 Payment ---
    x402_wallet_key: Optional[str] = os.getenv("X402_WALLET_KEY")
    x402_default_chain: str = os.getenv("X402_DEFAULT_CHAIN", "eip155:84532")

    # --- Data Sources ---
    covalent_api_key: Optional[str] = os.getenv("COVALENT_API_KEY")
    alchemy_api_key: Optional[str] = os.getenv("ALCHEMY_API_KEY")

    # --- Chains ---
    supported_chains: list[str] = field(
        default_factory=lambda: os.getenv(
            "TAXFI_SUPPORTED_CHAINS",
            "eip155:1,eip155:8453,eip155:42161"  # Ethereum, Base, Arbitrum
        ).split(",")
    )

    # --- Smart Contracts ---
    permission_registry_address: Optional[str] = os.getenv("TAXFI_PERMISSION_REGISTRY")
    agent_smart_account_address: Optional[str] = os.getenv("TAXFI_AGENT_ADDRESS")
    loss_harvest_vault_address: Optional[str] = os.getenv("TAXFI_VAULT_ADDRESS")
    form_attestor_address: Optional[str] = os.getenv("TAXFI_ATTESTOR_ADDRESS")

    # --- Tax ---
    cost_basis_method: str = os.getenv("TAXFI_COST_BASIS_METHOD", "HIFO")
    harvest_threshold_usd: float = float(os.getenv("TAXFI_HARVEST_THRESHOLD", "100.0"))
    agent_fee_bps: int = int(os.getenv("TAXFI_AGENT_FEE_BPS", "500"))  # 5%

    # --- Agent Behavior ---
    batch_size: int = int(os.getenv("TAXFI_BATCH_SIZE", "100"))
    scan_interval_seconds: int = int(os.getenv("TAXFI_SCAN_INTERVAL", "3600"))  # 1 hour
    max_concurrent_harvests: int = int(os.getenv("TAXFI_MAX_CONCURRENT", "5"))

    # --- Tax Jurisdiction ---
    DEFAULT_SHORT_TERM_RATE: float = 0.22  # 22% average effective rate
    DEFAULT_LONG_TERM_RATE: float = 0.15   # 15% long-term capital gains

    # (Rotki integration removed — was a planned bridge to the rotki tax engine)

    @classmethod
    def validate(cls) -> list[str]:
        """Validate configuration and return list of missing required fields."""
        missing = []
        if not cls.venice_api_key and not cls.venice_wallet_key:
            missing.append("VENICE_API_KEY or VENICE_WALLET_KEY")
        if not cls.covalent_api_key and not cls.alchemy_api_key:
            missing.append("COVALENT_API_KEY or ALCHEMY_API_KEY")
        return missing
