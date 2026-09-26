-- +goose Up
CREATE SEQUENCE process_code_seq START 1;

-- Reference process (template). The task_params columns hold defaults that a task
-- on a location may override; process_field_formula computes them from location parameters.
CREATE TABLE process (
    id                        uuid PRIMARY KEY,
    code                      text NOT NULL UNIQUE,
    name                      text NOT NULL,
    description               text,
    work_type_id              uuid NOT NULL REFERENCES work_type (id),
    work_category_code        text REFERENCES work_category (code),
    kpi_unit                  text,
    is_custom                 boolean NOT NULL DEFAULT false,
    created_from_location_id  uuid,
    owner_id                  uuid,
    default_worker_role       text,
    default_worker_time_share numeric CHECK (default_worker_time_share BETWEEN 0 AND 1),

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

    is_active                 boolean NOT NULL DEFAULT true,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX process_work_type_idx ON process (work_type_id);

CREATE TABLE process_facility_type (
    process_id         uuid NOT NULL REFERENCES process (id) ON DELETE CASCADE,
    facility_type_code text NOT NULL REFERENCES facility_type (code),
    PRIMARY KEY (process_id, facility_type_code)
);

CREATE TABLE process_handling_method (
    process_id              uuid NOT NULL REFERENCES process (id) ON DELETE CASCADE,
    handling_method_code    text NOT NULL REFERENCES handling_method (code),
    labor_replacement_ratio numeric CHECK (labor_replacement_ratio BETWEEN 0 AND 1),
    PRIMARY KEY (process_id, handling_method_code)
);

CREATE TABLE process_field_formula (
    process_id     uuid NOT NULL REFERENCES process (id) ON DELETE CASCADE,
    field_code     text NOT NULL,
    expression     text NOT NULL,
    description_ru text,
    PRIMARY KEY (process_id, field_code)
);

-- +goose Down
DROP TABLE process_field_formula;
DROP TABLE process_handling_method;
DROP TABLE process_facility_type;
DROP TABLE process;
DROP SEQUENCE process_code_seq;
