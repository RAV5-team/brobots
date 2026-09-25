package domain

import (
	"math"
	"time"

	"github.com/google/uuid"
)

// WorkTypeRef is a compact reference to an operation class.
type WorkTypeRef struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	UnitLabel string    `json:"unitLabel"`
}

// WorkType is an operation class (OP-01…), the matching key.
type WorkType struct {
	ID               uuid.UUID `json:"id"`
	Code             string    `json:"code"`
	Name             string    `json:"name"`
	Description      *string   `json:"description"`
	UnitLabel        string    `json:"unitLabel"`
	Action           *string   `json:"action"`
	HandledObject    *string   `json:"handledObject"`
	TypicalCarriers  *string   `json:"typicalCarriers"`
	ExampleProcesses *string   `json:"exampleProcesses"`
	WorkCategoryCode *string   `json:"workCategoryCode"`
	IsActive         bool      `json:"isActive"`
	RobotsCount      int       `json:"robotsCount"`
	ProcessesCount   int       `json:"processesCount"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// Ref returns the compact reference.
func (w WorkType) Ref() WorkTypeRef {
	return WorkTypeRef{ID: w.ID, Code: w.Code, Name: w.Name, UnitLabel: w.UnitLabel}
}

// DataSource is a registered origin of catalog, price or norm data.
type DataSource struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	SourceType      string    `json:"sourceType"`
	Origin          string    `json:"origin"`
	LocatorKind     *string   `json:"locatorKind"`
	URL             *string   `json:"url"`
	FileName        *string   `json:"fileName"`
	DataStatus      string    `json:"dataStatus"`
	Provides        *string   `json:"provides"`
	ActualizedOn    Date      `json:"actualizedOn"`
	RefreshSchedule string    `json:"refreshSchedule"`
	Responsible     *string   `json:"responsible"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// Price is the default offer price of a catalog position.
type Price struct {
	OfferID     *uuid.UUID `json:"offerId,omitempty"`
	AmountRub   *float64   `json:"amountRub"`
	Percent     *float64   `json:"percent"`
	Unit        string     `json:"unit"`
	IncludesVat bool       `json:"includesVat"`
}

// Offer is a priced variant of a catalog position.
type Offer struct {
	ID              uuid.UUID  `json:"id"`
	Label           string     `json:"label"`
	Price           Price      `json:"price"`
	IsDefault       bool       `json:"isDefault"`
	OrganizerRowRef *string    `json:"organizerRowRef"`
	SourceID        *uuid.UUID `json:"sourceId"`
}

// RobotSpec holds hardware characteristics; nil means unknown.
type RobotSpec struct {
	PayloadKg             *float64   `json:"payloadKg"`
	PayloadExact          bool       `json:"payloadExact"`
	LengthMm              *int       `json:"lengthMm"`
	WidthMm               *int       `json:"widthMm"`
	HeightMm              *int       `json:"heightMm"`
	DimensionsExact       bool       `json:"dimensionsExact"`
	MassKg                *float64   `json:"massKg"`
	MaxSpeedMps           *float64   `json:"maxSpeedMps"`
	AutonomyH             *float64   `json:"autonomyH"`
	ChargeTimeMin         *float64   `json:"chargeTimeMin"`
	MinTempC              *float64   `json:"minTempC"`
	MinTempExact          bool       `json:"minTempExact"`
	MaxTempC              *float64   `json:"maxTempC"`
	AvgPowerKw            *float64   `json:"avgPowerKw"`
	LoadTimeS             *float64   `json:"loadTimeS"`
	UnloadTimeS           *float64   `json:"unloadTimeS"`
	LiftHeightMm          *int       `json:"liftHeightMm"`
	PositioningAccuracyMm *float64   `json:"positioningAccuracyMm"`
	NavigationType        *string    `json:"navigationType"`
	HandlingMethodCode    *string    `json:"handlingMethodCode"`
	IndoorAllowed         *bool      `json:"indoorAllowed"`
	OutdoorAllowed        *bool      `json:"outdoorAllowed"`
	MinPassageMm          *int       `json:"minPassageMm"`
	FloorRequirements     *string    `json:"floorRequirements"`
	ChargingInfra         *string    `json:"chargingInfra"`
	Connectivity          []string   `json:"connectivity"`
	Integrations          []string   `json:"integrations"`
	ServiceTerms          *string    `json:"serviceTerms"`
	SpecsConfirmed        string     `json:"specsConfirmed" enum:"yes,partial,no"`
	SpecsSourceText       *string    `json:"specsSourceText"`
	SpecsSourceID         *uuid.UUID `json:"specsSourceId"`
	SpecsActualizedOn     *Date      `json:"specsActualizedOn"`
}

// Capability is a robot's ability to perform one operation class.
type Capability struct {
	ID                  uuid.UUID   `json:"id"`
	SolutionID          uuid.UUID   `json:"solutionId"`
	WorkType            WorkTypeRef `json:"workType"`
	ThroughputPerHour   *float64    `json:"throughputPerHour"`
	ThroughputRangeText *string     `json:"throughputRangeText"`
	ThroughputExact     bool        `json:"throughputExact"`
	HandlingMethodCode  *string     `json:"handlingMethodCode" description:"Пусто — берётся из ТТХ робота"`
	Environment         *string     `json:"environment" enum:"indoor,outdoor,both" description:"Пусто — по допускам робота"`
	LiftHeightMm        *int        `json:"liftHeightMm"`
	SourceText          *string     `json:"sourceText"`
	SourceID            *uuid.UUID  `json:"sourceId"`
	IsActive            bool        `json:"isActive"`
	Effective           Effective   `json:"effective" description:"Значения после подстановки из ТТХ робота"`
}

// Effective holds capability attributes after falling back to the robot spec.
type Effective struct {
	HandlingMethodCode *string `json:"handlingMethodCode"`
	Environment        *string `json:"environment"`
	LiftHeightMm       *int    `json:"liftHeightMm"`
}

// Resolve fills Effective from the capability row and the robot spec.
func (c *Capability) Resolve(spec *RobotSpec) {
	c.Effective = Effective{HandlingMethodCode: c.HandlingMethodCode, Environment: c.Environment, LiftHeightMm: c.LiftHeightMm}
	if spec == nil {
		return
	}
	if c.Effective.HandlingMethodCode == nil {
		c.Effective.HandlingMethodCode = spec.HandlingMethodCode
	}
	if c.Effective.LiftHeightMm == nil {
		c.Effective.LiftHeightMm = spec.LiftHeightMm
	}
	if c.Effective.Environment == nil {
		c.Effective.Environment = SpecEnvironment(spec)
	}
}

// SpecEnvironment derives the environment from the robot admission flags.
func SpecEnvironment(spec *RobotSpec) *string {
	if spec == nil || spec.IndoorAllowed == nil || spec.OutdoorAllowed == nil {
		return nil
	}
	switch {
	case *spec.IndoorAllowed && *spec.OutdoorAllowed:
		return Ptr("both")
	case *spec.IndoorAllowed:
		return Ptr("indoor")
	case *spec.OutdoorAllowed:
		return Ptr("outdoor")
	}
	return nil
}

// Badges are organizer catalog marks.
type Badges struct {
	TestedByFcbas bool `json:"testedByFcbas"`
	InRegistry719 bool `json:"inRegistry719"`
}

// Solution is a catalog position with its spec, capabilities and offers.
type Solution struct {
	ID                 uuid.UUID    `json:"id"`
	Code               string       `json:"code"`
	Kind               string       `json:"kind" enum:"robot,infrastructure,software,service,support"`
	Name               string       `json:"name"`
	Manufacturer       string       `json:"manufacturer"`
	OrganizerIDs       []string     `json:"organizerIds" description:"id строк catalog_export_v4 после склейки дублей"`
	ProductClass       *string      `json:"productClass" enum:"brs,bas,software"`
	TypeGroup          *string      `json:"typeGroup"`
	SolutionType       *string      `json:"solutionType"`
	Status             *string      `json:"status" enum:"operation,piloting,rnd"`
	Trl                *int         `json:"trl" description:"УГТ, 1–9"`
	MarketPotential    *int         `json:"marketPotential"`
	Region             *string      `json:"region"`
	Country            *string      `json:"country"`
	Description        *string      `json:"description"`
	CasesText          *string      `json:"casesText"`
	OrganizerScenarios []string     `json:"organizerScenarios"`
	AcquisitionModels  []string     `json:"acquisitionModels"`
	Badges             Badges       `json:"badges"`
	PhotoURL           *string      `json:"photoUrl"`
	CostType           *string      `json:"costType"`
	QuantityRule       *string      `json:"quantityRule"`
	CompatibleWith     *string      `json:"compatibleWith"`
	SoftwareCostPct    *float64     `json:"softwareCostPct"`
	ServiceCostPct     *float64     `json:"serviceCostPct"`
	ServiceLifeYears   *float64     `json:"serviceLifeYears"`
	SourceID           *uuid.UUID   `json:"sourceId"`
	IsActive           bool         `json:"isActive"`
	Industries         []string     `json:"industries"`
	Price              *Price       `json:"price"`
	Spec               *RobotSpec   `json:"spec"`
	Capabilities       []Capability `json:"capabilities"`
	Offers             []Offer      `json:"offers,omitempty"`
	CompletenessPct    int          `json:"completenessPct"`
	MissingSpecs       []string     `json:"missingSpecs"`
	UsedInProjects     int          `json:"usedInProjects"`
	CreatedAt          time.Time    `json:"createdAt"`
	UpdatedAt          time.Time    `json:"updatedAt"`
}

// SolutionSummary is a catalog list item.
type SolutionSummary struct {
	ID              uuid.UUID     `json:"id"`
	Code            string        `json:"code"`
	Kind            string        `json:"kind"`
	Name            string        `json:"name"`
	Manufacturer    string        `json:"manufacturer"`
	TypeGroup       *string       `json:"typeGroup"`
	SolutionType    *string       `json:"solutionType"`
	Status          *string       `json:"status"`
	Trl             *int          `json:"trl"`
	Price           *Price        `json:"price"`
	PriceBand       *string       `json:"priceBand"`
	CostType        *string       `json:"costType"`
	QuantityRule    *string       `json:"quantityRule"`
	CompatibleWith  *string       `json:"compatibleWith"`
	PayloadKg       *float64      `json:"payloadKg"`
	SpecsConfirmed  *string       `json:"specsConfirmed"`
	NeedsConfirm    bool          `json:"needsConfirmation"`
	CompletenessPct int           `json:"completenessPct"`
	MissingSpecs    []string      `json:"missingSpecs"`
	WorkTypes       []WorkTypeRef `json:"workTypes"`
	Industries      []string      `json:"industries"`
	Badges          Badges        `json:"badges"`
	PhotoURL        *string       `json:"photoUrl"`
	IsActive        bool          `json:"isActive"`
	UpdatedAt       time.Time     `json:"updatedAt"`
}

// Summary converts a full solution into a list item.
func (s *Solution) Summary() SolutionSummary {
	sum := SolutionSummary{
		ID: s.ID, Code: s.Code, Kind: s.Kind, Name: s.Name, Manufacturer: s.Manufacturer,
		TypeGroup: s.TypeGroup, SolutionType: s.SolutionType, Status: s.Status, Trl: s.Trl,
		Price: s.Price, PriceBand: s.PriceBand(), CostType: s.CostType, QuantityRule: s.QuantityRule,
		CompatibleWith: s.CompatibleWith, CompletenessPct: s.CompletenessPct, MissingSpecs: s.MissingSpecs,
		Industries: s.Industries, Badges: s.Badges, PhotoURL: s.PhotoURL, IsActive: s.IsActive,
		UpdatedAt: s.UpdatedAt, WorkTypes: []WorkTypeRef{},
	}
	if s.Spec != nil {
		sum.PayloadKg = s.Spec.PayloadKg
		sum.SpecsConfirmed = Ptr(s.Spec.SpecsConfirmed)
		sum.NeedsConfirm = s.Spec.SpecsConfirmed != "yes"
	}
	for _, c := range s.Capabilities {
		if c.IsActive {
			sum.WorkTypes = append(sum.WorkTypes, c.WorkType)
		}
	}
	return sum
}

// PriceRub returns the absolute default price, if any.
func (s *Solution) PriceRub() *float64 {
	if s.Price == nil || s.Price.Unit == "percent_capex" {
		return nil
	}
	return s.Price.AmountRub
}

// PriceBand classifies the default price; exact boundaries belong to the lower band.
func (s *Solution) PriceBand() *string {
	p := s.PriceRub()
	if p == nil || s.Price.Unit != "item" {
		return nil
	}
	switch {
	case *p <= 1_000_000:
		return Ptr("lte1m")
	case *p <= 3_000_000:
		return Ptr("1to3m")
	}
	return Ptr("gt3m")
}

// ActiveCapability returns the active capability for a work type.
func (s *Solution) ActiveCapability(workTypeID uuid.UUID) *Capability {
	for i := range s.Capabilities {
		if s.Capabilities[i].IsActive && s.Capabilities[i].WorkType.ID == workTypeID {
			return &s.Capabilities[i]
		}
	}
	return nil
}

// RequiredRobotSpecs lists the characteristics counted by completeness (ТЗ 3.3).
var RequiredRobotSpecs = []Option{
	{Code: "payloadKg", Name: "Грузоподъёмность"},
	{Code: "lengthMm", Name: "Длина"},
	{Code: "widthMm", Name: "Ширина"},
	{Code: "heightMm", Name: "Высота"},
	{Code: "maxSpeedMps", Name: "Макс. скорость"},
	{Code: "autonomyH", Name: "Автономность"},
	{Code: "minTempC", Name: "Мин. температура"},
	{Code: "positioningAccuracyMm", Name: "Точность позиционирования"},
	{Code: "navigationType", Name: "Тип навигации"},
	{Code: "handlingMethodCode", Name: "Способ обработки груза"},
	{Code: "indoorAllowed", Name: "Допуск в помещения"},
	{Code: "outdoorAllowed", Name: "Работа на улице"},
	{Code: "price", Name: "Цена"},
	{Code: "workTypes", Name: "Классы операций"},
}

// ComputeCompleteness fills CompletenessPct and MissingSpecs.
func (s *Solution) ComputeCompleteness() {
	filled := map[string]bool{"price": s.Price != nil}
	hasCap := false
	for _, c := range s.Capabilities {
		hasCap = hasCap || c.IsActive
	}
	required := RequiredRobotSpecs
	if s.Kind != "robot" {
		required = []Option{{Code: "price", Name: "Цена"}, {Code: "costType", Name: "Тип затрат"}, {Code: "quantityRule", Name: "Норма на объект"}}
		filled["costType"] = s.CostType != nil
		filled["quantityRule"] = s.QuantityRule != nil
	} else {
		filled["workTypes"] = hasCap
		if sp := s.Spec; sp != nil {
			filled["payloadKg"] = sp.PayloadKg != nil
			filled["lengthMm"] = sp.LengthMm != nil
			filled["widthMm"] = sp.WidthMm != nil
			filled["heightMm"] = sp.HeightMm != nil
			filled["maxSpeedMps"] = sp.MaxSpeedMps != nil
			filled["autonomyH"] = sp.AutonomyH != nil
			filled["minTempC"] = sp.MinTempC != nil
			filled["positioningAccuracyMm"] = sp.PositioningAccuracyMm != nil
			filled["navigationType"] = sp.NavigationType != nil
			filled["handlingMethodCode"] = sp.HandlingMethodCode != nil
			filled["indoorAllowed"] = sp.IndoorAllowed != nil
			filled["outdoorAllowed"] = sp.OutdoorAllowed != nil
		}
	}
	s.MissingSpecs = []string{}
	n := 0
	for _, r := range required {
		if filled[r.Code] {
			n++
		} else {
			s.MissingSpecs = append(s.MissingSpecs, r.Code)
		}
	}
	s.CompletenessPct = int(math.Round(float64(n) * 100 / float64(len(required))))
}
