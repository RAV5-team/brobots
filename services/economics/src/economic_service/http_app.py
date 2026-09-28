"""FastAPI application factory and transport-level middleware."""

import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.engine import Engine
from starlette.concurrency import run_in_threadpool

from economic_service.adapters.http.schemas import (
    ErrorResponseDto,
    EvaluationRequestDto,
    EvaluationSnapshotDto,
    ModelVersionDto,
)
from economic_service.adapters.persistence.sqlalchemy_repository import (
    SqlAlchemyEvaluationSnapshotRepository,
    create_engine_for_url,
)
from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.application.evaluation import (
    EvaluationApplicationService,
    SystemClock,
)
from economic_service.config import AppSettings
from economic_service.domain.errors import DomainError, ModelVersionError
from economic_service.logging_setup import configure_logging
from economic_service.model_versions import (
    CALCULATION_MODEL_VERSION,
    RANKING_MODEL_VERSION,
    is_supported_calculation_version,
)

LOGGER = logging.getLogger(__name__)
REQUEST_ID_HEADER = "X-Request-ID"

ReadinessProbe = Callable[[], None]


def create_app(
    settings: AppSettings | None = None,
    evaluation_service: EvaluationApplicationService | None = None,
    readiness_probe: ReadinessProbe | None = None,
) -> FastAPI:
    """Creates the FastAPI application for the configured environment.

    Without an injected service the app wires PostgreSQL and checks it in
    /readyz; an injected service is checked only by readiness_probe.
    """

    resolved_settings = settings or AppSettings.from_environment()
    configure_logging(resolved_settings.log_level)
    service = evaluation_service
    probe = readiness_probe
    if service is None:
        engine = create_engine_for_url(resolved_settings.database_url)
        service = _default_evaluation_service(engine)
        probe = probe or _database_probe(engine)

    application = FastAPI(
        title="RAV5 Economic Service",
        version="0.1.0",
        description=(
            "Economic calculation service for RAV5 robotics assessments."
        ),
    )
    application.state.settings = resolved_settings
    application.state.evaluation_service = service

    @application.get("/", include_in_schema=False)
    async def manual_workbench() -> FileResponse:
        """Serves the local browser workbench for manual API exploration."""

        page = Path(__file__).parent / "web" / "index.html"
        return FileResponse(page, media_type="text/html")

    @application.exception_handler(ModelVersionError)
    async def model_version_conflict(
        request: Request,
        error: ModelVersionError,
    ) -> JSONResponse:
        """Maps unavailable model versions to a conflict response."""

        del request
        return JSONResponse(
            status_code=409,
            content={"detail": str(error)},
        )

    @application.exception_handler(DomainError)
    async def domain_validation_error(
        request: Request,
        error: DomainError,
    ) -> JSONResponse:
        """Maps domain input failures to a validation response."""

        del request
        return JSONResponse(
            status_code=422,
            content={"detail": str(error)},
        )

    @application.middleware("http")
    async def add_request_id(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Adds or forwards a request correlation identifier."""

        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

    @application.get("/healthz", tags=["system"])
    async def health_check() -> dict[str, str]:
        """Reports that the process is alive."""

        return {"status": "ok", "service": resolved_settings.app_name}

    @application.get(
        "/readyz",
        tags=["system"],
        responses={
            503: {
                "model": ErrorResponseDto,
                "description": "The database is unavailable.",
            },
        },
    )
    async def readiness_check() -> dict[str, str]:
        """Reports readiness: the snapshot database answers."""

        if probe is not None:
            try:
                await run_in_threadpool(probe)
            except Exception as error:
                LOGGER.warning("Readiness check failed: %s", error)
                raise HTTPException(
                    status_code=503,
                    detail="The database is unavailable.",
                ) from error
        return {"status": "ready", "service": resolved_settings.app_name}

    @application.get(
        "/api/v1/model-version",
        response_model=ModelVersionDto,
        tags=["evaluations"],
    )
    async def model_version() -> ModelVersionDto:
        """Returns the calculation and ranking versions served now."""

        return ModelVersionDto(
            model_version=CALCULATION_MODEL_VERSION,
            ranking_version=RANKING_MODEL_VERSION,
        )

    @application.post(
        "/api/v1/evaluations",
        response_model=EvaluationSnapshotDto,
        status_code=201,
        responses={
            409: {
                "model": ErrorResponseDto,
                "description": "The requested model version is unavailable.",
            },
            422: {
                "model": ErrorResponseDto,
                "description": (
                    "The request is invalid or contains invalid domain data."
                ),
            },
        },
        tags=["evaluations"],
    )
    async def create_evaluation(
        payload: EvaluationRequestDto,
    ) -> EvaluationSnapshotDto:
        """Calculates, persists, and returns one evaluation snapshot."""

        if not is_supported_calculation_version(payload.model_version):
            raise ModelVersionError(
                "Requested calculation model version is unavailable: "
                f"{payload.model_version}."
            )
        snapshot = service.evaluate(payload.to_domain())
        return EvaluationSnapshotDto.from_domain(snapshot)

    @application.get(
        "/api/v1/evaluations/{evaluation_id}",
        response_model=EvaluationSnapshotDto,
        responses={
            404: {
                "model": ErrorResponseDto,
                "description": "The evaluation was not found.",
            },
        },
        tags=["evaluations"],
    )
    async def get_evaluation(evaluation_id: str) -> EvaluationSnapshotDto:
        """Returns the latest immutable snapshot for an evaluation."""

        snapshot = service.get(evaluation_id)
        if snapshot is None:
            raise HTTPException(
                status_code=404,
                detail="Evaluation was not found.",
            )
        return EvaluationSnapshotDto.from_domain(snapshot)

    return application


def _default_evaluation_service(
    engine: Engine,
) -> EvaluationApplicationService:
    """Creates the production-wired service without opening a DB connection."""

    repository = SqlAlchemyEvaluationSnapshotRepository.from_engine(engine)
    return EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=SystemClock(),
    )


def _database_probe(engine: Engine) -> ReadinessProbe:
    """Builds a readiness probe that runs one trivial query."""

    def probe() -> None:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    return probe
