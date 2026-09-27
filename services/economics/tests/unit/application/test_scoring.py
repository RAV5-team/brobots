"""Policy tests for weighted candidate scoring and explanations."""

from dataclasses import replace
from decimal import Decimal
from types import MappingProxyType, SimpleNamespace

import pytest

from economic_service.adapters.http.schemas import RankingItemDto
from economic_service.application.ranking import (
    RANKING_V1,
    RankingModel,
    RankingModelRegistry,
)
from economic_service.application.scoring import (
    MinMaxRankingStrategy,
    ScoringUseCase,
)
from economic_service.domain.models import (
    AcquisitionModel,
    CandidateEconomics,
    CandidateStatus,
    ConfirmationStatus,
    InputOrigin,
    MetricValue,
    Money,
    RankingCriterion,
    RankingItemStatus,
    RankingStatus,
    RobotCandidate,
    SourcedValue,
    SourceRef,
)

SOURCE = SourceRef(
    source="scoring-fixture",
    origin=InputOrigin.RECORDED,
    confirmation=ConfirmationStatus.CONFIRMED,
    version="fixture-v1",
)

_ALL_WEIGHTS = tuple(
    (criterion.value, Decimal("12.5")) for criterion in RankingCriterion
)


def _robot(
    candidate_id: str,
    *,
    maturity: str | None = "7",
    completeness: str | None = "80",
) -> RobotCandidate:
    return RobotCandidate(
        candidate_id=candidate_id,
        robot_code=f"robot-{candidate_id}",
        price=Money(Decimal("100")),
        payload_kg=Decimal("100"),
        max_speed_mps=Decimal("1"),
        loading_seconds=Decimal("1"),
        unloading_seconds=Decimal("1"),
        average_power_kw=Decimal("1"),
        handling_method="forks",
        catalog_status="operation",
        confirmation=ConfirmationStatus.CONFIRMED,
        source=SOURCE,
        maturity_trl=(
            SourcedValue(Decimal(maturity), "TRL", SOURCE)
            if maturity is not None
            else None
        ),
        catalog_completeness_percent=(
            SourcedValue(Decimal(completeness), "%", SOURCE)
            if completeness is not None
            else None
        ),
    )


def _candidate(
    candidate_id: str,
    *,
    status: CandidateStatus = CandidateStatus.APPLICABLE,
    payback: str | None = "2",
    roi: str | None = "1",
    annual_effect: str | None = "100",
    capex: str | None = "100",
    baseline_tco: str | None = "1000",
    robotized_tco: str | None = "800",
    utilization: str | None = "0.5",
    acquisition_model: AcquisitionModel = AcquisitionModel.PURCHASE,
) -> CandidateEconomics:
    inputs = (
        ("candidate.returns.simple_payback_years", payback, "years"),
        ("candidate.returns.workbook_roi", roi, "fraction"),
        ("candidate.effects.net_annual_benefit", annual_effect, "RUB/year"),
        ("candidate.capex.total", capex, "RUB"),
        ("candidate.returns.baseline_process_tco", baseline_tco, "RUB"),
        ("candidate.returns.robotized_process_tco", robotized_tco, "RUB"),
        ("candidate.fleet.average_utilization", utilization, "fraction"),
    )
    metrics = tuple(
        MetricValue(code, Decimal(value), unit, SOURCE)
        for code, value, unit in inputs
        if value is not None
    )
    return CandidateEconomics(
        candidate_id=candidate_id,
        acquisition_model=acquisition_model,
        status=status,
        metrics=metrics,
        traces=(),
        risks=(),
    )


def _request(
    robots: tuple[RobotCandidate, ...],
    *,
    budget: str | None = "100",
    weights: tuple[tuple[str, Decimal], ...] | None = _ALL_WEIGHTS,
) -> SimpleNamespace:
    task = SimpleNamespace(
        budget=Money(Decimal(budget)) if budget is not None else None,
        source=SOURCE,
    )
    return SimpleNamespace(
        candidates=robots,
        task=task,
        ranking_weights=weights,
        requested_ranking_version=None,
    )


def test_scoring_normalizes_direction_and_uses_competition_ranks() -> None:
    request = _request((_robot("a"), _robot("b"), _robot("c")))
    candidates = (
        _candidate("a", payback="1"),
        _candidate("b", payback="2"),
        _candidate("c", payback="3"),
    )
    request.ranking_weights = tuple(
        (criterion.value, Decimal("0")) for criterion in RankingCriterion
    )
    request.ranking_weights = (
        (RankingCriterion.PAYBACK.value, Decimal("100")),
        *(item for item in request.ranking_weights if item[0] != "payback"),
    )

    result = ScoringUseCase.ranking_v1().score(request, candidates)

    assert result.status is RankingStatus.AVAILABLE
    assert [
        (item.candidate_id, item.rank, item.score) for item in result.items
    ] == [
        ("a", 1, Decimal("100.00")),
        ("b", 2, Decimal("50.00")),
        ("c", 3, Decimal("0.00")),
    ]
    assert result.items[0].criteria[0].normalized_value == Decimal("1")


def test_scoring_rounds_contributions_and_ranks_ties_stably() -> None:
    request = _request((_robot("z"), _robot("a"), _robot("c")))
    candidates = (
        _candidate("z", payback="1"),
        _candidate("a", payback="1"),
        _candidate("c", payback="3"),
    )
    request.ranking_weights = (
        (RankingCriterion.PAYBACK.value, Decimal("100")),
        *(item for item in _ALL_WEIGHTS if item[0] != "payback"),
    )

    items = ScoringUseCase.ranking_v1().score(request, candidates).items

    assert [(item.candidate_id, item.rank) for item in items] == [
        ("a", 1),
        ("z", 1),
        ("c", 3),
    ]
    assert items[0].score == sum(value for _, value in items[0].contributions)
    assert all(
        value.as_tuple().exponent == -2 for _, value in items[0].contributions
    )
    dto = RankingItemDto.from_domain(items[0])
    assert dto.status is RankingItemStatus.RANKED
    assert dto.criteria[0].provenance[0].version == "fixture-v1"


def test_missing_values_renormalize_weights_and_keep_trace_reason() -> None:
    request = _request(
        (_robot("a", maturity=None, completeness=None), _robot("b")),
        weights=(
            (RankingCriterion.MATURITY.value, Decimal("50")),
            (RankingCriterion.DATA_QUALITY.value, Decimal("50")),
            *(
                (criterion.value, Decimal("0"))
                for criterion in RankingCriterion
                if criterion
                not in (
                    RankingCriterion.MATURITY,
                    RankingCriterion.DATA_QUALITY,
                )
            ),
        ),
    )
    candidates = (_candidate("a"), _candidate("b"))

    items = ScoringUseCase.ranking_v1().score(request, candidates).items
    first = next(item for item in items if item.candidate_id == "a")
    second = next(item for item in items if item.candidate_id == "b")

    assert first.score is None
    assert first.status is RankingItemStatus.UNRANKED
    assert first.unranked_reason
    missing = {trace.code: trace for trace in first.criteria}
    assert missing[RankingCriterion.MATURITY].is_missing
    assert missing[RankingCriterion.MATURITY].missing_reason
    assert second.criteria[5].effective_weight == Decimal("50")


def test_budget_fit_handles_missing_zero_and_raas_setup_capex() -> None:
    request = _request(
        (_robot("zero"), _robot("over"), _robot("raas")), budget="100"
    )
    candidates = (
        _candidate("zero", capex="0"),
        _candidate("over", capex="200"),
        _candidate(
            "raas", capex="200", acquisition_model=AcquisitionModel.RAAS
        ),
    )

    items = ScoringUseCase.ranking_v1().score(request, candidates).items
    fits = {
        item.candidate_id: next(
            trace
            for trace in item.criteria
            if trace.code is RankingCriterion.BUDGET_FIT
        )
        for item in items
    }
    assert fits["zero"].raw_value == Decimal("1")
    assert fits["over"].raw_value == Decimal("0.5")
    assert fits["raas"].raw_value == Decimal("0.5")
    assert len(fits["raas"].provenance) == 2

    no_budget = _request((_robot("x"),), budget=None)
    no_budget_result = ScoringUseCase.ranking_v1().score(
        no_budget, (_candidate("x"),)
    )
    budget_trace = next(
        trace
        for trace in no_budget_result.items[0].criteria
        if trace.code is RankingCriterion.BUDGET_FIT
    )
    assert budget_trace.is_missing
    assert budget_trace.missing_reason == "Location budget is unavailable."


def test_tco_savings_provenance_and_non_applicable_statuses() -> None:
    request = _request((_robot("included"), _robot("excluded")))
    applicable = _candidate("included", baseline_tco="100", robotized_tco="150")
    excluded = _candidate("excluded", status=CandidateStatus.EXCLUDED)

    items = (
        ScoringUseCase.ranking_v1().score(request, (applicable, excluded)).items
    )

    assert len(items) == 1
    assert items[0].candidate_id == "included"
    tco = next(
        trace
        for trace in items[0].criteria
        if trace.code is RankingCriterion.TCO_SAVINGS
    )
    assert tco.raw_value == Decimal("-50")
    assert tco.provenance == (SOURCE, SOURCE)


def test_scoring_resolves_criteria_from_injected_model_registry() -> None:
    model = RankingModel(
        version="ranking-v2",
        criteria=tuple(
            replace(
                criterion,
                default_weight=(
                    Decimal("100")
                    if criterion.code is RankingCriterion.PAYBACK
                    else Decimal("0")
                ),
            )
            for criterion in RANKING_V1.criteria
        ),
    )
    registry = RankingModelRegistry(
        models=MappingProxyType({model.version: model}),
        default_version=model.version,
    )
    use_case = ScoringUseCase(registry, MinMaxRankingStrategy())
    request = _request((_robot("a"), _robot("b")))
    request.requested_ranking_version = model.version
    request.ranking_weights = None

    result = use_case.score(
        request,
        (_candidate("a", payback="1"), _candidate("b", payback="3")),
    )

    assert result.model_version == model.version
    assert result.items[0].candidate_id == "a"
    assert result.items[0].score == Decimal("100.00")


def test_missing_criteria_use_stable_units() -> None:
    request = _request(
        (_robot("a", maturity=None, completeness=None),), budget=None
    )
    candidate = _candidate(
        "a",
        payback=None,
        roi=None,
        annual_effect=None,
        capex=None,
        baseline_tco=None,
        robotized_tco=None,
        utilization=None,
    )

    item = ScoringUseCase.ranking_v1().score(request, (candidate,)).items[0]

    assert {trace.code: trace.unit for trace in item.criteria} == {
        RankingCriterion.PAYBACK: "years",
        RankingCriterion.ROI: "fraction",
        RankingCriterion.ANNUAL_EFFECT: "RUB/year",
        RankingCriterion.BUDGET_FIT: "fraction",
        RankingCriterion.TCO_SAVINGS: "RUB",
        RankingCriterion.MATURITY: "TRL",
        RankingCriterion.DATA_QUALITY: "%",
        RankingCriterion.FLEET_UTILIZATION: "fraction",
    }


def test_negative_budget_or_capex_omits_budget_fit_and_preserves_sources() -> (
    None
):
    cases = (
        (_request((_robot("a"),), budget="-1"), _candidate("a")),
        (_request((_robot("a"),)), _candidate("a", capex="-1")),
    )

    for request, candidate in cases:
        item = ScoringUseCase.ranking_v1().score(request, (candidate,)).items[0]
        trace = next(
            criterion
            for criterion in item.criteria
            if criterion.code is RankingCriterion.BUDGET_FIT
        )

        assert trace.is_missing
        assert trace.contribution is None
        assert trace.missing_reason is not None
        assert request.task.source in trace.provenance
        assert item.score is not None


@pytest.mark.parametrize(
    ("criterion", "low_kwargs", "high_kwargs", "low_robot", "high_robot"),
    (
        (
            RankingCriterion.PAYBACK,
            {"payback": "3"},
            {"payback": "1"},
            {},
            {},
        ),
        (
            RankingCriterion.ROI,
            {"roi": "-1"},
            {"roi": "1"},
            {},
            {},
        ),
        (
            RankingCriterion.ANNUAL_EFFECT,
            {"annual_effect": "-100"},
            {"annual_effect": "100"},
            {},
            {},
        ),
        (
            RankingCriterion.BUDGET_FIT,
            {"capex": "2000"},
            {"capex": "100"},
            {},
            {},
        ),
        (
            RankingCriterion.TCO_SAVINGS,
            {"baseline_tco": "100", "robotized_tco": "200"},
            {"baseline_tco": "200", "robotized_tco": "100"},
            {},
            {},
        ),
        (
            RankingCriterion.MATURITY,
            {},
            {},
            {"maturity": "1"},
            {"maturity": "9"},
        ),
        (
            RankingCriterion.DATA_QUALITY,
            {},
            {},
            {"completeness": "0"},
            {"completeness": "100"},
        ),
        (
            RankingCriterion.FLEET_UTILIZATION,
            {"utilization": "-0.5"},
            {"utilization": "1"},
            {},
            {},
        ),
    ),
)
def test_each_criterion_uses_its_configured_normalization_direction(
    criterion: RankingCriterion,
    low_kwargs: dict[str, str],
    high_kwargs: dict[str, str],
    low_robot: dict[str, str],
    high_robot: dict[str, str],
) -> None:
    request = _request(
        (_robot("low", **low_robot), _robot("high", **high_robot)),
        budget="100",
        weights=tuple(
            (item.value, Decimal("100") if item is criterion else Decimal("0"))
            for item in RankingCriterion
        ),
    )
    candidates = (
        _candidate("low", **low_kwargs),
        _candidate("high", **high_kwargs),
    )

    items = ScoringUseCase.ranking_v1().score(request, candidates).items
    traces = {
        item.candidate_id: next(
            trace for trace in item.criteria if trace.code is criterion
        )
        for item in items
    }
    assert traces["low"].normalized_value == Decimal("0")
    assert traces["high"].normalized_value == Decimal("1")


def test_default_and_overridden_weights_are_exposed_in_score_traces() -> None:
    request = _request((_robot("a"),), weights=None)
    candidate = _candidate("a")

    default_trace = (
        ScoringUseCase.ranking_v1()
        .score(request, (candidate,))
        .items[0]
        .criteria
    )
    assert tuple(trace.configured_weight for trace in default_trace) == tuple(
        item.default_weight for item in RANKING_V1.criteria
    )

    request.ranking_weights = tuple(
        (
            criterion.value,
            Decimal("100")
            if criterion is RankingCriterion.ROI
            else Decimal("0"),
        )
        for criterion in RankingCriterion
    )
    override_trace = (
        ScoringUseCase.ranking_v1()
        .score(request, (candidate,))
        .items[0]
        .criteria
    )
    assert next(
        trace.configured_weight
        for trace in override_trace
        if trace.code is RankingCriterion.ROI
    ) == Decimal("100")


def test_half_up_rounding_publishes_contributions_that_sum_to_score() -> None:
    request = _request(
        tuple(
            _robot(candidate_id) for candidate_id in ("low", "middle", "high")
        ),
        weights=(
            (RankingCriterion.ROI.value, Decimal("0.01")),
            (RankingCriterion.PAYBACK.value, Decimal("99.99")),
            *(
                (criterion.value, Decimal("0"))
                for criterion in RankingCriterion
                if criterion
                not in (RankingCriterion.ROI, RankingCriterion.PAYBACK)
            ),
        ),
    )
    candidates = (
        _candidate("low", roi="0", payback="1"),
        _candidate("middle", roi="0.5", payback="1"),
        _candidate("high", roi="1", payback="1"),
    )

    middle = next(
        item
        for item in ScoringUseCase.ranking_v1().score(request, candidates).items
        if item.candidate_id == "middle"
    )
    contribution_map = dict(middle.contributions)

    assert contribution_map[RankingCriterion.ROI.value] == Decimal("0.01")
    assert contribution_map[RankingCriterion.PAYBACK.value] == Decimal("50.00")
    assert middle.score == sum(contribution_map.values(), Decimal("0"))


def test_equal_values_normalize_to_neutral_and_receive_tied_ranks() -> None:
    request = _request(
        (_robot("a"), _robot("b"), _robot("c")),
        weights=tuple(
            (
                criterion.value,
                Decimal("100")
                if criterion is RankingCriterion.PAYBACK
                else Decimal("0"),
            )
            for criterion in RankingCriterion
        ),
    )
    candidates = tuple(
        _candidate(candidate_id, payback="2")
        for candidate_id in ("a", "b", "c")
    )

    items = ScoringUseCase.ranking_v1().score(request, candidates).items

    assert {item.criteria[0].normalized_value for item in items} == {
        Decimal("0.5")
    }
    assert {(item.rank, item.score) for item in items} == {
        (1, Decimal("50.00"))
    }


def test_published_score_ties_use_competition_rank_and_stable_pair_order() -> (
    None
):
    request = _request(
        tuple(
            _robot(candidate_id)
            for candidate_id in ("low", "b", "z", "high", "same")
        ),
        weights=tuple(
            (
                criterion.value,
                Decimal("100")
                if criterion is RankingCriterion.ROI
                else Decimal("0"),
            )
            for criterion in RankingCriterion
        ),
    )
    candidates = (
        _candidate("low", roi="0"),
        _candidate("z", roi="0.50001"),
        _candidate("b", roi="0.50004"),
        _candidate("high", roi="1"),
        _candidate("same", roi="0.25"),
        _candidate(
            "same",
            roi="0.25",
            acquisition_model=AcquisitionModel.RAAS,
        ),
    )

    items = ScoringUseCase.ranking_v1().score(request, candidates).items
    by_id = {
        item.candidate_id: item for item in items if item.candidate_id != "same"
    }
    same_items = [item for item in items if item.candidate_id == "same"]

    assert by_id["b"].score == by_id["z"].score == Decimal("50.00")
    assert by_id["b"].rank == by_id["z"].rank == 2
    assert [(item.rank, item.candidate_id) for item in items[:4]] == [
        (1, "high"),
        (2, "b"),
        (2, "z"),
        (4, "same"),
    ]
    assert [item.acquisition_model for item in same_items] == sorted(
        (item.acquisition_model for item in same_items),
        key=lambda item: item.value,
    )


def test_no_positive_weight_values_have_explicit_unranked_reason() -> None:
    request = _request(
        (_robot("a", maturity=None, completeness=None),),
        weights=tuple(
            (
                criterion.value,
                Decimal("50")
                if criterion
                in (RankingCriterion.MATURITY, RankingCriterion.DATA_QUALITY)
                else Decimal("0"),
            )
            for criterion in RankingCriterion
        ),
    )

    item = (
        ScoringUseCase.ranking_v1().score(request, (_candidate("a"),)).items[0]
    )

    assert item.status is RankingItemStatus.UNRANKED
    assert item.score is None
    assert item.rank is None
    assert item.unranked_reason == (
        "No positive-weight criteria have available values."
    )


def test_maturity_and_completeness_trace_source_values_and_provenance() -> None:
    request = _request(
        (
            _robot("min", maturity="1", completeness="0"),
            _robot("max", maturity="9", completeness="100"),
        ),
        weights=tuple(
            (
                criterion.value,
                Decimal("50")
                if criterion
                in (RankingCriterion.MATURITY, RankingCriterion.DATA_QUALITY)
                else Decimal("0"),
            )
            for criterion in RankingCriterion
        ),
    )

    items = (
        ScoringUseCase.ranking_v1()
        .score(request, (_candidate("min"), _candidate("max")))
        .items
    )
    maximum = next(item for item in items if item.candidate_id == "max")
    sourced_traces = {
        trace.code: trace
        for trace in maximum.criteria
        if trace.code
        in (RankingCriterion.MATURITY, RankingCriterion.DATA_QUALITY)
    }

    assert sourced_traces[RankingCriterion.MATURITY].raw_value == Decimal("9")
    assert sourced_traces[RankingCriterion.MATURITY].unit == "TRL"
    assert sourced_traces[RankingCriterion.MATURITY].provenance == (SOURCE,)
    assert sourced_traces[RankingCriterion.DATA_QUALITY].raw_value == Decimal(
        "100"
    )
    assert sourced_traces[RankingCriterion.DATA_QUALITY].unit == "%"
    assert sourced_traces[RankingCriterion.DATA_QUALITY].provenance == (SOURCE,)
