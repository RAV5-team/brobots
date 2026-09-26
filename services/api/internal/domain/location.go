package domain

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// DefaultPayrollTaxCoef is the payroll tax coefficient of all three organizer datasets.
const DefaultPayrollTaxCoef = 1.302

// ParameterDefinition describes a facility-type parameter from the organizer datasets.
type ParameterDefinition struct {
	Code             string   `json:"code"`
	FacilityTypeCode string   `json:"facilityTypeCode"`
	GroupName        string   `json:"groupName"`
	Name             string   `json:"name"`
	Unit             *string  `json:"unit"`
	ValueType        string   `json:"valueType"`
	BaseValueNumber  *float64 `json:"baseValueNumber"`
	BaseValueText    *string  `json:"baseValueText"`
	MinValue         *float64 `json:"minValue"`
	MaxValue         *float64 `json:"maxValue"`
	EnumValues       []string `json:"enumValues"`
	IsRequired       bool     `json:"isRequired"`
	IsConstant       bool     `json:"isConstant"`
	Role             *string  `json:"role"`
	StaffRole        *string  `json:"staffRole"`
	StaffAttr        *string  `json:"staffAttr"`
	FormSection      string   `json:"formSection"`
	Hint             *string  `json:"hint"`
	SourceNote       *string  `json:"sourceNote"`
	Sort             int      `json:"sort"`
}

// IsNumeric reports whether the parameter holds a number.
func (d ParameterDefinition) IsNumeric() bool {
	return d.ValueType == "number" || d.ValueType == "integer"
}

// BaseValue returns the organizer base value as a JSON-friendly value.
func (d ParameterDefinition) BaseValue() any {
	if d.BaseValueNumber != nil {
		return *d.BaseValueNumber
	}
	if d.BaseValueText != nil {
		return *d.BaseValueText
	}
	return nil
}

// ParameterValue is a location value of a parameter.
type ParameterValue struct {
	Code         string    `json:"code"`
	Number       *float64  `json:"-"`
	Text         *string   `json:"-"`
	Bool         *bool     `json:"-"`
	Value        any       `json:"value"`
	Source       string    `json:"source"`
	IsAssumption bool      `json:"isAssumption"`
	Note         *string   `json:"note"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Fill sets Value from the typed columns.
func (v *ParameterValue) Fill() {
	switch {
	case v.Number != nil:
		v.Value = *v.Number
	case v.Text != nil:
		v.Value = *v.Text
	case v.Bool != nil:
		v.Value = *v.Bool
	default:
		v.Value = nil
	}
}

// ParameterInput is a value sent by the client.
type ParameterInput struct {
	Code         string  `json:"code"`
	Value        any     `json:"value"`
	Source       string  `json:"source"`
	IsAssumption bool    `json:"isAssumption"`
	Note         *string `json:"note"`
}

// CoerceParameter converts and validates an input value against its definition.
// It returns nil typed values when the input value is null (the value is cleared).
func CoerceParameter(def ParameterDefinition, in ParameterInput, field string) (ParameterValue, *FieldError) {
	pv := ParameterValue{Code: def.Code, Source: in.Source, IsAssumption: in.IsAssumption, Note: in.Note}
	if pv.Source == "" {
		pv.Source = "user"
	}
	if in.Value == nil {
		return pv, nil
	}
	unit := Deref(def.Unit)
	switch {
	case def.IsNumeric():
		n, ok := toNumber(in.Value)
		if !ok {
			return pv, &FieldError{Field: field, Code: "invalid_type",
				Message: fmt.Sprintf("«%s»: «%v» не число", def.Name, in.Value),
				Hint:    "Укажите число, например " + FormatNumber(Deref(def.BaseValueNumber))}
		}
		if def.ValueType == "integer" && n != float64(int64(n)) {
			return pv, &FieldError{Field: field, Code: "invalid_type",
				Message: fmt.Sprintf("«%s»: нужно целое число", def.Name), Hint: "Уберите дробную часть"}
		}
		if (def.MinValue != nil && n < *def.MinValue) || (def.MaxValue != nil && n > *def.MaxValue) {
			return pv, &FieldError{Field: field, Code: "out_of_range",
				Message: fmt.Sprintf("«%s»: %s%s вне допустимого диапазона", def.Name, FormatNumber(n), unitSuffix(unit)),
				Hint:    "Допустимо " + RangeText(def.MinValue, def.MaxValue, unit)}
		}
		pv.Number = &n
	case def.ValueType == "bool":
		b, ok := in.Value.(bool)
		if !ok {
			return pv, &FieldError{Field: field, Code: "invalid_type",
				Message: fmt.Sprintf("«%s»: нужно да или нет", def.Name), Hint: "Укажите true или false"}
		}
		pv.Bool = &b
	default:
		s := strings.TrimSpace(fmt.Sprint(in.Value))
		if def.ValueType == "enum" && len(def.EnumValues) > 0 {
			found := false
			for _, e := range def.EnumValues {
				found = found || e == s
			}
			if !found {
				return pv, &FieldError{Field: field, Code: "invalid_value",
					Message: fmt.Sprintf("«%s»: «%s» не из списка", def.Name, s),
					Hint:    "Выберите: " + strings.Join(def.EnumValues, ", ")}
			}
		}
		pv.Text = &s
	}
	if def.IsConstant {
		base := def.BaseValue()
		pv.Fill()
		if base != nil && fmt.Sprint(base) != fmt.Sprint(pv.Value) {
			return pv, &FieldError{Field: field, Code: "constant",
				Message: fmt.Sprintf("«%s» — константа датасета", def.Name),
				Hint:    fmt.Sprintf("Значение фиксировано: %v", base)}
		}
	}
	pv.Fill()
	return pv, nil
}

func toNumber(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case string:
		s := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(t), " ", ""), "\u00a0", "")
		s = strings.ReplaceAll(s, ",", ".")
		n, err := strconv.ParseFloat(s, 64)
		return n, err == nil
	}
	return 0, false
}

// StaffGroup is a staff role of a location that robots may partly replace.
type StaffGroup struct {
	ID                  uuid.UUID `json:"id"`
	RoleName            string    `json:"roleName"`
	Headcount           int       `json:"headcount"`
	SalaryGrossMonthRub *float64  `json:"salaryGrossMonthRub"`
	Source              *string   `json:"source"`
	Sort                int       `json:"sort"`
}

// Budget is the location CAPEX budget, a soft ranking signal.
type Budget struct {
	Amount     *float64 `json:"amount"`
	Currency   string   `json:"currency"`
	SourceUnit *string  `json:"sourceUnit"`
	Source     *string  `json:"source"`
}

// LocationSummary aggregates tasks and parameters for list cards.
type LocationSummary struct {
	TotalAreaM2               *float64 `json:"totalAreaM2"`
	StaffTotal                *float64 `json:"staffTotal"`
	ShiftsPerDay              *float64 `json:"shiftsPerDay"`
	ShiftHours                *float64 `json:"shiftHours"`
	TasksCount                int      `json:"tasksCount"`
	LaborCostRubYear          float64  `json:"laborCostRubYear"`
	WorkersInTasks            float64  `json:"workersInTasks"`
	ParametersCompletenessPct int      `json:"parametersCompletenessPct"`
	AssumptionsCount          int      `json:"assumptionsCount"`
	ProjectsCount             int      `json:"projectsCount"`
	ProjectsCompleted         int      `json:"projectsCompleted"`
}

// LocationReadiness reports required parameters and errors of the profile.
type LocationReadiness struct {
	RequiredFilled int      `json:"requiredFilled"`
	RequiredTotal  int      `json:"requiredTotal"`
	Missing        []string `json:"missing"`
	StaffOK        bool     `json:"staffOk"`
	Assumptions    int      `json:"assumptions"`
	EmptyOptional  int      `json:"emptyOptional"`
}

// Location is a reusable facility profile.
type Location struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	FacilityTypeCode string    `json:"facilityTypeCode"`
	City             string    `json:"city"`
	Address          *string   `json:"address"`
	CapexBudget      Budget    `json:"capexBudget"`
	HorizonYears     *int      `json:"horizonYears"`
	IsDemo           bool      `json:"isDemo"`
	IsDraft          bool      `json:"isDraft"`
	UpdatedBy        *string   `json:"updatedBy"`
	// OwnerID is the Keycloak sub of the author; nil for demo data. Not exposed.
	OwnerID     *uuid.UUID         `json:"-"`
	StaffGroups []StaffGroup       `json:"staffGroups"`
	Summary     *LocationSummary   `json:"summary,omitempty"`
	Readiness   *LocationReadiness `json:"readiness,omitempty"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`
}

// ParameterItem is a definition with the location value, for the parameters tab.
type ParameterItem struct {
	Definition ParameterDefinition `json:"definition"`
	Value      *ParameterValue     `json:"value"`
}

// ParameterGroup groups parameters as in the organizer dataset.
type ParameterGroup struct {
	Name  string          `json:"name"`
	Items []ParameterItem `json:"items"`
}

// LocationParameters is the parameters tab of a location.
type LocationParameters struct {
	LocationID       uuid.UUID        `json:"locationId"`
	FacilityTypeCode string           `json:"facilityTypeCode"`
	Groups           []ParameterGroup `json:"groups"`
	CompletenessPct  int              `json:"completenessPct"`
	AssumptionsCount int              `json:"assumptionsCount"`
}

// ParamEnv builds the formula environment: values by code and by role.
func ParamEnv(defs []ParameterDefinition, values []ParameterValue) map[string]float64 {
	byCode := make(map[string]ParameterDefinition, len(defs))
	for _, d := range defs {
		byCode[d.Code] = d
	}
	env := make(map[string]float64)
	for _, v := range values {
		if v.Number == nil {
			continue
		}
		env[v.Code] = *v.Number
		if d, ok := byCode[v.Code]; ok && d.Role != nil {
			env[*d.Role] = *v.Number
		}
	}
	return env
}

// ComputeReadiness counts required and assumed parameters of a location profile.
func ComputeReadiness(defs []ParameterDefinition, values []ParameterValue, staff []StaffGroup) (LocationReadiness, int, int) {
	have := make(map[string]ParameterValue, len(values))
	for _, v := range values {
		if v.Value != nil {
			have[v.Code] = v
		}
	}
	r := LocationReadiness{Missing: []string{}}
	total, filled := 0, 0
	for _, d := range defs {
		if d.StaffRole != nil {
			continue
		}
		total++
		v, ok := have[d.Code]
		if ok {
			filled++
			if v.IsAssumption {
				r.Assumptions++
			}
		}
		switch {
		case d.IsRequired:
			r.RequiredTotal++
			if ok {
				r.RequiredFilled++
			} else {
				r.Missing = append(r.Missing, d.Name)
			}
		case !ok:
			r.EmptyOptional++
		}
	}
	for _, g := range staff {
		if g.Headcount > 0 && g.SalaryGrossMonthRub != nil {
			r.StaffOK = true
		}
	}
	r.RequiredTotal++
	if r.StaffOK {
		r.RequiredFilled++
	} else {
		r.Missing = append(r.Missing, "Группа персонала с численностью и окладом")
	}
	pct := 0
	if total > 0 {
		pct = filled * 100 / total
	}
	return r, pct, r.Assumptions
}
