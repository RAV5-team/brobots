package seed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

func loadProcesses(ctx context.Context, st *store.Store, svc *service.Service) (int, error) {
	var pf struct {
		Processes []map[string]any `yaml:"processes"`
	}
	if err := readYAML("processes.yaml", &pf); err != nil {
		return 0, err
	}
	q := st.Q()
	n := 0
	for _, p := range pf.Processes {
		code := fmt.Sprint(p["code"])
		if _, found, err := q.ProcessIDByCode(ctx, code); err != nil {
			return n, err
		} else if found {
			continue
		}
		wt, err := q.GetWorkTypeByCode(ctx, fmt.Sprint(p["workType"]))
		if err != nil {
			return n, fmt.Errorf("process %s: %w", code, err)
		}
		delete(p, "workType")
		p["workTypeId"] = wt.ID.String()
		body, err := toJSON(p)
		if err != nil {
			return n, err
		}
		if _, err := svc.CreateProcess(ctx, body); err != nil {
			return n, fmt.Errorf("process %s: %w", code, err)
		}
		n++
	}
	return n, nil
}

type demoTask struct {
	Process string           `yaml:"process"`
	Name    *string          `yaml:"name"`
	Params  map[string]any   `yaml:"params"`
	Workers []map[string]any `yaml:"workers"`
}

type demoProject struct {
	Task        string `yaml:"task"`
	Name        string `yaml:"name"`
	RunMatching bool   `yaml:"runMatching"`
}

type demoLocation struct {
	Name             string           `yaml:"name"`
	FacilityTypeCode string           `yaml:"facilityTypeCode"`
	City             string           `yaml:"city"`
	Address          string           `yaml:"address"`
	CapexBudget      map[string]any   `yaml:"capexBudget"`
	HorizonYears     int              `yaml:"horizonYears"`
	Parameters       map[string]any   `yaml:"parameters"`
	Assumptions      []string         `yaml:"assumptions"`
	StaffGroups      []map[string]any `yaml:"staffGroups"`
	Tasks            []demoTask       `yaml:"tasks"`
	Projects         []demoProject    `yaml:"projects"`
}

func loadDemo(ctx context.Context, st *store.Store, svc *service.Service) (int, error) {
	var df struct {
		Locations []demoLocation `yaml:"locations"`
	}
	if err := readYAML("demo.yaml", &df); err != nil {
		return 0, err
	}
	q := st.Q()
	n := 0
	for _, dl := range df.Locations {
		if _, found, err := q.DemoLocationIDByName(ctx, dl.Name); err != nil {
			return n, err
		} else if found {
			continue
		}
		defs, err := q.ParameterDefinitions(ctx, dl.FacilityTypeCode)
		if err != nil {
			return n, err
		}
		assumed := map[string]bool{}
		for _, a := range dl.Assumptions {
			assumed[a] = true
		}
		params := []domain.ParameterInput{}
		for _, d := range defs {
			if d.StaffRole != nil {
				continue
			}
			in := domain.ParameterInput{Code: d.Code, Value: d.BaseValue(), Source: "organizer", IsAssumption: assumed[d.Code]}
			if v, ok := dl.Parameters[d.Code]; ok {
				in.Value, in.Source = v, "user"
			}
			if in.IsAssumption {
				in.Source = "assumption"
			}
			if in.Value != nil {
				params = append(params, in)
			}
		}
		body := map[string]any{
			"name": dl.Name, "facilityTypeCode": dl.FacilityTypeCode, "city": dl.City, "address": dl.Address,
			"capexBudget": dl.CapexBudget, "horizonYears": dl.HorizonYears, "fillDefaults": true, "parameters": params,
			"updatedBy": "Демо-данные организатора",
		}
		if dl.StaffGroups != nil {
			body["staffGroups"] = dl.StaffGroups
		}
		b, err := toJSON(body)
		if err != nil {
			return n, err
		}
		loc, err := svc.CreateLocation(ctx, b)
		if err != nil {
			return n, fmt.Errorf("demo location %s: %w", dl.Name, err)
		}
		raw, err := q.GetLocation(ctx, loc.ID)
		if err != nil {
			return n, err
		}
		raw.IsDemo = true
		if err := q.SaveLocation(ctx, raw); err != nil {
			return n, err
		}
		if err := loadDemoContent(ctx, q, svc, loc.ID, dl); err != nil {
			if derr := q.SoftDeleteLocation(ctx, loc.ID); derr != nil {
				return n, errors.Join(err, fmt.Errorf("cleanup: %w", derr))
			}
			return n, err
		}
		n++
	}
	return n, nil
}

// loadDemoContent creates the tasks and projects of a demo location.
func loadDemoContent(ctx context.Context, q store.Q, svc *service.Service, locationID uuid.UUID, dl demoLocation) error {
	tasks := map[string]uuid.UUID{}
	for _, dt := range dl.Tasks {
		pid, found, err := q.ProcessIDByCode(ctx, dt.Process)
		if err != nil {
			return err
		}
		if !found {
			return fmt.Errorf("demo task: unknown process %s", dt.Process)
		}
		tb := map[string]any{"processId": pid.String()}
		if dt.Name != nil {
			tb["name"] = *dt.Name
		}
		if dt.Params != nil {
			tb["params"] = dt.Params
		}
		if dt.Workers != nil {
			tb["workers"] = dt.Workers
		}
		b, err := toJSON(tb)
		if err != nil {
			return err
		}
		t, err := svc.CreateTask(ctx, locationID, b, false)
		if err != nil {
			return fmt.Errorf("demo task %s on %s: %w", dt.Process, dl.Name, err)
		}
		tasks[dt.Process] = t.ID
	}
	for _, dp := range dl.Projects {
		tid, ok := tasks[dp.Task]
		if !ok {
			return fmt.Errorf("demo project %s: task %s not on location", dp.Name, dp.Task)
		}
		b, err := json.Marshal(map[string]any{"locationId": locationID, "taskId": tid, "name": dp.Name})
		if err != nil {
			return err
		}
		p, err := svc.CreateProject(ctx, b)
		if err != nil {
			return fmt.Errorf("demo project %s: %w", dp.Name, err)
		}
		if dp.RunMatching {
			if _, err := svc.RunMatching(ctx, p.ID); err != nil {
				return fmt.Errorf("demo project %s matching: %w", dp.Name, err)
			}
		}
	}
	return nil
}
