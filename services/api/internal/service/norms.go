package service

import (
	"context"
	"fmt"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// EnsureNorms creates the first norm set of screen А5 when the database has none.
func (s *Service) EnsureNorms(ctx context.Context) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if err := q.LockNormSets(ctx); err != nil {
			return err
		}
		cur, err := q.CurrentNormSet(ctx)
		if err != nil || cur != nil {
			return err
		}
		set := domain.NormSet{Label: "Нормативы А5 · PRD 0.9", Values: domain.DefaultNormValues()}
		return q.InsertNormSet(ctx, &set, nil)
	})
}

// CurrentNorms returns the latest norm set: new projects pin it.
func (s *Service) CurrentNorms(ctx context.Context) (domain.NormSet, error) {
	cur, err := s.st.Q().CurrentNormSet(ctx)
	if err != nil {
		return domain.NormSet{}, err
	}
	if cur == nil {
		return domain.NormSet{}, domain.NotFound("norm_set", "current")
	}
	return *cur, nil
}

// GetNormSet returns a norm set version.
func (s *Service) GetNormSet(ctx context.Context, id uuid.UUID) (domain.NormSet, error) {
	return s.st.Q().GetNormSet(ctx, id)
}

// ListNormSets returns the norm set versions, newest first.
func (s *Service) ListNormSets(ctx context.Context) ([]domain.NormSetSummary, error) {
	return s.st.Q().ListNormSets(ctx)
}

// NormSetInput creates the next norm set version from changed values.
type NormSetInput struct {
	Label  *string          `json:"label" description:"Название версии; пусто — «Версия N»"`
	Note   *string          `json:"note" description:"Что и почему изменено"`
	Values []NormValueInput `json:"values" description:"Изменённые значения; остальные берутся из текущей версии"`
}

// NormValueInput is a new value of one norm.
type NormValueInput struct {
	Code   string  `json:"code"`
	Value  float64 `json:"value"`
	Source *string `json:"source" description:"Новое основание значения; пусто — прежнее"`
}

// CreateNormSet stores the next version of the norms (admin, экран А5). Saved sets never change:
// existing projects keep calculating on the version they pinned.
func (s *Service) CreateNormSet(ctx context.Context, body []byte) (domain.NormSet, error) {
	var in NormSetInput
	if err := MergePatch(&in, body); err != nil {
		return domain.NormSet{}, err
	}
	var out domain.NormSet
	err := s.st.Tx(ctx, func(q store.Q) error {
		if err := q.LockNormSets(ctx); err != nil {
			return err
		}
		cur, err := q.CurrentNormSet(ctx)
		if err != nil {
			return err
		}
		values := domain.DefaultNormValues()
		if cur != nil {
			values = mergeNormValues(values, cur.Values)
		}
		var v domain.Validator
		index := make(map[string]int, len(values))
		for i, nv := range values {
			index[nv.Code] = i
		}
		for i, change := range in.Values {
			at, ok := index[change.Code]
			if !ok {
				v.Add(fmt.Sprintf("values[%d].code", i), "invalid_value", fmt.Sprintf("Норматива «%s» нет в справочнике", change.Code),
					"Коды нормативов — в GET /api/v1/norms")
				continue
			}
			values[at].Value = change.Value
			if src := trimPtr(change.Source); src != nil {
				values[at].Source = *src
			}
		}
		v.Merge(domain.ValidateNormValues(values))
		if err := v.Err(); err != nil {
			return err
		}
		out = domain.NormSet{Note: trimPtr(in.Note), Values: values}
		if label := trimPtr(in.Label); label != nil {
			out.Label = *label
		}
		if err := q.InsertNormSet(ctx, &out, accessOf(ctx).owner()); err != nil {
			return err
		}
		if out.Label == "" {
			out.Label = fmt.Sprintf("Версия %d", out.Version)
			return q.SetNormSetLabel(ctx, out.ID, out.Label)
		}
		return nil
	})
	return out, err
}

// mergeNormValues takes the stored values over the definitions, so a norm added to the
// definitions after the last version gets its default value.
func mergeNormValues(defaults, stored []domain.NormValue) []domain.NormValue {
	byCode := make(map[string]domain.NormValue, len(stored))
	for _, v := range stored {
		byCode[v.Code] = v
	}
	out := make([]domain.NormValue, len(defaults))
	for i, d := range defaults {
		out[i] = d
		if v, ok := byCode[d.Code]; ok {
			out[i].Value, out[i].Source = v.Value, v.Source
		}
	}
	return out
}

// pinNorms pins the latest norm set in a project: on creation and on a snapshot refresh.
func pinNorms(ctx context.Context, q store.Q, rec *store.ProjectRecord) error {
	cur, err := q.CurrentNormSet(ctx)
	if err != nil || cur == nil {
		return err
	}
	rec.NormSetID = &cur.ID
	return nil
}

// projectNorms is the norm set a project calculates on: the pinned one, or the latest for
// projects created before norms were versioned.
func (s *Service) projectNorms(ctx context.Context, q store.Q, rec store.ProjectRecord) (domain.NormSet, error) {
	if rec.NormSetID != nil {
		return q.GetNormSet(ctx, *rec.NormSetID)
	}
	cur, err := q.CurrentNormSet(ctx)
	if err != nil {
		return domain.NormSet{}, err
	}
	if cur == nil {
		return domain.NormSet{}, domain.NotFound("norm_set", "current")
	}
	return *cur, nil
}
