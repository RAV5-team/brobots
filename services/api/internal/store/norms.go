package store

import (
	"context"
	"errors"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CurrentNormSet returns the latest norm set, or nil when none exists yet.
func (q Q) CurrentNormSet(ctx context.Context) (*domain.NormSet, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM norm_set ORDER BY version DESC LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	s, err := q.GetNormSet(ctx, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetNormSet returns a norm set with its values in screen order.
func (q Q) GetNormSet(ctx context.Context, id uuid.UUID) (domain.NormSet, error) {
	var s domain.NormSet
	err := q.db.QueryRow(ctx, `SELECT id, version, label, note, created_at FROM norm_set WHERE id = $1`, id).
		Scan(&s.ID, &s.Version, &s.Label, &s.Note, &s.CreatedAt)
	if err != nil {
		return s, notFound(err, "norm_set", id)
	}
	rows, err := q.db.Query(ctx, `SELECT code, group_code, label, value::float8, unit, kind, source
		FROM norm_value WHERE norm_set_id = $1 ORDER BY sort, code`, id)
	if err != nil {
		return s, err
	}
	s.Values, err = pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.NormValue, error) {
		var v domain.NormValue
		err := r.Scan(&v.Code, &v.Group, &v.Label, &v.Value, &v.Unit, &v.Kind, &v.Source)
		return v, err
	})
	return s, err
}

// ListNormSets returns all norm set versions, newest first.
func (q Q) ListNormSets(ctx context.Context) ([]domain.NormSetSummary, error) {
	rows, err := q.db.Query(ctx, `SELECT id, version, label, note, created_at FROM norm_set ORDER BY version DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.NormSetSummary, error) {
		var s domain.NormSetSummary
		err := r.Scan(&s.ID, &s.Version, &s.Label, &s.Note, &s.CreatedAt)
		return s, err
	})
}

// SetNormSetLabel names a norm set; used right after InsertNormSet when the label depends on the version.
func (q Q) SetNormSetLabel(ctx context.Context, id uuid.UUID, label string) error {
	_, err := q.db.Exec(ctx, `UPDATE norm_set SET label = $2 WHERE id = $1`, id, label)
	return err
}

// LockNormSets serializes norm set versioning until the end of the transaction.
func (q Q) LockNormSets(ctx context.Context) error {
	_, err := q.db.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('norm_set'))`)
	return err
}

// InsertNormSet stores the next version; it assigns the id, the version and the creation time.
// Call it inside a transaction after LockNormSets.
func (q Q) InsertNormSet(ctx context.Context, s *domain.NormSet, createdBy *uuid.UUID) error {
	s.ID = NewID()
	if err := q.db.QueryRow(ctx, `
INSERT INTO norm_set (id, version, label, note, created_by)
VALUES ($1, (SELECT COALESCE(max(version), 0) + 1 FROM norm_set), $2, $3, $4) RETURNING version, created_at`,
		s.ID, s.Label, s.Note, createdBy).Scan(&s.Version, &s.CreatedAt); err != nil {
		return err
	}
	for i, v := range s.Values {
		if _, err := q.db.Exec(ctx, `
INSERT INTO norm_value (norm_set_id, code, group_code, label, value, unit, kind, source, sort)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, s.ID, v.Code, v.Group, v.Label, v.Value, v.Unit, v.Kind, v.Source, i); err != nil {
			return err
		}
	}
	return nil
}
