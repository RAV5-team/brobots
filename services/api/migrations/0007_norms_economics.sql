-- +goose Up
-- Calculation norms of screen А5 (PRD 6.8). A set is immutable: an admin change creates the next
-- version. New projects pin the latest version, existing ones keep calculating on their own.
CREATE TABLE norm_set (
    id         uuid PRIMARY KEY,
    version    integer NOT NULL UNIQUE,
    label      text NOT NULL,
    note       text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE norm_value (
    norm_set_id uuid NOT NULL REFERENCES norm_set (id) ON DELETE CASCADE,
    code        text NOT NULL,
    group_code  text NOT NULL,
    label       text NOT NULL,
    value       numeric NOT NULL,
    unit        text NOT NULL,
    kind        text NOT NULL CHECK (kind IN ('norm', 'assumption')),
    source      text NOT NULL,
    sort        integer NOT NULL DEFAULT 0,
    PRIMARY KEY (norm_set_id, code)
);

ALTER TABLE project ADD COLUMN norm_set_id uuid REFERENCES norm_set (id);

-- The economics service ranks the candidates and returns cost items and the current-process baseline.
ALTER TABLE calc_run
    ADD COLUMN norm_set_id     uuid REFERENCES norm_set (id),
    ADD COLUMN ranking_version text;

ALTER TABLE calc_result
    ADD COLUMN rank        integer,
    ADD COLUMN score       numeric(10, 4),
    ADD COLUMN feasibility text CHECK (feasibility IN ('high', 'medium', 'low', 'none')),
    ADD COLUMN details     jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE calc_result DROP COLUMN details, DROP COLUMN feasibility, DROP COLUMN score, DROP COLUMN rank;
ALTER TABLE calc_run DROP COLUMN ranking_version, DROP COLUMN norm_set_id;
ALTER TABLE project DROP COLUMN norm_set_id;
DROP TABLE norm_value;
DROP TABLE norm_set;
