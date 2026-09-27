-- +goose Up
-- A project is a draft or a saved assessment; matching, simulation and economics are tabs, not statuses.
ALTER TABLE project DROP CONSTRAINT project_status_check;
UPDATE project SET status = CASE WHEN status = 'result' THEN 'saved' ELSE 'draft' END;
ALTER TABLE project
    ALTER COLUMN status SET DEFAULT 'draft',
    ADD CONSTRAINT project_status_check CHECK (status IN ('draft', 'saved')),
    ADD COLUMN saved_at timestamptz,
    -- Grows with every change of the calculation inputs: snapshot, conditions, manual candidates, horizon.
    ADD COLUMN inputs_version integer NOT NULL DEFAULT 0;
UPDATE project SET saved_at = updated_at WHERE status = 'saved';

-- One calculation of the matching candidates. request freezes the whole input, including the
-- catalog fields of every candidate: the catalog itself keeps no history.
CREATE TABLE calc_run (
    id              uuid PRIMARY KEY,
    project_id      uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    match_run_id    uuid NOT NULL REFERENCES match_run (id) ON DELETE CASCADE,
    model_version   text NOT NULL,
    catalog_version integer NOT NULL,
    inputs_version  integer NOT NULL,
    horizon_years   smallint NOT NULL,
    request         jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calc_run_project_idx ON calc_run (project_id, created_at DESC);

-- A result per robot and acquisition model. Values used in comparisons are typed columns.
CREATE TABLE calc_result (
    id                     uuid PRIMARY KEY,
    calc_run_id            uuid NOT NULL REFERENCES calc_run (id) ON DELETE CASCADE,
    solution_id            uuid NOT NULL REFERENCES solution (id),
    acquisition_model      text NOT NULL CHECK (acquisition_model IN ('purchase', 'raas')),
    calculable             boolean NOT NULL,
    reason                 text,
    robot_count            integer,
    charger_count          integer,
    capex_rub              numeric(16, 2),
    opex_year_rub          numeric(16, 2),
    labor_savings_year_rub numeric(16, 2),
    net_effect_year_rub    numeric(16, 2),
    payback_years          numeric(8, 2),
    roi                    numeric(10, 3),
    tco_rub                numeric(16, 2),
    budget_over_rub        numeric(16, 2),
    budget_over_pct        numeric(10, 3),
    trace                  jsonb NOT NULL DEFAULT '[]',
    warnings               text[] NOT NULL DEFAULT '{}',
    sort                   integer NOT NULL DEFAULT 0,
    UNIQUE (calc_run_id, solution_id, acquisition_model)
);

ALTER TABLE project ADD COLUMN selected_calc_result_id uuid REFERENCES calc_result (id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE project DROP COLUMN selected_calc_result_id;
DROP TABLE calc_result;
DROP TABLE calc_run;
ALTER TABLE project DROP CONSTRAINT project_status_check;
UPDATE project SET status = CASE WHEN status = 'saved' THEN 'result' ELSE 'params' END;
ALTER TABLE project
    ALTER COLUMN status SET DEFAULT 'params',
    ADD CONSTRAINT project_status_check CHECK (status IN ('params', 'matching', 'simulation', 'economics', 'result')),
    DROP COLUMN saved_at,
    DROP COLUMN inputs_version;
