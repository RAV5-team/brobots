"""Tests for the ranking methodology gate."""

from collections.abc import Sequence
from decimal import Decimal

import pytest

from economic_service.application.ranking import (
    NotConfiguredRankingStrategy,
    RankingGate,
    RankingModelRegistry,
)
from economic_service.domain.errors import ModelVersionError
from economic_service.domain.models import (
    CandidateEconomics,
    RankingResult,
    RankingStatus,
)


def test_not_configured_strategy_never_returns_scores_or_order() -> None:
    result = NotConfiguredRankingStrategy().rank((), "ranking-v1")

    assert result.status is RankingStatus.NOT_CONFIGURED
    assert result.model_version == "ranking-v1"
    assert result.items == ()


def test_default_gate_rejects_unavailable_ranking_version() -> None:
    with pytest.raises(ModelVersionError):
        RankingGate.unconfigured().rank((), "ranking-v1")


def test_default_gate_returns_not_configured_without_request() -> None:
    result = RankingGate.unconfigured().rank((), None)

    assert result.status is RankingStatus.NOT_CONFIGURED
    assert result.model_version is None
    assert result.items == ()


def test_ranking_v1_registry_has_the_default_criteria_and_weights() -> None:
    registry = RankingModelRegistry.ranking_v1()
    model = registry.models["ranking-v1"]

    assert registry.default_version == "ranking-v1"
    assert registry.is_available("ranking-v1")
    assert not registry.is_available("ranking-v2")
    assert tuple(item.default_weight for item in model.criteria) == (
        Decimal("30"),
        Decimal("15"),
        Decimal("15"),
        Decimal("10"),
        Decimal("10"),
        Decimal("10"),
        Decimal("5"),
        Decimal("5"),
    )
    assert tuple(item.higher_is_better for item in model.criteria) == (
        False,
        True,
        True,
        True,
        True,
        True,
        True,
        True,
    )


def test_ranking_v1_gate_resolves_omitted_version_to_default() -> None:
    result = RankingGate.with_ranking_v1().rank((), None)

    assert result.status is RankingStatus.NOT_CONFIGURED
    assert result.model_version == "ranking-v1"


class _AvailableVersionRegistry:
    """Test registry exposing one explicitly enabled version."""

    def is_available(self, model_version: str) -> bool:
        return model_version == "ranking-approved-v1"


class _AvailableRankingStrategy:
    """Test strategy proving the gate delegates approved versions."""

    def rank(
        self,
        candidates: Sequence[CandidateEconomics],
        model_version: str | None,
    ) -> RankingResult:
        del candidates
        return RankingResult(
            status=RankingStatus.AVAILABLE,
            model_version=model_version,
            items=(),
        )


def test_gate_delegates_only_available_versions() -> None:
    gate = RankingGate(
        strategy=_AvailableRankingStrategy(),
        model_versions=_AvailableVersionRegistry(),
    )

    result = gate.rank((), "ranking-approved-v1")

    assert result.status is RankingStatus.AVAILABLE
    assert result.model_version == "ranking-approved-v1"
