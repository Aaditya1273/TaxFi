"""TaxFi Utilities Package"""

from .pdf_generator import (
    generate_form_8949,
    generate_schedule_d,
    generate_tax_summary,
    generate_all_forms,
)

from .monitoring import (
    HealthStatus,
    perform_health_check,
    get_metrics,
    get_system_status,
    PIPELINE_RUNS_TOTAL,
    PIPELINE_DURATION_SECONDS,
    TRANSACTIONS_PROCESSED,
    HARVEST_OPPORTUNITIES_TOTAL,
    HARVEST_EXECUTIONS_TOTAL,
    USERS_REGISTERED_TOTAL,
    LEDGERS_TOTAL,
    API_REQUESTS_TOTAL,
    API_DURATION_SECONDS,
)

__all__ = [
    # PDF Generation
    "generate_form_8949",
    "generate_schedule_d",
    "generate_tax_summary",
    "generate_all_forms",
    # Monitoring
    "HealthStatus",
    "perform_health_check",
    "get_metrics",
    "get_system_status",
    # Metrics
    "PIPELINE_RUNS_TOTAL",
    "PIPELINE_DURATION_SECONDS",
    "TRANSACTIONS_PROCESSED",
    "HARVEST_OPPORTUNITIES_TOTAL",
    "HARVEST_EXECUTIONS_TOTAL",
    "USERS_REGISTERED_TOTAL",
    "LEDGERS_TOTAL",
    "API_REQUESTS_TOTAL",
    "API_DURATION_SECONDS",
]