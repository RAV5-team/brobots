// Package calc is the port of the capacity and economics calculation (docs/orchestrator.md).
//
// The orchestrator sends one Request per project: the frozen location and task inputs and the
// robots that passed matching. The calculator answers with one Result per robot and acquisition
// model. Implementations: calc/mock (in-process model) and calc/httpclient (services/economics).
// The HTTP contract is packages/contracts/openapi/economics.yaml, generated from these types.
package calc

import (
	"context"
	"errors"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

// HTTP paths of the economics service.
const (
	PathCalculations = "/api/v1/calculations"
	PathModelVersion = "/api/v1/model-version"
)

// Acquisition models priced by the calculator.
const (
	Purchase = "purchase"
	RaaS     = "raas"
)

// ErrUnavailable wraps every failure to get an answer from the calculator.
var ErrUnavailable = errors.New("calculator unavailable")

// Calculator computes fleet size and economics for the candidates of one project task.
type Calculator interface {
	// ModelVersion identifies the formulas and norms; results keep it for reproducibility.
	ModelVersion(ctx context.Context) (string, error)
	Calculate(ctx context.Context, req Request) (Response, error)
}

// Request is the calculation input: everything the formulas may read, frozen by the orchestrator.
type Request struct {
	ProjectID         uuid.UUID   `json:"projectId"`
	HorizonYears      int         `json:"horizonYears" description:"Горизонт расчёта ROI и TCO, лет"`
	AcquisitionModels []string    `json:"acquisitionModels" description:"Модели приобретения для расчёта: purchase, raas"`
	Location          Location    `json:"location"`
	Task              Task        `json:"task"`
	Candidates        []Candidate `json:"candidates"`
}

// Location is the part of the location snapshot used by the calculation.
type Location struct {
	ID               uuid.UUID           `json:"id"`
	Name             string              `json:"name"`
	FacilityTypeCode string              `json:"facilityTypeCode"`
	CapexBudget      domain.Budget       `json:"capexBudget"`
	Parameters       map[string]any      `json:"parameters" description:"Значения параметров объекта по кодам"`
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
	ModelVersion string   `json:"modelVersion"`
	Results      []Result `json:"results"`
}

// ModelVersionResponse is the body of GET /api/v1/model-version.
type ModelVersionResponse struct {
	ModelVersion string `json:"modelVersion"`
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
	OpexYearRub         *float64    `json:"opexYearRub" description:"Операционные затраты в год, для RaaS с арендой"`
	LaborSavingsYearRub *float64    `json:"laborSavingsYearRub" description:"Экономия ФОТ в год"`
	NetEffectYearRub    *float64    `json:"netEffectYearRub" description:"Экономия ФОТ + иные эффекты − OPEX"`
	PaybackYears        *float64    `json:"paybackYears" description:"null — не окупается"`
	Roi                 *float64    `json:"roi" description:"(эффект × горизонт − CAPEX) ÷ CAPEX"`
	TcoRub              *float64    `json:"tcoRub" description:"CAPEX + OPEX × горизонт"`
	BudgetOverRub       *float64    `json:"budgetOverRub" description:"Превышение бюджета CAPEX; 0 — в бюджете, null — бюджет не задан"`
	BudgetOverPct       *float64    `json:"budgetOverPct" description:"Превышение бюджета, доля 0–1"`
	Trace               []TraceItem `json:"trace"`
	Warnings            []string    `json:"warnings"`
}

// TraceItem is one step of the calculation trace: value, formula and source (ТЗ: без скрытых коэффициентов).
type TraceItem struct {
	Code    string   `json:"code"`
	Label   string   `json:"label"`
	Value   *float64 `json:"value"`
	Unit    string   `json:"unit"`
	Formula string   `json:"formula,omitempty"`
	Source  string   `json:"source" enum:"task,location,robot,norm,derived"`
}
