-- +goose Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE facility_type (
    code    text PRIMARY KEY,
    name_ru text NOT NULL,
    sort    smallint NOT NULL DEFAULT 0
);

CREATE TABLE industry (
    code    text PRIMARY KEY,
    name_ru text NOT NULL UNIQUE,
    sort    smallint NOT NULL DEFAULT 0
);

CREATE TABLE handling_method (
    code    text PRIMARY KEY,
    name_ru text NOT NULL,
    hint_ru text,
    sort    smallint NOT NULL DEFAULT 0
);

CREATE TABLE work_category (
    code    text PRIMARY KEY,
    name_ru text NOT NULL,
    sort    smallint NOT NULL DEFAULT 0
);

-- Counters bumped on every write to the catalog or the dictionaries; projects pin them.
CREATE TABLE reference_version (
    scope      text PRIMARY KEY CHECK (scope IN ('catalog', 'dictionaries')),
    version    integer NOT NULL DEFAULT 1,
    label      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reference_version (scope, version, label) VALUES
    ('catalog', 1, 'v4'),
    ('dictionaries', 1, 'v1');

CREATE SEQUENCE work_type_code_seq START 1;

-- Operation class (Work Type): the matching key shared by processes and robot capabilities.
CREATE TABLE work_type (
    id                 uuid PRIMARY KEY,
    code               text NOT NULL UNIQUE,
    name               text NOT NULL,
    description        text,
    unit_label         text NOT NULL,
    action             text,
    handled_object     text,
    typical_carriers   text,
    example_processes  text,
    work_category_code text REFERENCES work_category (code),
    is_active          boolean NOT NULL DEFAULT true,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX work_type_action_object_uq
    ON work_type (action, handled_object)
    WHERE action IS NOT NULL AND handled_object IS NOT NULL;

-- +goose Down
DROP TABLE work_type;
DROP SEQUENCE work_type_code_seq;
DROP TABLE reference_version;
DROP TABLE work_category;
DROP TABLE handling_method;
DROP TABLE industry;
DROP TABLE facility_type;
