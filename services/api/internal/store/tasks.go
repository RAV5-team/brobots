package store

import (
	"context"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var taskSelect = `
SELECT t.id, t.location_id, l.name, l.facility_type_code, l.owner_id, l.is_demo, t.process_id, p.name, p.kpi_unit,
       w.id, w.code, w.name, w.unit_label, t.name, t.created_at, t.updated_at, t.archived_at,
       ` + prefixed("t.", domain.TaskParamColumns()) + `
FROM task t
JOIN location l ON l.id = t.location_id
JOIN process p ON p.id = t.process_id
JOIN work_type w ON w.id = t.work_type_id`

func scanTask(r pgx.Row) (domain.Task, error) {
	var t domain.Task
	targets := []any{&t.ID, &t.LocationID, &t.LocationName, &t.FacilityTypeCode, &t.LocationOwnerID, &t.LocationIsDemo,
		&t.ProcessID, &t.ProcessName, &t.KpiUnit,
		&t.WorkType.ID, &t.WorkType.Code, &t.WorkType.Name, &t.WorkType.UnitLabel, &t.Name, &t.CreatedAt, &t.UpdatedAt,
		&t.ArchivedAt}
	targets = append(targets, t.Params.Targets()...)
	err := r.Scan(targets...)
	t.HandlingMethods = []domain.HandlingShare{}
	t.Workers = []domain.TaskWorker{}
	t.Provenance = map[string]domain.Provenance{}
	return t, err
}

// TaskFilter selects tasks.
type TaskFilter struct {
	LocationID      *uuid.UUID
	ProcessID       *uuid.UUID
	IncludeArchived bool
}

// ListTasks returns tasks of live locations with handling methods, workers and provenance.
func (q Q) ListTasks(ctx context.Context, f TaskFilter) ([]domain.Task, error) {
	rows, err := q.db.Query(ctx, taskSelect+`
WHERE l.deleted_at IS NULL AND ($1 OR t.archived_at IS NULL)
  AND ($2::uuid IS NULL OR t.location_id = $2) AND ($3::uuid IS NULL OR t.process_id = $3)
ORDER BY t.created_at`, f.IncludeArchived, f.LocationID, f.ProcessID)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Task, error) { return scanTask(r) })
	if err != nil {
		return nil, err
	}
	return list, q.attachTaskChildren(ctx, list)
}

// GetTask returns a task, including archived ones.
func (q Q) GetTask(ctx context.Context, id uuid.UUID) (domain.Task, error) {
	t, err := scanTask(q.db.QueryRow(ctx, taskSelect+` WHERE t.id = $1`, id))
	if err != nil {
		return t, notFound(err, "task", id)
	}
	list := []domain.Task{t}
	if err := q.attachTaskChildren(ctx, list); err != nil {
		return t, err
	}
	return list[0], nil
}

func (q Q) attachTaskChildren(ctx context.Context, list []domain.Task) error {
	if len(list) == 0 {
		return nil
	}
	idx := make(map[uuid.UUID]int, len(list))
	ids := make([]uuid.UUID, len(list))
	for i, t := range list {
		idx[t.ID] = i
		ids[i] = t.ID
	}
	rows, err := q.db.Query(ctx, `SELECT th.task_id, th.handling_method_code, th.labor_replacement_ratio
		FROM task_handling_method th JOIN handling_method h ON h.code = th.handling_method_code
		WHERE th.task_id = ANY($1) ORDER BY h.sort`, ids)
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
	rows, err = q.db.Query(ctx, `SELECT tw.task_id, g.id, g.role_name, g.headcount, g.salary_gross_month_rub, tw.time_share
		FROM task_worker_group tw JOIN location_staff_group g ON g.id = tw.staff_group_id
		WHERE tw.task_id = ANY($1) ORDER BY g.sort`, ids)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id uuid.UUID
		var w domain.TaskWorker
		if err := rows.Scan(&id, &w.StaffGroupID, &w.RoleName, &w.Headcount, &w.SalaryGrossMonthRub, &w.TimeShare); err != nil {
			rows.Close()
			return err
		}
		list[idx[id]].Workers = append(list[idx[id]].Workers, w)
	}
	rows.Close()
	rows, err = q.db.Query(ctx, `SELECT task_id, field_code, source, expression, is_assumption, note
		FROM task_field_provenance WHERE task_id = ANY($1)`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var code string
		var p domain.Provenance
		if err := rows.Scan(&id, &code, &p.Source, &p.Expression, &p.IsAssumption, &p.Note); err != nil {
			return err
		}
		list[idx[id]].Provenance[code] = p
	}
	return rows.Err()
}

// SaveTask inserts or updates a task with handling methods, workers and provenance.
func (q Q) SaveTask(ctx context.Context, t domain.Task) error {
	cols := append([]string{"id", "location_id", "process_id", "work_type_id", "name"}, domain.TaskParamColumns()...)
	args := append([]any{t.ID, t.LocationID, t.ProcessID, t.WorkType.ID, t.Name}, t.Params.Values()...)
	update := make([]string, 0, len(cols))
	for _, c := range cols[5:] {
		update = append(update, c+" = EXCLUDED."+c)
	}
	update = append(update, "name = EXCLUDED.name")
	// A task belongs to its location: the owner is copied from it on insert.
	sql := `INSERT INTO task (` + joinCols(cols) + `, owner_id) VALUES (` + placeholders(1, len(cols)) + `,
		(SELECT owner_id FROM location WHERE id = $2))
		ON CONFLICT (id) DO UPDATE SET ` + joinCols(update) + `, updated_at = now()`
	if _, err := q.db.Exec(ctx, sql, args...); err != nil {
		return err
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM task_handling_method WHERE task_id = $1`, t.ID); err != nil {
		return err
	}
	for _, h := range t.HandlingMethods {
		if _, err := q.db.Exec(ctx, `INSERT INTO task_handling_method (task_id, handling_method_code, labor_replacement_ratio)
			VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, t.ID, h.Code, h.LaborReplacementRatio); err != nil {
			return err
		}
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM task_worker_group WHERE task_id = $1`, t.ID); err != nil {
		return err
	}
	for _, w := range t.Workers {
		if _, err := q.db.Exec(ctx, `INSERT INTO task_worker_group (task_id, staff_group_id, time_share) VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING`, t.ID, w.StaffGroupID, w.TimeShare); err != nil {
			return err
		}
	}
	if _, err := q.db.Exec(ctx, `DELETE FROM task_field_provenance WHERE task_id = $1`, t.ID); err != nil {
		return err
	}
	for code, p := range t.Provenance {
		if _, err := q.db.Exec(ctx, `INSERT INTO task_field_provenance (task_id, field_code, source, expression, is_assumption, note)
			VALUES ($1, $2, $3, $4, $5, $6)`, t.ID, code, p.Source, p.Expression, p.IsAssumption, p.Note); err != nil {
			return err
		}
	}
	return nil
}

// TaskProjectsCount counts live projects of a task.
func (q Q) TaskProjectsCount(ctx context.Context, id uuid.UUID) (int, error) {
	var n int
	err := q.db.QueryRow(ctx, `SELECT count(*) FROM project WHERE task_id = $1 AND deleted_at IS NULL`, id).Scan(&n)
	return n, err
}

// ArchiveTask hides a task that is referenced by projects.
func (q Q) ArchiveTask(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE task SET archived_at = now() WHERE id = $1`, id)
	return err
}

// DeleteTask removes a task together with deleted projects that referenced it.
func (q Q) DeleteTask(ctx context.Context, id uuid.UUID) error {
	if _, err := q.db.Exec(ctx, `DELETE FROM project WHERE task_id = $1 AND deleted_at IS NOT NULL`, id); err != nil {
		return err
	}
	_, err := q.db.Exec(ctx, `DELETE FROM task WHERE id = $1`, id)
	return err
}
