package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var processSelect = `
SELECT p.id, p.code, p.name, p.description, w.id, w.code, w.name, w.unit_label, p.work_category_code, p.kpi_unit,
       p.is_custom, p.created_from_location_id, p.default_worker_role, p.default_worker_time_share, p.is_active,
       p.created_at, p.updated_at,
       (SELECT count(*) FROM robot_capability c JOIN solution s ON s.id = c.solution_id
         WHERE c.work_type_id = p.work_type_id AND c.is_active AND s.is_active AND s.kind = 'robot'),
       (SELECT count(DISTINCT t.location_id) FROM task t JOIN location l ON l.id = t.location_id
         WHERE t.process_id = p.id AND t.archived_at IS NULL AND l.deleted_at IS NULL),
       ` + prefixed("p.", domain.TaskParamColumns()) + `
FROM process p JOIN work_type w ON w.id = p.work_type_id`

func scanProcess(r pgx.Row) (domain.Process, error) {
	var p domain.Process
	targets := []any{&p.ID, &p.Code, &p.Name, &p.Description, &p.WorkType.ID, &p.WorkType.Code, &p.WorkType.Name,
		&p.WorkType.UnitLabel, &p.WorkCategoryCode, &p.KpiUnit, &p.IsCustom, &p.CreatedFromLocationID,
		&p.DefaultWorkerRole, &p.DefaultWorkerTimeShare, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		&p.RobotsCount, &p.LocationsCount}
	targets = append(targets, p.Defaults.Targets()...)
	err := r.Scan(targets...)
	p.FacilityTypes = []string{}
	p.HandlingMethods = []domain.HandlingShare{}
	p.Formulas = []domain.Formula{}
	return p, err
}

// ListProcesses returns processes with facility types, handling methods and formulas.
func (q Q) ListProcesses(ctx context.Context, includeHidden bool) ([]domain.Process, error) {
	rows, err := q.db.Query(ctx, processSelect+` WHERE $1 OR p.is_active ORDER BY p.code`, includeHidden)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Process, error) { return scanProcess(r) })
	if err != nil {
		return nil, err
	}
	return list, q.attachProcessChildren(ctx, list)
}

// GetProcess returns one process.
func (q Q) GetProcess(ctx context.Context, id uuid.UUID) (domain.Process, error) {
	p, err := scanProcess(q.db.QueryRow(ctx, processSelect+` WHERE p.id = $1`, id))
	if err != nil {
		return p, notFound(err, "process", id)
	}
	list := []domain.Process{p}
	if err := q.attachProcessChildren(ctx, list); err != nil {
		return p, err
	}
	return list[0], nil
}

// ProcessIDByCode finds a process by code.
func (q Q) ProcessIDByCode(ctx context.Context, code string) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM process WHERE code = $1`, code).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return id, false, nil
	}
	return id, err == nil, err
}

func (q Q) attachProcessChildren(ctx context.Context, list []domain.Process) error {
	if len(list) == 0 {
		return nil
	}
	idx := make(map[uuid.UUID]int, len(list))
	ids := make([]uuid.UUID, len(list))
	for i, p := range list {
		idx[p.ID] = i
		ids[i] = p.ID
	}
	rows, err := q.db.Query(ctx, `SELECT pf.process_id, pf.facility_type_code FROM process_facility_type pf
		JOIN facility_type f ON f.code = pf.facility_type_code WHERE pf.process_id = ANY($1) ORDER BY f.sort`, ids)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id uuid.UUID
		var code string
		if err := rows.Scan(&id, &code); err != nil {
			rows.Close()
			return err
		}
		list[idx[id]].FacilityTypes = append(list[idx[id]].FacilityTypes, code)
	}
	rows.Close()
	rows, err = q.db.Query(ctx, `SELECT ph.process_id, ph.handling_method_code, ph.labor_replacement_ratio
		FROM process_handling_method ph JOIN handling_method h ON h.code = ph.handling_method_code
		WHERE ph.process_id = ANY($1) ORDER BY h.sort`, ids)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id uuid.UUID
		var h domain.HandlingShare
		if err := rows.Scan(&id, &h.Code, &h.LaborReplacementRatio); err != nil {
			rows.Close()
			return err
		}
		list[idx[id]].HandlingMethods = append(list[idx[id]].HandlingMethods, h)
	}
	rows.Close()
	rows, err = q.db.Query(ctx, `SELECT process_id, field_code, expression, description_ru FROM process_field_formula
		WHERE process_id = ANY($1) ORDER BY field_code`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var f domain.Formula
		if err := rows.Scan(&id, &f.FieldCode, &f.Expression, &f.Description); err != nil {
			return err
		}
		list[idx[id]].Formulas = append(list[idx[id]].Formulas, f)
	}
	return rows.Err()
}

// NextProcessCode returns a new PR-NNNN code.
func (q Q) NextProcessCode(ctx context.Context) (string, error) {
	for {
		var n int64
		if err := q.db.QueryRow(ctx, `SELECT nextval('process_code_seq')`).Scan(&n); err != nil {
			return "", err
		}
		code := fmt.Sprintf("PR-%04d", n)
		if _, found, err := q.ProcessIDByCode(ctx, code); err != nil {
			return "", err
		} else if !found {
			return code, nil
		}
	}
}

// SaveProcess inserts or updates a process with its children.
func (q Q) SaveProcess(ctx context.Context, p domain.Process) error {
	cols := append([]string{"id", "code", "name", "description", "work_type_id", "work_category_code", "kpi_unit",
		"is_custom", "created_from_location_id", "default_worker_role", "default_worker_time_share", "is_active"},
		domain.TaskParamColumns()...)
	args := append([]any{p.ID, p.Code, p.Name, p.Description, p.WorkType.ID, p.WorkCategoryCode, p.KpiUnit, p.IsCustom,
		p.CreatedFromLocationID, p.DefaultWorkerRole, p.DefaultWorkerTimeShare, p.IsActive}, p.Defaults.Values()...)
	update := make([]string, 0, len(cols))
	for _, c := range cols[1:] {
		update = append(update, c+" = EXCLUDED."+c)
	}
	sql := `INSERT INTO process (` + joinCols(cols) + `) VALUES (` + placeholders(1, len(cols)) + `)
		ON CONFLICT (id) DO UPDATE SET ` + joinCols(update) + `, updated_at = now()`
	if _, err := q.db.Exec(ctx, sql, args...); err != nil {
		return err
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM process_facility_type WHERE process_id = $1`, p.ID); err != nil {
		return err
	}
	for _, f := range p.FacilityTypes {
		if _, err := q.db.Exec(ctx, `INSERT INTO process_facility_type (process_id, facility_type_code) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, p.ID, f); err != nil {
			return err
		}
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM process_handling_method WHERE process_id = $1`, p.ID); err != nil {
		return err
	}
	for _, h := range p.HandlingMethods {
		if _, err := q.db.Exec(ctx, `INSERT INTO process_handling_method (process_id, handling_method_code, labor_replacement_ratio)
			VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, p.ID, h.Code, h.LaborReplacementRatio); err != nil {
			return err
		}
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM process_field_formula WHERE process_id = $1`, p.ID); err != nil {
		return err
	}
	for _, f := range p.Formulas {
		if _, err := q.db.Exec(ctx, `INSERT INTO process_field_formula (process_id, field_code, expression, description_ru)
			VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, p.ID, f.FieldCode, f.Expression, f.Description); err != nil {
			return err
		}
	}
	return nil
}

func joinCols(cols []string) string {
	out := ""
	for i, c := range cols {
		if i > 0 {
			out += ", "
		}
		out += c
	}
	return out
}
