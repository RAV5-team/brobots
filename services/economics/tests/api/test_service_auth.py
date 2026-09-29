"""Only the service token of api reaches the economics API (roles model §9)."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from economic_service.adapters.http.auth import Caller, InvalidTokenError
from economic_service.adapters.http.schemas import EvaluationRequestDto
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
from economic_service.http_app import create_app
from tests.api.test_evaluations import _catalog_candidate
from tests.unit.application.test_calculation import _request

API = "rav5-api-internal"
TOKENS = {
    "service": Caller(sub="svc", azp=API, roles=frozenset({"service"})),
    "foreign": Caller(sub="svc2", azp="other", roles=frozenset({"service"})),
    "user": Caller(sub="u", azp="rav5-web", roles=frozenset({"user"})),
}


class FakeVerifier:
    """Accepts the tokens of TOKENS; the keys are loaded when ready is set."""

    def __init__(self, ready: bool = True) -> None:
        self.ready = ready

    def verify(self, token: str) -> Caller:
        if token not in TOKENS:
            raise InvalidTokenError("unknown token")
        return TOKENS[token]

    def is_ready(self) -> bool:
        return self.ready


def _app(
    verifier: FakeVerifier,
) -> tuple[TestClient, EvaluationApplicationService]:
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
    app = create_app(
        settings=AppSettings(
            database_url="sqlite://", environment="production"
        ),
        evaluation_service=service,
        token_verifier=verifier,
    )
    return TestClient(app), service


def _payload() -> dict:
    request = replace(
        _request(), candidates=(_catalog_candidate().to_domain(),)
    )
    return EvaluationRequestDto.from_domain(request).model_dump(mode="json")


@pytest.mark.parametrize(
    ("header", "status"),
    [
        (None, 401),
        ("Bearer garbage", 401),
        ("Basic YTpi", 401),
        ("Bearer user", 401),
        ("Bearer foreign", 401),
        ("Bearer service", 200),
    ],
)
def test_api_accepts_only_the_service_token_of_api(
    header: str | None, status: int
) -> None:
    client, _ = _app(FakeVerifier())
    headers = {"Authorization": header} if header else {}

    response = client.get("/api/v1/model-version", headers=headers)

    assert response.status_code == status
    if status == 401:
        assert response.json()["code"] == "unauthorized"
        assert response.headers["WWW-Authenticate"].startswith("Bearer")


def test_health_is_open_and_readiness_waits_for_the_keys() -> None:
    verifier = FakeVerifier(ready=False)
    client, _ = _app(verifier)

    assert client.get("/healthz").status_code == 200
    assert client.get("/readyz").status_code == 503
    verifier.ready = True
    assert client.get("/readyz").status_code == 200


def test_dry_run_calculates_without_saving() -> None:
    client, service = _app(FakeVerifier())
    auth = {"Authorization": "Bearer service"}
    payload = _payload()

    dry = client.post(
        "/api/v1/evaluations?dry_run=true", json=payload, headers=auth
    )

    assert dry.status_code == 201
    evaluation_id = dry.json()["evaluation_id"]
    assert service.get(evaluation_id) is None
    saved = client.post("/api/v1/evaluations", json=payload, headers=auth)
    assert saved.status_code == 201
    assert service.get(evaluation_id) is not None


def test_without_oidc_outside_development_the_app_does_not_start() -> None:
    with pytest.raises(RuntimeError, match="OIDC_ISSUER"):
        create_app(
            settings=AppSettings(
                database_url="sqlite://", environment="production"
            ),
            evaluation_service=object(),  # type: ignore[arg-type]
        )
