"""Начальная схема: задания, прогоны, трассы; мягкое удаление.

Revision ID: 0001
Revises:
Create Date: 2026-09-26
"""

# Имя файла ревизии начинается с цифры — так именует Alembic.
# pylint: disable=invalid-name

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

_UPGRADE = """
CREATE TABLE jobs (
    job_id             text PRIMARY KEY CHECK (job_id ~ '^[0-9a-f]{32}$'),
    status             text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'running', 'done', 'error')),
    simulation_version text NOT NULL,
    request            jsonb NOT NULL CHECK (jsonb_typeof(request) = 'object'),
    scenarios          jsonb NOT NULL CHECK (
                           jsonb_typeof(scenarios) = 'array'
                           AND jsonb_array_length(scenarios) BETWEEN 1 AND 2),
    log                jsonb NOT NULL DEFAULT '[]'::jsonb
                       CHECK (jsonb_typeof(log) = 'array'),
    workers            smallint CHECK (workers > 0),
    attempts           smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    lease              integer NOT NULL DEFAULT 0 CHECK (lease >= 0),
    worker_id          text,
    error              text,
    errors             jsonb,
    error_detail       text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    started_at         timestamptz,
    heartbeat_at       timestamptz,
    finished_at        timestamptz,
    deleted_at         timestamptz,
    CONSTRAINT jobs_finished_chk
        CHECK ((status IN ('done', 'error')) = (finished_at IS NOT NULL)),
    CONSTRAINT jobs_error_chk CHECK ((status = 'error') = (error IS NOT NULL)),
    CONSTRAINT jobs_running_chk
        CHECK (status <> 'running' OR heartbeat_at IS NOT NULL)
);
COMMENT ON TABLE jobs IS 'Задания проверки: очередь, ход расчёта, итог.';
COMMENT ON COLUMN jobs.error_detail IS 'Трассировка стека; в API не отдаётся.';
COMMENT ON COLUMN jobs.attempts IS 'Потраченные попытки; лимит — у воркера.';
COMMENT ON COLUMN jobs.lease IS
    'Токен владения: растёт при каждом захвате и никогда не уменьшается.';
CREATE INDEX jobs_queue_idx ON jobs (created_at, job_id)
    WHERE status = 'queued' AND deleted_at IS NULL;
CREATE INDEX jobs_heartbeat_idx ON jobs (heartbeat_at)
    WHERE status = 'running' AND deleted_at IS NULL;

CREATE TABLE runs (
    simulation_id      text PRIMARY KEY CHECK (simulation_id ~ '^[0-9a-f]{32}$'),
    job_id             text NOT NULL REFERENCES jobs (job_id) ON DELETE RESTRICT,
    scenario_index     smallint NOT NULL CHECK (scenario_index IN (0, 1)),
    scenario_name      text NOT NULL,
    configuration_id   text,
    status             text NOT NULL CHECK (status IN (
                           'confirmed', 'can_reduce', 'needs_additions',
                           'layout_bottleneck', 'not_achievable')),
    simulation_version text NOT NULL,
    result             jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
    created_at         timestamptz NOT NULL DEFAULT now(),
    deleted_at         timestamptz,
    CONSTRAINT runs_job_scenario_uq UNIQUE (job_id, scenario_index)
);
COMMENT ON TABLE runs IS 'Прогоны сценариев: SimulationRun целиком в result.';

CREATE TABLE run_traces (
    simulation_id text PRIMARY KEY
                  REFERENCES runs (simulation_id) ON DELETE RESTRICT,
    traces_gz     bytea NOT NULL,
    raw_bytes     integer NOT NULL CHECK (raw_bytes >= 0),
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);
COMMENT ON TABLE run_traces IS '2D-трассы прогона: gzip компактного JSON.';
ALTER TABLE run_traces ALTER COLUMN traces_gz SET STORAGE EXTERNAL;
"""

_DOWNGRADE = """
DROP TABLE run_traces;
DROP TABLE runs;
DROP TABLE jobs;
"""


def upgrade() -> None:
    """Создаёт таблицы jobs, runs, run_traces."""
    op.execute(_UPGRADE)


def downgrade() -> None:
    """Удаляет таблицы в обратном порядке."""
    op.execute(_DOWNGRADE)
