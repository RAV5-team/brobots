package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/formula"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// tasks loads tasks and computes derived values, readiness and robot counts.
func (s *Service) tasks(ctx context.Context, f store.TaskFilter) ([]domain.Task, error) {
	q := s.st.Q()
	list, err := q.ListTasks(ctx, f)
	if err != nil {
		return nil, err
	}
	if err := s.enrichTasks(ctx, list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *Service) enrichTasks(ctx context.Context, list []domain.Task) error {
	if len(list) == 0 {
		return nil
	}
	q := s.st.Q()
	wts, err := q.ListWorkTypes(ctx, true)
	if err != nil {
		return err
	}
	robots := map[uuid.UUID]int{}
	for _, w := range wts {
		robots[w.ID] = w.RobotsCount
	}
	defs, err := q.ParameterDefinitions(ctx, "")
	if err != nil {
		return err
	}
	var locID *uuid.UUID
	if allSameLocation(list) {
		locID = &list[0].LocationID
	}
	values, err := q.ParameterValues(ctx, locID)
	if err != nil {
		return err
	}
	for i := range list {
		t := &list[i]
		env := domain.ParamEnv(defs, values[t.LocationID])
		coef := domain.DefaultPayrollTaxCoef
		if v, ok := env["payroll_tax_coef"]; ok {
			coef = v
		}
		t.ComputeDerived(coef)
		t.ComputeReadiness()
		t.RobotsCount = robots[t.WorkType.ID]
	}
	return nil
}

func allSameLocation(list []domain.Task) bool {
	for _, t := range list {
		if t.LocationID != list[0].LocationID {
			return false
		}
	}
	return true
}

// ListLocationTasks returns the tasks of a location.
func (s *Service) ListLocationTasks(ctx context.Context, locationID uuid.UUID) ([]domain.Task, error) {
	if _, err := s.st.Q().GetLocation(ctx, locationID); err != nil {
		return nil, err
	}
	return s.tasks(ctx, store.TaskFilter{LocationID: &locationID})
}

// GetTask returns a task with derived values.
func (s *Service) GetTask(ctx context.Context, id uuid.UUID) (domain.Task, error) {
	t, err := s.st.Q().GetTask(ctx, id)
	if err != nil {
		return t, err
	}
	list := []domain.Task{t}
	if err := s.enrichTasks(ctx, list); err != nil {
		return t, err
	}
	return list[0], nil
}

// WorkerInput assigns a location staff group to a task.
type WorkerInput struct {
	StaffGroupID *uuid.UUID `json:"staffGroupId"`
	RoleName     *string    `json:"roleName"`
	TimeShare    float64    `json:"timeShare"`
}

// TaskCreateInput creates a task from a process template.
type TaskCreateInput struct {
	ProcessID       *uuid.UUID                 `json:"processId"`
	Name            *string                    `json:"name"`
	Params          map[string]json.RawMessage `json:"params"`
	HandlingMethods *[]domain.HandlingShare    `json:"handlingMethods"`
	Workers         *[]WorkerInput             `json:"workers"`
}

// TaskPatchInput updates a task. Params keys set values (null clears);
// assumeDefaults recomputes fields from the process like the «Не знаю» button.
type TaskPatchInput struct {
	Name            *string                    `json:"name"`
	Params          map[string]json.RawMessage `json:"params"`
	HandlingMethods *[]domain.HandlingShare    `json:"handlingMethods"`
	Workers         *[]WorkerInput             `json:"workers"`
	AssumeDefaults  []string                   `json:"assumeDefaults"`
}

// taskEnv is the data needed to resolve process formulas on a location.
type taskEnv struct {
	location domain.Location
	vars     map[string]float64
}

func (s *Service) taskEnvOf(ctx context.Context, q store.Q, locationID uuid.UUID) (taskEnv, error) {
	l, err := q.GetLocation(ctx, locationID)
	if err != nil {
		return taskEnv{}, err
	}
	defs, err := q.ParameterDefinitions(ctx, l.FacilityTypeCode)
	if err != nil {
		return taskEnv{}, err
	}
	values, err := q.ParameterValues(ctx, &locationID)
	if err != nil {
		return taskEnv{}, err
	}
	return taskEnv{location: l, vars: domain.ParamEnv(defs, values[locationID])}, nil
}

// resolveField computes one field from the process: formula first, then the literal default.
func resolveField(p domain.Process, env taskEnv, code string, params *domain.TaskParams) (domain.Provenance, bool) {
	for _, f := range p.Formulas {
		if f.FieldCode != code {
			continue
		}
		val, err := formula.Eval(f.Expression, env.vars)
		if err == nil {
			slot, ok := params.Number(code)
			if !ok {
				break
			}
			*slot = domain.Ptr(math.Round(val*10000) / 10000)
			src := "formula"
			if formula.IsReference(f.Expression) {
				src = "location"
			}
			expr := f.Expression
			return domain.Provenance{Source: src, Expression: &expr, Note: f.Description}, true
		}
		var miss *formula.MissingError
		if errors.As(err, &miss) {
			note := "На локации нет значений: " + strings.Join(miss.Missing, ", ") + " — взято значение процесса"
			if prov, ok := copyDefault(p, code, params); ok {
				prov.Note = &note
				return prov, true
			}
			return domain.Provenance{}, false
		}
		break
	}
	return copyDefault(p, code, params)
}

// copyDefault copies the literal process default of a field.
func copyDefault(p domain.Process, code string, params *domain.TaskParams) (domain.Provenance, bool) {
	defTargets := p.Defaults.Targets()
	dstTargets := params.Targets()
	for i, f := range domain.TaskParamFields {
		if f.Code != code {
			continue
		}
		if !p.Defaults.IsSet(code) {
			return domain.Provenance{}, false
		}
		switch src := defTargets[i].(type) {
		case **float64:
			*dstTargets[i].(**float64) = domain.Ptr(**src)
		case **string:
			*dstTargets[i].(**string) = domain.Ptr(**src)
		case **bool:
			*dstTargets[i].(**bool) = domain.Ptr(**src)
		case *[]string:
			*dstTargets[i].(*[]string) = append([]string(nil), *src...)
		}
		return domain.Provenance{Source: "process_default", IsAssumption: true}, true
	}
	return domain.Provenance{}, false
}

// resolveWorkers maps worker inputs to location staff groups.
func resolveWorkers(in []WorkerInput, groups []domain.StaffGroup, v *domain.Validator) []domain.TaskWorker {
	out := []domain.TaskWorker{}
	seen := map[uuid.UUID]bool{}
	for i, w := range in {
		field := fmt.Sprintf("workers[%d]", i)
		var g *domain.StaffGroup
		for j := range groups {
			if (w.StaffGroupID != nil && groups[j].ID == *w.StaffGroupID) ||
				(w.StaffGroupID == nil && w.RoleName != nil && strings.EqualFold(groups[j].RoleName, strings.TrimSpace(*w.RoleName))) {
				g = &groups[j]
			}
		}
		if g == nil {
			v.Add(field, "not_found", "Группа персонала не найдена на локации", "Добавьте группу в профиль локации или выберите существующую")
			continue
		}
		if w.TimeShare < 0 || w.TimeShare > 1 {
			v.Add(field+".timeShare", "out_of_range", "Доля времени — от 0 до 1", "Например 1 — вся смена на задаче, 0,5 — половина")
			continue
		}
		if seen[g.ID] {
			v.Add(field, "duplicate", fmt.Sprintf("Группа «%s» указана дважды", g.RoleName), "Оставьте одну строку")
			continue
		}
		seen[g.ID] = true
		out = append(out, domain.TaskWorker{StaffGroupID: g.ID, RoleName: g.RoleName, Headcount: g.Headcount,
			SalaryGrossMonthRub: g.SalaryGrossMonthRub, TimeShare: w.TimeShare})
	}
	return out
}

func (s *Service) validateHandling(ctx context.Context, q store.Q, hs []domain.HandlingShare, v *domain.Validator) error {
	seen := map[string]bool{}
	for i, h := range hs {
		field := fmt.Sprintf("handlingMethods[%d]", i)
		if err := s.checkDict(ctx, q, v, store.HandlingMethod, field+".code", "Способ обработки груза", &h.Code); err != nil {
			return err
		}
		if seen[h.Code] {
			v.Add(field+".code", "duplicate", "Способ указан дважды", "Оставьте одну строку")
		}
		seen[h.Code] = true
		v.Range(field+".laborReplacementRatio", "Коэффициент замещения труда", h.LaborReplacementRatio, domain.Ptr(0.0), domain.Ptr(1.0), "")
	}
	return nil
}

// CreateTask instantiates a process on a location. With dryRun nothing is saved.
func (s *Service) CreateTask(ctx context.Context, locationID uuid.UUID, body []byte, dryRun bool) (domain.Task, error) {
	var in TaskCreateInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Task{}, err
	}
	var v domain.Validator
	if in.ProcessID == nil {
		v.Add("processId", "required", "Не выбран процесс", "Выберите процесс из справочника")
		return domain.Task{}, v.Err()
	}
	var t domain.Task
	err := s.st.Tx(ctx, func(q store.Q) error {
		p, err := q.GetProcess(ctx, *in.ProcessID)
		if err != nil {
			var nf *domain.NotFoundError
			if errors.As(err, &nf) {
				v.Add("processId", "not_found", "Процесс не найден", "Выберите процесс из справочника")
				return v.Err()
			}
			return err
		}
		env, err := s.taskEnvOf(ctx, q, locationID)
		if err != nil {
			return err
		}
		t = domain.Task{ID: store.NewID(), LocationID: locationID, LocationName: env.location.Name,
			FacilityTypeCode: env.location.FacilityTypeCode, ProcessID: p.ID, ProcessName: p.Name, KpiUnit: p.KpiUnit,
			WorkType: p.WorkType, Name: p.Name, Provenance: map[string]domain.Provenance{},
			HandlingMethods: append([]domain.HandlingShare{}, p.HandlingMethods...)}
		if n := trimPtr(in.Name); n != nil {
			t.Name = *n
		}
		for _, f := range domain.TaskParamFields {
			if prov, ok := resolveField(p, env, f.Code, &t.Params); ok {
				t.Provenance[f.Code] = prov
			}
		}
		changed, errs := t.Params.ApplyPatch(in.Params, "params.")
		v.Merge(errs)
		for k := range in.Params {
			if _, ok := domain.TaskParamField(k); !ok {
				v.Add("params."+k, "unknown_field", fmt.Sprintf("Поле «%s» не поддерживается", k), "Коды полей — в описании TaskParams")
			}
		}
		for _, c := range changed {
			t.Provenance[c] = domain.Provenance{Source: "user"}
		}
		v.Merge(t.Params.Validate("params."))
		if in.HandlingMethods != nil {
			t.HandlingMethods = *in.HandlingMethods
		}
		if err := s.validateHandling(ctx, q, t.HandlingMethods, &v); err != nil {
			return err
		}
		switch {
		case in.Workers != nil:
			t.Workers = resolveWorkers(*in.Workers, env.location.StaffGroups, &v)
		case p.DefaultWorkerRole != nil:
			share := 1.0
			if p.DefaultWorkerTimeShare != nil {
				share = *p.DefaultWorkerTimeShare
			}
			var dv domain.Validator
			t.Workers = resolveWorkers([]WorkerInput{{RoleName: p.DefaultWorkerRole, TimeShare: share}}, env.location.StaffGroups, &dv)
		default:
			t.Workers = []domain.TaskWorker{}
		}
		if err := v.Err(); err != nil {
			return err
		}
		if dryRun {
			return nil
		}
		if err := q.SaveTask(ctx, t); err != nil {
			if store.IsUniqueViolation(err, "task_location_process_uq") {
				return domain.Conflict("task_exists", fmt.Sprintf("Процесс «%s» уже есть на этой локации", p.Name))
			}
			return err
		}
		return q.TouchLocation(ctx, locationID)
	})
	if err != nil {
		return t, err
	}
	if dryRun {
		list := []domain.Task{t}
		err := s.enrichTasks(ctx, list)
		return list[0], err
	}
	return s.GetTask(ctx, t.ID)
}

// PatchTask updates task values and records their provenance.
func (s *Service) PatchTask(ctx context.Context, id uuid.UUID, body []byte) (domain.Task, error) {
	var in TaskPatchInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Task{}, err
	}
	var v domain.Validator
	err := s.st.Tx(ctx, func(q store.Q) error {
		t, err := q.GetTask(ctx, id)
		if err != nil {
			return err
		}
		if t.ArchivedAt != nil {
			return domain.Conflict("task_archived", "Задача удалена с локации и не редактируется")
		}
		if n := in.Name; n != nil {
			if strings.TrimSpace(*n) == "" {
				v.Add("name", "required", "Поле «Название» не заполнено", "Заполните поле")
			}
			t.Name = strings.TrimSpace(*n)
		}
		changed, errs := t.Params.ApplyPatch(in.Params, "params.")
		v.Merge(errs)
		for k := range in.Params {
			if _, ok := domain.TaskParamField(k); !ok {
				v.Add("params."+k, "unknown_field", fmt.Sprintf("Поле «%s» не поддерживается", k), "Коды полей — в описании TaskParams")
			}
		}
		for _, c := range changed {
			t.Provenance[c] = domain.Provenance{Source: "user"}
		}
		if len(in.AssumeDefaults) > 0 {
			p, err := q.GetProcess(ctx, t.ProcessID)
			if err != nil {
				return err
			}
			env, err := s.taskEnvOf(ctx, q, t.LocationID)
			if err != nil {
				return err
			}
			for _, code := range in.AssumeDefaults {
				if _, ok := domain.TaskParamField(code); !ok {
					v.Add("assumeDefaults", "unknown_field", fmt.Sprintf("Поле «%s» не поддерживается", code), "Коды полей — в описании TaskParams")
					continue
				}
				prov, ok := resolveField(p, env, code, &t.Params)
				if !ok {
					v.Add("assumeDefaults", "no_default", fmt.Sprintf("У процесса нет значения по умолчанию для «%s»", code), "Введите значение вручную")
					continue
				}
				prov.IsAssumption = true
				t.Provenance[code] = prov
			}
		}
		v.Merge(t.Params.Validate("params."))
		if in.HandlingMethods != nil {
			t.HandlingMethods = *in.HandlingMethods
			if err := s.validateHandling(ctx, q, t.HandlingMethods, &v); err != nil {
				return err
			}
		}
		if in.Workers != nil {
			l, err := q.GetLocation(ctx, t.LocationID)
			if err != nil {
				return err
			}
			t.Workers = resolveWorkers(*in.Workers, l.StaffGroups, &v)
		}
		if err := v.Err(); err != nil {
			return err
		}
		return q.SaveTask(ctx, t)
	})
	if err != nil {
		return domain.Task{}, err
	}
	return s.GetTask(ctx, id)
}

// DeleteTask removes a task from its location; a task used by projects is archived instead.
func (s *Service) DeleteTask(ctx context.Context, id uuid.UUID) (archived bool, err error) {
	err = s.st.Tx(ctx, func(q store.Q) error {
		t, err := q.GetTask(ctx, id)
		if err != nil {
			return err
		}
		n, err := q.TaskProjectsCount(ctx, id)
		if err != nil {
			return err
		}
		if n > 0 {
			archived = true
			err = q.ArchiveTask(ctx, id)
		} else {
			err = q.DeleteTask(ctx, id)
		}
		if err != nil {
			return err
		}
		return q.TouchLocation(ctx, t.LocationID)
	})
	return archived, err
}

// MatchPreview screens the catalog against the live task without saving a run.
func (s *Service) MatchPreview(ctx context.Context, id uuid.UUID) (matching.Run, error) {
	t, err := s.GetTask(ctx, id)
	if err != nil {
		return matching.Run{}, err
	}
	conds := matching.BuildConditions(t, nil)
	cands, _, err := s.screen(ctx, t.WorkType, conds, nil)
	if err != nil {
		return matching.Run{}, err
	}
	version, err := s.st.Q().VersionOf(ctx, "catalog")
	if err != nil {
		return matching.Run{}, err
	}
	return matching.Run{TaskID: t.ID, WorkType: t.WorkType, CatalogVersion: version, RulesetVersion: matching.RulesetVersion,
		Conditions: conds.List(), Counts: matching.Count(cands), Candidates: cands}, nil
}

// screen evaluates the robots of a class and the manual candidates.
func (s *Service) screen(ctx context.Context, wt domain.WorkTypeRef, conds matching.Conditions, manual []uuid.UUID) ([]matching.Candidate, []domain.SolutionSummary, error) {
	q := s.st.Q()
	robots, err := q.ListSolutions(ctx, store.SolutionFilter{Kind: "robot"})
	if err != nil {
		return nil, nil, err
	}
	cands := []matching.Candidate{}
	sols := []domain.SolutionSummary{}
	seen := map[uuid.UUID]bool{}
	for i := range robots {
		sol := &robots[i]
		c := sol.ActiveCapability(wt.ID)
		if c == nil {
			continue
		}
		seen[sol.ID] = true
		cands = append(cands, matching.NewCandidate(conds, wt, matching.Robot{Solution: sol, Capability: c}, offerOf(sol)))
		sols = append(sols, sol.Summary())
	}
	var extra []uuid.UUID
	for _, id := range manual {
		if !seen[id] {
			extra = append(extra, id)
		}
	}
	if len(extra) > 0 {
		list, err := q.ListSolutions(ctx, store.SolutionFilter{IDs: extra, IncludeHidden: true})
		if err != nil {
			return nil, nil, err
		}
		for i := range list {
			sol := &list[i]
			cands = append(cands, matching.NewCandidate(conds, wt, matching.Robot{Solution: sol, Capability: sol.ActiveCapability(wt.ID), IsManual: true}, offerOf(sol)))
			sols = append(sols, sol.Summary())
		}
	}
	matching.Sort(cands)
	return cands, sols, nil
}

func offerOf(s *domain.Solution) *uuid.UUID {
	if s.Price == nil {
		return nil
	}
	return s.Price.OfferID
}
