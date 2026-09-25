package store

import (
	"context"
	"fmt"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const workTypeSelect = `
SELECT w.id, w.code, w.name, w.description, w.unit_label, w.action, w.handled_object,
       w.typical_carriers, w.example_processes, w.work_category_code, w.is_active, w.created_at, w.updated_at,
       (SELECT count(*) FROM robot_capability c JOIN solution s ON s.id = c.solution_id
         WHERE c.work_type_id = w.id AND c.is_active AND s.is_active AND s.kind = 'robot'),
       (SELECT count(*) FROM process p WHERE p.work_type_id = w.id AND p.is_active)
FROM work_type w`

func scanWorkType(r pgx.Row) (domain.WorkType, error) {
	var w domain.WorkType
	err := r.Scan(&w.ID, &w.Code, &w.Name, &w.Description, &w.UnitLabel, &w.Action, &w.HandledObject,
		&w.TypicalCarriers, &w.ExampleProcesses, &w.WorkCategoryCode, &w.IsActive, &w.CreatedAt, &w.UpdatedAt,
		&w.RobotsCount, &w.ProcessesCount)
	return w, err
}

// ListWorkTypes returns operation classes ordered by code.
func (q Q) ListWorkTypes(ctx context.Context, includeHidden bool) ([]domain.WorkType, error) {
	rows, err := q.db.Query(ctx, workTypeSelect+` WHERE $1 OR w.is_active ORDER BY w.code`, includeHidden)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.WorkType, error) { return scanWorkType(r) })
}

// GetWorkType returns one operation class.
func (q Q) GetWorkType(ctx context.Context, id uuid.UUID) (domain.WorkType, error) {
	w, err := scanWorkType(q.db.QueryRow(ctx, workTypeSelect+` WHERE w.id = $1`, id))
	return w, notFound(err, "work_type", id)
}

// GetWorkTypeByCode returns an operation class by its code.
func (q Q) GetWorkTypeByCode(ctx context.Context, code string) (domain.WorkType, error) {
	w, err := scanWorkType(q.db.QueryRow(ctx, workTypeSelect+` WHERE w.code = $1`, code))
	return w, notFound(err, "work_type", code)
}

// NextWorkTypeCode returns the next free OP-NN code.
func (q Q) NextWorkTypeCode(ctx context.Context) (string, error) {
	for {
		var n int64
		if err := q.db.QueryRow(ctx, `SELECT nextval('work_type_code_seq')`).Scan(&n); err != nil {
			return "", err
		}
		code := fmt.Sprintf("OP-%02d", n)
		var taken bool
		if err := q.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM work_type WHERE code = $1)`, code).Scan(&taken); err != nil {
			return "", err
		}
		if !taken {
			return code, nil
		}
	}
}

// SaveWorkType inserts or updates an operation class.
func (q Q) SaveWorkType(ctx context.Context, w domain.WorkType) error {
	_, err := q.db.Exec(ctx, `
INSERT INTO work_type (id, code, name, description, unit_label, action, handled_object,
                       typical_carriers, example_processes, work_category_code, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description, unit_label = EXCLUDED.unit_label,
  action = EXCLUDED.action, handled_object = EXCLUDED.handled_object, typical_carriers = EXCLUDED.typical_carriers,
  example_processes = EXCLUDED.example_processes, work_category_code = EXCLUDED.work_category_code,
  is_active = EXCLUDED.is_active, updated_at = now()`,
		w.ID, w.Code, w.Name, w.Description, w.UnitLabel, w.Action, w.HandledObject,
		w.TypicalCarriers, w.ExampleProcesses, w.WorkCategoryCode, w.IsActive)
	return err
}
