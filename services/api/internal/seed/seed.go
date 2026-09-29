// Package seed loads the demo data: dictionaries, operation classes, the organizer catalog,
// startup items, dataset parameters, reference processes, demo locations, tasks and projects.
// Loading is idempotent: existing records (by code or name) are left untouched.
package seed

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

//go:embed data
var data embed.FS

var namespace = uuid.MustParse("6a0f3b2e-5d1c-4c8e-9b7a-2f4e8d9c1a01")

func seedID(kind, key string) uuid.UUID {
	return uuid.NewSHA1(namespace, []byte(kind+":"+key))
}

func readYAML(name string, dst any) error {
	b, err := data.ReadFile("data/" + name)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(b, dst); err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	return nil
}

// toJSON converts a YAML-decoded value into JSON for the service inputs.
func toJSON(v any) ([]byte, error) {
	return json.Marshal(normalize(v))
}

func normalize(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[k] = normalize(val)
		}
		return out
	case map[any]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[fmt.Sprint(k)] = normalize(val)
		}
		return out
	case []any:
		for i := range t {
			t[i] = normalize(t[i])
		}
	}
	return v
}

type reference struct {
	FacilityTypes   []domain.Option `yaml:"facilityTypes"`
	Industries      []domain.Option `yaml:"industries"`
	HandlingMethods []domain.Option `yaml:"handlingMethods"`
	WorkCategories  []domain.Option `yaml:"workCategories"`
	WorkTypes       []struct {
		Code             string  `yaml:"code"`
		Name             string  `yaml:"name"`
		Description      string  `yaml:"description"`
		UnitLabel        string  `yaml:"unitLabel"`
		WorkCategoryCode *string `yaml:"workCategoryCode"`
		TypicalCarriers  *string `yaml:"typicalCarriers"`
		ExampleProcesses *string `yaml:"exampleProcesses"`
	} `yaml:"workTypes"`
	DataSources []struct {
		Key             string  `yaml:"key"`
		Name            string  `yaml:"name"`
		SourceType      string  `yaml:"sourceType"`
		Origin          string  `yaml:"origin"`
		LocatorKind     *string `yaml:"locatorKind"`
		URL             *string `yaml:"url"`
		FileName        *string `yaml:"fileName"`
		DataStatus      string  `yaml:"dataStatus"`
		Provides        *string `yaml:"provides"`
		ActualizedOn    string  `yaml:"actualizedOn"`
		RefreshSchedule string  `yaml:"refreshSchedule"`
	} `yaml:"dataSources"`
}

// Load applies the demo data; calculator evaluates the demo projects.
func Load(ctx context.Context, st *store.Store, calculator calc.Calculator, log *slog.Logger) error {
	ctx = service.AsSystem(ctx) // demo data has no owner and is read only for users
	started := time.Now()
	if err := service.New(st, log, calculator).EnsureNorms(ctx); err != nil {
		return fmt.Errorf("norms: %w", err)
	}
	var ref reference
	if err := readYAML("reference.yaml", &ref); err != nil {
		return err
	}
	sources := map[string]uuid.UUID{}
	for _, s := range ref.DataSources {
		sources[s.Key] = seedID("source", s.Key)
	}
	freshCatalog := false
	err := st.Tx(ctx, func(q store.Q) error {
		for t, opts := range map[store.DictTable][]domain.Option{
			store.FacilityTypes: ref.FacilityTypes, store.Industries: ref.Industries,
			store.HandlingMethod: ref.HandlingMethods, store.WorkCategories: ref.WorkCategories,
		} {
			if err := q.UpsertDictionary(ctx, t, opts); err != nil {
				return fmt.Errorf("dictionary %s: %w", t, err)
			}
		}
		for _, w := range ref.WorkTypes {
			if _, err := q.GetWorkTypeByCode(ctx, w.Code); err == nil {
				continue
			}
			if err := q.SaveWorkType(ctx, domain.WorkType{ID: seedID("work_type", w.Code), Code: w.Code, Name: w.Name,
				Description: domain.Ptr(w.Description), UnitLabel: w.UnitLabel, WorkCategoryCode: w.WorkCategoryCode,
				TypicalCarriers: w.TypicalCarriers, ExampleProcesses: w.ExampleProcesses, IsActive: true}); err != nil {
				return fmt.Errorf("work type %s: %w", w.Code, err)
			}
		}
		for _, s := range ref.DataSources {
			id := sources[s.Key]
			if _, err := q.GetSource(ctx, id); err == nil {
				continue
			}
			date, err := time.Parse(time.DateOnly, s.ActualizedOn)
			if err != nil {
				return fmt.Errorf("source %s: %w", s.Key, err)
			}
			if err := q.SaveSource(ctx, domain.DataSource{ID: id, Name: s.Name, SourceType: s.SourceType, Origin: s.Origin,
				LocatorKind: s.LocatorKind, URL: s.URL, FileName: s.FileName, DataStatus: s.DataStatus, Provides: s.Provides,
				ActualizedOn: domain.Date{Time: date}, RefreshSchedule: s.RefreshSchedule}); err != nil {
				return fmt.Errorf("source %s: %w", s.Key, err)
			}
		}
		if err := loadParameters(ctx, q); err != nil {
			return err
		}
		n, err := loadCatalog(ctx, q, sources)
		if err != nil {
			return err
		}
		freshCatalog = n > 0
		return nil
	})
	if err != nil {
		return err
	}
	svc := service.New(st, log, calculator)
	newProcesses, err := loadProcesses(ctx, st, svc)
	if err != nil {
		return err
	}
	if freshCatalog || newProcesses > 0 {
		if _, err := st.Pool.Exec(ctx, `UPDATE reference_version SET version = 1, updated_at = now()`); err != nil {
			return err
		}
	}
	newLocations, err := loadDemo(ctx, st, svc, log)
	if err != nil {
		return err
	}
	readied, err := readyDemoProjects(ctx, svc, log)
	if err != nil {
		return err
	}
	log.Info("seed loaded", slog.Bool("catalog", freshCatalog), slog.Int("processes", newProcesses),
		slog.Int("locations", newLocations), slog.Int("demo_projects_readied", readied),
		slog.Duration("duration", time.Since(started)))
	return nil
}
