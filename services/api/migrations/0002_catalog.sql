-- +goose Up
CREATE TABLE data_source (
    id               uuid PRIMARY KEY,
    name             text NOT NULL,
    source_type      text NOT NULL CHECK (source_type IN ('specs', 'prices', 'cases', 'norms', 'dataset', 'catalog')),
    origin           text NOT NULL CHECK (origin IN ('organizer', 'open', 'vendor', 'internal')),
    locator_kind     text CHECK (locator_kind IN ('file', 'url')),
    url              text,
    file_name        text,
    data_status      text NOT NULL CHECK (data_status IN ('confirmed', 'estimate')),
    provides         text,
    actualized_on    date NOT NULL,
    refresh_schedule text NOT NULL DEFAULT 'manual'
        CHECK (refresh_schedule IN ('manual', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
    responsible      text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE solution_code_seq START 1;

-- A catalog position: a robot or a startup item (infrastructure, software, service, support).
CREATE TABLE solution (
    id                  uuid PRIMARY KEY,
    code                text NOT NULL UNIQUE,
    kind                text NOT NULL CHECK (kind IN ('robot', 'infrastructure', 'software', 'service', 'support')),
    name                text NOT NULL,
    manufacturer        text NOT NULL,
    organizer_ids       text[] NOT NULL DEFAULT '{}',
    product_class       text CHECK (product_class IN ('brs', 'bas', 'software')),
    type_group          text,
    solution_type       text,
    status              text CHECK (status IN ('operation', 'piloting', 'rnd')),
    trl                 smallint CHECK (trl BETWEEN 1 AND 9),
    market_potential    smallint CHECK (market_potential BETWEEN 1 AND 5),
    region              text,
    country             text,
    description         text,
    cases_text          text,
    organizer_scenarios text[] NOT NULL DEFAULT '{}',
    acquisition_models  text[] NOT NULL DEFAULT '{}',
    tested_by_fcbas     boolean NOT NULL DEFAULT false,
    in_registry_719     boolean NOT NULL DEFAULT false,
    photo_url           text,
    cost_type           text CHECK (cost_type IN ('capex', 'opex_year', 'percent')),
    quantity_rule       text,
    compatible_with     text,
    software_cost_pct   numeric(6, 2),
    service_cost_pct    numeric(6, 2),
    service_life_years  numeric(4, 1),
    source_id           uuid REFERENCES data_source (id) ON DELETE SET NULL,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX solution_kind_active_idx ON solution (kind, is_active);
CREATE INDEX solution_status_idx ON solution (status);
CREATE INDEX solution_search_idx ON solution USING gin ((name || ' ' || manufacturer) gin_trgm_ops);

CREATE TABLE solution_industry (
    solution_id   uuid NOT NULL REFERENCES solution (id) ON DELETE CASCADE,
    industry_code text NOT NULL REFERENCES industry (code),
    PRIMARY KEY (solution_id, industry_code)
);

-- Price offers. Duplicate organizer rows with different prices become alternative offers.
CREATE TABLE solution_offer (
    id                 uuid PRIMARY KEY,
    solution_id        uuid NOT NULL REFERENCES solution (id) ON DELETE CASCADE,
    label              text NOT NULL,
    price_rub          numeric(14, 2) CHECK (price_rub > 0),
    price_percent      numeric(6, 2) CHECK (price_percent > 0),
    price_includes_vat boolean NOT NULL DEFAULT true,
    price_unit         text NOT NULL DEFAULT 'item' CHECK (price_unit IN ('item', 'year', 'percent_capex')),
    is_default         boolean NOT NULL DEFAULT false,
    organizer_row_ref  text,
    source_id          uuid REFERENCES data_source (id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (price_unit = 'percent_capex' AND price_percent IS NOT NULL)
        OR (price_unit <> 'percent_capex' AND price_rub IS NOT NULL)
    )
);

CREATE UNIQUE INDEX solution_offer_default_uq ON solution_offer (solution_id) WHERE is_default;

-- Hardware characteristics shared by all capabilities of a robot. NULL means unknown.
CREATE TABLE robot_spec (
    solution_id             uuid PRIMARY KEY REFERENCES solution (id) ON DELETE CASCADE,
    payload_kg              numeric,
    payload_exact           boolean NOT NULL DEFAULT false,
    length_mm               integer,
    width_mm                integer,
    height_mm               integer,
    dimensions_exact        boolean NOT NULL DEFAULT false,
    mass_kg                 numeric,
    max_speed_mps           numeric,
    autonomy_h              numeric,
    charge_time_min         numeric,
    min_temp_c              numeric,
    min_temp_exact          boolean NOT NULL DEFAULT false,
    max_temp_c              numeric,
    avg_power_kw            numeric,
    load_time_s             numeric,
    unload_time_s           numeric,
    lift_height_mm          integer,
    positioning_accuracy_mm numeric,
    navigation_type         text,
    handling_method_code    text REFERENCES handling_method (code),
    indoor_allowed          boolean,
    outdoor_allowed         boolean,
    min_passage_mm          integer,
    floor_requirements      text,
    charging_infra          text,
    connectivity            text[] NOT NULL DEFAULT '{}',
    integrations            text[] NOT NULL DEFAULT '{}',
    service_terms           text,
    specs_confirmed         text NOT NULL DEFAULT 'no' CHECK (specs_confirmed IN ('yes', 'partial', 'no')),
    specs_source_text       text,
    specs_source_id         uuid REFERENCES data_source (id) ON DELETE SET NULL,
    specs_actualized_on     date,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Robot × operation class. Empty handling/environment fall back to robot_spec.
CREATE TABLE robot_capability (
    id                    uuid PRIMARY KEY,
    solution_id           uuid NOT NULL REFERENCES solution (id) ON DELETE CASCADE,
    work_type_id          uuid NOT NULL REFERENCES work_type (id),
    throughput_per_hour   numeric CHECK (throughput_per_hour > 0),
    throughput_range_text text,
    throughput_exact      boolean NOT NULL DEFAULT false,
    handling_method_code  text REFERENCES handling_method (code),
    environment           text CHECK (environment IN ('indoor', 'outdoor', 'both')),
    lift_height_mm        integer,
    source_text           text,
    source_id             uuid REFERENCES data_source (id) ON DELETE SET NULL,
    is_active             boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (solution_id, work_type_id)
);

CREATE INDEX robot_capability_work_type_idx ON robot_capability (work_type_id) WHERE is_active;

-- +goose Down
DROP TABLE robot_capability;
DROP TABLE robot_spec;
DROP TABLE solution_offer;
DROP TABLE solution_industry;
DROP TABLE solution;
DROP SEQUENCE solution_code_seq;
DROP TABLE data_source;
