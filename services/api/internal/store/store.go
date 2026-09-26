// Package store implements Postgres repositories of the api service on pgx.
package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is satisfied by a pool and by a transaction.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Store owns the connection pool.
type Store struct {
	Pool *pgxpool.Pool
}

// Q runs queries on a pool or inside a transaction.
type Q struct {
	db DBTX
}

// New creates a store over an existing pool.
func New(pool *pgxpool.Pool) *Store {
	return &Store{Pool: pool}
}

// Q returns a query runner on the pool.
func (s *Store) Q() Q {
	return Q{db: s.Pool}
}

// Tx runs fn in a transaction and commits when it returns nil.
func (s *Store) Tx(ctx context.Context, fn func(Q) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback after commit is a no-op
	if err := fn(Q{db: tx}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// NewID returns a time-ordered UUID v7.
func NewID() uuid.UUID {
	id, err := uuid.NewV7()
	if err != nil {
		return uuid.New()
	}
	return id
}

// IsUniqueViolation reports a unique constraint violation, optionally of a named constraint.
func IsUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return constraint == "" || pgErr.ConstraintName == constraint
}

// IsForeignKeyViolation reports a foreign key violation.
func IsForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func notFound(err error, entity string, id any) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.NotFound(entity, fmt.Sprint(id))
	}
	return err
}

func placeholders(start, n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = fmt.Sprintf("$%d", start+i)
	}
	return strings.Join(parts, ", ")
}

func prefixed(prefix string, cols []string) string {
	parts := make([]string, len(cols))
	for i, c := range cols {
		parts[i] = prefix + c
	}
	return strings.Join(parts, ", ")
}

// BumpVersion increments a reference version counter.
func (q Q) BumpVersion(ctx context.Context, scope string) error {
	_, err := q.db.Exec(ctx, `UPDATE reference_version SET version = version + 1, updated_at = now() WHERE scope = $1`, scope)
	return err
}

// Versions returns all reference version counters.
func (q Q) Versions(ctx context.Context) ([]domain.ReferenceVersion, error) {
	rows, err := q.db.Query(ctx, `SELECT scope, version, label, updated_at FROM reference_version ORDER BY scope`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.ReferenceVersion, error) {
		var v domain.ReferenceVersion
		err := r.Scan(&v.Scope, &v.Version, &v.Label, &v.UpdatedAt)
		return v, err
	})
}

// VersionOf returns the counter of one scope.
func (q Q) VersionOf(ctx context.Context, scope string) (int, error) {
	var v int
	err := q.db.QueryRow(ctx, `SELECT version FROM reference_version WHERE scope = $1`, scope).Scan(&v)
	return v, err
}

// Ping checks the connection.
func (q Q) Ping(ctx context.Context) error {
	var one int
	return q.db.QueryRow(ctx, `SELECT 1`).Scan(&one)
}
