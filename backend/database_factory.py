"""
TaxFi — Database Factory

Selects the database backend based on TAXFI_DB_TYPE:
- "sqlite" (default) → TaxFiDatabase (aiosqlite)
- "postgres"        → TaxFiPostgresDatabase (asyncpg)

Environment:
    TAXFI_DB_TYPE  = "sqlite" | "postgres"
    TAXFI_DB_PATH  = /path/to/taxfi.db (SQLite)
    TAXFI_PG_DSN   = postgresql://user:pass@host:5432/dbname (PostgreSQL)
"""

from __future__ import annotations

import os
from typing import Any, Optional

from backend.database import TaxFiDatabase


def create_database(config: Optional[dict] = None) -> Any:
    """Create a database instance based on TAXFI_DB_TYPE.

    Args:
        config: Optional config dict (may contain db_path)

    Returns:
        TaxFiDatabase or TaxFiPostgresDatabase instance
    """
    db_type = os.getenv("TAXFI_DB_TYPE", "sqlite").lower()

    if db_type == "postgres":
        from backend.database_postgres import TaxFiPostgresDatabase

        dsn = os.getenv("TAXFI_PG_DSN", "postgresql://taxfi:taxfi@localhost:5432/taxfi")
        return TaxFiPostgresDatabase(dsn=dsn)

    # Default: SQLite
    db_path = "~/.taxfi/taxfi.db"
    if config and "db_path" in config:
        db_path = config["db_path"]
    elif os.getenv("TAXFI_DB_PATH"):
        db_path = os.getenv("TAXFI_DB_PATH")

    import logging
    logger = logging.getLogger("taxfi.database.factory")
    logger.info("Using SQLite backend: %s", db_path)
    return TaxFiDatabase(db_path)
