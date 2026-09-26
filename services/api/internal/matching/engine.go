package matching

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

// Check statuses.
const (
	Pass          = "pass"
	Fail          = "fail"
	Unknown       = "unknown"
	NotApplicable = "not_applicable"
)

// Candidate states.
const (
	StatePassed            = "passed"
	StateNeedsVerification = "needs_verification"
	StateExcluded          = "excluded"
)

// Risk codes.
const (
	RiskSpecsUnconfirmed  = "specs_unconfirmed"
	RiskThroughputUnknown = "throughput_unknown"
	RiskHypothesisOnly    = "hypothesis_only"
)

const (
	srcSpec       = "каталог · ТТХ робота"
	srcCapability = "каталог · класс операции робота"
	srcOffer      = "каталог · предложение"
)

// HandlingLabels are the Russian names used in check messages.
var HandlingLabels = map[string]string{
	"forks": "вилы", "platform": "платформа", "tow": "буксировка", "body": "кузов",
	"manipulator": "манипулятор", "brushes": "щётки", "none": "без груза",
}

// EnvironmentLabels are the Russian names of environments.
var EnvironmentLabels = map[string]string{"indoor": "помещение", "outdoor": "улица", "both": "помещение и улица"}

var checkLabels = map[string]string{
	"work_type": "Класс операции", "handling": "Способ обработки груза", "environment": "Среда работы",
	"payload": "Грузоподъёмность", "aisle_width": "Габариты и проход", "min_temperature": "Условия эксплуатации",
	"lift_height": "Высота подъёма", "price": "Цена в каталоге",
}

// CheckLabel returns the Russian label of a check code.
func CheckLabel(code string) string {
	if l, ok := checkLabels[code]; ok {
		return l
	}
	return code
}

// Robot is the catalog data of one candidate.
type Robot struct {
	Solution   *domain.Solution
	Capability *domain.Capability
	IsManual   bool
}

// Check is the explained result of one hard check.
type Check struct {
	Code                string `json:"code" enum:"work_type,handling,environment,payload,aisle_width,min_temperature,lift_height,price"`
	Label               string `json:"label"`
	Status              string `json:"status" enum:"pass,fail,unknown,not_applicable"`
	RobotValue          string `json:"robotValue"`
	RequiredValue       string `json:"requiredValue"`
	Unit                string `json:"unit"`
	RobotValueSource    string `json:"robotValueSource"`
	RequiredValueSource string `json:"requiredValueSource"`
	Message             string `json:"message"`
}

// Result is the outcome of screening one robot.
type Result struct {
	State        string   `json:"state" enum:"passed,needs_verification,excluded"`
	Checks       []Check  `json:"checks"`
	Risks        []string `json:"risks" description:"specs_unconfirmed, throughput_unknown, hypothesis_only"`
	TransferFlag *string  `json:"transferFlag" enum:"P0,P1,P2,P3" description:"Пока считается только P3: статус rnd или УГТ ниже 7"`
	Summary      string   `json:"summary"`
}

// Evaluate runs the hard checks of one robot against the conditions.
func Evaluate(c Conditions, workType domain.WorkTypeRef, r Robot) Result {
	s := r.Solution
	cp := r.Capability
	if cp != nil {
		cp.Resolve(s.Spec)
	}
	checks := []Check{
		checkWorkType(workType, cp),
		checkHandling(c.Handling, cp),
		checkEnvironment(c.Environment, cp),
		checkPayload(c.Payload, s.Spec),
		checkAisleWidth(c.AisleWidth, s.Spec),
		checkMinTemperature(c.MinTemperature, s.Spec),
		checkLiftHeight(c.LiftHeight, cp),
		checkPrice(s),
	}
	res := Result{State: StatePassed, Checks: checks, Risks: []string{}}
	var fails, unknowns []string
	for _, ch := range checks {
		switch ch.Status {
		case Fail:
			fails = append(fails, ch.Message)
		case Unknown:
			unknowns = append(unknowns, ch.Label)
		}
	}
	switch {
	case len(fails) > 0:
		res.State = StateExcluded
		res.Summary = "Исключено: " + strings.Join(fails, "; ")
	case len(unknowns) > 0:
		res.State = StateNeedsVerification
		res.Summary = "Требует проверки: не хватает данных — " + strings.ToLower(strings.Join(unknowns, ", "))
	default:
		res.Summary = "Все жёсткие проверки пройдены"
	}
	if s.Spec == nil || s.Spec.SpecsConfirmed != "yes" {
		res.Risks = append(res.Risks, RiskSpecsUnconfirmed)
	}
	if cp == nil || cp.ThroughputPerHour == nil || !cp.ThroughputExact {
		res.Risks = append(res.Risks, RiskThroughputUnknown)
	}
	if (s.Status != nil && *s.Status == "rnd") || (s.Trl != nil && *s.Trl < 7) {
		res.TransferFlag = domain.Ptr("P3")
		res.Risks = append(res.Risks, RiskHypothesisOnly)
	}
	return res
}

func checkWorkType(wt domain.WorkTypeRef, cp *domain.Capability) Check {
	ch := Check{Code: "work_type", Label: "Класс операции", RequiredValue: wt.Code + " · " + wt.Name,
		RequiredValueSource: "задача · процесс", RobotValueSource: srcCapability}
	if cp == nil {
		ch.Status = Fail
		ch.RobotValue = "нет"
		ch.Message = fmt.Sprintf("Класс операции: нужно %s, у робота его нет", wt.Code)
		return ch
	}
	ch.Status = Pass
	ch.RobotValue = cp.WorkType.Code + " · " + cp.WorkType.Name
	ch.Message = "Класс операции совпадает: " + wt.Code
	return ch
}

func checkHandling(c Condition, cp *domain.Capability) Check {
	ch := Check{Code: "handling", Label: "Способ обработки груза", RequiredValue: labels(c.List, HandlingLabels),
		RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcCapability}
	switch {
	case len(c.List) == 0:
		ch.Status = Unknown
		ch.Message = "Способ обработки: в задаче не заданы допустимые способы"
	case cp == nil || cp.Effective.HandlingMethodCode == nil:
		ch.Status = Unknown
		ch.Message = "Способ обработки: у робота не указан"
	default:
		code := *cp.Effective.HandlingMethodCode
		ch.RobotValue = labelOf(code, HandlingLabels)
		if cp.HandlingMethodCode == nil {
			ch.RobotValueSource = srcSpec
		}
		if slices.Contains(c.List, code) {
			ch.Status = Pass
			ch.Message = "Способ обработки допустим: " + ch.RobotValue
		} else {
			ch.Status = Fail
			ch.Message = fmt.Sprintf("Способ обработки груза: нужно %s, есть %s", ch.RequiredValue, ch.RobotValue)
		}
	}
	return ch
}

func checkEnvironment(c Condition, cp *domain.Capability) Check {
	ch := Check{Code: "environment", Label: "Среда работы", RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcCapability}
	if c.Text != nil {
		ch.RequiredValue = labelOf(*c.Text, EnvironmentLabels)
	}
	switch {
	case c.Text == nil:
		ch.Status = Unknown
		ch.Message = "Среда: в задаче не указана"
	case cp == nil || cp.Effective.Environment == nil:
		ch.Status = Unknown
		ch.Message = "Среда: у робота не указаны допуски в помещения и на улицу"
	default:
		env := *cp.Effective.Environment
		ch.RobotValue = labelOf(env, EnvironmentLabels)
		if cp.Environment == nil {
			ch.RobotValueSource = srcSpec
		}
		if env == "both" || env == *c.Text {
			ch.Status = Pass
			ch.Message = "Среда подходит: " + ch.RequiredValue
		} else {
			ch.Status = Fail
			if *c.Text == "indoor" {
				ch.Message = "Не допущен в помещения: робот только для улицы"
			} else {
				ch.Message = "Не допущен к работе на улице: робот только для помещений"
			}
		}
	}
	return ch
}

func checkPayload(c Condition, spec *domain.RobotSpec) Check {
	ch := Check{Code: "payload", Label: "Грузоподъёмность", Unit: "кг", RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcSpec}
	if spec != nil && spec.PayloadKg != nil {
		ch.RobotValue = num(*spec.PayloadKg)
	}
	switch {
	case !c.Applicable:
		ch.Status = NotApplicable
		ch.Message = c.Note
	case c.Number == nil:
		if spec == nil || spec.PayloadKg == nil {
			ch.Status = Unknown
			ch.Message = "Грузоподъёмность: у робота не указана"
		} else {
			ch.Status = Pass
			ch.Message = c.Note
		}
	case spec == nil || spec.PayloadKg == nil:
		ch.RequiredValue = "≥ " + num(*c.Number)
		ch.Status = Unknown
		ch.Message = "Грузоподъёмность: у робота не указана"
	default:
		ch.RequiredValue = "≥ " + num(*c.Number)
		if *spec.PayloadKg >= *c.Number {
			ch.Status = Pass
			ch.Message = fmt.Sprintf("Грузоподъёмность %s кг ≥ %s кг", num(*spec.PayloadKg), num(*c.Number))
		} else {
			ch.Status = Fail
			ch.Message = fmt.Sprintf("Грузоподъёмность: нужно ≥ %s кг, есть %s кг", num(*c.Number), num(*spec.PayloadKg))
		}
	}
	return ch
}

func checkAisleWidth(c Condition, spec *domain.RobotSpec) Check {
	ch := Check{Code: "aisle_width", Label: "Габариты и проход", Unit: "м", RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcSpec}
	var width *float64
	if spec != nil && spec.WidthMm != nil {
		width = domain.Ptr(float64(*spec.WidthMm) / 1000)
		ch.RobotValue = num(*width)
	}
	if c.Number != nil {
		ch.RequiredValue = "≤ " + num(*c.Number)
	}
	switch {
	case c.Number == nil:
		ch.Status = Unknown
		ch.Message = "Проход: ширина прохода не задана"
	case width == nil:
		ch.Status = Unknown
		ch.Message = "Габариты: у робота не указана ширина"
	case *width <= *c.Number:
		ch.Status = Pass
		ch.Message = fmt.Sprintf("Ширина %s м ≤ %s м (%s)", num(*width), num(*c.Number), strings.TrimPrefix(c.Note, "= "))
	default:
		ch.Status = Fail
		ch.Message = fmt.Sprintf("Габариты: ширина робота %s м больше допустимой %s м", num(*width), num(*c.Number))
	}
	return ch
}

func checkMinTemperature(c Condition, spec *domain.RobotSpec) Check {
	ch := Check{Code: "min_temperature", Label: "Условия эксплуатации", Unit: "°C", RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcSpec}
	if spec != nil && spec.MinTempC != nil {
		ch.RobotValue = "от " + num(*spec.MinTempC)
	}
	if c.Number != nil {
		ch.RequiredValue = "работа при " + num(*c.Number)
	}
	switch {
	case c.Number == nil:
		ch.Status = Unknown
		ch.Message = "Температура: в задаче не указана минимальная температура"
	case spec == nil || spec.MinTempC == nil:
		ch.Status = Unknown
		ch.Message = "Температура: у робота не указана минимальная температура"
	case *spec.MinTempC <= *c.Number:
		ch.Status = Pass
		ch.Message = fmt.Sprintf("Работает от %s °C, в зоне %s °C", num(*spec.MinTempC), num(*c.Number))
	default:
		ch.Status = Fail
		ch.Message = fmt.Sprintf("Условия эксплуатации: в зоне %s °C, робот работает от %s °C", num(*c.Number), num(*spec.MinTempC))
	}
	return ch
}

func checkLiftHeight(c Condition, cp *domain.Capability) Check {
	ch := Check{Code: "lift_height", Label: "Высота подъёма", Unit: "мм", RequiredValueSource: SourceLabel(c.Source), RobotValueSource: srcCapability}
	if !c.Applicable || c.Number == nil {
		ch.Status = NotApplicable
		ch.Message = "Подъём на ярус в задаче не требуется"
		return ch
	}
	ch.RequiredValue = "≥ " + num(*c.Number)
	if cp == nil || cp.Effective.LiftHeightMm == nil {
		ch.Status = Unknown
		ch.Message = "Высота подъёма: у робота не указана"
		return ch
	}
	h := float64(*cp.Effective.LiftHeightMm)
	ch.RobotValue = num(h)
	if h >= *c.Number {
		ch.Status = Pass
		ch.Message = fmt.Sprintf("Высота подъёма %s мм ≥ %s мм", num(h), num(*c.Number))
	} else {
		ch.Status = Fail
		ch.Message = fmt.Sprintf("Высота подъёма: нужно ≥ %s мм, есть %s мм", num(*c.Number), num(h))
	}
	return ch
}

func checkPrice(s *domain.Solution) Check {
	ch := Check{Code: "price", Label: "Цена в каталоге", RequiredValue: "обязательна", RequiredValueSource: SourceLabel(SourceRule), RobotValueSource: srcOffer, Unit: "₽"}
	if p := s.PriceRub(); p != nil {
		ch.Status = Pass
		ch.RobotValue = num(*p)
		ch.Message = "Цена есть: " + num(*p) + " ₽"
		return ch
	}
	ch.Status = Fail
	ch.RobotValue = "нет"
	ch.Message = "Нет цены в каталоге — экономику не посчитать"
	return ch
}

func num(v float64) string { return domain.FormatNumber(v) }

func labelOf(code string, m map[string]string) string {
	if l, ok := m[code]; ok {
		return l
	}
	return code
}

func labels(codes []string, m map[string]string) string {
	out := make([]string, len(codes))
	for i, c := range codes {
		out[i] = labelOf(c, m)
	}
	return strings.Join(out, " / ")
}

// CandidateSolution is the catalog part of a candidate shown in the rating.
type CandidateSolution struct {
	ID             uuid.UUID `json:"id"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	Manufacturer   string    `json:"manufacturer"`
	SolutionType   *string   `json:"solutionType"`
	Status         *string   `json:"status"`
	Trl            *int      `json:"trl"`
	PriceRub       *float64  `json:"priceRub"`
	PayloadKg      *float64  `json:"payloadKg"`
	SpecsConfirmed *string   `json:"specsConfirmed"`
}

// Candidate is a screened robot with explanations.
type Candidate struct {
	ID                *uuid.UUID        `json:"id"`
	Solution          CandidateSolution `json:"solution"`
	CapabilityID      *uuid.UUID        `json:"capabilityId"`
	OfferID           *uuid.UUID        `json:"offerId"`
	ThroughputPerHour *float64          `json:"throughputPerHour"`
	IsManual          bool              `json:"isManual"`
	Result
}

// NewCandidate evaluates a robot and wraps the result.
func NewCandidate(c Conditions, wt domain.WorkTypeRef, r Robot, offerID *uuid.UUID) Candidate {
	s := r.Solution
	cand := Candidate{
		Solution: CandidateSolution{
			ID: s.ID, Code: s.Code, Name: s.Name, Manufacturer: s.Manufacturer, SolutionType: s.SolutionType,
			Status: s.Status, Trl: s.Trl, PriceRub: s.PriceRub(),
		},
		OfferID:  offerID,
		IsManual: r.IsManual,
		Result:   Evaluate(c, wt, r),
	}
	if s.Spec != nil {
		cand.Solution.PayloadKg = s.Spec.PayloadKg
		cand.Solution.SpecsConfirmed = domain.Ptr(s.Spec.SpecsConfirmed)
	}
	if r.Capability != nil {
		cand.CapabilityID = &r.Capability.ID
		cand.ThroughputPerHour = r.Capability.ThroughputPerHour
	}
	return cand
}

var stateOrder = map[string]int{StatePassed: 0, StateNeedsVerification: 1, StateExcluded: 2}

// Sort orders candidates: passed, needs verification, excluded; manual last within a state.
func Sort(cs []Candidate) {
	slices.SortStableFunc(cs, func(a, b Candidate) int {
		if d := stateOrder[a.State] - stateOrder[b.State]; d != 0 {
			return d
		}
		if a.IsManual != b.IsManual {
			if a.IsManual {
				return 1
			}
			return -1
		}
		return strings.Compare(a.Solution.Name, b.Solution.Name)
	})
}

// Count returns the counts by state.
func Count(cs []Candidate) domain.MatchCounts {
	var m domain.MatchCounts
	for _, c := range cs {
		m.Total++
		if c.IsManual {
			m.Manual++
		}
		switch c.State {
		case StatePassed:
			m.Passed++
		case StateNeedsVerification:
			m.NeedsVerification++
		case StateExcluded:
			m.Excluded++
		}
	}
	return m
}

// Run is a matching result for one task.
type Run struct {
	ID             *uuid.UUID         `json:"id"`
	ProjectID      *uuid.UUID         `json:"projectId"`
	TaskID         uuid.UUID          `json:"taskId"`
	WorkType       domain.WorkTypeRef `json:"workType"`
	CatalogVersion int                `json:"catalogVersion"`
	RulesetVersion string             `json:"rulesetVersion"`
	Conditions     []Condition        `json:"conditions"`
	Counts         domain.MatchCounts `json:"counts"`
	Candidates     []Candidate        `json:"candidates"`
	CreatedAt      *time.Time         `json:"createdAt"`
}
