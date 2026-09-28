-- +goose Up
-- Runs of the «Симуляция» step (PRD 11.4): the job of services/simulation started by the orchestrator for the
-- selected configuration. The run itself (verdict, KPIs, traces) stays in services/simulation; api keeps the link,
-- the conditions it was started with and the inputs version, so a later change of the project marks it stale.
CREATE TABLE simulation_run (
    id             uuid PRIMARY KEY,
    project_id     uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    job_id         text NOT NULL,
    simulation_id  text,
    status         text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'error', 'cancelled')),
    robot_count    integer NOT NULL,
    charger_count  integer NOT NULL,
    conditions     jsonb NOT NULL DEFAULT '{}',
    assumptions    jsonb NOT NULL DEFAULT '[]',
    error          text,
    inputs_version integer NOT NULL,
    owner_id       uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX simulation_run_project_idx ON simulation_run (project_id, created_at DESC);

-- +goose Down
DROP TABLE simulation_run;
