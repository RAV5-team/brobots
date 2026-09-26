-- +goose Up
-- An assessment of exactly one task. snapshot freezes the location and task inputs.
CREATE TABLE project (
    id                         uuid PRIMARY KEY,
    name                       text NOT NULL,
    location_id                uuid NOT NULL REFERENCES location (id),
    task_id                    uuid NOT NULL REFERENCES task (id),
    status                     text NOT NULL DEFAULT 'params'
        CHECK (status IN ('params', 'matching', 'simulation', 'economics', 'result')),
    horizon_years              smallint CHECK (horizon_years BETWEEN 1 AND 30),
    catalog_version            integer NOT NULL,
    dictionaries_version       integer NOT NULL,
    model_version              text,
    snapshot                   jsonb NOT NULL,
    snapshot_taken_at          timestamptz NOT NULL,
    pinned_solution_id         uuid REFERENCES solution (id),
    selected_solution_id       uuid REFERENCES solution (id),
    selected_acquisition_model text CHECK (selected_acquisition_model IN ('purchase', 'raas')),
    copied_from_id             uuid REFERENCES project (id) ON DELETE SET NULL,
    is_demo                    boolean NOT NULL DEFAULT false,
    owner_id                   uuid,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    deleted_at                 timestamptz
);

CREATE INDEX project_location_idx ON project (location_id) WHERE deleted_at IS NULL;
CREATE INDEX project_task_idx ON project (task_id) WHERE deleted_at IS NULL;

CREATE TABLE project_condition_override (
    project_id   uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    check_code   text NOT NULL CHECK (check_code IN ('handling', 'environment', 'payload', 'aisle_width', 'min_temperature', 'lift_height')),
    value_number numeric,
    value_text   text,
    value_list   text[],
    note         text,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, check_code)
);

CREATE TABLE project_manual_candidate (
    project_id  uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    solution_id uuid NOT NULL REFERENCES solution (id),
    reason      text,
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, solution_id)
);

CREATE TABLE match_run (
    id               uuid PRIMARY KEY,
    project_id       uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
    task_id          uuid NOT NULL REFERENCES task (id),
    work_type_id     uuid NOT NULL REFERENCES work_type (id),
    catalog_version  integer NOT NULL,
    ruleset_version  text NOT NULL,
    conditions       jsonb NOT NULL,
    total_candidates integer NOT NULL,
    passed_count     integer NOT NULL,
    verify_count     integer NOT NULL,
    excluded_count   integer NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX match_run_project_idx ON match_run (project_id, created_at DESC);

CREATE TABLE match_candidate (
    id            uuid PRIMARY KEY,
    run_id        uuid NOT NULL REFERENCES match_run (id) ON DELETE CASCADE,
    solution_id   uuid NOT NULL REFERENCES solution (id),
    capability_id uuid REFERENCES robot_capability (id),
    offer_id      uuid REFERENCES solution_offer (id) ON DELETE SET NULL,
    state         text NOT NULL CHECK (state IN ('passed', 'needs_verification', 'excluded')),
    is_manual     boolean NOT NULL DEFAULT false,
    transfer_flag text CHECK (transfer_flag IN ('P0', 'P1', 'P2', 'P3')),
    risks         text[] NOT NULL DEFAULT '{}',
    summary_ru    text,
    sort          integer NOT NULL DEFAULT 0,
    UNIQUE (run_id, solution_id)
);

CREATE INDEX match_candidate_solution_idx ON match_candidate (solution_id);

CREATE TABLE match_check (
    candidate_id          uuid NOT NULL REFERENCES match_candidate (id) ON DELETE CASCADE,
    check_code            text NOT NULL,
    status                text NOT NULL CHECK (status IN ('pass', 'fail', 'unknown', 'not_applicable')),
    robot_value           text,
    required_value        text,
    unit                  text,
    robot_value_source    text,
    required_value_source text,
    message_ru            text NOT NULL,
    sort                  smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (candidate_id, check_code)
);

-- +goose Down
DROP TABLE match_check;
DROP TABLE match_candidate;
DROP TABLE match_run;
DROP TABLE project_manual_candidate;
DROP TABLE project_condition_override;
DROP TABLE project;
