"""Ranking boundary and methodology approval gate."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType

from economic_service.application.ports import (
    ModelVersionRegistry,
    RankingStrategy,
)
from economic_service.domain.errors import ModelVersionError
from economic_service.domain.models import (
    CandidateEconomics,
    RankingCriterion,
    RankingResult,
    RankingStatus,
)


class NotConfiguredRankingStrategy:
    """Returns no ranking until the methodology has been approved."""

    def rank(
        self,
        candidates: Sequence[CandidateEconomics],
        model_version: str | None,
    ) -> RankingResult:
        """Preserves candidates outside the ranking contract without scoring."""

        del candidates
        return RankingResult(
            status=RankingStatus.NOT_CONFIGURED,
            model_version=model_version,
            items=(),
        )


class UnconfiguredRankingVersionRegistry:
    """Reports that no ranking methodology version is enabled."""

    def is_available(self, model_version: str) -> bool:
        """Returns false until an approved version is registered."""

        del model_version
        return False


@dataclass(frozen=True, slots=True)
class RankingCriterionDefinition:
    """Describes one immutable criterion in a ranking model."""

    code: RankingCriterion
    higher_is_better: bool
    default_weight: Decimal


@dataclass(frozen=True, slots=True)
class RankingModel:
    """Represents one versioned ranking policy definition."""

    version: str
    criteria: tuple[RankingCriterionDefinition, ...]


RANKING_V1 = RankingModel(
    version="ranking-v1",
    criteria=(
        # Normalized weight: 0.30.
        RankingCriterionDefinition(
            RankingCriterion.PAYBACK, False, Decimal("30")
        ),
        # Normalized weight: 0.15.
        RankingCriterionDefinition(RankingCriterion.ROI, True, Decimal("15")),
        RankingCriterionDefinition(
            RankingCriterion.ANNUAL_EFFECT, True, Decimal("15")
        ),
        RankingCriterionDefinition(
            RankingCriterion.BUDGET_FIT, True, Decimal("10")
        ),
        RankingCriterionDefinition(
            RankingCriterion.TCO_SAVINGS, True, Decimal("10")
        ),
        RankingCriterionDefinition(
            RankingCriterion.MATURITY, True, Decimal("10")
        ),
        RankingCriterionDefinition(
            RankingCriterion.DATA_QUALITY, True, Decimal("5")
        ),
        RankingCriterionDefinition(
            RankingCriterion.FLEET_UTILIZATION, True, Decimal("5")
        ),
        # The normalized weights sum to 1.
    ),
)


@dataclass(frozen=True, slots=True)
class RankingModelRegistry:
    """Provides immutable model definitions and the default model version."""

    models: Mapping[str, RankingModel]
    default_version: str

    @classmethod
    def ranking_v1(cls) -> RankingModelRegistry:
        """Returns the registry with the approved v1 model enabled."""

        return cls(
            models=MappingProxyType({RANKING_V1.version: RANKING_V1}),
            default_version=RANKING_V1.version,
        )

    def is_available(self, model_version: str) -> bool:
        """Returns whether the requested ranking model is registered."""

        return model_version in self.models


@dataclass(frozen=True, slots=True)
class RankingGate:
    """Validates optional ranking versions before invoking a strategy."""

    strategy: RankingStrategy
    model_versions: ModelVersionRegistry

    @classmethod
    def unconfigured(cls) -> RankingGate:
        """Builds the default gate with no enabled ranking versions."""

        return cls(
            strategy=NotConfiguredRankingStrategy(),
            model_versions=UnconfiguredRankingVersionRegistry(),
        )

    @classmethod
    def with_ranking_v1(cls) -> RankingGate:
        """Builds a gate with the registered v1 policy as its default."""

        return cls(
            strategy=NotConfiguredRankingStrategy(),
            model_versions=RankingModelRegistry.ranking_v1(),
        )

    def rank(
        self,
        candidates: Sequence[CandidateEconomics],
        requested_model_version: str | None,
    ) -> RankingResult:
        """Returns an empty result or rejects an unavailable version."""

        model_version = requested_model_version
        if model_version is None:
            model_version = getattr(
                self.model_versions, "default_version", None
            )
        if model_version is not None and not self.model_versions.is_available(
            model_version
        ):
            raise ModelVersionError(
                "Requested ranking model version is unavailable: "
                f"{model_version}."
            )
        return self.strategy.rank(candidates, model_version)
