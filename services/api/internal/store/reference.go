package store

import (
	"context"

	"github.com/brobots/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

// DictTable is a dictionary table with code and name_ru columns.
type DictTable string

// Editable dictionaries.
const (
	FacilityTypes  DictTable = "facility_type"
	Industries     DictTable = "industry"
	HandlingMethod DictTable = "handling_method"
	WorkCategories DictTable = "work_category"
)

// Dictionary returns the options of a dictionary table ordered by sort.
func (q Q) Dictionary(ctx context.Context, t DictTable) ([]domain.Option, error) {
	hint := "NULL::text"
	if t == HandlingMethod {
		hint = "hint_ru"
	}
	rows, err := q.db.Query(ctx, `SELECT code, name_ru, `+hint+` FROM `+string(t)+` ORDER BY sort, name_ru`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Option, error) {
		var o domain.Option
		var h *string
		err := r.Scan(&o.Code, &o.Name, &h)
		o.Hint = domain.Deref(h)
		return o, err
	})
}

// UpsertDictionary inserts or renames dictionary entries.
func (q Q) UpsertDictionary(ctx context.Context, t DictTable, opts []domain.Option) error {
	for i, o := range opts {
		var err error
		if t == HandlingMethod {
			_, err = q.db.Exec(ctx, `INSERT INTO handling_method (code, name_ru, hint_ru, sort) VALUES ($1, $2, $3, $4)
				ON CONFLICT (code) DO UPDATE SET name_ru = EXCLUDED.name_ru, hint_ru = EXCLUDED.hint_ru, sort = EXCLUDED.sort`,
				o.Code, o.Name, o.Hint, i)
		} else {
			_, err = q.db.Exec(ctx, `INSERT INTO `+string(t)+` (code, name_ru, sort) VALUES ($1, $2, $3)
				ON CONFLICT (code) DO UPDATE SET name_ru = EXCLUDED.name_ru, sort = EXCLUDED.sort`, o.Code, o.Name, i)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// DictionaryHas reports whether a code exists in a dictionary.
func (q Q) DictionaryHas(ctx context.Context, t DictTable, code string) (bool, error) {
	var ok bool
	err := q.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM `+string(t)+` WHERE code = $1)`, code).Scan(&ok)
	return ok, err
}
