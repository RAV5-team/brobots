"""HTTP contract tests for evaluation submission and retrieval."""

from dataclasses import replace

from fastapi.testclient import TestClient

from economic_service.adapters.http.schemas import (
    CandidateDto,
    EvaluationRequestDto,
    SourceDto,
)
from economic_service.adapters.persistence.sqlalchemy_repository import (
    Base,
    SqlAlchemyEvaluationSnapshotRepository,
)
from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.application.evaluation import (
    EvaluationApplicationService,
    SystemClock,
)
from economic_service.config import AppSettings
from economic_service.domain.models import (
    ConfirmationStatus,
    InputOrigin,
    RankingCriterion,
)
from economic_service.http_app import create_app
from tests.fixtures.extracted_loader import (
    load_catalog_products,
    load_facility_scenario,
    money_from_rub_millions,
)
from tests.unit.application.test_calculation import _request


def _client() -> TestClient:
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    service = EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=SqlAlchemyEvaluationSnapshotRepository.from_engine(engine),
        clock=SystemClock(),
    )
    return TestClient(
        create_app(
            settings=AppSettings(database_url="sqlite://"),
            evaluation_service=service,
        )
    )


def _catalog_candidate() -> CandidateDto:
    product = load_catalog_products()[0]
    return CandidateDto(
        candidate_id=product["product_id"],
        robot_code=product["name"],
        price=None,
        payload_kg=None,
        max_speed_mps=None,
        loading_seconds=None,
        unloading_seconds=None,
        average_power_kw=None,
        handling_method=None,
        catalog_status=product["status"],
        confirmation=ConfirmationStatus.PARTIAL,
        source=SourceDto(
            source="catalog_export_v4.csv",
            origin=InputOrigin.RECORDED,
            confirmation=ConfirmationStatus.PARTIAL,
            version="catalog_export_v4",
            note=(
                "The export has no structured capability fields or explicit "
                "price currency."
            ),
        ),
    )


def test_post_and_get_evaluation_return_snapshot_and_ranking_gate() -> None:
    client = _client()
    warehouse = load_facility_scenario("Склад")
    budget_row = next(
        row
        for row in warehouse
        if row["parameter"] == "Планируемый бюджет на роботизацию (CAPEX)"
    )
    assert money_from_rub_millions(budget_row["base_value"]).currency == "RUB"
    request = replace(
        _request(), candidates=(_catalog_candidate().to_domain(),)
    )
    payload = EvaluationRequestDto.from_domain(request)
    task_payload = payload.model_dump(mode="json")["task"]
    assert payload.task.baseline_annual_opex.to_domain() == (
        request.task.baseline_annual_payroll
    )
    assert "baseline_annual_opex" in task_payload
    assert "baseline_annual_payroll" not in task_payload

    response = client.post(
        "/api/v1/evaluations",
        json=payload.model_dump(mode="json"),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["result"]["status"] == "partial"
    assert body["result"]["ranking"]["status"] == "available"
    assert body["result"]["ranking"]["model_version"] == "ranking-v1"
    assert body["result"]["ranking"]["items"] == []
    assert body["request"]["candidates"][0]["price"] is None
    assert body["request"]["candidates"][0]["confirmation"] == "partial"
    assert body["result"]["candidates"][0]["status"] == ("unresolved_economics")
    assert response.headers["X-Request-ID"]

    fetched = client.get(f"/api/v1/evaluations/{request.evaluation_id}")
    assert fetched.status_code == 200
    assert fetched.json()["evaluation_id"] == request.evaluation_id
    assert fetched.json()["request"]["model_version"] == "economic-v1.1"


def test_post_and_get_round_trip_applicable_ranking_trace() -> None:
    client = _client()
    request = _request()
    payload = EvaluationRequestDto.from_domain(request).model_dump(mode="json")

    created = client.post("/api/v1/evaluations", json=payload)
    fetched = client.get(f"/api/v1/evaluations/{request.evaluation_id}")

    assert created.status_code == 201
    assert fetched.status_code == 200
    ranking = created.json()["result"]["ranking"]
    assert ranking["status"] == "available"
    assert len(ranking["items"]) == 1
    assert ranking["items"][0]["candidate_status"] == "applicable"
    assert ranking["items"][0]["criteria"]
    assert fetched.json()["result"]["ranking"] == ranking


def test_http_money_requires_explicit_currency() -> None:
    client = _client()
    payload = EvaluationRequestDto.from_domain(_request()).model_dump(
        mode="json"
    )
    del payload["task"]["target_annual_payroll"]["currency"]

    response = client.post("/api/v1/evaluations", json=payload)

    assert response.status_code == 422


def test_http_rejects_non_rub_calculation_currency() -> None:
    client = _client()
    payload = EvaluationRequestDto.from_domain(_request()).model_dump(
        mode="json"
    )
    payload["calculation_currency"] = "USD"

    response = client.post("/api/v1/evaluations", json=payload)

    assert response.status_code == 422


def test_bad_input_and_ranking_version_errors() -> None:
    client = _client()

    assert client.post("/api/v1/evaluations", json={}).status_code == 422

    request = replace(_request(), requested_ranking_version="ranking-v2")
    payload = EvaluationRequestDto.from_domain(request)
    response = client.post(
        "/api/v1/evaluations",
        json=payload.model_dump(mode="json"),
    )
    assert response.status_code == 409


def test_http_rejects_invalid_ranking_weight_overrides() -> None:
    client = _client()
    request = replace(
        _request(),
        ranking_weights=((RankingCriterion.PAYBACK.value, 100),),
    )
    payload = EvaluationRequestDto.from_domain(request).model_dump(mode="json")

    response = client.post("/api/v1/evaluations", json=payload)

    assert response.status_code == 422


def test_model_version_reports_the_served_versions() -> None:
    response = _client().get("/api/v1/model-version")

    assert response.status_code == 200
    assert response.json() == {
        "model_version": "economic-v1.1",
        "ranking_version": "ranking-v1",
    }


def test_http_rejects_unknown_calculation_model_version() -> None:
    client = _client()
    request = replace(_request(), model_version="economic-v9")
    payload = EvaluationRequestDto.from_domain(request).model_dump(mode="json")

    response = client.post("/api/v1/evaluations", json=payload)

    assert response.status_code == 409
    assert "economic-v9" in response.json()["detail"]


def test_get_unknown_evaluation_returns_not_found() -> None:
    response = _client().get("/api/v1/evaluations/missing")

    assert response.status_code == 404


def test_openapi_documents_versioned_evaluation_routes() -> None:
    response = _client().get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/evaluations" in paths
    assert "/api/v1/evaluations/{evaluation_id}" in paths
    assert "/api/v1/model-version" in paths
