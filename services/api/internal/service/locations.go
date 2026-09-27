package service

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// FacilityParameters returns the parameter definitions of a facility type.
func (s *Service) FacilityParameters(ctx context.Context, facilityType string) ([]domain.ParameterDefinition, error) {
	q := s.st.Q()
	ok, err := q.DictionaryHas(ctx, store.FacilityTypes, facilityType)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.NotFound("facility_type", facilityType)
	}
	return q.ParameterDefinitions(ctx, facilityType)
}

// LocationQuery filters the locations list.
type LocationQuery struct {
	Q             string
	FacilityType  string
	Completeness  string
	Projects      string
	Sort          string
	Limit, Offset int
}

// locationContext holds everything needed to build location summaries.
type locationContext struct {
	defs     map[string][]domain.ParameterDefinition
	values   map[uuid.UUID][]domain.ParameterValue
	tasks    map[uuid.UUID][]domain.Task
	projects map[uuid.UUID][]domain.Project
}

func (s *Service) loadLocationContext(ctx context.Context, id *uuid.UUID) (locationContext, error) {
	q := s.st.Q()
	lc := locationContext{defs: map[string][]domain.ParameterDefinition{}, tasks: map[uuid.UUID][]domain.Task{},
		projects: map[uuid.UUID][]domain.Project{}}
	defs, err := q.ParameterDefinitions(ctx, "")
	if err != nil {
		return lc, err
	}
	for _, d := range defs {
		lc.defs[d.FacilityTypeCode] = append(lc.defs[d.FacilityTypeCode], d)
	}
	if lc.values, err = q.ParameterValues(ctx, id); err != nil {
		return lc, err
	}
	tasks, err := s.tasks(ctx, store.TaskFilter{LocationID: id})
	if err != nil {
		return lc, err
	}
	for _, t := range tasks {
		lc.tasks[t.LocationID] = append(lc.tasks[t.LocationID], t)
	}
	projects, err := q.ListProjects(ctx, store.ProjectFilter{LocationID: id})
	if err != nil {
		return lc, err
	}
	a := accessOf(ctx)
	for _, p := range projects {
		if a.sees(p.OwnerID, p.IsDemo) {
			lc.projects[p.LocationID] = append(lc.projects[p.LocationID], p)
		}
	}
	return lc, nil
}

func (lc locationContext) enrich(l *domain.Location) {
	defs := lc.defs[l.FacilityTypeCode]
	values := lc.values[l.ID]
	readiness, pct, assumptions := domain.ComputeReadiness(defs, values, l.StaffGroups)
	env := domain.ParamEnv(defs, values)
	get := func(role string) *float64 {
		if v, ok := env[role]; ok {
			return &v
		}
		return nil
	}
	sum := domain.LocationSummary{
		TotalAreaM2: get("total_area"), StaffTotal: get("staff_total"), ShiftsPerDay: get("shifts_per_day"),
		ShiftHours: get("shift_hours"), ParametersCompletenessPct: pct, AssumptionsCount: assumptions,
	}
	for _, t := range lc.tasks[l.ID] {
		sum.TasksCount++
		sum.LaborCostRubYear += domain.Deref(t.Derived.BasePayrollRubYear)
		for _, w := range t.Workers {
			sum.WorkersInTasks += float64(w.Headcount) * w.TimeShare
		}
	}
	for _, p := range lc.projects[l.ID] {
		sum.ProjectsCount++
		if p.Status == domain.ProjectSaved {
			sum.ProjectsCompleted++
		}
	}
	l.Summary = &sum
	l.Readiness = &readiness
}

// ListLocations returns location cards with summaries.
func (s *Service) ListLocations(ctx context.Context, f LocationQuery) (Page[domain.Location], error) {
	list, err := s.st.Q().ListLocations(ctx)
	if err != nil {
		return Page[domain.Location]{}, err
	}
	lc, err := s.loadLocationContext(ctx, nil)
	if err != nil {
		return Page[domain.Location]{}, err
	}
	out := []domain.Location{}
	a := accessOf(ctx)
	for i := range list {
		l := list[i]
		if a.location(l, false) != nil {
			continue
		}
		lc.enrich(&l)
		if f.Q != "" && !containsFold(l.Name+" "+l.City+" "+l.FacilityTypeCode+" "+domain.Deref(l.Address), f.Q) {
			continue
		}
		if f.FacilityType != "" && l.FacilityTypeCode != f.FacilityType {
			continue
		}
		switch f.Completeness {
		case "complete":
			if len(l.Readiness.Missing) > 0 {
				continue
			}
		case "has_assumptions":
			if l.Summary.AssumptionsCount == 0 {
				continue
			}
		case "has_missing":
			if len(l.Readiness.Missing) == 0 && l.Readiness.EmptyOptional == 0 {
				continue
			}
		}
		switch f.Projects {
		case "has_completed":
			if l.Summary.ProjectsCompleted == 0 {
				continue
			}
		case "drafts":
			if l.Summary.ProjectsCount == 0 || l.Summary.ProjectsCompleted > 0 {
				continue
			}
		case "none":
			if l.Summary.ProjectsCount > 0 {
				continue
			}
		}
		out = append(out, l)
	}
	slices.SortStableFunc(out, func(a, b domain.Location) int {
		switch f.Sort {
		case "name":
			return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
		case "completeness":
			return b.Summary.ParametersCompletenessPct - a.Summary.ParametersCompletenessPct
		case "projects":
			return b.Summary.ProjectsCount - a.Summary.ProjectsCount
		case "labor_cost":
			return compareFloat(b.Summary.LaborCostRubYear, a.Summary.LaborCostRubYear)
		}
		return b.UpdatedAt.Compare(a.UpdatedAt)
	})
	return paginate(out, f.Limit, f.Offset), nil
}

func compareFloat(a, b float64) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

// GetLocation returns a location with summary and readiness.
func (s *Service) GetLocation(ctx context.Context, id uuid.UUID) (domain.Location, error) {
	l, err := s.visibleLocation(ctx, s.st.Q(), id, false)
	if err != nil {
		return l, err
	}
	lc, err := s.loadLocationContext(ctx, &id)
	if err != nil {
		return l, err
	}
	lc.enrich(&l)
	return l, nil
}

// StaffGroupInput is a staff group sent by the client.
type StaffGroupInput struct {
	RoleName            string   `json:"roleName"`
	Headcount           int      `json:"headcount"`
	SalaryGrossMonthRub *float64 `json:"salaryGrossMonthRub"`
	Source              *string  `json:"source"`
}

// LocationInput is the editable part of a location.
type LocationInput struct {
	Name             string                  `json:"name"`
	FacilityTypeCode string                  `json:"facilityTypeCode"`
	City             string                  `json:"city"`
	Address          *string                 `json:"address"`
	CapexBudget      domain.Budget           `json:"capexBudget"`
	HorizonYears     *int                    `json:"horizonYears"`
	IsDraft          bool                    `json:"isDraft"`
	UpdatedBy        *string                 `json:"updatedBy"`
	FillDefaults     bool                    `json:"fillDefaults"`
	Parameters       []domain.ParameterInput `json:"parameters"`
	StaffGroups      []StaffGroupInput       `json:"staffGroups"`
}

// CreateLocation creates a location profile with parameters and staff groups.
func (s *Service) CreateLocation(ctx context.Context, body []byte) (domain.Location, error) {
	in := LocationInput{CapexBudget: domain.Budget{Currency: "RUB"}}
	if err := MergePatch(&in, body); err != nil {
		return domain.Location{}, err
	}
	l := domain.Location{ID: store.NewID(), OwnerID: accessOf(ctx).owner()}
	if err := s.saveLocation(ctx, &l, in, true); err != nil {
		return l, err
	}
	return s.GetLocation(ctx, l.ID)
}

// PatchLocation updates a location; parameters and staff groups in the body are upserted.
func (s *Service) PatchLocation(ctx context.Context, id uuid.UUID, body []byte) (domain.Location, error) {
	l, err := s.visibleLocation(ctx, s.st.Q(), id, true)
	if err != nil {
		return l, err
	}
	in := LocationInput{Name: l.Name, FacilityTypeCode: l.FacilityTypeCode, City: l.City, Address: l.Address,
		CapexBudget: l.CapexBudget, HorizonYears: l.HorizonYears, IsDraft: l.IsDraft, UpdatedBy: l.UpdatedBy}
	if err := MergePatch(&in, body); err != nil {
		return l, err
	}
	if in.FacilityTypeCode != l.FacilityTypeCode {
		tasks, err := s.st.Q().ListTasks(ctx, store.TaskFilter{LocationID: &id})
		if err != nil {
			return l, err
		}
		if len(tasks) > 0 {
			return l, domain.Conflict("facility_type_locked", "Тип объекта нельзя сменить: на локации уже есть задачи")
		}
	}
	if err := s.saveLocation(ctx, &l, in, false); err != nil {
		return l, err
	}
	return s.GetLocation(ctx, id)
}

// DeleteLocation hides a location and archives its tasks; projects keep their snapshots.
func (s *Service) DeleteLocation(ctx context.Context, id uuid.UUID) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if _, err := s.visibleLocation(ctx, q, id, true); err != nil {
			return err
		}
		return q.SoftDeleteLocation(ctx, id)
	})
}

// visibleLocation loads a location the caller may read, or change when write is set.
func (s *Service) visibleLocation(ctx context.Context, q store.Q, id uuid.UUID, write bool) (domain.Location, error) {
	l, err := q.GetLocation(ctx, id)
	if err != nil {
		return l, err
	}
	return l, accessOf(ctx).location(l, write)
}

func (s *Service) saveLocation(ctx context.Context, l *domain.Location, in LocationInput, isNew bool) error {
	var v domain.Validator
	v.Required("name", "Название", in.Name)
	v.Required("city", "Город", in.City)
	v.Required("facilityTypeCode", "Тип объекта", in.FacilityTypeCode)
	v.Range("capexBudget.amount", "Бюджет CAPEX", in.CapexBudget.Amount, domain.Ptr(0.0), nil, "₽")
	if in.HorizonYears != nil {
		v.Range("horizonYears", "Горизонт расчёта", domain.Ptr(float64(*in.HorizonYears)), domain.Ptr(1.0), domain.Ptr(30.0), "лет")
	}
	if c := in.CapexBudget.Currency; c != "" && len(c) != 3 {
		v.Add("capexBudget.currency", "invalid_value", "Валюта — трёхбуквенный код", "Например RUB")
	}
	return s.st.Tx(ctx, func(q store.Q) error {
		if err := s.checkDict(ctx, q, &v, store.FacilityTypes, "facilityTypeCode", "Тип объекта", &in.FacilityTypeCode); err != nil {
			return err
		}
		defs, err := q.ParameterDefinitions(ctx, in.FacilityTypeCode)
		if err != nil {
			return err
		}
		values := coerceParameters(defs, in.Parameters, "parameters", &v)
		groups := validateStaff(defs, in.StaffGroups, "staffGroups", &v)
		if err := v.Err(); err != nil {
			return err
		}
		l.Name, l.FacilityTypeCode, l.City, l.Address = strings.TrimSpace(in.Name), in.FacilityTypeCode, strings.TrimSpace(in.City), trimPtr(in.Address)
		l.CapexBudget, l.HorizonYears, l.IsDraft, l.UpdatedBy = in.CapexBudget, in.HorizonYears, in.IsDraft, trimPtr(in.UpdatedBy)
		if l.CapexBudget.Currency == "" {
			l.CapexBudget.Currency = "RUB"
		}
		if err := q.SaveLocation(ctx, *l); err != nil {
			return err
		}
		if isNew && in.FillDefaults {
			given := map[string]bool{}
			for _, pv := range values {
				given[pv.Code] = true
			}
			for _, d := range defs {
				if given[d.Code] || d.StaffRole != nil || d.BaseValue() == nil {
					continue
				}
				pv, _ := domain.CoerceParameter(d, domain.ParameterInput{Code: d.Code, Value: d.BaseValue(), Source: "default", IsAssumption: !d.IsConstant}, "")
				values = append(values, pv)
			}
			if in.StaffGroups == nil {
				groups = defaultStaffGroups(defs)
			}
		}
		for _, pv := range values {
			if err := q.SaveParameterValue(ctx, l.ID, pv); err != nil {
				return err
			}
		}
		if in.StaffGroups != nil || (isNew && in.FillDefaults) {
			if _, err := q.ReplaceStaffGroups(ctx, l.ID, groups); err != nil {
				return err
			}
		}
		return nil
	})
}

func coerceParameters(defs []domain.ParameterDefinition, in []domain.ParameterInput, prefix string, v *domain.Validator) []domain.ParameterValue {
	byCode := map[string]domain.ParameterDefinition{}
	for _, d := range defs {
		byCode[d.Code] = d
	}
	out := make([]domain.ParameterValue, 0, len(in))
	for i, p := range in {
		field := fmt.Sprintf("%s[%d]", prefix, i)
		d, ok := byCode[p.Code]
		if !ok {
			v.Add(field+".code", "unknown_parameter", fmt.Sprintf("Параметра «%s» нет у этого типа объекта", p.Code), "Коды параметров — GET /facility-types/{code}/parameters")
			continue
		}
		if d.StaffRole != nil {
			v.Add(field+".code", "staff_parameter", fmt.Sprintf("«%s» задаётся в группах персонала", d.Name), "Передайте значение в staffGroups")
			continue
		}
		if p.Source != "" && !slices.Contains(domain.Codes(domain.ValueSources), p.Source) {
			v.Add(field+".source", "invalid_value", "Неизвестный источник значения", "Допустимо: user, default, file, organizer, formula, assumption")
			continue
		}
		pv, fe := domain.CoerceParameter(d, p, field+".value")
		if fe != nil {
			v.Merge([]domain.FieldError{*fe})
			continue
		}
		out = append(out, pv)
	}
	return out
}

func validateStaff(defs []domain.ParameterDefinition, in []StaffGroupInput, prefix string, v *domain.Validator) []domain.StaffGroup {
	out := make([]domain.StaffGroup, 0, len(in))
	seen := map[string]bool{}
	for i, g := range in {
		field := fmt.Sprintf("%s[%d]", prefix, i)
		name := strings.TrimSpace(g.RoleName)
		if name == "" {
			v.Add(field+".roleName", "required", "Не указана группа (роль)", "Например: Операторы погрузчиков")
			continue
		}
		if seen[strings.ToLower(name)] {
			v.Add(field+".roleName", "duplicate", fmt.Sprintf("Группа «%s» указана дважды", name), "Оставьте одну строку")
		}
		seen[strings.ToLower(name)] = true
		if g.Headcount < 0 {
			v.Add(field+".headcount", "out_of_range", "Численность не может быть отрицательной", "Укажите число сотрудников")
		}
		for _, d := range defs {
			if d.StaffRole == nil || !strings.EqualFold(*d.StaffRole, name) {
				continue
			}
			switch domain.Deref(d.StaffAttr) {
			case "headcount":
				v.Range(field+".headcount", name+": численность", domain.Ptr(float64(g.Headcount)), d.MinValue, d.MaxValue, "чел.")
			case "salary":
				v.Range(field+".salaryGrossMonthRub", name+": оклад gross", g.SalaryGrossMonthRub, d.MinValue, d.MaxValue, "₽/мес.")
			}
		}
		if g.SalaryGrossMonthRub != nil && *g.SalaryGrossMonthRub <= 0 {
			v.Add(field+".salaryGrossMonthRub", "out_of_range", "Оклад должен быть больше нуля", "Укажите оклад gross в рублях в месяц")
		}
		out = append(out, domain.StaffGroup{RoleName: name, Headcount: g.Headcount, SalaryGrossMonthRub: g.SalaryGrossMonthRub, Source: g.Source})
	}
	return out
}

func defaultStaffGroups(defs []domain.ParameterDefinition) []domain.StaffGroup {
	var out []domain.StaffGroup
	idx := map[string]int{}
	for _, d := range defs {
		if d.StaffRole == nil {
			continue
		}
		i, ok := idx[*d.StaffRole]
		if !ok {
			out = append(out, domain.StaffGroup{RoleName: *d.StaffRole, Source: domain.Ptr("default")})
			i = len(out) - 1
			idx[*d.StaffRole] = i
		}
		switch domain.Deref(d.StaffAttr) {
		case "headcount":
			out[i].Headcount = int(domain.Deref(d.BaseValueNumber))
		case "salary":
			out[i].SalaryGrossMonthRub = d.BaseValueNumber
		}
	}
	return out
}

// LocationParameters returns the parameters tab grouped as in the dataset.
func (s *Service) LocationParameters(ctx context.Context, id uuid.UUID) (domain.LocationParameters, error) {
	q := s.st.Q()
	l, err := s.visibleLocation(ctx, q, id, false)
	if err != nil {
		return domain.LocationParameters{}, err
	}
	defs, err := q.ParameterDefinitions(ctx, l.FacilityTypeCode)
	if err != nil {
		return domain.LocationParameters{}, err
	}
	values, err := q.ParameterValues(ctx, &id)
	if err != nil {
		return domain.LocationParameters{}, err
	}
	byCode := map[string]domain.ParameterValue{}
	for _, v := range values[id] {
		byCode[v.Code] = v
	}
	_, pct, assumptions := domain.ComputeReadiness(defs, values[id], l.StaffGroups)
	out := domain.LocationParameters{LocationID: id, FacilityTypeCode: l.FacilityTypeCode, CompletenessPct: pct, AssumptionsCount: assumptions}
	groupIdx := map[string]int{}
	for _, d := range defs {
		gi, ok := groupIdx[d.GroupName]
		if !ok {
			out.Groups = append(out.Groups, domain.ParameterGroup{Name: d.GroupName})
			gi = len(out.Groups) - 1
			groupIdx[d.GroupName] = gi
		}
		item := domain.ParameterItem{Definition: d}
		if v, ok := byCode[d.Code]; ok {
			item.Value = &v
		}
		out.Groups[gi].Items = append(out.Groups[gi].Items, item)
	}
	return out, nil
}

// PutLocationParameters upserts parameter values; null clears a value.
func (s *Service) PutLocationParameters(ctx context.Context, id uuid.UUID, items []domain.ParameterInput) (domain.LocationParameters, error) {
	var v domain.Validator
	err := s.st.Tx(ctx, func(q store.Q) error {
		l, err := s.visibleLocation(ctx, q, id, true)
		if err != nil {
			return err
		}
		defs, err := q.ParameterDefinitions(ctx, l.FacilityTypeCode)
		if err != nil {
			return err
		}
		values := coerceParameters(defs, items, "items", &v)
		if err := v.Err(); err != nil {
			return err
		}
		for _, pv := range values {
			if err := q.SaveParameterValue(ctx, id, pv); err != nil {
				return err
			}
		}
		return q.TouchLocation(ctx, id)
	})
	if err != nil {
		return domain.LocationParameters{}, err
	}
	return s.LocationParameters(ctx, id)
}

// PutStaffGroups replaces the staff groups of a location.
func (s *Service) PutStaffGroups(ctx context.Context, id uuid.UUID, items []StaffGroupInput) ([]domain.StaffGroup, error) {
	var v domain.Validator
	var out []domain.StaffGroup
	err := s.st.Tx(ctx, func(q store.Q) error {
		l, err := s.visibleLocation(ctx, q, id, true)
		if err != nil {
			return err
		}
		defs, err := q.ParameterDefinitions(ctx, l.FacilityTypeCode)
		if err != nil {
			return err
		}
		groups := validateStaff(defs, items, "items", &v)
		if err := v.Err(); err != nil {
			return err
		}
		if out, err = q.ReplaceStaffGroups(ctx, id, groups); err != nil {
			return err
		}
		return q.TouchLocation(ctx, id)
	})
	if out == nil {
		out = []domain.StaffGroup{}
	}
	return out, err
}

// LocationTemplate is a typical object built from an organizer dataset.
type LocationTemplate struct {
	LocationID       uuid.UUID `json:"locationId"`
	FacilityTypeCode string    `json:"facilityTypeCode"`
	Name             string    `json:"name"`
	City             string    `json:"city"`
	TasksCount       int       `json:"tasksCount"`
	ParametersCount  int       `json:"parametersCount"`
}

// LocationTemplates lists demo locations that can be copied as a typical object.
func (s *Service) LocationTemplates(ctx context.Context) ([]LocationTemplate, error) {
	list, err := s.st.Q().ListLocations(ctx)
	if err != nil {
		return nil, err
	}
	lc, err := s.loadLocationContext(ctx, nil)
	if err != nil {
		return nil, err
	}
	out := []LocationTemplate{}
	for _, l := range list {
		if !l.IsDemo {
			continue
		}
		out = append(out, LocationTemplate{LocationID: l.ID, FacilityTypeCode: l.FacilityTypeCode, Name: l.Name, City: l.City,
			TasksCount: len(lc.tasks[l.ID]), ParametersCount: len(lc.values[l.ID])})
	}
	slices.SortFunc(out, func(a, b LocationTemplate) int { return strings.Compare(a.FacilityTypeCode, b.FacilityTypeCode) })
	return out, nil
}

// FromTemplateInput selects the template and the new name.
type FromTemplateInput struct {
	TemplateLocationID uuid.UUID `json:"templateLocationId"`
	Name               *string   `json:"name"`
	City               *string   `json:"city"`
}

// CreateLocationFromTemplate copies a demo location with parameters, staff groups and tasks.
func (s *Service) CreateLocationFromTemplate(ctx context.Context, body []byte) (domain.Location, error) {
	var in FromTemplateInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Location{}, err
	}
	q := s.st.Q()
	src, err := s.visibleLocation(ctx, q, in.TemplateLocationID, false)
	if err != nil {
		return src, err
	}
	values, err := q.ParameterValues(ctx, &src.ID)
	if err != nil {
		return src, err
	}
	tasks, err := q.ListTasks(ctx, store.TaskFilter{LocationID: &src.ID})
	if err != nil {
		return src, err
	}
	dst := src
	dst.ID, dst.IsDemo, dst.IsDraft, dst.OwnerID = store.NewID(), false, false, accessOf(ctx).owner()
	dst.Name = src.Name + " · копия"
	if n := trimPtr(in.Name); n != nil {
		dst.Name = *n
	}
	if c := trimPtr(in.City); c != nil {
		dst.City = *c
	}
	err = s.st.Tx(ctx, func(q store.Q) error {
		if err := q.SaveLocation(ctx, dst); err != nil {
			return err
		}
		for _, v := range values[src.ID] {
			if err := q.SaveParameterValue(ctx, dst.ID, v); err != nil {
				return err
			}
		}
		groups := make([]domain.StaffGroup, len(src.StaffGroups))
		for i, g := range src.StaffGroups {
			g.ID = uuid.Nil
			groups[i] = g
		}
		newGroups, err := q.ReplaceStaffGroups(ctx, dst.ID, groups)
		if err != nil {
			return err
		}
		byRole := map[string]uuid.UUID{}
		for _, g := range newGroups {
			byRole[g.RoleName] = g.ID
		}
		for _, t := range tasks {
			t.ID, t.LocationID = store.NewID(), dst.ID
			for i := range t.Workers {
				t.Workers[i].StaffGroupID = byRole[t.Workers[i].RoleName]
			}
			if err := q.SaveTask(ctx, t); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return dst, err
	}
	return s.GetLocation(ctx, dst.ID)
}
