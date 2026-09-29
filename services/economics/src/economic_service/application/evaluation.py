"""Application workflow for calculating and persisting evaluations."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from economic_service.application.ports import (
    CalculationEngine,
    Clock,
    EvaluationSnapshotRepository,
    ScoringUseCasePort,
)
from economic_service.application.scoring import ScoringUseCase
from economic_service.domain.models import (
    EvaluationRequest,
    EvaluationResult,
    EvaluationSnapshot,
)


class SystemClock:
    """Provides timezone-aware UTC timestamps."""

    def now(self) -> datetime:
        """Returns the current UTC timestamp."""

        return datetime.now(UTC)


@dataclass
class EvaluationApplicationService:
    """Calculates, snapshots, and retrieves immutable evaluations."""

    calculator: CalculationEngine
    repository: EvaluationSnapshotRepository
    clock: Clock
    scorer: ScoringUseCasePort = field(
        default_factory=ScoringUseCase.ranking_v1
    )

    def evaluate(
        self, request: EvaluationRequest, persist: bool = True
    ) -> EvaluationSnapshot:
        """Calculates and saves a new immutable evaluation revision.

        persist=False returns the snapshot without saving it (dry run).
        """

        self.scorer.validate_request(request)
        calculated = self.calculator.calculate(request)
        ranking = self.scorer.score(request, calculated.candidates)
        result = EvaluationResult(
            evaluation_id=calculated.evaluation_id,
            project_id=calculated.project_id,
            model_version=calculated.model_version,
            status=calculated.status,
            candidates=calculated.candidates,
            ranking=ranking,
        )
        previous = (
            self.repository.get(request.evaluation_id) if persist else None
        )
        snapshot = EvaluationSnapshot(
            evaluation_id=request.evaluation_id,
            project_id=request.project_id,
            request=request,
            result=result,
            created_at=self.clock.now(),
            revision_of=(
                previous.evaluation_id if previous is not None else None
            ),
        )
        if persist:
            self.repository.save(snapshot)
        return snapshot

    def get(self, evaluation_id: str) -> EvaluationSnapshot | None:
        """Returns the latest stored snapshot for an evaluation ID."""

        return self.repository.get(evaluation_id)
