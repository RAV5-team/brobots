-- +goose Up
-- «Параметры расчёта» of the matching step (PRD 11.3, ТЗ 3.5.3): the user's values over the snapshot, for this
-- project only. They are calculation inputs, so a change bumps inputs_version.
ALTER TABLE project ADD COLUMN calc_overrides jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE project DROP COLUMN calc_overrides;
