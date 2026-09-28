package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// ProjectQuery filters the projects list.
type ProjectQuery struct {
	LocationID    *uuid.UUID
	TaskID        *uuid.UUID
	Status        string
	Q             string
	Sort          string
	Limit, Offset int
}

// ListProjects returns live projects.
func (s *Service) ListProjects(ctx context.Context, f ProjectQuery) (Page[domain.Project], error) {
	list, err := s.st.Q().ListProjects(ctx, store.ProjectFilter{LocationID: f.LocationID, TaskID: f.TaskID, Status: f.Status})
	if err != nil {
		return Page[domain.Project]{}, err
	}
	out := []domain.Project{}
	a := accessOf(ctx)
	for _, p := range list {
		if !a.sees(p.OwnerID, p.IsDemo) {
			continue
		}
		if f.Q != "" && !containsFold(p.Name+" "+p.LocationName+" "+p.Task.Name, f.Q) {
			continue
		}
		out = append(out, p)
	}
	if f.Sort == "name" {
		slices.SortStableFunc(out, func(a, b domain.Project) int {
			return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
		})
	}
	return paginate(out, f.Limit, f.Offset), nil
}

// GetProject returns a project.
func (s *Service) GetProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	p, err := s.st.Q().GetProject(ctx, id)
	if err != nil {
		return p, err
	}
	return p, accessOf(ctx).project(p.ID, p.OwnerID, p.IsDemo, false)
}

// visibleProject loads the writable part of a project the caller may read, or change when write is set.
func (s *Service) visibleProject(ctx context.Context, q store.Q, id uuid.UUID, write bool) (store.ProjectRecord, error) {
	rec, err := q.ProjectRecordOf(ctx, id)
	if err != nil {
		return rec, err
	}
	return rec, accessOf(ctx).project(rec.ID, rec.OwnerID, rec.IsDemo, write)
}

// draftProject loads a project the caller may change; a saved project is frozen.
func (s *Service) draftProject(ctx context.Context, q store.Q, id uuid.UUID) (store.ProjectRecord, error) {
	rec, err := s.visibleProject(ctx, q, id, true)
	if err != nil {
		return rec, err
	}
	return rec, editable(rec)
}

func editable(rec store.ProjectRecord) error {
	if rec.Status == domain.ProjectSaved {
		return domain.Conflict("project_saved",
			"Проект сохранён: его данные и расчёт закреплены. Откройте проект для изменений или скопируйте его")
	}
	return nil
}

// ProjectCreateInput creates a project for exactly one task.
type ProjectCreateInput struct {
	LocationID       *uuid.UUID `json:"locationId"`
	TaskID           *uuid.UUID `json:"taskId"`
	Name             *string    `json:"name"`
	HorizonYears     *int       `json:"horizonYears"`
	PinnedSolutionID *uuid.UUID `json:"pinnedSolutionId"`
}

func (s *Service) buildSnapshot(ctx context.Context, q store.Q, locationID, taskID uuid.UUID) (domain.ProjectSnapshot, domain.Versions, error) {
	var snap domain.ProjectSnapshot
	var ver domain.Versions
	l, err := s.visibleLocation(ctx, q, locationID, false) // own or demo location
	if err != nil {
		return snap, ver, err
	}
	t, err := q.GetTask(ctx, taskID)
	if err != nil {
		return snap, ver, err
	}
	if t.LocationID != locationID {
		return snap, ver, &domain.ValidationError{Errors: []domain.FieldError{{Field: "taskId", Code: "wrong_location",
			Message: "Задача относится к другой локации", Hint: "Выберите задачу этой локации"}}}
	}
	if t.ArchivedAt != nil {
		return snap, ver, domain.Conflict("task_archived", "Задача удалена с локации — выберите другую задачу")
	}
	list := []domain.Task{t}
	if err := s.enrichTasks(ctx, list); err != nil {
		return snap, ver, err
	}
	values, err := q.ParameterValues(ctx, &locationID)
	if err != nil {
		return snap, ver, err
	}
	snap = domain.ProjectSnapshot{Location: l, Parameters: values[locationID], Task: list[0]}
	if snap.Parameters == nil {
		snap.Parameters = []domain.ParameterValue{}
	}
	if ver.Catalog, err = q.VersionOf(ctx, "catalog"); err != nil {
		return snap, ver, err
	}
	ver.Dictionaries, err = q.VersionOf(ctx, "dictionaries")
	return snap, ver, err
}

// CreateProject creates a project, freezing the location and task inputs.
func (s *Service) CreateProject(ctx context.Context, body []byte) (domain.Project, error) {
	var in ProjectCreateInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Project{}, err
	}
	var v domain.Validator
	if in.LocationID == nil {
		v.Add("locationId", "required", "Не выбрана локация", "Выберите локацию или создайте новую")
	}
	if in.TaskID == nil {
		v.Add("taskId", "required", "Не выбрана задача", "В проекте ровно одна задача — выберите её или создайте на локации")
	}
	if in.HorizonYears != nil {
		v.Range("horizonYears", "Горизонт расчёта", domain.Ptr(float64(*in.HorizonYears)), domain.Ptr(1.0), domain.Ptr(30.0), "лет")
	}
	if err := v.Err(); err != nil {
		return domain.Project{}, err
	}
	a := accessOf(ctx)
	rec := store.ProjectRecord{ID: store.NewID(), LocationID: *in.LocationID, TaskID: *in.TaskID, Status: domain.ProjectDraft,
		PinnedSolutionID: in.PinnedSolutionID, SnapshotTakenAt: time.Now(), OwnerID: a.owner()}
	err := s.st.Tx(ctx, func(q store.Q) error {
		snap, ver, err := s.buildSnapshot(ctx, q, *in.LocationID, *in.TaskID)
		if err != nil {
			return err
		}
		// Only seed data is demo: a user project on a demo location is the user's own.
		rec.Snapshot, rec.Versions, rec.IsDemo = snap, ver, a.system && snap.Location.IsDemo
		rec.Name = fmt.Sprintf("Роботизация · %s · %s", snap.Task.Name, snap.Location.Name)
		if n := trimPtr(in.Name); n != nil {
			rec.Name = *n
		}
		rec.HorizonYears = in.HorizonYears
		if rec.HorizonYears == nil {
			rec.HorizonYears = snap.Location.HorizonYears
		}
		if err := pinNorms(ctx, q, &rec); err != nil {
			return err
		}
		if in.PinnedSolutionID != nil {
			if _, err := q.GetSolution(ctx, *in.PinnedSolutionID); err != nil {
				return &domain.ValidationError{Errors: []domain.FieldError{{Field: "pinnedSolutionId", Code: "not_found", Message: "Решение каталога не найдено"}}}
			}
		}
		if err := q.SaveProject(ctx, rec); err != nil {
			return err
		}
		if in.PinnedSolutionID != nil {
			return q.AddManualCandidate(ctx, rec.ID, *in.PinnedSolutionID, domain.Ptr("Проверить на своём объекте"))
		}
		return nil
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, rec.ID)
}

// ProjectPatchInput is the editable part of a project. The status changes by save and reopen.
type ProjectPatchInput struct {
	Name         string          `json:"name"`
	HorizonYears *int            `json:"horizonYears" description:"Вход расчёта: у сохранённого проекта не меняется"`
	TaskID       *uuid.UUID      `json:"taskId" description:"Другая задача той же локации (шаг 1, PRD 11.1): снимок собирается заново, выбор робота, условия подбора и решения по шагам сбрасываются. Только у черновика"`
	Step         *string         `json:"step" enum:"params,matching,simulation,economics" description:"Самый дальний открытый шаг. Только у черновика"`
	Inputs       json.RawMessage `json:"inputs" description:"Решения по шагам целиком, заменяют прежние (автосохранение черновика). Только у черновика"`
}

// maxInputsBytes bounds the decisions of one project: they are form values, not files.
const maxInputsBytes = 256 << 10

// PatchProject updates the name, the horizon, the task and the decisions by steps.
func (s *Service) PatchProject(ctx context.Context, id uuid.UUID, body []byte) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.visibleProject(ctx, q, id, true)
		if err != nil {
			return err
		}
		in := ProjectPatchInput{Name: rec.Name, HorizonYears: rec.HorizonYears}
		if err := MergePatch(&in, body); err != nil {
			return err
		}
		var v domain.Validator
		v.Required("name", "Название проекта", in.Name)
		if in.HorizonYears != nil {
			v.Range("horizonYears", "Горизонт расчёта", domain.Ptr(float64(*in.HorizonYears)), domain.Ptr(1.0), domain.Ptr(30.0), "лет")
		}
		if in.Step != nil {
			v.OneOf("step", "Шаг проекта", *in.Step, domain.ProjectSteps)
		}
		if in.Inputs != nil {
			validateInputs(&v, in.Inputs)
		}
		if err := v.Err(); err != nil {
			return err
		}
		horizonChanged := domain.Deref(in.HorizonYears) != domain.Deref(rec.HorizonYears)
		taskChanged := in.TaskID != nil && *in.TaskID != rec.TaskID
		if horizonChanged || taskChanged || in.Step != nil || in.Inputs != nil {
			if err := editable(rec); err != nil {
				return err
			}
		}
		rec.Name, rec.HorizonYears = strings.TrimSpace(in.Name), in.HorizonYears
		if taskChanged {
			if err := s.switchTask(ctx, q, &rec, *in.TaskID); err != nil {
				return err
			}
		}
		if in.Step != nil {
			rec.Step = *in.Step
		}
		if in.Inputs != nil {
			rec.Inputs = in.Inputs
		}
		if err := q.SaveProject(ctx, rec); err != nil {
			return err
		}
		if taskChanged {
			// Conditions were overrides of the previous task; ReplaceOverrides bumps the inputs version.
			return q.ReplaceOverrides(ctx, id, nil)
		}
		if horizonChanged {
			return q.BumpProjectInputs(ctx, id)
		}
		return nil
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// validateInputs accepts a JSON object or null of a bounded size; its fields are the web model.
func validateInputs(v *domain.Validator, raw json.RawMessage) {
	if len(raw) > maxInputsBytes {
		v.Add("inputs", "too_large", "Решения по шагам слишком большие", fmt.Sprintf("Не больше %d КБ", maxInputsBytes>>10))
		return
	}
	var probe any
	if err := json.Unmarshal(raw, &probe); err != nil {
		v.Add("inputs", "invalid_json", "Решения по шагам не читаются как JSON", "Передайте объект")
		return
	}
	if _, ok := probe.(map[string]any); !ok && probe != nil {
		v.Add("inputs", "invalid_type", "Решения по шагам должны быть объектом", "Передайте объект или null")
	}
}

// switchTask moves a draft to another task of its location: the snapshot is rebuilt, and whatever was
// decided for the previous task (robot, steps) is dropped (D-94).
func (s *Service) switchTask(ctx context.Context, q store.Q, rec *store.ProjectRecord, taskID uuid.UUID) error {
	snap, ver, err := s.buildSnapshot(ctx, q, rec.LocationID, taskID)
	if err != nil {
		return err
	}
	ver.Model = rec.Versions.Model
	rec.TaskID, rec.Snapshot, rec.Versions, rec.SnapshotTakenAt = taskID, snap, ver, time.Now()
	clearSelection(rec)
	rec.Step, rec.Inputs = domain.ProjectSteps[0], nil
	return pinNorms(ctx, q, rec)
}

// DeleteProject hides a project.
func (s *Service) DeleteProject(ctx context.Context, id uuid.UUID) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if _, err := s.visibleProject(ctx, q, id, true); err != nil {
			return err
		}
		return q.SoftDeleteProject(ctx, id)
	})
}

// CopyProject duplicates a project with its snapshot, conditions and manual candidates.
func (s *Service) CopyProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	var newID uuid.UUID
	a := accessOf(ctx)
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.visibleProject(ctx, q, id, false)
		if err != nil {
			return err
		}
		overrides, err := q.Overrides(ctx, id)
		if err != nil {
			return err
		}
		manual, err := q.ManualCandidates(ctx, id)
		if err != nil {
			return err
		}
		src := rec.ID
		rec.ID, rec.Name, rec.CopiedFromID, rec.Status = store.NewID(), "Копия · "+rec.Name, &src, domain.ProjectDraft
		rec.OwnerID, rec.IsDemo = a.owner(), a.system && rec.IsDemo // a copy of a demo project is the user's own
		// The copy keeps the inputs, not the decision: calculations stay with the source project.
		clearSelection(&rec)
		rec.SavedAt, rec.Versions.Model = nil, nil
		rec.Step, rec.Inputs, rec.ResultSummary, rec.QuoteRequestedAt = domain.ProjectSteps[0], nil, nil, nil
		newID = rec.ID
		if err := q.SaveProject(ctx, rec); err != nil {
			return err
		}
		if err := q.ReplaceOverrides(ctx, rec.ID, overrides); err != nil {
			return err
		}
		for _, m := range manual {
			if err := q.AddManualCandidate(ctx, rec.ID, m.SolutionID, m.Reason); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, newID)
}

// RefreshSnapshot re-reads the location and task and pins the current versions. The selected
// robot is dropped: its figures were calculated on the old inputs.
func (s *Service) RefreshSnapshot(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.draftProject(ctx, q, id)
		if err != nil {
			return err
		}
		snap, ver, err := s.buildSnapshot(ctx, q, rec.LocationID, rec.TaskID)
		if err != nil {
			var nf *domain.NotFoundError
			if errors.As(err, &nf) && nf.Entity == "location" {
				return domain.Conflict("location_deleted", "Локация удалена — снимок проекта обновить нельзя")
			}
			return err
		}
		ver.Model = rec.Versions.Model
		rec.Snapshot, rec.Versions, rec.SnapshotTakenAt = snap, ver, time.Now()
		if err := pinNorms(ctx, q, &rec); err != nil {
			return err
		}
		clearSelection(&rec)
		if err := q.SaveProject(ctx, rec); err != nil {
			return err
		}
		return q.BumpProjectInputs(ctx, id)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// Snapshot returns the frozen inputs of a project.
func (s *Service) Snapshot(ctx context.Context, id uuid.UUID) (domain.ProjectSnapshot, error) {
	rec, err := s.visibleProject(ctx, s.st.Q(), id, false)
	return rec.Snapshot, err
}

func (s *Service) projectConditions(ctx context.Context, q store.Q, id uuid.UUID, write bool) (store.ProjectRecord, matching.Conditions, error) {
	rec, err := s.visibleProject(ctx, q, id, write)
	if err != nil {
		return rec, matching.Conditions{}, err
	}
	overrides, err := q.Overrides(ctx, id)
	if err != nil {
		return rec, matching.Conditions{}, err
	}
	return rec, matching.BuildConditions(rec.Snapshot.Task, overrides), nil
}

// Conditions returns the matching conditions of a project with their sources.
func (s *Service) Conditions(ctx context.Context, id uuid.UUID) ([]matching.Condition, error) {
	_, c, err := s.projectConditions(ctx, s.st.Q(), id, false)
	return c.List(), err
}

// PutConditions replaces the project overrides of task conditions (panel «Условия задачи»).
func (s *Service) PutConditions(ctx context.Context, id uuid.UUID, items []matching.Override) ([]matching.Condition, error) {
	var v domain.Validator
	seen := map[string]bool{}
	err := s.st.Tx(ctx, func(q store.Q) error {
		if _, err := s.draftProject(ctx, q, id); err != nil {
			return err
		}
		for i, o := range items {
			field := fmt.Sprintf("items[%d]", i)
			if !slices.Contains(matching.OverridableCodes, o.Code) {
				v.Add(field+".code", "invalid_value", fmt.Sprintf("Условие «%s» нельзя изменить в проекте", o.Code),
					"Допустимо: "+strings.Join(matching.OverridableCodes, ", "))
				continue
			}
			if seen[o.Code] {
				v.Add(field+".code", "duplicate", "Условие указано дважды", "Оставьте одну строку")
			}
			seen[o.Code] = true
			switch o.Code {
			case "handling":
				if len(o.List) == 0 {
					v.Add(field+".list", "required", "Не выбраны способы обработки", "Отметьте хотя бы один способ")
				}
				for _, h := range o.List {
					if err := s.checkDict(ctx, q, &v, store.HandlingMethod, field+".list", "Способ обработки", &h); err != nil {
						return err
					}
				}
			case "environment":
				if o.Text == nil {
					v.Add(field+".text", "required", "Не указана среда", "indoor или outdoor")
				} else {
					v.OneOf(field+".text", "Среда", *o.Text, domain.Codes(domain.TaskEnvironments))
				}
			case "aisle_width", "min_temperature":
				if o.Number == nil {
					v.Add(field+".number", "required", "Не указано значение", "Укажите число")
				}
			}
		}
		if err := v.Err(); err != nil {
			return err
		}
		return q.ReplaceOverrides(ctx, id, items)
	})
	if err != nil {
		return nil, err
	}
	return s.Conditions(ctx, id)
}

// RunMatching screens the catalog for the project task and saves the run.
func (s *Service) RunMatching(ctx context.Context, id uuid.UUID) (matching.Run, error) {
	var run matching.Run
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, conds, err := s.projectConditions(ctx, q, id, true)
		if err != nil {
			return err
		}
		if err := editable(rec); err != nil {
			return err
		}
		manual, err := q.ManualCandidates(ctx, id)
		if err != nil {
			return err
		}
		ids := make([]uuid.UUID, len(manual))
		for i, m := range manual {
			ids[i] = m.SolutionID
		}
		cands, _, err := s.screen(ctx, rec.Snapshot.Task.WorkType, conds, ids)
		if err != nil {
			return err
		}
		version, err := q.VersionOf(ctx, "catalog")
		if err != nil {
			return err
		}
		run = matching.Run{ProjectID: &rec.ID, TaskID: rec.TaskID, WorkType: rec.Snapshot.Task.WorkType,
			CatalogVersion: version, RulesetVersion: matching.RulesetVersion, Conditions: conds.List(),
			Counts: matching.Count(cands), Candidates: cands}
		return q.SaveRun(ctx, &run, conds)
	})
	return run, err
}

// LatestRun returns the latest saved run of a project.
func (s *Service) LatestRun(ctx context.Context, projectID uuid.UUID) (matching.Run, error) {
	q := s.st.Q()
	if _, err := s.visibleProject(ctx, q, projectID, false); err != nil {
		return matching.Run{}, err
	}
	id, err := q.LatestRunID(ctx, projectID)
	if err != nil {
		return matching.Run{}, err
	}
	if id == nil {
		return matching.Run{}, domain.NotFound("matching_run", "latest")
	}
	return q.GetRun(ctx, *id)
}

// GetRun returns a saved run.
func (s *Service) GetRun(ctx context.Context, id uuid.UUID) (matching.Run, error) {
	q := s.st.Q()
	run, err := q.GetRun(ctx, id)
	if err != nil {
		return run, err
	}
	// A run is seen through its project; a run of a hidden or deleted project is not found.
	if _, err := s.visibleProject(ctx, q, *run.ProjectID, false); err != nil {
		return matching.Run{}, domain.NotFound("matching_run", id.String())
	}
	return run, nil
}

// ManualCandidates returns the solutions added by hand.
func (s *Service) ManualCandidates(ctx context.Context, projectID uuid.UUID) ([]domain.ManualCandidate, error) {
	q := s.st.Q()
	if _, err := s.visibleProject(ctx, q, projectID, false); err != nil {
		return nil, err
	}
	return q.ManualCandidates(ctx, projectID)
}

// ManualCandidateInput adds a solution by hand.
type ManualCandidateInput struct {
	SolutionID *uuid.UUID `json:"solutionId"`
	Reason     *string    `json:"reason"`
}

// AddManualCandidate adds a solution to the comparison; it is screened with a warning.
func (s *Service) AddManualCandidate(ctx context.Context, projectID uuid.UUID, body []byte) ([]domain.ManualCandidate, error) {
	var in ManualCandidateInput
	if err := MergePatch(&in, body); err != nil {
		return nil, err
	}
	if in.SolutionID == nil {
		return nil, &domain.ValidationError{Errors: []domain.FieldError{{Field: "solutionId", Code: "required", Message: "Не выбрано решение", Hint: "Укажите solutionId из каталога"}}}
	}
	var out []domain.ManualCandidate
	err := s.st.Tx(ctx, func(q store.Q) error {
		if _, err := s.draftProject(ctx, q, projectID); err != nil {
			return err
		}
		if _, err := q.GetSolution(ctx, *in.SolutionID); err != nil {
			return err
		}
		if err := q.AddManualCandidate(ctx, projectID, *in.SolutionID, trimPtr(in.Reason)); err != nil {
			return err
		}
		var err error
		out, err = q.ManualCandidates(ctx, projectID)
		return err
	})
	return out, err
}

// RemoveManualCandidate removes a hand-added solution.
func (s *Service) RemoveManualCandidate(ctx context.Context, projectID, solutionID uuid.UUID) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if _, err := s.draftProject(ctx, q, projectID); err != nil {
			return err
		}
		return q.RemoveManualCandidate(ctx, projectID, solutionID)
	})
}

// EvaluationCandidate is an eligible candidate with full catalog data.
type EvaluationCandidate struct {
	Match    matching.Candidate `json:"match"`
	Solution domain.Solution    `json:"solution"`
}

// EvaluationContext is the contract for the evaluation orchestrator and economics.
type EvaluationContext struct {
	Project    domain.Project         `json:"project"`
	Snapshot   domain.ProjectSnapshot `json:"snapshot"`
	Conditions []matching.Condition   `json:"conditions"`
	RunID      *uuid.UUID             `json:"runId"`
	Candidates []EvaluationCandidate  `json:"candidates"`
}

// EvaluationContext returns the inputs for calculation: snapshot and eligible candidates of the latest run.
func (s *Service) EvaluationContext(ctx context.Context, id uuid.UUID) (EvaluationContext, error) {
	q := s.st.Q()
	p, err := s.GetProject(ctx, id)
	if err != nil {
		return EvaluationContext{}, err
	}
	rec, conds, err := s.projectConditions(ctx, q, id, false)
	if err != nil {
		return EvaluationContext{}, err
	}
	out := EvaluationContext{Project: p, Snapshot: rec.Snapshot, Conditions: conds.List(), Candidates: []EvaluationCandidate{}}
	runID, err := q.LatestRunID(ctx, id)
	if err != nil || runID == nil {
		return out, err
	}
	run, err := q.GetRun(ctx, *runID)
	if err != nil {
		return out, err
	}
	out.RunID = runID
	for _, c := range run.Candidates {
		if c.State == matching.StateExcluded && !c.IsManual {
			continue
		}
		sol, err := q.GetSolution(ctx, c.Solution.ID)
		if err != nil {
			return out, err
		}
		out.Candidates = append(out.Candidates, EvaluationCandidate{Match: c, Solution: sol})
	}
	return out, nil
}

// Dashboard returns the dashboard summary.
func (s *Service) Dashboard(ctx context.Context) (domain.Dashboard, error) {
	var d domain.Dashboard
	locs, err := s.ListLocations(ctx, LocationQuery{Limit: 500})
	if err != nil {
		return d, err
	}
	d.Locations.Total = locs.Total
	d.Locations.ByFacilityType = map[string]int{}
	for _, l := range locs.Items {
		d.Locations.ByFacilityType[l.FacilityTypeCode]++
		d.ManualLaborCostRubYear += l.Summary.LaborCostRubYear
	}
	page, err := s.ListProjects(ctx, ProjectQuery{Limit: 500})
	if err != nil {
		return d, err
	}
	projects := page.Items
	d.Projects.Total = page.Total
	for _, p := range projects {
		if p.Status != domain.ProjectSaved {
			continue
		}
		d.Projects.Calculated++
		if p.ResultSummary != nil && p.ResultSummary.NetEffectYearRub != nil {
			d.FoundSavingsRubYear = domain.Ptr(domain.Deref(d.FoundSavingsRubYear) + *p.ResultSummary.NetEffectYearRub)
		}
	}
	d.RecentProjects = projects[:min(5, len(projects))]
	d.TopLocations = locs.Items[:min(5, len(locs.Items))]
	d.Versions, err = s.Versions(ctx)
	return d, err
}
