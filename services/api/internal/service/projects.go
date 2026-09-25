package service

import (
	"context"
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
	for _, p := range list {
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
	return s.st.Q().GetProject(ctx, id)
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
	l, err := q.GetLocation(ctx, locationID)
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
	rec := store.ProjectRecord{ID: store.NewID(), LocationID: *in.LocationID, TaskID: *in.TaskID, Status: "params",
		PinnedSolutionID: in.PinnedSolutionID, SnapshotTakenAt: time.Now()}
	err := s.st.Tx(ctx, func(q store.Q) error {
		snap, ver, err := s.buildSnapshot(ctx, q, *in.LocationID, *in.TaskID)
		if err != nil {
			return err
		}
		rec.Snapshot, rec.Versions, rec.IsDemo = snap, ver, snap.Location.IsDemo
		rec.Name = fmt.Sprintf("Роботизация · %s · %s", snap.Task.Name, snap.Location.Name)
		if n := trimPtr(in.Name); n != nil {
			rec.Name = *n
		}
		rec.HorizonYears = in.HorizonYears
		if rec.HorizonYears == nil {
			rec.HorizonYears = snap.Location.HorizonYears
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

// ProjectPatchInput is the editable part of a project.
type ProjectPatchInput struct {
	Name         string `json:"name"`
	Status       string `json:"status"`
	HorizonYears *int   `json:"horizonYears"`
}

// PatchProject updates name, status and horizon.
func (s *Service) PatchProject(ctx context.Context, id uuid.UUID, body []byte) (domain.Project, error) {
	q := s.st.Q()
	rec, err := q.ProjectRecordOf(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	in := ProjectPatchInput{Name: rec.Name, Status: rec.Status, HorizonYears: rec.HorizonYears}
	if err := MergePatch(&in, body); err != nil {
		return domain.Project{}, err
	}
	var v domain.Validator
	v.Required("name", "Название проекта", in.Name)
	v.OneOf("status", "Статус", in.Status, domain.Codes(domain.ProjectStatuses))
	if in.HorizonYears != nil {
		v.Range("horizonYears", "Горизонт расчёта", domain.Ptr(float64(*in.HorizonYears)), domain.Ptr(1.0), domain.Ptr(30.0), "лет")
	}
	if err := v.Err(); err != nil {
		return domain.Project{}, err
	}
	rec.Name, rec.Status, rec.HorizonYears = strings.TrimSpace(in.Name), in.Status, in.HorizonYears
	if err := q.SaveProject(ctx, rec); err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// DeleteProject hides a project.
func (s *Service) DeleteProject(ctx context.Context, id uuid.UUID) error {
	return s.st.Q().SoftDeleteProject(ctx, id)
}

// CopyProject duplicates a project with its snapshot, conditions and manual candidates.
func (s *Service) CopyProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	var newID uuid.UUID
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := q.ProjectRecordOf(ctx, id)
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
		rec.ID, rec.Name, rec.CopiedFromID, rec.Status = store.NewID(), "Копия · "+rec.Name, &src, "params"
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

// RefreshSnapshot re-reads the location and task and pins the current versions.
func (s *Service) RefreshSnapshot(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := q.ProjectRecordOf(ctx, id)
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
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// Snapshot returns the frozen inputs of a project.
func (s *Service) Snapshot(ctx context.Context, id uuid.UUID) (domain.ProjectSnapshot, error) {
	rec, err := s.st.Q().ProjectRecordOf(ctx, id)
	return rec.Snapshot, err
}

func (s *Service) projectConditions(ctx context.Context, q store.Q, id uuid.UUID) (store.ProjectRecord, matching.Conditions, error) {
	rec, err := q.ProjectRecordOf(ctx, id)
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
	_, c, err := s.projectConditions(ctx, s.st.Q(), id)
	return c.List(), err
}

// PutConditions replaces the project overrides of task conditions (panel «Условия задачи»).
func (s *Service) PutConditions(ctx context.Context, id uuid.UUID, items []matching.Override) ([]matching.Condition, error) {
	var v domain.Validator
	seen := map[string]bool{}
	err := s.st.Tx(ctx, func(q store.Q) error {
		if _, err := q.ProjectRecordOf(ctx, id); err != nil {
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
		rec, conds, err := s.projectConditions(ctx, q, id)
		if err != nil {
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
		if err := q.SaveRun(ctx, &run, conds); err != nil {
			return err
		}
		if rec.Status == "params" {
			rec.Status = "matching"
			return q.SaveProject(ctx, rec)
		}
		return nil
	})
	return run, err
}

// LatestRun returns the latest saved run of a project.
func (s *Service) LatestRun(ctx context.Context, projectID uuid.UUID) (matching.Run, error) {
	q := s.st.Q()
	if _, err := q.ProjectRecordOf(ctx, projectID); err != nil {
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
	return s.st.Q().GetRun(ctx, id)
}

// ManualCandidates returns the solutions added by hand.
func (s *Service) ManualCandidates(ctx context.Context, projectID uuid.UUID) ([]domain.ManualCandidate, error) {
	q := s.st.Q()
	if _, err := q.ProjectRecordOf(ctx, projectID); err != nil {
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
	q := s.st.Q()
	if _, err := q.ProjectRecordOf(ctx, projectID); err != nil {
		return nil, err
	}
	if _, err := q.GetSolution(ctx, *in.SolutionID); err != nil {
		return nil, err
	}
	if err := q.AddManualCandidate(ctx, projectID, *in.SolutionID, trimPtr(in.Reason)); err != nil {
		return nil, err
	}
	return q.ManualCandidates(ctx, projectID)
}

// RemoveManualCandidate removes a hand-added solution.
func (s *Service) RemoveManualCandidate(ctx context.Context, projectID, solutionID uuid.UUID) error {
	return s.st.Q().RemoveManualCandidate(ctx, projectID, solutionID)
}

// SelectionInput chooses the configuration of the project.
type SelectionInput struct {
	SolutionID       *uuid.UUID `json:"solutionId"`
	AcquisitionModel *string    `json:"acquisitionModel"`
}

// PutSelection stores or clears the chosen configuration.
func (s *Service) PutSelection(ctx context.Context, id uuid.UUID, body []byte) (domain.Project, error) {
	var in SelectionInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Project{}, err
	}
	var v domain.Validator
	if in.AcquisitionModel != nil {
		v.OneOf("acquisitionModel", "Модель приобретения", *in.AcquisitionModel, []string{"purchase", "raas"})
	}
	if err := v.Err(); err != nil {
		return domain.Project{}, err
	}
	q := s.st.Q()
	rec, err := q.ProjectRecordOf(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	if in.SolutionID != nil {
		if _, err := q.GetSolution(ctx, *in.SolutionID); err != nil {
			return domain.Project{}, err
		}
	}
	rec.SelectedSolutionID, rec.SelectedModel = in.SolutionID, in.AcquisitionModel
	if in.SolutionID == nil {
		rec.SelectedModel = nil
	}
	if err := q.SaveProject(ctx, rec); err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
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
	p, err := q.GetProject(ctx, id)
	if err != nil {
		return EvaluationContext{}, err
	}
	rec, conds, err := s.projectConditions(ctx, q, id)
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
	projects, err := s.st.Q().ListProjects(ctx, store.ProjectFilter{})
	if err != nil {
		return d, err
	}
	d.Projects.Total = len(projects)
	for _, p := range projects {
		if p.Status == "result" {
			d.Projects.Calculated++
		}
	}
	d.RecentProjects = projects[:min(5, len(projects))]
	d.TopLocations = locs.Items[:min(5, len(locs.Items))]
	d.Versions, err = s.Versions(ctx)
	return d, err
}
