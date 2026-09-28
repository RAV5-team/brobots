-- +goose Up
-- Decisions of the user by project steps (PRD 11): the draft reopens on its step with the data entered.
-- inputs is the web model of the decisions, stored as is; the service validates only its shape.
ALTER TABLE project
    ADD COLUMN inputs             jsonb,
    ADD COLUMN current_step       text NOT NULL DEFAULT 'params'
        CHECK (current_step IN ('params', 'matching', 'simulation', 'economics')),
    -- Figures of the selected scenario at save: the projects list and the dashboard show them without
    -- reading the calculation of every project (PRD 11.1, 8.2).
    ADD COLUMN result_summary     jsonb,
    ADD COLUMN quote_requested_at timestamptz;

-- +goose Down
ALTER TABLE project DROP COLUMN quote_requested_at, DROP COLUMN result_summary, DROP COLUMN current_step, DROP COLUMN inputs;
