// Package calc is the port of the capacity and economics calculation (docs/orchestrator.md).
//
// The orchestrator sends one Request per project: the frozen location and task inputs, the pinned
// norm set and the robots that passed matching. The calculator answers with one Result per robot
// and acquisition model. Implementations: calc/mock (in-process model) and calc/economics
// (services/economics, POST /api/v1/evaluations).
package calc

import (
	"context"
	"errors"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

// Acquisition models priced by the calculator.
const (
	Purchase = "purchase"
	RaaS     = "raas"
)

// ErrUnavailable wraps every failure to get an answer from the calculator.
var ErrUnavailable = errors.New("calculator unavailable")

// ErrRejected wraps an answer where the calculator refused the input (HTTP 409 or 422).
var ErrRejected = errors.New("calculator rejected the input")

// Calculator computes fleet size and economics for the candidates of one project task.
type Calculator interface {
	// ModelVersion identifies the formulas and norms; results keep it for reproducibility.
	ModelVersion(ctx context.Context) (string, error)
	Calculate(ctx context.Context, req Request) (Response, error)
}

// Request is the calculation input: everything the formulas may read, frozen by the orchestrator.
type Request struct {
	RunID             uuid.UUID      `json:"runId" description:"Идентификатор расчёта: calc_run.id и evaluation_id в сервисе economics"`
	ProjectID         uuid.UUID      `json:"projectId"`
	HorizonYears      int            `json:"horizonYears" description:"Горизонт расчёта ROI и TCO, лет"`
	AcquisitionModels []string       `json:"acquisitionModels" description:"Модели приобретения для расчёта: purchase, raas"`
	Norms             domain.NormSet `json:"norms" description:"Закреплённая в проекте версия нормативов А5"`
	Location          Location       `json:"location"`
	Task              Task           `json:"task"`
	Candidates        []Candidate    `json:"candidates"`
	// Defaults are the snapshot values before the user's «Параметры расчёта» were applied; nil in runs made before them.
	Defaults *Defaults `json:"defaults,omitempty"`
	// DryRun asks for figures only: the calculator keeps no snapshot (the guest preview writes nothing).
	DryRun bool `json:"-"`
}

// Defaults keep the values of the «Параметры расчёта» fields as the snapshot and the catalog gave them.
type Defaults struct {
	StaffCostRubPerMonth *float64                    `json:"staffCostRubPerMonth"`
	WorkHoursPerDay      *float64                    `json:"workHoursPerDay"`
	Robots               map[uuid.UUID]RobotDefaults `json:"robots"`
}

// RobotDefaults are the catalog values of a candidate the panel can override.
type RobotDefaults struct {
	PriceRub       *float64 `json:"priceRub"`
	TripsPerHour   *float64 `json:"tripsPerHour"`
	ServiceCostPct *float64 `json:"serviceCostPct"`
}

// Location is the part of the location snapshot used by the calculation.
type Location struct {
	ID               uuid.UUID           `json:"id"`
	Name             string              `json:"name"`
	FacilityTypeCode string              `json:"facilityTypeCode"`
	CapexBudget      domain.Budget       `json:"capexBudget"`
	Parameters       map[string]any      `json:"parameters" description:"Значения параметров объекта по кодам"`
	Roles            map[string]float64  `json:"roles" description:"Числовые значения параметров по ролям: shifts_per_day, available_power_kw…"`
	StaffGroups      []domain.StaffGroup `json:"staffGroups"`
}

// Task is the part of the task snapshot used by the calculation.
type Task struct {
	ID              uuid.UUID              `json:"id"`
	Name            string                 `json:"name"`
	WorkType        domain.WorkTypeRef     `json:"workType"`
	KpiUnit         *string                `json:"kpiUnit"`
	Params          domain.TaskParams      `json:"params"`
	HandlingMethods []domain.HandlingShare `json:"handlingMethods"`
	Workers         []domain.TaskWorker    `json:"workers"`
	Derived         domain.TaskDerived     `json:"derived"`
}

// Candidate is a robot from the matching run with its catalog fields at the time of the run.
type Candidate struct {
	domain.RobotCard
	MatchState string `json:"matchState" enum:"passed,needs_verification,excluded"`
	IsManual   bool   `json:"isManual"`
}

// Models are the requested acquisition models the robot is offered with; an empty catalog list
// means every model. The calculator returns exactly one Result per candidate and such model.
func (c Candidate) Models(requested []string) []string {
	if len(c.AcquisitionModels) == 0 {
		return requested
	}
	out := []string{}
	for _, m := range requested {
		for _, offered := range c.AcquisitionModels {
			if m == offered {
				out = append(out, m)
				break
			}
		}
	}
	return out
}

// Response is the calculation output.
type Response struct {
	ModelVersion   string   `json:"modelVersion"`
	RankingVersion *string  `json:"rankingVersion" description:"Методика рейтинга; null — калькулятор не ранжирует"`
	Results        []Result `json:"results"`
}

// Result is the calculation of one robot under one acquisition model. Money is in RUB with VAT.
type Result struct {
	SolutionID          uuid.UUID   `json:"solutionId"`
	AcquisitionModel    string      `json:"acquisitionModel" enum:"purchase,raas"`
	Calculable          bool        `json:"calculable" description:"false — не хватает данных, причина в reason"`
	Reason              *string     `json:"reason"`
	RobotCount          *int        `json:"robotCount"`
	ChargerCount        *int        `json:"chargerCount"`
	CapexRub            *float64    `json:"capexRub" description:"Первоначальные затраты; для RaaS — запуск без аренды"`
	OpexYearRub         *float64    `json:"opexYearRub" description:"Расходы процесса в год после внедрения: оставшийся ФОТ и новые расходы, для RaaS с арендой"`
	LaborSavingsYearRub *float64    `json:"laborSavingsYearRub" description:"Экономия ФОТ в год"`
	NetEffectYearRub    *float64    `json:"netEffectYearRub" description:"Годовой денежный эффект к текущему процессу"`
	PaybackYears        *float64    `json:"paybackYears" description:"null — не окупается"`
	Roi                 *float64    `json:"roi" description:"Накопленный эффект за горизонт ÷ CAPEX (ТЗ 3.5.2), доля"`
	TcoRub              *float64    `json:"tcoRub" description:"CAPEX + расходы процесса за горизонт с заменой АКБ"`
	BudgetOverRub       *float64    `json:"budgetOverRub" description:"Превышение бюджета CAPEX; 0 — в бюджете, null — бюджет не задан"`
	BudgetOverPct       *float64    `json:"budgetOverPct" description:"Превышение бюджета, доля 0–1"`
	Feasibility         *string     `json:"feasibility" enum:"high,medium,low,none" description:"Интерпретация окупаемости по границам нормативов (ТЗ 3.5.7); none — не окупается"`
	Rank                *int        `json:"rank" description:"Место в рейтинге пар «решение + модель приобретения»; null — вне рейтинга"`
	Score               *float64    `json:"score" description:"Балл рейтинга 0–1"`
	Details             Details     `json:"details"`
	Trace               []TraceItem `json:"trace"`
	Warnings            []string    `json:"warnings"`
}

// Details are the figures behind the headline values: cost items, the current-process baseline
// and the ranking criteria. Stored as one JSON document per result.
type Details struct {
	FleetUtilization    *float64          `json:"fleetUtilization,omitempty" description:"Средняя загрузка парка, доля"`
	CycleTimeS          *float64          `json:"cycleTimeS,omitempty" description:"Время цикла рейса, с"`
	BaselineOpexYearRub *float64          `json:"baselineOpexYearRub,omitempty" description:"Текущий процесс: ФОТ исполнителей в год"`
	BaselineTcoRub      *float64          `json:"baselineTcoRub,omitempty" description:"Текущий процесс: расходы за горизонт"`
	CapexItems          []CostItem        `json:"capexItems,omitempty"`
	OpexItems           []CostItem        `json:"opexItems,omitempty"`
	ScoreCriteria       []ScoreCriterion  `json:"scoreCriteria,omitempty"`
	Assumptions         []AssumptionValue `json:"assumptions,omitempty" description:"Значения, подставленные по нормативу вместо пустых данных"`
}

// CostItem is one article of CAPEX or yearly OPEX.
type CostItem struct {
	Code      string   `json:"code"`
	Label     string   `json:"label"`
	AmountRub *float64 `json:"amountRub"`
}

// ScoreCriterion explains one criterion of the ranking score (ТЗ 3.4.5).
type ScoreCriterion struct {
	Code          string   `json:"code" enum:"payback,roi,annual_effect,budget_fit,tco_savings,maturity,data_quality,fleet_utilization"`
	Label         string   `json:"label"`
	RawValue      *float64 `json:"rawValue"`
	Unit          string   `json:"unit"`
	Normalized    *float64 `json:"normalized" description:"Нормированное значение 0–1"`
	Weight        float64  `json:"weight" description:"Вес из нормативов, %"`
	Contribution  *float64 `json:"contribution" description:"Вклад в балл 0–1"`
	Missing       bool     `json:"missing"`
	MissingReason *string  `json:"missingReason"`
}

// AssumptionValue is an input the calculation took from a norm because the data was empty.
type AssumptionValue struct {
	Code  string  `json:"code"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

// TraceItem is one step of the calculation trace: value, formula and source (ТЗ: без скрытых коэффициентов).
type TraceItem struct {
	Code    string       `json:"code"`
	Label   string       `json:"label"`
	Value   *float64     `json:"value"`
	Text    *string      `json:"text,omitempty" description:"Нечисловой результат шага, например интерпретация"`
	Unit    string       `json:"unit"`
	Formula string       `json:"formula,omitempty"`
	Source  string       `json:"source" enum:"task,location,robot,norm,derived"`
	Inputs  []TraceInput `json:"inputs,omitempty" description:"Входы шага с их значениями"`
}

// TraceInput is one input of a trace step.
type TraceInput struct {
	Name  string   `json:"name"`
	Value *float64 `json:"value"`
	Text  *string  `json:"text,omitempty"`
}
