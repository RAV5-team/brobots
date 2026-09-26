package store

import (
	"context"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const sourceSelect = `
SELECT id, name, source_type, origin, locator_kind, url, file_name, data_status, provides,
       actualized_on, refresh_schedule, responsible, created_at, updated_at
FROM data_source`

func scanSource(r pgx.Row) (domain.DataSource, error) {
	var s domain.DataSource
	var actualized time.Time
	err := r.Scan(&s.ID, &s.Name, &s.SourceType, &s.Origin, &s.LocatorKind, &s.URL, &s.FileName, &s.DataStatus,
		&s.Provides, &actualized, &s.RefreshSchedule, &s.Responsible, &s.CreatedAt, &s.UpdatedAt)
	s.ActualizedOn = domain.Date{Time: actualized}
	return s, err
}

// ListSources returns the data sources, most recently actualized first.
func (q Q) ListSources(ctx context.Context) ([]domain.DataSource, error) {
	rows, err := q.db.Query(ctx, sourceSelect+` ORDER BY actualized_on DESC, name`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.DataSource, error) { return scanSource(r) })
}

// GetSource returns one data source.
func (q Q) GetSource(ctx context.Context, id uuid.UUID) (domain.DataSource, error) {
	s, err := scanSource(q.db.QueryRow(ctx, sourceSelect+` WHERE id = $1`, id))
	return s, notFound(err, "data_source", id)
}

// SaveSource inserts or updates a data source.
func (q Q) SaveSource(ctx context.Context, s domain.DataSource) error {
	_, err := q.db.Exec(ctx, `
INSERT INTO data_source (id, name, source_type, origin, locator_kind, url, file_name, data_status, provides,
                         actualized_on, refresh_schedule, responsible)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, source_type = EXCLUDED.source_type, origin = EXCLUDED.origin,
  locator_kind = EXCLUDED.locator_kind, url = EXCLUDED.url, file_name = EXCLUDED.file_name,
  data_status = EXCLUDED.data_status, provides = EXCLUDED.provides, actualized_on = EXCLUDED.actualized_on,
  refresh_schedule = EXCLUDED.refresh_schedule, responsible = EXCLUDED.responsible, updated_at = now()`,
		s.ID, s.Name, s.SourceType, s.Origin, s.LocatorKind, s.URL, s.FileName, s.DataStatus, s.Provides,
		s.ActualizedOn.Time, s.RefreshSchedule, s.Responsible)
	return err
}

// DeleteSource removes a data source; references are set to NULL.
func (q Q) DeleteSource(ctx context.Context, id uuid.UUID) error {
	tag, err := q.db.Exec(ctx, `DELETE FROM data_source WHERE id = $1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.NotFound("data_source", id.String())
	}
	return err
}
