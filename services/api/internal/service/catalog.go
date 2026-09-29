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

// WorkTypeInput is the editable part of an operation class.
type WorkTypeInput struct {
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	UnitLabel        string  `json:"unitLabel"`
	Action           *string `json:"action"`
	HandledObject    *string `json:"handledObject"`
	TypicalCarriers  *string `json:"typicalCarriers"`
	ExampleProcesses *string `json:"exampleProcesses"`
	WorkCategoryCode *string `json:"workCategoryCode"`
	IsActive         *bool   `json:"isActive,omitempty"`
}

func workTypeInput(w domain.WorkType) WorkTypeInput {
	return WorkTypeInput{Name: w.Name, Description: w.Description, UnitLabel: w.UnitLabel, Action: w.Action,
		HandledObject: w.HandledObject, TypicalCarriers: w.TypicalCarriers, ExampleProcesses: w.ExampleProcesses,
		WorkCategoryCode: w.WorkCategoryCode, IsActive: domain.Ptr(w.IsActive)}
}

// ListWorkTypes returns operation classes with robot and process counts; hidden ones only to the admin.
func (s *Service) ListWorkTypes(ctx context.Context, includeHidden bool) ([]domain.WorkType, error) {
	return s.st.Q().ListWorkTypes(ctx, includeHidden && accessOf(ctx).seesHidden())
}

// GetWorkType returns one operation class; a hidden one is not found for anyone but the admin.
func (s *Service) GetWorkType(ctx context.Context, id uuid.UUID) (domain.WorkType, error) {
	w, err := s.st.Q().GetWorkType(ctx, id)
	if err == nil && !w.IsActive && !accessOf(ctx).seesHidden() {
		return domain.WorkType{}, domain.NotFound("work_type", id.String())
	}
	return w, err
}

// CreateWorkType creates an operation class with the next OP code.
func (s *Service) CreateWorkType(ctx context.Context, body []byte) (domain.WorkType, error) {
	var in WorkTypeInput
	if err := MergePatch(&in, body); err != nil {
		return domain.WorkType{}, err
	}
	w := domain.WorkType{ID: store.NewID(), IsActive: true}
	return s.saveWorkType(ctx, w, in, true)
}

// PatchWorkType updates an operation class.
func (s *Service) PatchWorkType(ctx context.Context, id uuid.UUID, body []byte) (domain.WorkType, error) {
	w, err := s.st.Q().GetWorkType(ctx, id)
	if err != nil {
		return w, err
	}
	in := workTypeInput(w)
	if err := MergePatch(&in, body); err != nil {
		return w, err
	}
	return s.saveWorkType(ctx, w, in, false)
}

// HideWorkType deactivates an operation class; links from robots and processes stay.
func (s *Service) HideWorkType(ctx context.Context, id uuid.UUID) error {
	_, err := s.PatchWorkType(ctx, id, []byte(`{"isActive": false}`))
	return err
}

func (s *Service) saveWorkType(ctx context.Context, w domain.WorkType, in WorkTypeInput, isNew bool) (domain.WorkType, error) {
	var v domain.Validator
	v.Required("name", "Название", in.Name)
	v.Required("description", "Что делает процесс", domain.Deref(in.Description))
	v.Required("unitLabel", "Единица измерения", in.UnitLabel)
	if (in.Action == nil) != (in.HandledObject == nil) {
		v.Add("action", "pair_required", "Действие и предмет задаются парой", "Заполните оба поля или оставьте оба пустыми")
	}
	err := s.st.Tx(ctx, func(q store.Q) error {
		if err := s.checkDict(ctx, q, &v, store.WorkCategories, "workCategoryCode", "Вид работ", in.WorkCategoryCode); err != nil {
			return err
		}
		if err := v.Err(); err != nil {
			return err
		}
		if isNew {
			code, err := q.NextWorkTypeCode(ctx)
			if err != nil {
				return err
			}
			w.Code = code
		}
		w.Name, w.Description, w.UnitLabel = strings.TrimSpace(in.Name), trimPtr(in.Description), strings.TrimSpace(in.UnitLabel)
		w.Action, w.HandledObject = trimPtr(in.Action), trimPtr(in.HandledObject)
		w.TypicalCarriers, w.ExampleProcesses, w.WorkCategoryCode = trimPtr(in.TypicalCarriers), trimPtr(in.ExampleProcesses), in.WorkCategoryCode
		if in.IsActive != nil {
			w.IsActive = *in.IsActive
		}
		if err := q.SaveWorkType(ctx, w); err != nil {
			if store.IsUniqueViolation(err, "work_type_action_object_uq") {
				return domain.Conflict("work_type_duplicate", "Такая пара «действие + предмет» уже есть — завести вторую нельзя")
			}
			return err
		}
		return q.BumpVersion(ctx, "dictionaries")
	})
	if err != nil {
		return w, err
	}
	return s.st.Q().GetWorkType(ctx, w.ID)
}

// DataSourceInput is the editable part of a data source.
type DataSourceInput struct {
	Name            string       `json:"name"`
	SourceType      string       `json:"sourceType"`
	Origin          string       `json:"origin"`
	LocatorKind     *string      `json:"locatorKind"`
	URL             *string      `json:"url"`
	FileName        *string      `json:"fileName"`
	DataStatus      string       `json:"dataStatus"`
	Provides        *string      `json:"provides"`
	ActualizedOn    *domain.Date `json:"actualizedOn"`
	RefreshSchedule string       `json:"refreshSchedule"`
	Responsible     *string      `json:"responsible"`
}

// ListSources returns the data sources.
func (s *Service) ListSources(ctx context.Context) ([]domain.DataSource, error) {
	return s.st.Q().ListSources(ctx)
}

// GetSource returns one data source.
func (s *Service) GetSource(ctx context.Context, id uuid.UUID) (domain.DataSource, error) {
	return s.st.Q().GetSource(ctx, id)
}

// CreateSource registers a data source.
func (s *Service) CreateSource(ctx context.Context, body []byte) (domain.DataSource, error) {
	in := DataSourceInput{RefreshSchedule: "manual", Origin: "open"}
	if err := MergePatch(&in, body); err != nil {
		return domain.DataSource{}, err
	}
	return s.saveSource(ctx, domain.DataSource{ID: store.NewID()}, in)
}

// PatchSource updates a data source.
func (s *Service) PatchSource(ctx context.Context, id uuid.UUID, body []byte) (domain.DataSource, error) {
	src, err := s.st.Q().GetSource(ctx, id)
	if err != nil {
		return src, err
	}
	in := DataSourceInput{Name: src.Name, SourceType: src.SourceType, Origin: src.Origin, LocatorKind: src.LocatorKind,
		URL: src.URL, FileName: src.FileName, DataStatus: src.DataStatus, Provides: src.Provides,
		ActualizedOn: &src.ActualizedOn, RefreshSchedule: src.RefreshSchedule, Responsible: src.Responsible}
	if err := MergePatch(&in, body); err != nil {
		return src, err
	}
	return s.saveSource(ctx, src, in)
}

// DeleteSource removes a data source.
func (s *Service) DeleteSource(ctx context.Context, id uuid.UUID) error {
	return s.st.Q().DeleteSource(ctx, id)
}

func (s *Service) saveSource(ctx context.Context, src domain.DataSource, in DataSourceInput) (domain.DataSource, error) {
	var v domain.Validator
	v.Required("name", "Название", in.Name)
	v.OneOf("sourceType", "Тип", in.SourceType, domain.Codes(domain.SourceTypes))
	v.OneOf("origin", "Происхождение", in.Origin, domain.Codes(domain.SourceOrigins))
	v.OneOf("dataStatus", "Статус данных", in.DataStatus, domain.Codes(domain.DataStatuses))
	v.OneOf("refreshSchedule", "Автообновление", in.RefreshSchedule, domain.Codes(domain.RefreshSchedules))
	if in.ActualizedOn == nil {
		v.Add("actualizedOn", "required", "Поле «Дата актуализации» не заполнено", "Укажите дату в формате ГГГГ-ММ-ДД")
	}
	if in.LocatorKind != nil {
		v.OneOf("locatorKind", "Файл или ссылка", *in.LocatorKind, []string{"file", "url"})
		if *in.LocatorKind == "url" && trimPtr(in.URL) == nil {
			v.Add("url", "required", "Не указана ссылка на источник", "Укажите адрес, например https://moros.ru/catalog/amr-800")
		}
		if *in.LocatorKind == "file" && trimPtr(in.FileName) == nil {
			v.Add("fileName", "required", "Не указано имя файла", "Укажите имя файла источника")
		}
		if *in.LocatorKind == "file" && in.RefreshSchedule != "manual" {
			v.Add("refreshSchedule", "invalid_value", "Автообновление доступно только для ссылки", "Для файла выберите «Только вручную»")
		}
	}
	if err := v.Err(); err != nil {
		return src, err
	}
	src.Name, src.SourceType, src.Origin, src.LocatorKind = strings.TrimSpace(in.Name), in.SourceType, in.Origin, in.LocatorKind
	src.URL, src.FileName, src.DataStatus, src.Provides = trimPtr(in.URL), trimPtr(in.FileName), in.DataStatus, trimPtr(in.Provides)
	src.ActualizedOn, src.RefreshSchedule, src.Responsible = *in.ActualizedOn, in.RefreshSchedule, trimPtr(in.Responsible)
	if err := s.st.Q().SaveSource(ctx, src); err != nil {
		return src, err
	}
	return s.st.Q().GetSource(ctx, src.ID)
}

// SolutionQuery filters and sorts the catalog.
type SolutionQuery struct {
	Kind            string
	Q               string
	WorkTypeIDs     []uuid.UUID
	Industries      []string
	FacilityType    string
	Statuses        []string
	TrlMin          *int
	PriceBand       string
	CostType        string
	HasCapabilities *bool
	SpecsConfirmed  []string
	IncludeHidden   bool
	Sort            string
	Limit, Offset   int
}

// ListSolutions returns the filtered catalog page.
func (s *Service) ListSolutions(ctx context.Context, f SolutionQuery) (Page[domain.SolutionSummary], error) {
	q := s.st.Q()
	all, err := q.ListSolutions(ctx, store.SolutionFilter{Kind: f.Kind, IncludeHidden: f.IncludeHidden && accessOf(ctx).seesHidden()})
	if err != nil {
		return Page[domain.SolutionSummary]{}, err
	}
	var facilityWorkTypes map[uuid.UUID]bool
	if f.FacilityType != "" {
		procs, err := q.ListProcesses(ctx, false)
		if err != nil {
			return Page[domain.SolutionSummary]{}, err
		}
		facilityWorkTypes = map[uuid.UUID]bool{}
		for _, p := range procs {
			if slices.Contains(p.FacilityTypes, f.FacilityType) {
				facilityWorkTypes[p.WorkType.ID] = true
			}
		}
	}
	out := make([]domain.SolutionSummary, 0, len(all))
	for i := range all {
		sol := &all[i]
		if !matchesSolution(sol, f, facilityWorkTypes) {
			continue
		}
		out = append(out, sol.Summary())
	}
	sortSolutions(out, f.Sort)
	return paginate(out, f.Limit, f.Offset), nil
}

func matchesSolution(s *domain.Solution, f SolutionQuery, facilityWorkTypes map[uuid.UUID]bool) bool {
	if f.Q != "" && !containsFold(s.Name+" "+s.Manufacturer+" "+s.Code, f.Q) {
		return false
	}
	hasWorkType := func(set func(uuid.UUID) bool) bool {
		for _, c := range s.Capabilities {
			if c.IsActive && set(c.WorkType.ID) {
				return true
			}
		}
		return false
	}
	if len(f.WorkTypeIDs) > 0 && !hasWorkType(func(id uuid.UUID) bool { return slices.Contains(f.WorkTypeIDs, id) }) {
		return false
	}
	if facilityWorkTypes != nil && !hasWorkType(func(id uuid.UUID) bool { return facilityWorkTypes[id] }) {
		return false
	}
	if len(f.Industries) > 0 && !slices.ContainsFunc(s.Industries, func(i string) bool { return slices.Contains(f.Industries, i) }) {
		return false
	}
	if len(f.Statuses) > 0 && (s.Status == nil || !slices.Contains(f.Statuses, *s.Status)) {
		return false
	}
	if f.TrlMin != nil && (s.Trl == nil || *s.Trl < *f.TrlMin) {
		return false
	}
	if f.PriceBand != "" {
		band := s.PriceBand()
		if band == nil || *band != f.PriceBand {
			return false
		}
	}
	switch f.CostType {
	case "capex":
		if s.Kind != "robot" && domain.Deref(s.CostType) != "capex" {
			return false
		}
	case "opex":
		if ct := domain.Deref(s.CostType); ct != "opex_year" && ct != "percent" {
			return false
		}
	}
	if f.HasCapabilities != nil && *f.HasCapabilities != slices.ContainsFunc(s.Capabilities, func(c domain.Capability) bool { return c.IsActive }) {
		return false
	}
	if len(f.SpecsConfirmed) > 0 && (s.Spec == nil || !slices.Contains(f.SpecsConfirmed, s.Spec.SpecsConfirmed)) {
		return false
	}
	return true
}

var confirmationRank = map[string]int{"yes": 0, "partial": 1, "no": 2}

func sortSolutions(list []domain.SolutionSummary, sortBy string) {
	price := func(s domain.SolutionSummary) (float64, bool) {
		if s.Price == nil || s.Price.Unit != "item" || s.Price.AmountRub == nil {
			return 0, false
		}
		return *s.Price.AmountRub, true
	}
	slices.SortStableFunc(list, func(a, b domain.SolutionSummary) int {
		switch sortBy {
		case "price_asc", "price_desc":
			pa, oka := price(a)
			pb, okb := price(b)
			if oka != okb {
				if oka {
					return -1
				}
				return 1
			}
			if pa != pb {
				if (pa < pb) == (sortBy == "price_asc") {
					return -1
				}
				return 1
			}
		case "trl":
			if d := domain.Deref(b.Trl) - domain.Deref(a.Trl); d != 0 {
				return d
			}
		case "confirmation":
			ra, rb := 3, 3
			if a.SpecsConfirmed != nil {
				ra = confirmationRank[*a.SpecsConfirmed]
			}
			if b.SpecsConfirmed != nil {
				rb = confirmationRank[*b.SpecsConfirmed]
			}
			if ra != rb {
				return ra - rb
			}
		case "updated":
			if c := b.UpdatedAt.Compare(a.UpdatedAt); c != 0 {
				return c
			}
		case "name":
		default:
			if a.Kind != b.Kind {
				return strings.Compare(kindOrder(a.Kind), kindOrder(b.Kind))
			}
			if d := b.CompletenessPct - a.CompletenessPct; d != 0 {
				return d
			}
		}
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})
}

func kindOrder(k string) string {
	return fmt.Sprint(slices.Index(domain.Codes(domain.SolutionKinds), k))
}

// GetSolution returns the full catalog card; a hidden position is not found for anyone but the admin.
func (s *Service) GetSolution(ctx context.Context, id uuid.UUID) (domain.Solution, error) {
	sol, err := s.st.Q().GetSolution(ctx, id)
	if err == nil && !sol.IsActive && !accessOf(ctx).seesHidden() {
		return domain.Solution{}, domain.NotFound("solution", id.String())
	}
	return sol, err
}

// SolutionInput is the editable part of a catalog position.
type SolutionInput struct {
	Code               *string           `json:"code"`
	Kind               string            `json:"kind"`
	Name               string            `json:"name"`
	Manufacturer       string            `json:"manufacturer"`
	ProductClass       *string           `json:"productClass"`
	TypeGroup          *string           `json:"typeGroup"`
	SolutionType       *string           `json:"solutionType"`
	Status             *string           `json:"status"`
	Trl                *int              `json:"trl"`
	MarketPotential    *int              `json:"marketPotential"`
	Region             *string           `json:"region"`
	Country            *string           `json:"country"`
	Description        *string           `json:"description"`
	CasesText          *string           `json:"casesText"`
	OrganizerScenarios []string          `json:"organizerScenarios"`
	AcquisitionModels  []string          `json:"acquisitionModels"`
	Badges             domain.Badges     `json:"badges"`
	PhotoURL           *string           `json:"photoUrl"`
	CostType           *string           `json:"costType"`
	QuantityRule       *string           `json:"quantityRule"`
	CompatibleWith     *string           `json:"compatibleWith"`
	SoftwareCostPct    *float64          `json:"softwareCostPct"`
	ServiceCostPct     *float64          `json:"serviceCostPct"`
	ServiceLifeYears   *float64          `json:"serviceLifeYears"`
	SourceID           *uuid.UUID        `json:"sourceId"`
	IsActive           *bool             `json:"isActive,omitempty"`
	Industries         []string          `json:"industries"`
	Price              *domain.Price     `json:"price"`
	Spec               *domain.RobotSpec `json:"spec"`
	WorkTypeIDs        []uuid.UUID       `json:"workTypeIds"`
}

func solutionInput(sol domain.Solution) SolutionInput {
	in := SolutionInput{Code: &sol.Code, Kind: sol.Kind, Name: sol.Name, Manufacturer: sol.Manufacturer,
		ProductClass: sol.ProductClass, TypeGroup: sol.TypeGroup, SolutionType: sol.SolutionType, Status: sol.Status,
		Trl: sol.Trl, MarketPotential: sol.MarketPotential, Region: sol.Region, Country: sol.Country,
		Description: sol.Description, CasesText: sol.CasesText, OrganizerScenarios: sol.OrganizerScenarios,
		AcquisitionModels: sol.AcquisitionModels, Badges: sol.Badges, PhotoURL: sol.PhotoURL, CostType: sol.CostType,
		QuantityRule: sol.QuantityRule, CompatibleWith: sol.CompatibleWith, SoftwareCostPct: sol.SoftwareCostPct,
		ServiceCostPct: sol.ServiceCostPct, ServiceLifeYears: sol.ServiceLifeYears, SourceID: sol.SourceID,
		IsActive: domain.Ptr(sol.IsActive), Industries: sol.Industries, Price: sol.Price, Spec: sol.Spec,
		WorkTypeIDs: []uuid.UUID{}}
	for _, c := range sol.Capabilities {
		if c.IsActive {
			in.WorkTypeIDs = append(in.WorkTypeIDs, c.WorkType.ID)
		}
	}
	return in
}

// CreateSolution adds a catalog position, its spec, price and operation classes.
func (s *Service) CreateSolution(ctx context.Context, body []byte) (domain.Solution, error) {
	var in SolutionInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Solution{}, err
	}
	sol := domain.Solution{ID: store.NewID(), IsActive: true}
	return s.saveSolution(ctx, sol, in, true)
}

// PatchSolution updates a catalog position; the change goes into the next catalog version.
func (s *Service) PatchSolution(ctx context.Context, id uuid.UUID, body []byte) (domain.Solution, error) {
	sol, err := s.st.Q().GetSolution(ctx, id)
	if err != nil {
		return sol, err
	}
	in := solutionInput(sol)
	if err := MergePatch(&in, body); err != nil {
		return sol, err
	}
	return s.saveSolution(ctx, sol, in, false)
}

// HideSolution removes a position from new matching; saved projects keep it.
func (s *Service) HideSolution(ctx context.Context, id uuid.UUID) error {
	_, err := s.PatchSolution(ctx, id, []byte(`{"isActive": false}`))
	return err
}

func validateSolution(in *SolutionInput, v *domain.Validator) {
	v.Required("name", "Название", in.Name)
	v.Required("manufacturer", "Производитель", in.Manufacturer)
	v.OneOf("kind", "Вид позиции", in.Kind, domain.Codes(domain.SolutionKinds))
	if in.Status != nil {
		v.OneOf("status", "Статус", *in.Status, domain.Codes(domain.SolutionStatuses))
	}
	if in.ProductClass != nil {
		v.OneOf("productClass", "Класс изделия", *in.ProductClass, domain.Codes(domain.ProductClasses))
	}
	if in.CostType != nil {
		v.OneOf("costType", "Тип затрат", *in.CostType, domain.Codes(domain.CostTypes))
	}
	for i, m := range in.AcquisitionModels {
		v.OneOf(fmt.Sprintf("acquisitionModels[%d]", i), "Модель приобретения", m, domain.Codes(domain.AcquisitionModels))
	}
	if in.Trl != nil {
		v.Range("trl", "УГТ", domain.Ptr(float64(*in.Trl)), domain.Ptr(1.0), domain.Ptr(9.0), "")
	}
	if in.MarketPotential != nil {
		v.Range("marketPotential", "Рыночный потенциал", domain.Ptr(float64(*in.MarketPotential)), domain.Ptr(1.0), domain.Ptr(5.0), "")
	}
	for _, f := range []struct {
		field, label string
		val          *float64
	}{{"softwareCostPct", "Стоимость ПО, %", in.SoftwareCostPct}, {"serviceCostPct", "Стоимость обслуживания, %", in.ServiceCostPct}} {
		v.Range(f.field, f.label, f.val, domain.Ptr(0.0), domain.Ptr(100.0), "%")
	}
	v.Range("serviceLifeYears", "Срок службы", in.ServiceLifeYears, domain.Ptr(1.0), domain.Ptr(30.0), "лет")
	if p := in.Price; p != nil {
		if p.Unit == "" {
			p.Unit = "item"
		}
		v.OneOf("price.unit", "Единица цены", p.Unit, domain.Codes(domain.PriceUnits))
		if p.Unit == "percent_capex" {
			if p.Percent == nil || *p.Percent <= 0 {
				v.Add("price.percent", "required", "Не указан процент", "Укажите процент от CAPEX, например 10")
			}
		} else if p.AmountRub == nil || *p.AmountRub <= 0 {
			v.Add("price.amountRub", "out_of_range", "Цена должна быть больше нуля", "Укажите цену в рублях с НДС, например 1800000")
		}
	}
	if in.Kind != "robot" && in.Spec != nil {
		v.Add("spec", "not_applicable", "ТТХ задаются только для роботов", "Уберите блок spec или смените вид позиции на robot")
	}
	if sp := in.Spec; sp != nil {
		if sp.SpecsConfirmed == "" {
			sp.SpecsConfirmed = "no"
		}
		v.OneOf("spec.specsConfirmed", "ТТХ подтверждены", sp.SpecsConfirmed, domain.Codes(domain.SpecsConfirmation))
		v.Range("spec.payloadKg", "Грузоподъёмность", sp.PayloadKg, domain.Ptr(0.0), nil, "кг")
		v.Range("spec.maxSpeedMps", "Макс. скорость", sp.MaxSpeedMps, domain.Ptr(0.1), domain.Ptr(30.0), "м/с")
		v.Range("spec.autonomyH", "Автономность", sp.AutonomyH, domain.Ptr(0.0), nil, "ч")
		v.Range("spec.minTempC", "Мин. температура", sp.MinTempC, domain.Ptr(-60.0), domain.Ptr(40.0), "°C")
		v.Range("spec.maxTempC", "Макс. температура", sp.MaxTempC, domain.Ptr(0.0), domain.Ptr(70.0), "°C")
		for field, val := range map[string]*int{"spec.lengthMm": sp.LengthMm, "spec.widthMm": sp.WidthMm, "spec.heightMm": sp.HeightMm} {
			if val != nil && *val <= 0 {
				v.Add(field, "out_of_range", "Габариты должны быть больше нуля", "Укажите размер в миллиметрах")
			}
		}
		if sp.MinTempC != nil && sp.MaxTempC != nil && *sp.MinTempC > *sp.MaxTempC {
			v.Add("spec.minTempC", "invalid_range", "Мин. температура больше максимальной", "Проверьте диапазон температур")
		}
	}
}

func (s *Service) saveSolution(ctx context.Context, sol domain.Solution, in SolutionInput, isNew bool) (domain.Solution, error) {
	var v domain.Validator
	validateSolution(&in, &v)
	err := s.st.Tx(ctx, func(q store.Q) error {
		if in.Spec != nil {
			if err := s.checkDict(ctx, q, &v, store.HandlingMethod, "spec.handlingMethodCode", "Способ обработки груза", in.Spec.HandlingMethodCode); err != nil {
				return err
			}
		}
		workTypes := make([]domain.WorkType, 0, len(in.WorkTypeIDs))
		for i, id := range in.WorkTypeIDs {
			w, err := q.GetWorkType(ctx, id)
			if err != nil {
				v.Add(fmt.Sprintf("workTypeIds[%d]", i), "not_found", "Класс операции не найден", "Выберите класс из справочника")
				continue
			}
			workTypes = append(workTypes, w)
		}
		if err := v.Err(); err != nil {
			return err
		}
		code := trimPtr(in.Code)
		switch {
		case code != nil:
			sol.Code = *code
		case isNew:
			prefix := "SI"
			if in.Kind == "robot" {
				prefix = "RB"
			}
			c, err := q.NextSolutionCode(ctx, prefix)
			if err != nil {
				return err
			}
			sol.Code = c
		}
		sol.Kind, sol.Name, sol.Manufacturer = in.Kind, strings.TrimSpace(in.Name), strings.TrimSpace(in.Manufacturer)
		sol.ProductClass, sol.TypeGroup, sol.SolutionType, sol.Status = in.ProductClass, trimPtr(in.TypeGroup), trimPtr(in.SolutionType), in.Status
		sol.Trl, sol.MarketPotential, sol.Region, sol.Country = in.Trl, in.MarketPotential, trimPtr(in.Region), trimPtr(in.Country)
		sol.Description, sol.CasesText = trimPtr(in.Description), trimPtr(in.CasesText)
		sol.OrganizerScenarios, sol.AcquisitionModels, sol.Badges = in.OrganizerScenarios, in.AcquisitionModels, in.Badges
		sol.PhotoURL, sol.CostType, sol.QuantityRule, sol.CompatibleWith = trimPtr(in.PhotoURL), in.CostType, trimPtr(in.QuantityRule), trimPtr(in.CompatibleWith)
		sol.SoftwareCostPct, sol.ServiceCostPct, sol.ServiceLifeYears, sol.SourceID = in.SoftwareCostPct, in.ServiceCostPct, in.ServiceLifeYears, in.SourceID
		if in.IsActive != nil {
			sol.IsActive = *in.IsActive
		}
		if err := q.SaveSolution(ctx, sol); err != nil {
			if store.IsUniqueViolation(err, "solution_code_key") {
				return domain.Conflict("solution_code_taken", fmt.Sprintf("Код «%s» уже занят другой позицией", sol.Code))
			}
			if store.IsForeignKeyViolation(err) {
				return &domain.ValidationError{Errors: []domain.FieldError{{Field: "sourceId", Code: "not_found", Message: "Источник данных не найден"}}}
			}
			return err
		}
		if in.Kind == "robot" {
			spec := in.Spec
			if spec == nil {
				spec = &domain.RobotSpec{SpecsConfirmed: "no"}
			}
			if err := q.SaveRobotSpec(ctx, sol.ID, spec); err != nil {
				return err
			}
		} else if err := q.SaveRobotSpec(ctx, sol.ID, nil); err != nil {
			return err
		}
		if err := q.SetDefaultPrice(ctx, sol.ID, in.Price); err != nil {
			return err
		}
		if err := q.ReplaceIndustries(ctx, sol.ID, in.Industries); err != nil {
			return &domain.ValidationError{Errors: []domain.FieldError{{Field: "industries", Code: "not_found",
				Message: err.Error(), Hint: "Выберите отрасль из справочника industries"}}}
		}
		if err := syncCapabilities(ctx, q, sol.ID, workTypes); err != nil {
			return err
		}
		return q.BumpVersion(ctx, "catalog")
	})
	if err != nil {
		return sol, err
	}
	return s.st.Q().GetSolution(ctx, sol.ID)
}

// syncCapabilities activates capability rows for the given classes and hides the others.
func syncCapabilities(ctx context.Context, q store.Q, solutionID uuid.UUID, workTypes []domain.WorkType) error {
	existing, err := q.Capabilities(ctx, solutionID)
	if err != nil {
		return err
	}
	want := map[uuid.UUID]domain.WorkType{}
	for _, w := range workTypes {
		want[w.ID] = w
	}
	for _, c := range existing {
		_, keep := want[c.WorkType.ID]
		if c.IsActive != keep {
			if err := q.SetCapabilityActive(ctx, solutionID, c.ID, keep); err != nil {
				return err
			}
		}
		delete(want, c.WorkType.ID)
	}
	for _, w := range want {
		if err := q.SaveCapability(ctx, domain.Capability{ID: store.NewID(), SolutionID: solutionID, WorkType: w.Ref(), IsActive: true}); err != nil {
			return err
		}
	}
	return nil
}

// CapabilityInput is the editable part of a capability row.
type CapabilityInput struct {
	WorkTypeID          *uuid.UUID `json:"workTypeId"`
	ThroughputPerHour   *float64   `json:"throughputPerHour"`
	ThroughputRangeText *string    `json:"throughputRangeText"`
	ThroughputExact     bool       `json:"throughputExact"`
	HandlingMethodCode  *string    `json:"handlingMethodCode"`
	Environment         *string    `json:"environment"`
	LiftHeightMm        *int       `json:"liftHeightMm"`
	SourceText          *string    `json:"sourceText"`
	SourceID            *uuid.UUID `json:"sourceId"`
	IsActive            *bool      `json:"isActive,omitempty"`
}

// ListCapabilities returns the capability rows of a solution.
func (s *Service) ListCapabilities(ctx context.Context, solutionID uuid.UUID) ([]domain.Capability, error) {
	sol, err := s.st.Q().GetSolution(ctx, solutionID)
	if err != nil {
		return nil, err
	}
	return sol.Capabilities, nil
}

// ReplaceCapabilities sets the operation classes of a robot (chips on the robot card).
func (s *Service) ReplaceCapabilities(ctx context.Context, solutionID uuid.UUID, workTypeIDs []uuid.UUID) ([]domain.Capability, error) {
	body := fmt.Sprintf(`{"workTypeIds": %s}`, uuidListJSON(workTypeIDs))
	sol, err := s.PatchSolution(ctx, solutionID, []byte(body))
	if err != nil {
		return nil, err
	}
	return sol.Capabilities, nil
}

func uuidListJSON(ids []uuid.UUID) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = `"` + id.String() + `"`
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// AddCapability adds or reactivates one capability row with its attributes.
func (s *Service) AddCapability(ctx context.Context, solutionID uuid.UUID, body []byte) (domain.Capability, error) {
	var in CapabilityInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Capability{}, err
	}
	if in.WorkTypeID == nil {
		return domain.Capability{}, &domain.ValidationError{Errors: []domain.FieldError{{Field: "workTypeId", Code: "required",
			Message: "Не выбран класс операции", Hint: "Укажите workTypeId из справочника классов"}}}
	}
	caps, err := s.st.Q().Capabilities(ctx, solutionID)
	if err != nil {
		return domain.Capability{}, err
	}
	c := domain.Capability{ID: store.NewID(), SolutionID: solutionID, IsActive: true}
	for _, e := range caps {
		if e.WorkType.ID == *in.WorkTypeID {
			if e.IsActive {
				return c, domain.Conflict("capability_exists", "Этот класс операции у робота уже есть — измените его строку")
			}
			c = e
			c.IsActive = true
		}
	}
	return s.saveCapability(ctx, solutionID, c, in)
}

// PatchCapability updates the attributes of a capability row.
func (s *Service) PatchCapability(ctx context.Context, solutionID, capID uuid.UUID, body []byte) (domain.Capability, error) {
	caps, err := s.st.Q().Capabilities(ctx, solutionID)
	if err != nil {
		return domain.Capability{}, err
	}
	for _, c := range caps {
		if c.ID != capID {
			continue
		}
		in := CapabilityInput{WorkTypeID: &c.WorkType.ID, ThroughputPerHour: c.ThroughputPerHour,
			ThroughputRangeText: c.ThroughputRangeText, ThroughputExact: c.ThroughputExact,
			HandlingMethodCode: c.HandlingMethodCode, Environment: c.Environment, LiftHeightMm: c.LiftHeightMm,
			SourceText: c.SourceText, SourceID: c.SourceID, IsActive: domain.Ptr(c.IsActive)}
		if err := MergePatch(&in, body); err != nil {
			return c, err
		}
		if *in.WorkTypeID != c.WorkType.ID {
			return c, &domain.ValidationError{Errors: []domain.FieldError{{Field: "workTypeId", Code: "immutable",
				Message: "Класс операции строки не меняется", Hint: "Скройте строку и добавьте новую с другим классом"}}}
		}
		return s.saveCapability(ctx, solutionID, c, in)
	}
	return domain.Capability{}, domain.NotFound("capability", capID.String())
}

// HideCapability hides a capability row; it no longer takes part in new matching.
func (s *Service) HideCapability(ctx context.Context, solutionID, capID uuid.UUID) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if err := q.SetCapabilityActive(ctx, solutionID, capID, false); err != nil {
			return err
		}
		return q.BumpVersion(ctx, "catalog")
	})
}

func (s *Service) saveCapability(ctx context.Context, solutionID uuid.UUID, c domain.Capability, in CapabilityInput) (domain.Capability, error) {
	var v domain.Validator
	if in.ThroughputPerHour != nil && *in.ThroughputPerHour <= 0 {
		v.Add("throughputPerHour", "out_of_range", "Производительность должна быть больше нуля", "Укажите значение в единицах класса в час")
	}
	if in.Environment != nil {
		v.OneOf("environment", "Среда", *in.Environment, domain.Codes(domain.CapabilityEnvironments))
	}
	if in.LiftHeightMm != nil && *in.LiftHeightMm <= 0 {
		v.Add("liftHeightMm", "out_of_range", "Высота подъёма должна быть больше нуля", "Укажите высоту в миллиметрах")
	}
	var saved domain.Capability
	err := s.st.Tx(ctx, func(q store.Q) error {
		if err := s.checkDict(ctx, q, &v, store.HandlingMethod, "handlingMethodCode", "Способ обработки груза", in.HandlingMethodCode); err != nil {
			return err
		}
		w, err := q.GetWorkType(ctx, *in.WorkTypeID)
		if err != nil {
			v.Add("workTypeId", "not_found", "Класс операции не найден", "Выберите класс из справочника")
		}
		if err := v.Err(); err != nil {
			return err
		}
		c.WorkType = w.Ref()
		c.ThroughputPerHour, c.ThroughputRangeText, c.ThroughputExact = in.ThroughputPerHour, trimPtr(in.ThroughputRangeText), in.ThroughputExact
		c.HandlingMethodCode, c.Environment, c.LiftHeightMm = in.HandlingMethodCode, in.Environment, in.LiftHeightMm
		c.SourceText, c.SourceID = trimPtr(in.SourceText), in.SourceID
		if in.IsActive != nil {
			c.IsActive = *in.IsActive
		}
		if err := q.SaveCapability(ctx, c); err != nil {
			if store.IsForeignKeyViolation(err) {
				return domain.NotFound("solution", solutionID.String())
			}
			return err
		}
		if err := q.BumpVersion(ctx, "catalog"); err != nil {
			return err
		}
		caps, err := q.Capabilities(ctx, solutionID)
		for _, e := range caps {
			if e.WorkType.ID == c.WorkType.ID {
				saved = e
			}
		}
		return err
	})
	if err != nil {
		return saved, err
	}
	sol, err := s.st.Q().GetSolution(ctx, solutionID)
	if err == nil {
		saved.Resolve(sol.Spec)
	}
	return saved, err
}

// ComparisonRow is one characteristic across compared solutions.
type ComparisonRow struct {
	Group  string `json:"group"`
	Field  string `json:"field"`
	Label  string `json:"label"`
	Unit   string `json:"unit"`
	Values []any  `json:"values"`
}

// Comparison is the unified characteristics table (ТЗ 3.3.7).
type Comparison struct {
	Solutions []domain.SolutionSummary `json:"solutions"`
	Rows      []ComparisonRow          `json:"rows"`
}

// CompareSolutions builds the comparison table of 2–6 solutions.
func (s *Service) CompareSolutions(ctx context.Context, ids []uuid.UUID) (Comparison, error) {
	if len(ids) < 2 || len(ids) > 6 {
		return Comparison{}, &domain.ValidationError{Errors: []domain.FieldError{{Field: "ids", Code: "out_of_range",
			Message: "Для сравнения выберите от 2 до 6 решений", Hint: "Передайте ids через запятую"}}}
	}
	list, err := s.st.Q().ListSolutions(ctx, store.SolutionFilter{IDs: ids, IncludeHidden: true})
	if err != nil {
		return Comparison{}, err
	}
	byID := map[uuid.UUID]*domain.Solution{}
	for i := range list {
		byID[list[i].ID] = &list[i]
	}
	ordered := make([]*domain.Solution, 0, len(ids))
	for _, id := range ids {
		sol, ok := byID[id]
		if !ok {
			return Comparison{}, domain.NotFound("solution", id.String())
		}
		ordered = append(ordered, sol)
	}
	cmp := Comparison{}
	for _, sol := range ordered {
		cmp.Solutions = append(cmp.Solutions, sol.Summary())
	}
	spec := func(sol *domain.Solution) *domain.RobotSpec {
		if sol.Spec == nil {
			return &domain.RobotSpec{}
		}
		return sol.Spec
	}
	rows := []struct {
		group, field, label, unit string
		get                       func(*domain.Solution) any
	}{
		{"identity", "manufacturer", "Производитель", "", func(x *domain.Solution) any { return x.Manufacturer }},
		{"identity", "solutionType", "Тип решения", "", func(x *domain.Solution) any { return x.SolutionType }},
		{"identity", "country", "Страна происхождения", "", func(x *domain.Solution) any { return x.Country }},
		{"identity", "status", "Статус доступности", "", func(x *domain.Solution) any { return x.Status }},
		{"tech", "payloadKg", "Грузоподъёмность", "кг", func(x *domain.Solution) any { return spec(x).PayloadKg }},
		{"tech", "dimensions", "Габариты Д×Ш×В", "мм", func(x *domain.Solution) any { return dims(spec(x)) }},
		{"tech", "maxSpeedMps", "Макс. скорость", "м/с", func(x *domain.Solution) any { return spec(x).MaxSpeedMps }},
		{"tech", "throughput", "Производительность", "в час", func(x *domain.Solution) any { return throughputs(x) }},
		{"tech", "autonomyH", "Автономность", "ч", func(x *domain.Solution) any { return spec(x).AutonomyH }},
		{"tech", "positioningAccuracyMm", "Точность позиционирования", "мм", func(x *domain.Solution) any { return spec(x).PositioningAccuracyMm }},
		{"tech", "navigationType", "Тип навигации", "", func(x *domain.Solution) any { return spec(x).NavigationType }},
		{"tech", "temperature", "Допустимые температуры", "°C", func(x *domain.Solution) any { return tempRange(spec(x)) }},
		{"infra", "chargingInfra", "Зарядная инфраструктура", "", func(x *domain.Solution) any { return spec(x).ChargingInfra }},
		{"infra", "connectivity", "Связь", "", func(x *domain.Solution) any { return spec(x).Connectivity }},
		{"infra", "integrations", "Интеграции", "", func(x *domain.Solution) any { return spec(x).Integrations }},
		{"economics", "priceRub", "Цена с НДС", "₽", func(x *domain.Solution) any { return x.PriceRub() }},
		{"economics", "acquisitionModels", "Модели приобретения", "", func(x *domain.Solution) any { return x.AcquisitionModels }},
		{"economics", "serviceLifeYears", "Срок службы", "лет", func(x *domain.Solution) any { return x.ServiceLifeYears }},
		{"applicability", "workTypes", "Классы операций", "", func(x *domain.Solution) any { return x.Summary().WorkTypes }},
		{"applicability", "trl", "УГТ", "", func(x *domain.Solution) any { return x.Trl }},
		{"applicability", "cases", "Реализованные кейсы", "", func(x *domain.Solution) any { return x.CasesText }},
		{"dataQuality", "specsConfirmed", "ТТХ подтверждены", "", func(x *domain.Solution) any { return x.Summary().SpecsConfirmed }},
		{"dataQuality", "completenessPct", "Полнота ТТХ", "%", func(x *domain.Solution) any { return x.CompletenessPct }},
		{"dataQuality", "specsSource", "Источник ТТХ", "", func(x *domain.Solution) any { return spec(x).SpecsSourceText }},
	}
	for _, r := range rows {
		row := ComparisonRow{Group: r.group, Field: r.field, Label: r.label, Unit: r.unit}
		for _, sol := range ordered {
			row.Values = append(row.Values, r.get(sol))
		}
		cmp.Rows = append(cmp.Rows, row)
	}
	return cmp, nil
}

func dims(sp *domain.RobotSpec) *string {
	if sp.LengthMm == nil || sp.WidthMm == nil || sp.HeightMm == nil {
		return nil
	}
	return domain.Ptr(fmt.Sprintf("%d × %d × %d", *sp.LengthMm, *sp.WidthMm, *sp.HeightMm))
}

func tempRange(sp *domain.RobotSpec) *string {
	if sp.MinTempC == nil && sp.MaxTempC == nil {
		return nil
	}
	lo, hi := "…", "…"
	if sp.MinTempC != nil {
		lo = domain.FormatNumber(*sp.MinTempC)
	}
	if sp.MaxTempC != nil {
		hi = domain.FormatNumber(*sp.MaxTempC)
	}
	return domain.Ptr(lo + " … " + hi)
}

func throughputs(sol *domain.Solution) []string {
	out := []string{}
	for _, c := range sol.Capabilities {
		if !c.IsActive || (c.ThroughputPerHour == nil && c.ThroughputRangeText == nil) {
			continue
		}
		val := domain.Deref(c.ThroughputRangeText)
		if c.ThroughputPerHour != nil {
			val = domain.FormatNumber(*c.ThroughputPerHour)
		}
		out = append(out, c.WorkType.Code+": "+val+" "+c.WorkType.UnitLabel+"/ч")
	}
	return out
}
