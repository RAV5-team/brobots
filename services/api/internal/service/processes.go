package service

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/formula"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// ProcessQuery filters the process library.
type ProcessQuery struct {
	Q             string
	WorkTypeID    *uuid.UUID
	FacilityType  string
	Category      string
	IsCustom      *bool
	IncludeHidden bool
}

// ListProcesses returns the process library.
func (s *Service) ListProcesses(ctx context.Context, f ProcessQuery) ([]domain.Process, error) {
	all, err := s.st.Q().ListProcesses(ctx, f.IncludeHidden)
	if err != nil {
		return nil, err
	}
	out := []domain.Process{}
	a := accessOf(ctx)
	for _, p := range all {
		if a.process(p, false) != nil {
			continue
		}
		if f.Q != "" && !containsFold(p.Name+" "+p.WorkType.Code+" "+p.WorkType.Name+" "+domain.Deref(p.Description), f.Q) {
			continue
		}
		if f.WorkTypeID != nil && p.WorkType.ID != *f.WorkTypeID {
			continue
		}
		if f.FacilityType != "" && !slices.Contains(p.FacilityTypes, f.FacilityType) && !slices.Contains(p.FacilityTypes, "custom") {
			continue
		}
		if f.Category != "" && domain.Deref(p.WorkCategoryCode) != f.Category {
			continue
		}
		if f.IsCustom != nil && p.IsCustom != *f.IsCustom {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

// GetProcess returns a process with its usage on locations.
func (s *Service) GetProcess(ctx context.Context, id uuid.UUID) (domain.ProcessDetail, error) {
	p, err := s.visibleProcess(ctx, s.st.Q(), id, false)
	if err != nil {
		return domain.ProcessDetail{}, err
	}
	tasks, err := s.tasks(ctx, store.TaskFilter{ProcessID: &id})
	if err != nil {
		return domain.ProcessDetail{}, err
	}
	d := domain.ProcessDetail{Process: p, Usage: []domain.ProcessUsage{}}
	a := accessOf(ctx)
	for _, t := range tasks {
		if a.task(t, false) != nil { // usage on locations of other users stays hidden
			continue
		}
		workers := []string{}
		for _, w := range t.Workers {
			workers = append(workers, fmt.Sprintf("%d · %s", w.Headcount, w.RoleName))
		}
		d.Usage = append(d.Usage, domain.ProcessUsage{
			TaskID: t.ID, TaskName: t.Name, LocationID: t.LocationID, LocationName: t.LocationName,
			FacilityTypeCode: t.FacilityTypeCode, DailyVolume: t.Params.DailyVolume,
			PeakIntensityPerHour: t.Derived.PeakIntensityPerHour, Workers: strings.Join(workers, ", "),
			LaborCostRubYear: t.Derived.BasePayrollRubYear, AutomationShare: t.Params.AutomationShare, Ready: t.Readiness.Ready,
		})
	}
	return d, nil
}

// RobotGroups is the pre-check of catalog robots against process defaults (process card).
type RobotGroups struct {
	Total            int                      `json:"total"`
	Passed           int                      `json:"passed"`
	Limited          int                      `json:"limited"`
	InsufficientData int                      `json:"insufficientData"`
	Items            []matching.Candidate     `json:"items"`
	Conditions       []matching.Condition     `json:"conditions"`
	Solutions        []domain.SolutionSummary `json:"solutions"`
}

// ProcessRobots screens the robots of the process class against the process defaults.
func (s *Service) ProcessRobots(ctx context.Context, id uuid.UUID) (RobotGroups, error) {
	p, err := s.visibleProcess(ctx, s.st.Q(), id, false)
	if err != nil {
		return RobotGroups{}, err
	}
	t := domain.Task{Params: p.Defaults, HandlingMethods: p.HandlingMethods, WorkType: p.WorkType}
	conds := matching.BuildConditions(t, nil)
	cands, sols, err := s.screen(ctx, p.WorkType, conds, nil)
	if err != nil {
		return RobotGroups{}, err
	}
	g := RobotGroups{Items: cands, Conditions: conds.List(), Solutions: sols}
	for _, c := range cands {
		g.Total++
		switch c.State {
		case matching.StatePassed:
			g.Passed++
		case matching.StateExcluded:
			g.Limited++
		default:
			g.InsufficientData++
		}
	}
	return g, nil
}

// ProcessInput is the editable part of a process.
type ProcessInput struct {
	Code                   *string                `json:"code"`
	Name                   string                 `json:"name"`
	Description            *string                `json:"description"`
	WorkTypeID             *uuid.UUID             `json:"workTypeId"`
	WorkCategoryCode       *string                `json:"workCategoryCode"`
	KpiUnit                *string                `json:"kpiUnit"`
	IsCustom               bool                   `json:"isCustom"`
	CreatedFromLocationID  *uuid.UUID             `json:"createdFromLocationId"`
	DefaultWorkerRole      *string                `json:"defaultWorkerRole"`
	DefaultWorkerTimeShare *float64               `json:"defaultWorkerTimeShare"`
	FacilityTypes          []string               `json:"facilityTypes"`
	HandlingMethods        []domain.HandlingShare `json:"handlingMethods"`
	Formulas               []domain.Formula       `json:"formulas"`
	Defaults               domain.TaskParams      `json:"defaults"`
	IsActive               *bool                  `json:"isActive,omitempty"`
}

func processInput(p domain.Process) ProcessInput {
	return ProcessInput{Code: &p.Code, Name: p.Name, Description: p.Description, WorkTypeID: &p.WorkType.ID,
		WorkCategoryCode: p.WorkCategoryCode, KpiUnit: p.KpiUnit, IsCustom: p.IsCustom,
		CreatedFromLocationID: p.CreatedFromLocationID, DefaultWorkerRole: p.DefaultWorkerRole,
		DefaultWorkerTimeShare: p.DefaultWorkerTimeShare, FacilityTypes: p.FacilityTypes,
		HandlingMethods: p.HandlingMethods, Formulas: p.Formulas, Defaults: p.Defaults.Copy(), IsActive: domain.Ptr(p.IsActive)}
}

// CreateProcess adds a process to the library.
func (s *Service) CreateProcess(ctx context.Context, body []byte) (domain.Process, error) {
	var in ProcessInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Process{}, err
	}
	return s.saveProcess(ctx, s.newProcess(ctx, &in), in, true)
}

// newProcess starts a process of the caller: the admin adds reference processes, a user own ones.
func (s *Service) newProcess(ctx context.Context, in *ProcessInput) domain.Process {
	owner := accessOf(ctx).newProcessOwner()
	if owner != nil {
		in.IsCustom = true
	}
	return domain.Process{ID: store.NewID(), IsActive: true, OwnerID: owner}
}

// visibleProcess loads a process the caller may read, or change when write is set.
func (s *Service) visibleProcess(ctx context.Context, q store.Q, id uuid.UUID, write bool) (domain.Process, error) {
	p, err := q.GetProcess(ctx, id)
	if err != nil {
		return p, err
	}
	return p, accessOf(ctx).process(p, write)
}

// PatchProcess updates a process; tasks already created keep their copied values.
func (s *Service) PatchProcess(ctx context.Context, id uuid.UUID, body []byte) (domain.Process, error) {
	p, err := s.visibleProcess(ctx, s.st.Q(), id, true)
	if err != nil {
		return p, err
	}
	in := processInput(p)
	if err := MergePatch(&in, body); err != nil {
		return p, err
	}
	if in.WorkTypeID == nil || *in.WorkTypeID != p.WorkType.ID {
		if p.LocationsCount > 0 {
			return p, domain.Conflict("process_in_use", "Класс операции процесса нельзя сменить: процесс уже используется на локациях")
		}
	}
	return s.saveProcess(ctx, p, in, false)
}

// HideProcess hides a process from the library.
func (s *Service) HideProcess(ctx context.Context, id uuid.UUID) error {
	_, err := s.PatchProcess(ctx, id, []byte(`{"isActive": false}`))
	return err
}

// DuplicateProcess copies a process with the «копия» prefix.
func (s *Service) DuplicateProcess(ctx context.Context, id uuid.UUID) (domain.Process, error) {
	p, err := s.visibleProcess(ctx, s.st.Q(), id, false)
	if err != nil {
		return p, err
	}
	in := processInput(p)
	in.Code = nil
	in.Name = "Копия · " + p.Name
	return s.saveProcess(ctx, s.newProcess(ctx, &in), in, true)
}

func (s *Service) saveProcess(ctx context.Context, p domain.Process, in ProcessInput, isNew bool) (domain.Process, error) {
	var v domain.Validator
	v.Required("name", "Название процесса", in.Name)
	if in.WorkTypeID == nil {
		v.Add("workTypeId", "required", "Не выбран класс операции", "Процесс без класса операции не сохраняется: по нему система находит роботов")
	}
	v.Merge(in.Defaults.Validate("defaults."))
	v.Range("defaultWorkerTimeShare", "Доля времени исполнителей", in.DefaultWorkerTimeShare, domain.Ptr(0.0), domain.Ptr(1.0), "")
	seen := map[string]bool{}
	for i, f := range in.Formulas {
		field := fmt.Sprintf("formulas[%d]", i)
		if _, ok := in.Defaults.Number(f.FieldCode); !ok {
			v.Add(field+".fieldCode", "invalid_value", fmt.Sprintf("Поле «%s» нельзя вычислять формулой", f.FieldCode), "Выберите числовое поле задачи")
		}
		if seen[f.FieldCode] {
			v.Add(field+".fieldCode", "duplicate", "Для поля уже задана формула", "Оставьте одну формулу на поле")
		}
		seen[f.FieldCode] = true
		if err := formula.Validate(f.Expression); err != nil {
			v.Add(field+".expression", "invalid_formula", err.Error(), "Пример: wh_inbound_pallets + wh_outbound_pallets")
		}
	}
	for i, h := range in.HandlingMethods {
		v.Range(fmt.Sprintf("handlingMethods[%d].laborReplacementRatio", i), "Коэффициент замещения", h.LaborReplacementRatio, domain.Ptr(0.0), domain.Ptr(1.0), "")
	}
	var saved domain.Process
	err := s.st.Tx(ctx, func(q store.Q) error {
		if err := s.checkDict(ctx, q, &v, store.WorkCategories, "workCategoryCode", "Вид работ", in.WorkCategoryCode); err != nil {
			return err
		}
		for i, f := range in.FacilityTypes {
			if err := s.checkDict(ctx, q, &v, store.FacilityTypes, fmt.Sprintf("facilityTypes[%d]", i), "Где применяется", &f); err != nil {
				return err
			}
		}
		for i, h := range in.HandlingMethods {
			if err := s.checkDict(ctx, q, &v, store.HandlingMethod, fmt.Sprintf("handlingMethods[%d].code", i), "Способ обработки", &h.Code); err != nil {
				return err
			}
		}
		var wt domain.WorkType
		if in.WorkTypeID != nil {
			var err error
			if wt, err = q.GetWorkType(ctx, *in.WorkTypeID); err != nil {
				v.Add("workTypeId", "not_found", "Класс операции не найден", "Выберите класс из справочника")
			}
		}
		if err := v.Err(); err != nil {
			return err
		}
		switch code := trimPtr(in.Code); {
		case code != nil:
			p.Code = *code
		case isNew:
			c, err := q.NextProcessCode(ctx)
			if err != nil {
				return err
			}
			p.Code = c
		}
		p.Name, p.Description, p.WorkType = strings.TrimSpace(in.Name), trimPtr(in.Description), wt.Ref()
		p.WorkCategoryCode, p.KpiUnit, p.IsCustom, p.CreatedFromLocationID = in.WorkCategoryCode, trimPtr(in.KpiUnit), in.IsCustom, in.CreatedFromLocationID
		p.DefaultWorkerRole, p.DefaultWorkerTimeShare = trimPtr(in.DefaultWorkerRole), in.DefaultWorkerTimeShare
		p.FacilityTypes, p.HandlingMethods, p.Formulas, p.Defaults = in.FacilityTypes, in.HandlingMethods, in.Formulas, in.Defaults
		if p.WorkCategoryCode == nil {
			p.WorkCategoryCode = wt.WorkCategoryCode
		}
		if in.IsActive != nil {
			p.IsActive = *in.IsActive
		}
		if err := q.SaveProcess(ctx, p); err != nil {
			if store.IsUniqueViolation(err, "process_code_key") {
				return domain.Conflict("process_code_taken", fmt.Sprintf("Код процесса «%s» уже занят", p.Code))
			}
			if store.IsForeignKeyViolation(err) {
				return &domain.ValidationError{Errors: []domain.FieldError{{Field: "createdFromLocationId", Code: "not_found", Message: "Локация не найдена"}}}
			}
			return err
		}
		if err := q.BumpVersion(ctx, "dictionaries"); err != nil {
			return err
		}
		var err error
		saved, err = q.GetProcess(ctx, p.ID)
		return err
	})
	return saved, err
}
