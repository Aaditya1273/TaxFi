"""
TaxFi Agent System

Multi-agent pipeline for crypto tax optimization:
1. IngestAgent - Pulls transactions from chains
2. ClassifierAgent - Categorizes transactions via Venice AI
3. BasisAgent - Tracks cost basis (FIFO/LIFO/HIFO/ACB)
4. LossDetector - Identifies tax loss harvesting opportunities
5. FormGenerator - Produces IRS-compliant forms
6. ExecutorAgent - Executes harvest swaps via 1Shot relayer
"""

from .base_agent import BaseAgent
from .ingest_agent import IngestAgent
from .classifier_agent import ClassifierAgent
from .basis_agent import BasisAgent
from .loss_detector import LossDetector
from .form_generator import FormGenerator
from .executor_agent import ExecutorAgent

__all__ = [
    "BaseAgent",
    "IngestAgent",
    "ClassifierAgent",
    "BasisAgent",
    "LossDetector",
    "FormGenerator",
    "ExecutorAgent",
]
