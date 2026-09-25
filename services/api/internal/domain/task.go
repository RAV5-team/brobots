package domain

import (
	"time"

	"github.com/google/uuid"
)

// TaskWorker is a staff group performing the task with its share of time.
type TaskWorker struct {
	StaffGroupID        uuid.UUID `json:"staffGroupId"`
	RoleName            string    `json:"roleName"`
	Headcount           int       `json:"headcount"`
	SalaryGrossMonthRub *float64  `json:"salaryGrossMonthRub"`
	TimeShare           float64   `json:"timeShare"`
}

// Provenance tells where a task value came from.
type Provenance struct {
	Source       string  `json:"source"`
	Expression   *string `json:"expression"`
	IsAssumption bool    `json:"isAssumption"`
	Note         *string `json:"note"`
}

// TaskDerived holds values computed from the task, shown on the task form.
type TaskDerived struct {
	PeakIntensityPerHour  *float64 `json:"peakIntensityPerHour"`
	PeakToRobotizePerHour *float64 `json:"peakToRobotizePerHour"`
	AvgHourlyToRobotize   *float64 `json:"avgHourlyToRobotize"`
	TargetFte             *float64 `json:"targetFte"`
	BasePayrollRubYear    *float64 `json:"basePayrollRubYear"`
	TargetPayrollRubYear  *float64 `json:"targetPayrollRubYear"`
	MaxRobotWidthM        *float64 `json:"maxRobotWidthM"`
	PayrollTaxCoef        float64  `json:"payrollTaxCoef"`
}

// ReadinessItem is one of the fields needed before calculation.
type ReadinessItem struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

// TaskReadiness is «Готово к расчёту · 9/9» or the list of missing items.
type TaskReadiness struct {
	Ready   bool            `json:"ready"`
	Filled  int             `json:"filled"`
	Total   int             `json:"total"`
	Missing []ReadinessItem `json:"missing"`
}

// Task is a process instantiated on a location: the unit of matching and calculation.
type Task struct {
	ID               uuid.UUID             `json:"id"`
	LocationID       uuid.UUID             `json:"locationId"`
	LocationName     string                `json:"locationName"`
	FacilityTypeCode string                `json:"facilityTypeCode"`
	ProcessID        uuid.UUID             `json:"processId"`
	ProcessName      string                `json:"processName"`
	WorkType         WorkTypeRef           `json:"workType"`
	KpiUnit          *string               `json:"kpiUnit"`
	Name             string                `json:"name"`
	Params           TaskParams            `json:"params"`
	HandlingMethods  []HandlingShare       `json:"handlingMethods"`
	Workers          []TaskWorker          `json:"workers"`
	Provenance       map[string]Provenance `json:"provenance"`
	Derived          TaskDerived           `json:"derived"`
	Readiness        TaskReadiness         `json:"readiness"`
	RobotsCount      int                   `json:"robotsCount"`
	CreatedAt        time.Time             `json:"createdAt"`
	UpdatedAt        time.Time             `json:"updatedAt"`
	ArchivedAt       *time.Time            `json:"archivedAt"`
}

// CargoHandling are handling methods that move a physical load.
var CargoHandling = map[string]bool{"forks": true, "platform": true, "tow": true, "body": true, "manipulator": true}

// HasCargo reports whether the task handles a physical load.
func (t *Task) HasCargo() bool {
	for _, h := range t.HandlingMethods {
		if CargoHandling[h.Code] {
			return true
		}
	}
	return false
}

// ComputeDerived fills Derived; payrollCoef is the location payroll tax coefficient.
func (t *Task) ComputeDerived(payrollCoef float64) {
	p := t.Params
	d := TaskDerived{PayrollTaxCoef: payrollCoef}
	if p.DailyVolume != nil && p.WorkHoursPerDay != nil && *p.WorkHoursPerDay > 0 {
		hourly := *p.DailyVolume / *p.WorkHoursPerDay
		if p.PeakFactor != nil {
			d.PeakIntensityPerHour = Ptr(hourly * *p.PeakFactor)
			if p.AutomationShare != nil {
				d.PeakToRobotizePerHour = Ptr(*d.PeakIntensityPerHour * *p.AutomationShare)
			}
		}
		if p.AutomationShare != nil {
			d.AvgHourlyToRobotize = Ptr(hourly * *p.AutomationShare)
		}
	}
	if len(t.Workers) > 0 {
		fte, payroll, complete := 0.0, 0.0, true
		for _, w := range t.Workers {
			fte += float64(w.Headcount) * w.TimeShare
			if w.SalaryGrossMonthRub == nil {
				complete = false
				continue
			}
			payroll += float64(w.Headcount) * w.TimeShare * *w.SalaryGrossMonthRub * 12 * payrollCoef
		}
		if complete {
			d.BasePayrollRubYear = Ptr(payroll)
		}
		if p.AutomationShare != nil {
			d.TargetFte = Ptr(fte * *p.AutomationShare)
			if complete {
				d.TargetPayrollRubYear = Ptr(payroll * *p.AutomationShare)
			}
		}
	}
	if p.MinAisleWidthM != nil {
		d.MaxRobotWidthM = Ptr(*p.MinAisleWidthM - Deref(p.WidthClearanceM))
	}
	t.Derived = d
}

// ComputeReadiness fills Readiness with the nine items needed for calculation.
func (t *Task) ComputeReadiness() {
	p := t.Params
	hasWorkers, hasSalary := false, len(t.Workers) > 0
	for _, w := range t.Workers {
		if w.Headcount > 0 && w.TimeShare > 0 {
			hasWorkers = true
		}
		if w.SalaryGrossMonthRub == nil {
			hasSalary = false
		}
	}
	items := []struct {
		item ReadinessItem
		ok   bool
	}{
		{ReadinessItem{"process", "процесс"}, true},
		{ReadinessItem{"dailyVolume", "объём"}, p.DailyVolume != nil && *p.DailyVolume > 0},
		{ReadinessItem{"peakFactor", "пиковый коэффициент"}, p.PeakFactor != nil},
		{ReadinessItem{"unitMassKg", "масса груза"}, !t.HasCargo() || p.UnitMassKg != nil},
		{ReadinessItem{"handlingMethods", "способы обработки"}, len(t.HandlingMethods) > 0},
		{ReadinessItem{"routeLengthM", "маршрут"}, p.RouteLengthM != nil},
		{ReadinessItem{"environment", "среда"}, p.Environment != nil},
		{ReadinessItem{"workers", "исполнители"}, hasWorkers},
		{ReadinessItem{"salary", "оклад"}, hasSalary},
	}
	r := TaskReadiness{Total: len(items), Missing: []ReadinessItem{}}
	for _, it := range items {
		if it.ok {
			r.Filled++
		} else {
			r.Missing = append(r.Missing, it.item)
		}
	}
	r.Ready = r.Filled == r.Total
	t.Readiness = r
}
