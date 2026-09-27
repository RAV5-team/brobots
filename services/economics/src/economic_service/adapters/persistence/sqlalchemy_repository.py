"""PostgreSQL-backed immutable evaluation snapshot repository."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

from economic_service.adapters.persistence.codec import (
    snapshot_from_json,
    snapshot_to_json,
)
from economic_service.domain.models import EvaluationSnapshot

SNAPSHOT_SCHEMA_VERSION = "2"
JSON_STORAGE_TYPE = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    """Base class for persistence metadata."""


class EvaluationSnapshotRecord(Base):
    """Typed metadata row with immutable JSON request and result snapshots."""

    __tablename__ = "evaluation_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_id", "revision", name="uq_evaluation_revision"
        ),
    )

    snapshot_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evaluation_id: Mapped[str] = mapped_column(String(128), index=True)
    project_id: Mapped[str] = mapped_column(String(128), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    revision_of: Mapped[str | None] = mapped_column(String(128), nullable=True)
    schema_version: Mapped[str] = mapped_column(String(32))
    model_version: Mapped[str] = mapped_column(String(128))
    request_digest: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON_STORAGE_TYPE)
    result_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON_STORAGE_TYPE)


def create_engine_for_url(database_url: str) -> Engine:
    """Creates a SQLAlchemy engine for the configured database URL."""

    return create_engine(database_url, pool_pre_ping=True)


def create_schema(engine: Engine) -> None:
    """Creates local metadata for development and test environments."""

    Base.metadata.create_all(engine)


@dataclass
class SqlAlchemyEvaluationSnapshotRepository:
    """Persists snapshots by insert-only revisions."""

    session_factory: sessionmaker[Session]
    schema_version: str = SNAPSHOT_SCHEMA_VERSION

    @classmethod
    def from_engine(
        cls,
        engine: Engine,
        schema_version: str = SNAPSHOT_SCHEMA_VERSION,
    ) -> SqlAlchemyEvaluationSnapshotRepository:
        """Builds a repository from an SQLAlchemy engine."""

        return cls(
            session_factory=sessionmaker(bind=engine, expire_on_commit=False),
            schema_version=schema_version,
        )

    def save(self, snapshot: EvaluationSnapshot) -> None:
        """Inserts a new immutable revision for an evaluation ID."""

        input_snapshot, result_snapshot = snapshot_to_json(snapshot)
        request_digest = hashlib.sha256(
            json.dumps(
                input_snapshot,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        with self.session_factory() as session:
            if session.get_bind().dialect.name == "postgresql":
                session.execute(
                    text(
                        "SELECT pg_advisory_xact_lock("
                        "hashtextextended(:evaluation_id, 0))"
                    ),
                    {"evaluation_id": snapshot.evaluation_id},
                )
            latest_revision = session.scalar(
                select(EvaluationSnapshotRecord.revision)
                .where(
                    EvaluationSnapshotRecord.evaluation_id
                    == snapshot.evaluation_id
                )
                .order_by(EvaluationSnapshotRecord.revision.desc())
                .limit(1)
            )
            revision = (latest_revision or 0) + 1
            session.add(
                EvaluationSnapshotRecord(
                    evaluation_id=snapshot.evaluation_id,
                    project_id=snapshot.project_id,
                    revision=revision,
                    revision_of=snapshot.revision_of,
                    schema_version=self.schema_version,
                    model_version=snapshot.result.model_version,
                    request_digest=request_digest,
                    created_at=snapshot.created_at,
                    input_snapshot=input_snapshot,
                    result_snapshot=result_snapshot,
                )
            )
            session.commit()

    def get(self, evaluation_id: str) -> EvaluationSnapshot | None:
        """Returns the latest immutable revision for an evaluation ID."""

        with self.session_factory() as session:
            record = session.scalar(
                select(EvaluationSnapshotRecord)
                .where(EvaluationSnapshotRecord.evaluation_id == evaluation_id)
                .order_by(EvaluationSnapshotRecord.revision.desc())
                .limit(1)
            )
            if record is None:
                return None
            return snapshot_from_json(
                input_payload=record.input_snapshot,
                result_payload=record.result_snapshot,
                created_at=record.created_at,
                revision_of=record.revision_of,
            )
