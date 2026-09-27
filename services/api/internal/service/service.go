// Package service implements the use cases of the location, catalog and matching blocks.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"reflect"
	"strings"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
)

// Service coordinates the store and the domain rules.
type Service struct {
	st   *store.Store
	log  *slog.Logger
	calc calc.Calculator
}

// New creates the service; calculator computes fleet and economics for the orchestrator.
func New(st *store.Store, log *slog.Logger, calculator calc.Calculator) *Service {
	return &Service{st: st, log: log, calc: calculator}
}

// Ping checks the database.
func (s *Service) Ping(ctx context.Context) error {
	return s.st.Q().Ping(ctx)
}

// MergePatch applies a JSON merge patch onto dst, the editable state of an entity:
// present keys overwrite, null clears, nested objects merge. Unknown keys are rejected.
func MergePatch(dst any, body []byte) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return DecodeError(err)
	}
	return nil
}

// DecodeError converts a JSON decoding error into a user-facing validation error.
func DecodeError(err error) error {
	var typeErr *json.UnmarshalTypeError
	var syntaxErr *json.SyntaxError
	msg := err.Error()
	switch {
	case errors.As(err, &typeErr):
		t := typeErr.Type
		for t.Kind() == reflect.Pointer {
			t = t.Elem()
		}
		kind := t.Kind().String()
		if t.String() == "uuid.UUID" {
			kind = "string"
		}
		return &domain.ValidationError{Errors: []domain.FieldError{{
			Field: typeErr.Field, Code: "invalid_type",
			Message: fmt.Sprintf("Поле «%s»: ожидается %s", typeErr.Field, jsonTypeRu(kind)),
			Hint:    "Проверьте формат значения",
		}}}
	case errors.As(err, &syntaxErr), errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
		return &domain.ValidationError{Errors: []domain.FieldError{{
			Field: "body", Code: "invalid_json", Message: "Тело запроса не является корректным JSON", Hint: "Проверьте синтаксис JSON",
		}}}
	case strings.HasPrefix(msg, "json: unknown field "):
		field := strings.Trim(strings.TrimPrefix(msg, "json: unknown field "), `"`)
		return &domain.ValidationError{Errors: []domain.FieldError{{
			Field: field, Code: "unknown_field", Message: fmt.Sprintf("Поле «%s» не поддерживается", field),
			Hint: "Уберите поле из запроса",
		}}}
	}
	return &domain.ValidationError{Errors: []domain.FieldError{{Field: "body", Code: "invalid_json", Message: msg}}}
}

func jsonTypeRu(kind string) string {
	switch kind {
	case "string":
		return "строка"
	case "bool":
		return "true или false"
	case "slice", "array":
		return "список"
	case "struct", "map", "ptr":
		return "объект"
	}
	return "число"
}

// Page is a paginated list.
type Page[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
}

func paginate[T any](items []T, limit, offset int) Page[T] {
	total := len(items)
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	out := items[offset:end]
	if out == nil {
		out = []T{}
	}
	return Page[T]{Items: out, Total: total}
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func containsFold(hay, needle string) bool {
	return strings.Contains(strings.ToLower(hay), strings.ToLower(needle))
}

// Dictionaries returns all dropdown values.
func (s *Service) Dictionaries(ctx context.Context) (map[string][]domain.Option, error) {
	q := s.st.Q()
	out := map[string][]domain.Option{
		"solutionKinds":          domain.SolutionKinds,
		"solutionStatuses":       domain.SolutionStatuses,
		"productClasses":         domain.ProductClasses,
		"specsConfirmation":      domain.SpecsConfirmation,
		"capabilityEnvironments": domain.CapabilityEnvironments,
		"taskEnvironments":       domain.TaskEnvironments,
		"acquisitionModels":      domain.AcquisitionModels,
		"costTypes":              domain.CostTypes,
		"priceUnits":             domain.PriceUnits,
		"priceBands":             domain.PriceBands,
		"sourceTypes":            domain.SourceTypes,
		"sourceOrigins":          domain.SourceOrigins,
		"dataStatuses":           domain.DataStatuses,
		"refreshSchedules":       domain.RefreshSchedules,
		"projectStatuses":        domain.ProjectStatuses,
		"valueSources":           domain.ValueSources,
		"matchStates":            domain.MatchStates,
		"navigationTypes":        domain.NavigationTypes,
	}
	for key, t := range map[string]store.DictTable{
		"facilityTypes": store.FacilityTypes, "industries": store.Industries,
		"handlingMethods": store.HandlingMethod, "workCategories": store.WorkCategories,
	} {
		opts, err := q.Dictionary(ctx, t)
		if err != nil {
			return nil, err
		}
		out[key] = opts
	}
	return out, nil
}

// Versions returns the current reference versions.
func (s *Service) Versions(ctx context.Context) ([]domain.ReferenceVersion, error) {
	return s.st.Q().Versions(ctx)
}

func (s *Service) checkDict(ctx context.Context, q store.Q, v *domain.Validator, t store.DictTable, field, label string, code *string) error {
	if code == nil {
		return nil
	}
	ok, err := q.DictionaryHas(ctx, t, *code)
	if err != nil {
		return err
	}
	if !ok {
		opts, err := q.Dictionary(ctx, t)
		if err != nil {
			return err
		}
		v.Add(field, "invalid_value", fmt.Sprintf("Поле «%s»: значение «%s» не из справочника", label, *code),
			"Допустимые значения: "+strings.Join(domain.Codes(opts), ", "))
	}
	return nil
}
