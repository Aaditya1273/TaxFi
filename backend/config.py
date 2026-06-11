"""
TaxFi — Configuration Module

Central configuration for the TaxFi backend agent system.
All settings loaded from environment with sensible defaults.
"""

import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

# Auto-load .env file from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=str(_env_path))
    except ImportError:
        pass  # dotenv not installed — env vars must be set manually


@dataclass
class TaxFiConfig:
    """TaxFi agent system configuration."""

    # --- Venice AI ---
    venice_api_key: Optional[str] = None
    venice_wallet_key: Optional[str] = None
    venice_base_url: str = "https://api.venice.ai/api/v1"
    venice_model: str = "zai-org-glm-5-1"
    venice_classification_model: str = "zai-org-glm-5-1"

    # --- 1Shot API ---
    oneshot_api_key: Optional[str] = None
    oneshot_api_secret: Optional[str] = None
    oneshot_relayer_url: str = "https://relayer.1shotapi.dev/relayers"  # Sepolia testnet

    # --- x402 Payment ---
    x402_wallet_key: Optional[str] = None
    x402_default_chain: str = "eip155:84532"

    # --- Data Sources ---
    covalent_api_key: Optional[str] = None
    alchemy_api_key: Optional[str] = None

    # --- Chains ---
    supported_chains: list[str] = field(
        default_factory=lambda: ["eip155:1", "eip155:8453", "eip155:42161"]
    )

    # --- Smart Contracts ---
    permission_registry_address: Optional[str] = None
    agent_smart_account_address: Optional[str] = None
    loss_harvest_vault_address: Optional[str] = None
    form_attestor_address: Optional[str] = None

    # --- Tax ---
    cost_basis_method: str = "HIFO"
    harvest_threshold_usd: float = 100.0
    agent_fee_bps: int = 500  # 5%

    # --- Agent Behavior ---
    batch_size: int = 100
    scan_interval_seconds: int = 3600  # 1 hour
    max_concurrent_harvests: int = 5

    # --- Database ---
    db_path: str = field(default_factory=lambda: os.path.expanduser("~/.taxfi/taxfi.db"))

    # --- Tax Jurisdiction ---
    # These are the effective tax rates used for savings estimation.
    # Override via TAXFI_SHORT_TERM_RATE and TAXFI_LONG_TERM_RATE env vars.
    short_term_rate: float = 0.22   # 22% average effective short-term rate
    long_term_rate: float = 0.15    # 15% long-term capital gains rate

    @classmethod
    def from_env(cls) -> "TaxFiConfig":
        """Build config from environment at runtime."""
        chains = os.getenv("TAXFI_SUPPORTED_CHAINS", "eip155:1,eip155:8453,eip155:42161")
        return cls(
            venice_api_key=os.getenv("VENICE_API_KEY"),
            venice_wallet_key=os.getenv("VENICE_WALLET_KEY"),
            venice_base_url=os.getenv("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),
            venice_model=os.getenv("VENICE_MODEL", "zai-org-glm-5-1"),
            venice_classification_model=os.getenv("VENICE_CLASSIFICATION_MODEL", "zai-org-glm-5-1"),
            oneshot_api_key=os.getenv("ONESHOT_API_KEY"),
            oneshot_api_secret=os.getenv("ONESHOT_API_SECRET"),
            oneshot_relayer_url=os.getenv(
                "ONESHOT_RELAYER_URL", "https://relayer.1shotapi.dev/relayers"
            ),
            x402_wallet_key=os.getenv("X402_WALLET_KEY"),
            x402_default_chain=os.getenv("X402_DEFAULT_CHAIN", "eip155:84532"),
            covalent_api_key=os.getenv("COVALENT_API_KEY"),
            alchemy_api_key=os.getenv("ALCHEMY_API_KEY"),
            supported_chains=[c.strip() for c in chains.split(",") if c.strip()],
            permission_registry_address=os.getenv("TAXFI_PERMISSION_REGISTRY"),
            agent_smart_account_address=os.getenv("TAXFI_AGENT_ADDRESS"),
            loss_harvest_vault_address=os.getenv("TAXFI_VAULT_ADDRESS"),
            form_attestor_address=os.getenv("TAXFI_ATTESTOR_ADDRESS"),
            cost_basis_method=os.getenv("TAXFI_COST_BASIS_METHOD", "HIFO"),
            harvest_threshold_usd=float(os.getenv("TAXFI_HARVEST_THRESHOLD", "100.0")),
            agent_fee_bps=int(os.getenv("TAXFI_AGENT_FEE_BPS", "500")),
            batch_size=int(os.getenv("TAXFI_BATCH_SIZE", "100")),
            scan_interval_seconds=int(os.getenv("TAXFI_SCAN_INTERVAL", "3600")),
            max_concurrent_harvests=int(os.getenv("TAXFI_MAX_CONCURRENT", "5")),
            short_term_rate=float(os.getenv("TAXFI_SHORT_TERM_RATE", "0.22")),
            long_term_rate=float(os.getenv("TAXFI_LONG_TERM_RATE", "0.15")),
            db_path=os.getenv("TAXFI_DB_PATH", os.path.expanduser("~/.taxfi/taxfi.db")),
        )

    def to_dict(self) -> dict:
        """Serialize config to plain dict for agent/orchestrator consumers."""
        cfg = asdict(self)
        # Backward-compatible key used by executor agent
        cfg["agent_address"] = self.agent_smart_account_address
        return cfg

    def validate(self) -> list[str]:
        """Validate configuration and return list of missing required fields."""
        missing = []
        if not self.venice_api_key and not self.venice_wallet_key:
            missing.append("VENICE_API_KEY or VENICE_WALLET_KEY")
        if not self.covalent_api_key and not self.alchemy_api_key:
            missing.append("COVALENT_API_KEY or ALCHEMY_API_KEY")
        return missing


def load_config() -> dict:
    """Load runtime config dictionary from environment."""
    return TaxFiConfig.from_env().to_dict()
