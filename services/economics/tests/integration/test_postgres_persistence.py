"""PostgreSQL-backed integration tests for snapshot persistence."""

from __future__ import annotations

import os
import subprocess
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

import pytest
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.engine import Engine

from economic_service.adapters.persistence.sqlalchemy_repository import (
    EvaluationSnapshotRecord,
    SqlAlchemyEvaluationSnapshotRepository,
)
from economic_service.application.calculation import EconomicCalculationEngine
from economic_service.application.evaluation import (
    EvaluationApplicationService,
    SystemClock,
)
from tests.unit.application.test_calculation import _request

POSTGRES_URL_ENV = "POSTGRES_TEST_DATABASE_URL"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def postgres_engine() -> Generator[Engine, None, None]:
    """Provides a migrated PostgreSQL engine when explicitly configured."""

    database_url = os.getenv(POSTGRES_URL_ENV)
    if not database_url:
        pytest.fail(f"Set {POSTGRES_URL_ENV} to run PostgreSQL tests.")

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))

        migration_environment = os.environ.copy()
        migration_environment["DATABASE_URL"] = database_url
        subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=REPOSITORY_ROOT,
            env=migration_environment,
            check=True,
        )
    except Exception:
        engine.dispose()
        raise

    yield engine
    engine.dispose()


def _service(engine: Engine) -> EvaluationApplicationService:
    repository = SqlAlchemyEvaluationSnapshotRepository.from_engine(engine)
    return EvaluationApplicationService(
        calculator=EconomicCalculationEngine(),
        repository=repository,
        clock=SystemClock(),
    )


def _clean_evaluation(engine: Engine, evaluation_id: str) -> None:
    repository = SqlAlchemyEvaluationSnapshotRepository.from_engine(engine)
    with repository.session_factory() as session:
        session.execute(
            delete(EvaluationSnapshotRecord).where(
                EvaluationSnapshotRecord.evaluation_id == evaluation_id
            )
        )
        session.commit()


@pytest.mark.postgres
def test_postgres_snapshot_round_trip_preserves_rub_request(
    postgres_engine: Engine,
) -> None:
    """A PostgreSQL JSONB snapshot round trip preserves the RUB contract."""

    evaluation_id = "postgres-round-trip"
    _clean_evaluation(postgres_engine, evaluation_id)
    request = replace(_request(), evaluation_id=evaluation_id)

    saved = _service(postgres_engine).evaluate(request)
    loaded = SqlAlchemyEvaluationSnapshotRepository.from_engine(
        postgres_engine
    ).get(evaluation_id)

    assert loaded == saved
    assert loaded is not None
    assert loaded.request.calculation_currency == "RUB"
    assert loaded.request.task.target_annual_payroll.currency == "RUB"
    assert loaded.result.candidates[0].traces


@pytest.mark.postgres
def test_postgres_recalculation_creates_immutable_revision(
    postgres_engine: Engine,
) -> None:
    """Repeated evaluation inserts a new PostgreSQL revision."""

    evaluation_id = "postgres-revisions"
    _clean_evaluation(postgres_engine, evaluation_id)
    request = replace(_request(), evaluation_id=evaluation_id)
    service = _service(postgres_engine)

    service.evaluate(request)
    service.evaluate(request)

    repository = SqlAlchemyEvaluationSnapshotRepository.from_engine(
        postgres_engine
    )
    with repository.session_factory() as session:
        rows = session.scalars(
            select(EvaluationSnapshotRecord)
            .where(EvaluationSnapshotRecord.evaluation_id == evaluation_id)
            .order_by(EvaluationSnapshotRecord.revision)
        ).all()

    assert [row.revision for row in rows] == [1, 2]
    assert rows[0].snapshot_id != rows[1].snapshot_id
    assert rows[1].revision_of == evaluation_id


@pytest.mark.postgres
def test_postgres_concurrent_revisions_are_unique_and_consecutive(
    postgres_engine: Engine,
) -> None:
    """Concurrent writes serialize revision allocation per evaluation."""

    evaluation_id = "postgres-concurrent-revisions"
    _clean_evaluation(postgres_engine, evaluation_id)
    request = replace(_request(), evaluation_id=evaluation_id)
    service = _service(postgres_engine)
    revision_count = 8

    with ThreadPoolExecutor(max_workers=revision_count) as executor:
        list(executor.map(service.evaluate, (request,) * revision_count))

    repository = SqlAlchemyEvaluationSnapshotRepository.from_engine(
        postgres_engine
    )
    with repository.session_factory() as session:
        rows = session.scalars(
            select(EvaluationSnapshotRecord)
            .where(EvaluationSnapshotRecord.evaluation_id == evaluation_id)
            .order_by(EvaluationSnapshotRecord.revision)
        ).all()

    assert [row.revision for row in rows] == list(range(1, revision_count + 1))
