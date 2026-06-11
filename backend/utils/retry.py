"""
TaxFi — Retry & Circuit Breaker Utilities

Provides:
1. **exponential_backoff** — Async retry decorator with jitter, configurable
   max retries, and error classification (retryable vs non-retryable).
2. **CircuitBreaker** — State machine (CLOSED → OPEN → HALF_OPEN) that
   prevents cascading failures to downstream services like Venice AI,
   Covalent, and 1Shot.
3. **with_retry** — Convenience wrapper for aiohttp calls that handles
   429/5xx/connection errors automatically.

Usage:
    from backend.utils.retry import with_retry, CircuitBreaker

    # In any integration client:
    result = await with_retry(
        "venice_classify",
        lambda: session.post(url, json=payload),
        max_retries=3,
    )
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Optional

import aiohttp

logger = logging.getLogger("taxfi.retry")

# ── Error Classification ────────────────────────────────────────────────────


class ServiceError(Exception):
    """Base exception for service integration errors."""


class RateLimitError(ServiceError):
    """HTTP 429 — Too Many Requests. Always retryable after waiting."""


class ServiceUnavailableError(ServiceError):
    """HTTP 503 — Temporary. Retryable."""


class CircuitBreakerOpenError(ServiceError):
    """Raised when the circuit breaker is OPEN and rejecting requests."""


def classify_response(status: int) -> Optional[str]:
    """Classify an HTTP status code for retry decisions.

    Returns:
        None if not retryable, or an error message if retryable.
    """
    if status == 429:
        return "rate_limit"
    if status in (502, 503, 504):
        return "service_unavailable"
    if status in (408, 425):
        return "timeout"
    if status >= 500:
        return "server_error"
    return None


def is_retryable_error(error: Exception) -> bool:
    """Determine if an exception should be retried."""
    if isinstance(error, (RateLimitError, ServiceUnavailableError, CircuitBreakerOpenError)):
        return True
    if isinstance(error, aiohttp.ClientError):
        return True
    if isinstance(error, asyncio.TimeoutError):
        return True
    # Connection errors
    if isinstance(error, (ConnectionError, OSError)):
        return True
    return False


# ── Exponential Backoff ─────────────────────────────────────────────────────


@dataclass
class RetryConfig:
    """Configuration for exponential backoff retry.

    Attributes:
        max_retries: Maximum number of retry attempts (default 3)
        base_delay: Initial delay in seconds (default 1.0)
        max_delay: Maximum delay in seconds (default 60.0)
        backoff_factor: Multiplier for each retry (default 2.0)
        jitter: Random jitter fraction (default 0.1 = ±10%)
    """

    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    backoff_factor: float = 2.0
    jitter: float = 0.1


def compute_delay(attempt: int, config: RetryConfig) -> float:
    """Compute delay for a given retry attempt with full jitter."""
    delay = min(config.base_delay * (config.backoff_factor ** (attempt - 1)), config.max_delay)
    jitter_range = delay * config.jitter
    return delay + random.uniform(-jitter_range, jitter_range)


async def with_retry(
    operation_name: str,
    fn: Callable[[], Awaitable[Any]],
    max_retries: int = 3,
    base_delay: float = 1.0,
    is_retryable: Callable[[Exception], bool] = is_retryable_error,
) -> Any:
    """Execute an async operation with exponential backoff retry.

    Args:
        operation_name: Human-readable name for logging
        fn: Async callable to execute
        max_retries: Maximum retry attempts
        base_delay: Initial delay in seconds
        is_retryable: Function to determine if an exception is retryable

    Returns:
        The result of fn()

    Raises:
        The last exception if all retries are exhausted
    """
    config = RetryConfig(max_retries=max_retries, base_delay=base_delay)
    last_error: Optional[Exception] = None

    for attempt in range(1, config.max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            last_error = e
            if not is_retryable(e):
                logger.warning(
                    "[%s] Non-retryable error on attempt %d/%d: %s",
                    operation_name, attempt, config.max_retries, e,
                )
                raise

            if attempt == config.max_retries:
                logger.error(
                    "[%s] All %d retries exhausted: %s",
                    operation_name, config.max_retries, e,
                )
                raise

            delay = compute_delay(attempt, config)
            logger.info(
                "[%s] Attempt %d/%d failed, retrying in %.2fs: %s",
                operation_name, attempt, config.max_retries, delay, e,
            )
            await asyncio.sleep(delay)

    # Should never reach here
    raise last_error or RuntimeError(f"Unexpected: {operation_name} retry exhausted with no error")


# ── Circuit Breaker ─────────────────────────────────────────────────────────


class CircuitState(Enum):
    CLOSED = "closed"          # Normal operation — requests pass through
    OPEN = "open"              # Failing — requests are rejected immediately
    HALF_OPEN = "half_open"    # Testing — a single request is allowed through


@dataclass
class CircuitBreaker:
    """Circuit breaker to protect downstream services.

    State transitions:
        CLOSED → OPEN: After `failure_threshold` consecutive failures
        OPEN → HALF_OPEN: After `reset_timeout` seconds
        HALF_OPEN → CLOSED: A single successful request
        HALF_OPEN → OPEN: A single failed request during half-open

    Usage:
        cb = CircuitBreaker("venice_ai")
        async with cb:
            result = await call_venice()
    """

    name: str
    failure_threshold: int = 5
    reset_timeout: float = 30.0
    half_open_max_requests: int = 1

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = 0.0
    half_open_requests: int = 0
    total_failures: int = 0
    total_successes: int = 0

    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    async def __aenter__(self) -> "CircuitBreaker":
        """Enter context — checks if request is allowed through."""
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time >= self.reset_timeout:
                    logger.info("[%s] Circuit transitioning OPEN → HALF_OPEN", self.name)
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_requests = 0
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker [{self.name}] is OPEN. "
                        f"Retry after {self.reset_timeout - (time.time() - self.last_failure_time):.0f}s"
                    )

            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_requests >= self.half_open_max_requests:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker [{self.name}] is HALF_OPEN and at capacity"
                    )
                self.half_open_requests += 1

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit context — records success/failure and updates state."""
        async with self._lock:
            if exc_type is not None and is_retryable_error(exc_val):
                # Failure
                self.failure_count += 1
                self.total_failures += 1
                self.last_failure_time = time.time()

                if self.state == CircuitState.HALF_OPEN:
                    logger.warning("[%s] HALF_OPEN request failed → OPEN", self.name)
                    self.state = CircuitState.OPEN
                elif self.failure_count >= self.failure_threshold:
                    logger.warning(
                        "[%s] Failure threshold reached (%d) → OPEN",
                        self.name, self.failure_threshold,
                    )
                    self.state = CircuitState.OPEN
            else:
                # Success (or non-retryable error — count as success for circuit purposes)
                self.failure_count = 0
                self.total_successes += 1

                if self.state == CircuitState.HALF_OPEN:
                    logger.info("[%s] HALF_OPEN request succeeded → CLOSED", self.name)
                    self.state = CircuitState.CLOSED

    @property
    def is_available(self) -> bool:
        """Quick check if the circuit is likely to accept requests."""
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            return (time.time() - self.last_failure_time) >= self.reset_timeout
        # HALF_OPEN
        return self.half_open_requests < self.half_open_max_requests

    def reset(self) -> None:
        """Manually reset the circuit breaker to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.half_open_requests = 0
        logger.info("[%s] Circuit manually reset to CLOSED", self.name)

    def stats(self) -> dict:
        """Return current statistics."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "total_failures": self.total_failures,
            "total_successes": self.total_successes,
            "failure_threshold": self.failure_threshold,
            "reset_timeout": self.reset_timeout,
        }


# ── Global Circuit Breaker Registry ────────────────────────────────────────

# Shared circuit breakers for all integration clients
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    """Get or create a named circuit breaker singleton."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _circuit_breakers[name]


def all_circuit_stats() -> dict[str, dict]:
    """Get stats for all circuit breakers (for /health endpoint)."""
    return {name: cb.stats() for name, cb in _circuit_breakers.items()}


# ── Convenience: retry with circuit breaker ─────────────────────────────────


async def circuit_breaker_call(
    cb_name: str,
    operation_name: str,
    fn: Callable[[], Awaitable[Any]],
    max_retries: int = 3,
    base_delay: float = 1.0,
) -> Any:
    """Execute an operation with circuit breaker protection and retry.

    Args:
        cb_name: Circuit breaker name (e.g. "venice_ai")
        operation_name: Human-readable operation name for logging
        fn: Async callable
        max_retries: Max retry attempts within a closed circuit
        base_delay: Initial backoff delay

    Returns:
        The result of fn()
    """
    cb = get_circuit_breaker(cb_name)

    async with cb:
        return await with_retry(
            operation_name=operation_name,
            fn=fn,
            max_retries=max_retries,
            base_delay=base_delay,
        )
