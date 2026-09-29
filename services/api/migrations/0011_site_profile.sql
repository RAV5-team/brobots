-- +goose Up
-- Site profile groups (PRD 10.5) live in form_section next to area/schedule/staff/object_params.
-- route_only and checked_by_matching tell the project step which empty fields need a check.
ALTER TABLE parameter_definition DROP CONSTRAINT parameter_definition_form_section_check;
ALTER TABLE parameter_definition ADD CONSTRAINT parameter_definition_form_section_check
    CHECK (form_section IN (
        'area', 'schedule', 'staff', 'object_params',
        'aisles', 'floor', 'layout', 'operating', 'connectivity'
    ));
ALTER TABLE parameter_definition
    ADD COLUMN route_only boolean NOT NULL DEFAULT false,
    ADD COLUMN checked_by_matching boolean NOT NULL DEFAULT false,
    ADD COLUMN pair_code text;

-- +goose Down
ALTER TABLE parameter_definition DROP COLUMN pair_code, DROP COLUMN checked_by_matching, DROP COLUMN route_only;
UPDATE parameter_definition
SET form_section = 'object_params'
WHERE form_section IN ('aisles', 'floor', 'layout', 'operating', 'connectivity');
ALTER TABLE parameter_definition DROP CONSTRAINT parameter_definition_form_section_check;
ALTER TABLE parameter_definition ADD CONSTRAINT parameter_definition_form_section_check
    CHECK (form_section IN ('area', 'schedule', 'staff', 'object_params'));
