-- +goose Up
-- Parameters of a facility type, seeded from the organizer datasets (Датасеты_хакатон.xlsx).
-- Rows with staff_role describe a staff group attribute: its value lives in location_staff_group.
CREATE TABLE parameter_definition (
    code               text PRIMARY KEY,
    facility_type_code text NOT NULL REFERENCES facility_type (code),
    group_name         text NOT NULL,
    name               text NOT NULL,
    unit               text,
    value_type         text NOT NULL CHECK (value_type IN ('number', 'integer', 'text', 'bool', 'enum', 'dimensions')),
    base_value_number  numeric,
    base_value_text    text,
    min_value          numeric,
    max_value          numeric,
    enum_values        text[] NOT NULL DEFAULT '{}',
    is_required        boolean NOT NULL DEFAULT false,
    is_constant        boolean NOT NULL DEFAULT false,
    role               text,
    staff_role         text,
    staff_attr         text CHECK (staff_attr IN ('headcount', 'salary')),
    form_section       text NOT NULL CHECK (form_section IN ('area', 'schedule', 'staff', 'object_params')),
    hint               text,
    source_note        text,
    sort               integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX parameter_definition_role_uq
    ON parameter_definition (facility_type_code, role) WHERE role IS NOT NULL;

CREATE TABLE location (
    id                       uuid PRIMARY KEY,
    name                     text NOT NULL,
    facility_type_code       text NOT NULL REFERENCES facility_type (code),
    city                     text NOT NULL,
    address                  text,
    capex_budget_amount      numeric(16, 2) CHECK (capex_budget_amount >= 0),
    capex_budget_currency    char(3) NOT NULL DEFAULT 'RUB',
    capex_budget_source_unit text,
    capex_budget_source      text,
    horizon_years            smallint CHECK (horizon_years BETWEEN 1 AND 30),
    is_demo                  boolean NOT NULL DEFAULT false,
    is_draft                 boolean NOT NULL DEFAULT false,
    owner_id                 uuid,
    updated_by               text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    deleted_at               timestamptz
);

CREATE INDEX location_active_idx ON location (facility_type_code) WHERE deleted_at IS NULL;

ALTER TABLE process
    ADD CONSTRAINT process_created_from_location_fk
    FOREIGN KEY (created_from_location_id) REFERENCES location (id) ON DELETE SET NULL;

CREATE TABLE location_parameter_value (
    location_id    uuid NOT NULL REFERENCES location (id) ON DELETE CASCADE,
    parameter_code text NOT NULL REFERENCES parameter_definition (code),
    value_number   numeric,
    value_text     text,
    value_bool     boolean,
    source         text NOT NULL CHECK (source IN ('user', 'default', 'file', 'organizer', 'formula', 'assumption')),
    is_assumption  boolean NOT NULL DEFAULT false,
    note           text,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (location_id, parameter_code),
    CHECK (num_nonnulls(value_number, value_text, value_bool) <= 1)
);

CREATE TABLE location_staff_group (
    id                     uuid PRIMARY KEY,
    location_id            uuid NOT NULL REFERENCES location (id) ON DELETE CASCADE,
    role_name              text NOT NULL,
    headcount              integer NOT NULL CHECK (headcount >= 0),
    salary_gross_month_rub numeric CHECK (salary_gross_month_rub > 0),
    source                 text,
    sort                   smallint NOT NULL DEFAULT 0,
    UNIQUE (location_id, role_name)
);

-- A process instantiated on a location. work_type_id is copied at creation and never changes.
CREATE TABLE task (
    id                        uuid PRIMARY KEY,
    location_id               uuid NOT NULL REFERENCES location (id),
    process_id                uuid NOT NULL REFERENCES process (id),
    work_type_id              uuid NOT NULL REFERENCES work_type (id),
    name                      text NOT NULL,

    cargo_unit                text,
    unit_mass_kg              numeric CHECK (unit_mass_kg >= 0),
    cargo_divisible           boolean,
    route_points              text[] NOT NULL DEFAULT '{}',
    daily_volume              numeric CHECK (daily_volume >= 0),
    work_hours_per_day        numeric CHECK (work_hours_per_day > 0 AND work_hours_per_day <= 24),
    peak_factor               numeric CHECK (peak_factor >= 1),
    automation_share          numeric CHECK (automation_share BETWEEN 0 AND 1),
    route_length_m            numeric CHECK (route_length_m >= 0),
    site_speed_limit_mps      numeric CHECK (site_speed_limit_mps > 0),
    width_clearance_m         numeric CHECK (width_clearance_m >= 0),
    lift_trip_share           numeric CHECK (lift_trip_share BETWEEN 0 AND 1),
    lift_time_s               numeric CHECK (lift_time_s >= 0),
    environment               text CHECK (environment IN ('indoor', 'outdoor')),
    min_aisle_width_m         numeric CHECK (min_aisle_width_m > 0),
    min_operating_temp_c      numeric,
    required_lift_height_mm   numeric CHECK (required_lift_height_mm > 0),
    turnover_rate             numeric CHECK (turnover_rate BETWEEN 0 AND 1),
    work_time_loss            numeric CHECK (work_time_loss BETWEEN 0 AND 1),
    fleet_operators_per_shift numeric CHECK (fleet_operators_per_shift >= 0),
    fleet_operator_salary_rub numeric CHECK (fleet_operator_salary_rub >= 0),
    site_prep_share           numeric CHECK (site_prep_share BETWEEN 0 AND 1),
    it_integration_rub        numeric CHECK (it_integration_rub >= 0),
    consumables_per_robot_rub numeric CHECK (consumables_per_robot_rub >= 0),
    other_effects_rub         numeric,

    owner_id                  uuid,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    archived_at               timestamptz
);

CREATE UNIQUE INDEX task_location_process_uq ON task (location_id, process_id) WHERE archived_at IS NULL;
CREATE INDEX task_process_idx ON task (process_id) WHERE archived_at IS NULL;

CREATE TABLE task_handling_method (
    task_id                 uuid NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    handling_method_code    text NOT NULL REFERENCES handling_method (code),
    labor_replacement_ratio numeric CHECK (labor_replacement_ratio BETWEEN 0 AND 1),
    PRIMARY KEY (task_id, handling_method_code)
);

CREATE TABLE task_worker_group (
    task_id        uuid NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    staff_group_id uuid NOT NULL REFERENCES location_staff_group (id) ON DELETE CASCADE,
    time_share     numeric NOT NULL CHECK (time_share BETWEEN 0 AND 1),
    PRIMARY KEY (task_id, staff_group_id)
);

CREATE TABLE task_field_provenance (
    task_id       uuid NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    field_code    text NOT NULL,
    source        text NOT NULL CHECK (source IN ('location', 'formula', 'process_default', 'user', 'file', 'organizer', 'assumption')),
    expression    text,
    is_assumption boolean NOT NULL DEFAULT false,
    note          text,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, field_code)
);

-- +goose Down
DROP TABLE task_field_provenance;
DROP TABLE task_worker_group;
DROP TABLE task_handling_method;
DROP TABLE task;
DROP TABLE location_staff_group;
DROP TABLE location_parameter_value;
ALTER TABLE process DROP CONSTRAINT process_created_from_location_fk;
DROP TABLE location;
DROP TABLE parameter_definition;
