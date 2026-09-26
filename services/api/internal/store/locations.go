package store

import (
	"context"
	"errors"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const definitionSelect = `
SELECT code, facility_type_code, group_name, name, unit, value_type, base_value_number, base_value_text,
       min_value, max_value, enum_values, is_required, is_constant, role, staff_role, staff_attr, form_section,
       hint, source_note, sort
FROM parameter_definition`

// ParameterDefinitions returns the definitions of a facility type, or of all types when empty.
func (q Q) ParameterDefinitions(ctx context.Context, facilityType string) ([]domain.ParameterDefinition, error) {
	rows, err := q.db.Query(ctx, definitionSelect+` WHERE $1 = '' OR facility_type_code = $1 ORDER BY facility_type_code, sort`, facilityType)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.ParameterDefinition, error) {
		var d domain.ParameterDefinition
		err := r.Scan(&d.Code, &d.FacilityTypeCode, &d.GroupName, &d.Name, &d.Unit, &d.ValueType, &d.BaseValueNumber,
			&d.BaseValueText, &d.MinValue, &d.MaxValue, &d.EnumValues, &d.IsRequired, &d.IsConstant, &d.Role,
			&d.StaffRole, &d.StaffAttr, &d.FormSection, &d.Hint, &d.SourceNote, &d.Sort)
		return d, err
	})
}

// SaveParameterDefinition inserts or updates a definition.
func (q Q) SaveParameterDefinition(ctx context.Context, d domain.ParameterDefinition) error {
	enum := d.EnumValues
	if enum == nil {
		enum = []string{}
	}
	_, err := q.db.Exec(ctx, `
INSERT INTO parameter_definition (code, facility_type_code, group_name, name, unit, value_type, base_value_number,
    base_value_text, min_value, max_value, enum_values, is_required, is_constant, role, staff_role, staff_attr,
    form_section, hint, source_note, sort)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
ON CONFLICT (code) DO UPDATE SET facility_type_code = EXCLUDED.facility_type_code, group_name = EXCLUDED.group_name,
  name = EXCLUDED.name, unit = EXCLUDED.unit, value_type = EXCLUDED.value_type, base_value_number = EXCLUDED.base_value_number,
  base_value_text = EXCLUDED.base_value_text, min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value,
  enum_values = EXCLUDED.enum_values, is_required = EXCLUDED.is_required, is_constant = EXCLUDED.is_constant,
  role = EXCLUDED.role, staff_role = EXCLUDED.staff_role, staff_attr = EXCLUDED.staff_attr,
  form_section = EXCLUDED.form_section, hint = EXCLUDED.hint, source_note = EXCLUDED.source_note, sort = EXCLUDED.sort`,
		d.Code, d.FacilityTypeCode, d.GroupName, d.Name, d.Unit, d.ValueType, d.BaseValueNumber, d.BaseValueText,
		d.MinValue, d.MaxValue, enum, d.IsRequired, d.IsConstant, d.Role, d.StaffRole, d.StaffAttr, d.FormSection,
		d.Hint, d.SourceNote, d.Sort)
	return err
}

const locationSelect = `
SELECT id, name, facility_type_code, city, address, capex_budget_amount, capex_budget_currency,
       capex_budget_source_unit, capex_budget_source, horizon_years, is_demo, is_draft, updated_by, owner_id,
       created_at, updated_at
FROM location`

func scanLocation(r pgx.Row) (domain.Location, error) {
	var l domain.Location
	err := r.Scan(&l.ID, &l.Name, &l.FacilityTypeCode, &l.City, &l.Address, &l.CapexBudget.Amount,
		&l.CapexBudget.Currency, &l.CapexBudget.SourceUnit, &l.CapexBudget.Source, &l.HorizonYears, &l.IsDemo,
		&l.IsDraft, &l.UpdatedBy, &l.OwnerID, &l.CreatedAt, &l.UpdatedAt)
	l.StaffGroups = []domain.StaffGroup{}
	return l, err
}

// ListLocations returns live locations with staff groups.
func (q Q) ListLocations(ctx context.Context) ([]domain.Location, error) {
	rows, err := q.db.Query(ctx, locationSelect+` WHERE deleted_at IS NULL ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Location, error) { return scanLocation(r) })
	if err != nil {
		return nil, err
	}
	groups, err := q.staffGroups(ctx, nil)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if g, ok := groups[list[i].ID]; ok {
			list[i].StaffGroups = g
		}
	}
	return list, nil
}

// GetLocation returns a live location with staff groups.
func (q Q) GetLocation(ctx context.Context, id uuid.UUID) (domain.Location, error) {
	l, err := scanLocation(q.db.QueryRow(ctx, locationSelect+` WHERE id = $1 AND deleted_at IS NULL`, id))
	if err != nil {
		return l, notFound(err, "location", id)
	}
	groups, err := q.staffGroups(ctx, &id)
	if g, ok := groups[id]; ok {
		l.StaffGroups = g
	}
	return l, err
}

// DemoLocationIDByName finds a live demo location by name.
func (q Q) DemoLocationIDByName(ctx context.Context, name string) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM location WHERE name = $1 AND is_demo AND deleted_at IS NULL`, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return id, false, nil
	}
	return id, err == nil, err
}

// SaveLocation inserts or updates the location row.
func (q Q) SaveLocation(ctx context.Context, l domain.Location) error {
	currency := l.CapexBudget.Currency
	if currency == "" {
		currency = "RUB"
	}
	_, err := q.db.Exec(ctx, `
INSERT INTO location (id, name, facility_type_code, city, address, capex_budget_amount, capex_budget_currency,
                      capex_budget_source_unit, capex_budget_source, horizon_years, is_demo, is_draft, updated_by,
                      owner_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, facility_type_code = EXCLUDED.facility_type_code,
  city = EXCLUDED.city, address = EXCLUDED.address, capex_budget_amount = EXCLUDED.capex_budget_amount,
  capex_budget_currency = EXCLUDED.capex_budget_currency, capex_budget_source_unit = EXCLUDED.capex_budget_source_unit,
  capex_budget_source = EXCLUDED.capex_budget_source, horizon_years = EXCLUDED.horizon_years, is_demo = EXCLUDED.is_demo,
  is_draft = EXCLUDED.is_draft, updated_by = EXCLUDED.updated_by, updated_at = now()`,
		l.ID, l.Name, l.FacilityTypeCode, l.City, l.Address, l.CapexBudget.Amount, currency, l.CapexBudget.SourceUnit,
		l.CapexBudget.Source, l.HorizonYears, l.IsDemo, l.IsDraft, l.UpdatedBy, l.OwnerID) // owner is set on insert only
	return err
}

// TouchLocation marks the location profile as changed, so projects see stale snapshots.
func (q Q) TouchLocation(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE location SET updated_at = now() WHERE id = $1`, id)
	return err
}

// SoftDeleteLocation hides a location and archives its tasks.
func (q Q) SoftDeleteLocation(ctx context.Context, id uuid.UUID) error {
	tag, err := q.db.Exec(ctx, `UPDATE location SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("location", id.String())
	}
	_, err = q.db.Exec(ctx, `UPDATE task SET archived_at = now() WHERE location_id = $1 AND archived_at IS NULL`, id)
	return err
}

// ParameterValues returns values of one location, or of all live locations when id is nil.
func (q Q) ParameterValues(ctx context.Context, id *uuid.UUID) (map[uuid.UUID][]domain.ParameterValue, error) {
	rows, err := q.db.Query(ctx, `
SELECT v.location_id, v.parameter_code, v.value_number, v.value_text, v.value_bool, v.source, v.is_assumption, v.note, v.updated_at
FROM location_parameter_value v JOIN location l ON l.id = v.location_id
JOIN parameter_definition d ON d.code = v.parameter_code
WHERE l.deleted_at IS NULL AND ($1::uuid IS NULL OR v.location_id = $1)
ORDER BY d.sort`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID][]domain.ParameterValue{}
	for rows.Next() {
		var loc uuid.UUID
		var v domain.ParameterValue
		if err := rows.Scan(&loc, &v.Code, &v.Number, &v.Text, &v.Bool, &v.Source, &v.IsAssumption, &v.Note, &v.UpdatedAt); err != nil {
			return nil, err
		}
		v.Fill()
		out[loc] = append(out[loc], v)
	}
	return out, rows.Err()
}

// SaveParameterValue upserts a value; a value without data is deleted.
func (q Q) SaveParameterValue(ctx context.Context, locationID uuid.UUID, v domain.ParameterValue) error {
	if v.Number == nil && v.Text == nil && v.Bool == nil {
		_, err := q.db.Exec(ctx, `DELETE FROM location_parameter_value WHERE location_id = $1 AND parameter_code = $2`, locationID, v.Code)
		return err
	}
	_, err := q.db.Exec(ctx, `
INSERT INTO location_parameter_value (location_id, parameter_code, value_number, value_text, value_bool, source, is_assumption, note)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (location_id, parameter_code) DO UPDATE SET value_number = EXCLUDED.value_number,
  value_text = EXCLUDED.value_text, value_bool = EXCLUDED.value_bool, source = EXCLUDED.source,
  is_assumption = EXCLUDED.is_assumption, note = EXCLUDED.note, updated_at = now()`,
		locationID, v.Code, v.Number, v.Text, v.Bool, v.Source, v.IsAssumption, v.Note)
	return err
}

func (q Q) staffGroups(ctx context.Context, id *uuid.UUID) (map[uuid.UUID][]domain.StaffGroup, error) {
	rows, err := q.db.Query(ctx, `SELECT location_id, id, role_name, headcount, salary_gross_month_rub, source, sort
		FROM location_staff_group WHERE $1::uuid IS NULL OR location_id = $1 ORDER BY sort, role_name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID][]domain.StaffGroup{}
	for rows.Next() {
		var loc uuid.UUID
		var g domain.StaffGroup
		if err := rows.Scan(&loc, &g.ID, &g.RoleName, &g.Headcount, &g.SalaryGrossMonthRub, &g.Source, &g.Sort); err != nil {
			return nil, err
		}
		out[loc] = append(out[loc], g)
	}
	return out, rows.Err()
}

// ReplaceStaffGroups upserts groups by role name and deletes groups not in the list.
func (q Q) ReplaceStaffGroups(ctx context.Context, locationID uuid.UUID, groups []domain.StaffGroup) ([]domain.StaffGroup, error) {
	keep := make([]string, 0, len(groups))
	for i, g := range groups {
		if g.ID == uuid.Nil {
			g.ID = NewID()
		}
		if _, err := q.db.Exec(ctx, `
INSERT INTO location_staff_group (id, location_id, role_name, headcount, salary_gross_month_rub, source, sort)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (location_id, role_name) DO UPDATE SET headcount = EXCLUDED.headcount,
  salary_gross_month_rub = EXCLUDED.salary_gross_month_rub, source = EXCLUDED.source, sort = EXCLUDED.sort`,
			g.ID, locationID, g.RoleName, g.Headcount, g.SalaryGrossMonthRub, g.Source, i); err != nil {
			return nil, err
		}
		keep = append(keep, g.RoleName)
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM location_staff_group WHERE location_id = $1 AND NOT (role_name = ANY($2))`,
		locationID, keep); err != nil {
		return nil, err
	}
	groupsMap, err := q.staffGroups(ctx, &locationID)
	return groupsMap[locationID], err
}
