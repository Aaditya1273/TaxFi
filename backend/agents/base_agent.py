"""
TaxFi — Base Agent

Abstract base class for all TaxFi agents.
Provides logging, configuration access, and common utilities.
"""

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("taxfi.agents")


@dataclass
class AgentResult:
    """Standard result from any agent processing step."""
    success: bool
    message: str = ""
    data: Any = None
    error: Optional[str] = None
    processing_time_ms: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract base class for all TaxFi agents."""

    def __init__(self, name: str, config: dict[str, Any] | None = None):
        self.name = name
        self.config = config or {}
        self._start_time: float = 0.0

    def start_timer(self) -> None:
        """Start processing timer."""
        self._start_time = time.time()

    def elapsed_ms(self) -> float:
        """Get elapsed time in milliseconds."""
        return (time.time() - self._start_time) * 1000

    def success(self, message: str = "", data: Any = None, **metadata) -> AgentResult:
        """Create a success result."""
        return AgentResult(
            success=True,
            message=message,
            data=data,
            processing_time_ms=self.elapsed_ms(),
            metadata=metadata,
        )

    def failure(self, error: str, message: str = "", data: Any = None) -> AgentResult:
        """Create a failure result."""
        return AgentResult(
            success=False,
            message=message or error,
            error=error,
            data=data,
            processing_time_ms=self.elapsed_ms(),
        )

    @abstractmethod
    async def process(self, *args, **kwargs) -> AgentResult:
        """Process the agent's task. Must be implemented by subclasses."""
        ...

    def log(self, level: str, msg: str, **extra) -> None:
        """Log a message with agent context."""
        log_fn = getattr(logger, level.lower(), logger.info)
        log_fn(f"[{self.name}] {msg}", extra={"agent": self.name, **extra})
