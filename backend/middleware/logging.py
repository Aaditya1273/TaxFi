"""
TaxFi — Structured Logging Middleware

Provides structured JSON logging for the API.
"""

import time
import uuid
from contextvars import ContextVar
from typing import Callable

import structlog
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Request ID context
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.Renderer(),
    ],
    wrapper_class=structlog.stdlib.ProcessorWrapper,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger("taxfi")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all HTTP requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_ctx.set(request_id)
        
        # Start timer
        start_time = time.time()
        
        # Log request
        log = logger.bind(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query=request.url.query,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )
        log.info("request_started")
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Add response info to log
            log = log.bind(
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
            
            if response.status_code < 400:
                log.info("request_completed")
            else:
                log.warning("request_failed")
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.bind(
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                error=str(e),
                error_type=type(e).__name__,
            ).error("request_exception")
            
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
                headers={"X-Request-ID": request_id},
            )


def get_logger(name: str = "taxfi"):
    """Get a structured logger."""
    return logger.bind(component=name)


def log_pipeline_event(
    event_type: str,
    user_address: str,
    **extra,
):
    """Log a pipeline event."""
    logger.info(
        event_type,
        user_address=user_address,
        request_id=request_id_ctx.get(),
        **extra,
    )