// Package matching screens catalog robots against the conditions of one task:
// the operation class must match, then hard checks give pass, fail or unknown.
package matching

import (
	"strings"

	"github.com/brobots/api/internal/domain"
)

// RulesetVersion identifies the check rules stored with every run.
const RulesetVersion = "match-rules/v1"

// Condition sources.
const (
	SourceTask    = "task"
	SourceFormula = "formula"
	SourceProject = "project"
	SourceRule    = "rule"
)

// Condition is one requirement the robot is checked against.
type Condition struct {
	Code       string   `json:"code"`
	Label      string   `json:"label"`
	Applicable bool     `json:"applicable"`
	Number     *float64 `json:"number"`
	Text       *string  `json:"text"`
	List       []string `json:"list"`
	Unit       string   `json:"unit"`
	Source     string   `json:"source" enum:"task,formula,project,rule"`
	Note       string   `json:"note"`
}

// Conditions are the resolved requirements of a task, optionally overridden in a project.
type Conditions struct {
	Handling       Condition `json:"handling"`
	Environment    Condition `json:"environment"`
	Payload        Condition `json:"payload"`
	AisleWidth     Condition `json:"aisleWidth"`
	MinTemperature Condition `json:"minTemperature"`
	LiftHeight     Condition `json:"liftHeight"`
	Price          Condition `json:"price"`
}

// List returns the conditions in display order.
func (c Conditions) List() []Condition {
	return []Condition{c.Handling, c.Environment, c.Payload, c.AisleWidth, c.MinTemperature, c.LiftHeight, c.Price}
}

// Override is a project-level replacement of a task condition.
type Override struct {
	Code   string   `json:"code" enum:"handling,environment,payload,aisle_width,min_temperature,lift_height"`
	Number *float64 `json:"number"`
	Text   *string  `json:"text"`
	List   []string `json:"list"`
	Note   *string  `json:"note"`
}

// OverridableCodes are the conditions a project may replace; price is a fixed rule.
var OverridableCodes = []string{"handling", "environment", "payload", "aisle_width", "min_temperature", "lift_height"}

// BuildConditions resolves the task requirements and applies project overrides.
func BuildConditions(t domain.Task, overrides []Override) Conditions {
	p := t.Params
	c := Conditions{
		Handling:       Condition{Code: "handling", Label: "Способ обработки груза", Source: SourceTask, Applicable: true, List: []string{}},
		Environment:    Condition{Code: "environment", Label: "Среда работы", Source: SourceTask, Applicable: true, Text: p.Environment},
		Payload:        Condition{Code: "payload", Label: "Грузоподъёмность не меньше", Unit: "кг", Source: SourceTask},
		AisleWidth:     Condition{Code: "aisle_width", Label: "Ширина робота не больше", Unit: "м", Source: SourceFormula},
		MinTemperature: Condition{Code: "min_temperature", Label: "Мин. температура эксплуатации", Unit: "°C", Source: SourceTask, Applicable: true, Number: p.MinOperatingTempC},
		LiftHeight:     Condition{Code: "lift_height", Label: "Высота подъёма не меньше", Unit: "мм", Source: SourceTask, Number: p.RequiredLiftHeightMm, Applicable: p.RequiredLiftHeightMm != nil},
		Price:          Condition{Code: "price", Label: "Цена в каталоге", Source: SourceRule, Applicable: true, Text: domain.Ptr("обязательна"), Note: "Без цены экономику не посчитать"},
	}
	for _, h := range t.HandlingMethods {
		c.Handling.List = append(c.Handling.List, h.Code)
	}
	switch {
	case !t.HasCargo():
		c.Payload.Note = "Задача без груза — проверка не применяется"
	case p.CargoDivisible != nil && *p.CargoDivisible:
		c.Payload.Applicable = true
		c.Payload.Note = "Груз делимый — число рейсов посчитает расчёт парка"
	default:
		c.Payload.Applicable = true
		c.Payload.Number = p.UnitMassKg
		c.Payload.Note = "= масса единицы груза, груз неделим"
	}
	if p.MinAisleWidthM != nil {
		c.AisleWidth.Applicable = true
		clearance := domain.Deref(p.WidthClearanceM)
		c.AisleWidth.Number = domain.Ptr(round(*p.MinAisleWidthM-clearance, 3))
		c.AisleWidth.Note = "= проход " + domain.FormatNumber(*p.MinAisleWidthM) + " − запас " + domain.FormatNumber(clearance) + " м"
	} else {
		c.AisleWidth.Applicable = true
		c.AisleWidth.Note = "Ширина прохода не задана"
	}
	for _, o := range overrides {
		note := "Изменено в проекте"
		if o.Note != nil && strings.TrimSpace(*o.Note) != "" {
			note = *o.Note
		}
		switch o.Code {
		case "handling":
			c.Handling.List, c.Handling.Source, c.Handling.Note = append([]string{}, o.List...), SourceProject, note
		case "environment":
			c.Environment.Text, c.Environment.Source, c.Environment.Note = o.Text, SourceProject, note
		case "payload":
			c.Payload.Number, c.Payload.Source, c.Payload.Note, c.Payload.Applicable = o.Number, SourceProject, note, o.Number != nil
		case "aisle_width":
			c.AisleWidth.Number, c.AisleWidth.Source, c.AisleWidth.Note, c.AisleWidth.Applicable = o.Number, SourceProject, note, true
		case "min_temperature":
			c.MinTemperature.Number, c.MinTemperature.Source, c.MinTemperature.Note = o.Number, SourceProject, note
		case "lift_height":
			c.LiftHeight.Number, c.LiftHeight.Source, c.LiftHeight.Note, c.LiftHeight.Applicable = o.Number, SourceProject, note, o.Number != nil
		}
	}
	return c
}

// SourceLabel is the Russian label of a condition source.
func SourceLabel(s string) string {
	switch s {
	case SourceTask:
		return "задача"
	case SourceFormula:
		return "формула по задаче"
	case SourceProject:
		return "условие проекта"
	case SourceRule:
		return "правило подбора"
	}
	return s
}

func round(v float64, digits int) float64 {
	p := 1.0
	for i := 0; i < digits; i++ {
		p *= 10
	}
	if v < 0 {
		return -float64(int64(-v*p+0.5)) / p
	}
	return float64(int64(v*p+0.5)) / p
}
