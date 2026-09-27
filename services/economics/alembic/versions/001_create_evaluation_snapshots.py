"""Create immutable evaluation snapshot storage."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "001_evaluation_snapshots"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Creates typed metadata and JSONB snapshot columns."""

    op.create_table(
        "evaluation_snapshots",
        sa.Column(
            "snapshot_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("evaluation_id", sa.String(length=128), nullable=False),
        sa.Column("project_id", sa.String(length=128), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("revision_of", sa.String(length=128), nullable=True),
        sa.Column("schema_version", sa.String(length=32), nullable=False),
        sa.Column("model_version", sa.String(length=128), nullable=False),
        sa.Column("request_digest", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "input_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "result_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("snapshot_id"),
        sa.UniqueConstraint(
            "evaluation_id",
            "revision",
            name="uq_evaluation_revision",
        ),
    )
    op.create_index(
        "ix_evaluation_snapshots_evaluation_id",
        "evaluation_snapshots",
        ["evaluation_id"],
    )
    op.create_index(
        "ix_evaluation_snapshots_project_id",
        "evaluation_snapshots",
        ["project_id"],
    )


def downgrade() -> None:
    """Removes the snapshot table."""

    op.drop_index(
        "ix_evaluation_snapshots_project_id",
        table_name="evaluation_snapshots",
    )
    op.drop_index(
        "ix_evaluation_snapshots_evaluation_id",
        table_name="evaluation_snapshots",
    )
    op.drop_table("evaluation_snapshots")
