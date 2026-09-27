"""Ports that keep application workflows independent of adapters."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from economic_service.domain.models import (
    CalculatedEconomics,
    CandidateEconomics,
    EvaluationRequest,
    EvaluationSnapshot,
    RankingResult,
)


class CalculationEngine(Protocol):
    """Calculates an explainable result from a complete evaluation request."""

    def calculate(self, request: EvaluationRequest) -> CalculatedEconomics:
        """Calculates economics for all requested candidate scenarios."""


class ScoringUseCasePort(Protocol):
    """Scores already calculated candidates for one evaluation request."""

    def validate_request(self, request: EvaluationRequest) -> None:
        """Validates the requested ranking model before calculation begins."""

    def score(
        self,
        request: EvaluationRequest,
        candidates: Sequence[CandidateEconomics],
    ) -> RankingResult:
        """Returns the ranking and criterion explanation traces."""


class RankingStrategy(Protocol):
    """Ranks calculated candidate scenarios when a methodology is available."""

    def rank(
        self,
        candidates: Sequence[CandidateEconomics],
        model_version: str | None,
        request: EvaluationRequest | None = None,
    ) -> RankingResult:
        """Returns ranked candidates and criterion contributions."""


class EvaluationSnapshotRepository(Protocol):
    """Persists and retrieves immutable evaluation snapshots."""

    def save(self, snapshot: EvaluationSnapshot) -> None:
        """Persists one immutable evaluation snapshot."""

    def get(self, evaluation_id: str) -> EvaluationSnapshot | None:
        """Returns a snapshot by evaluation ID, if one exists."""


class Clock(Protocol):
    """Provides the current UTC time to application services."""

    def now(self) -> datetime:
        """Returns the current timezone-aware UTC timestamp."""


class ModelVersionRegistry(Protocol):
    """Checks whether a calculation or ranking model version is available."""

    def is_available(self, model_version: str) -> bool:
        """Returns whether the requested model version is available."""
