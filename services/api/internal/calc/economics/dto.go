package economics

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
)

// The DTOs mirror services/economics/src/economic_service/adapters/http/schemas.py. The service
// rejects unknown fields (extra="forbid") and requires nullable fields to be present, so nothing
// here is omitempty unless the Python field has a default.

// Dec is a decimal sent as a JSON string, so pydantic reads it into Decimal without float noise.
type Dec float64

// MarshalJSON writes the shortest exact representation as a string.
func (d Dec) MarshalJSON() ([]byte, error) {
	return json.Marshal(strconv.FormatFloat(float64(d), 'f', -1, 64))
}

// UnmarshalJSON accepts a JSON number or a decimal string.
func (d *Dec) UnmarshalJSON(b []byte) error {
	var s Scalar
	if err := s.UnmarshalJSON(b); err != nil {
		return err
	}
	if s.Num == nil {
		return fmt.Errorf("decimal expected, got %s", b)
	}
	*d = Dec(*s.Num)
	return nil
}

// Scalar is a value of a metric or trace: pydantic serializes Decimal as a string, so a string
// that parses as a finite number is a number; other strings are text.
type Scalar struct {
	Num  *float64
	Bool *bool
	Text *string
}

// UnmarshalJSON decodes null, a boolean, a number or a string.
func (s *Scalar) UnmarshalJSON(b []byte) error {
	*s = Scalar{}
	b = bytes.TrimSpace(b)
	switch {
	case bytes.Equal(b, []byte("null")):
		return nil
	case bytes.Equal(b, []byte("true")), bytes.Equal(b, []byte("false")):
		v := b[0] == 't'
		s.Bool = &v
		return nil
	case len(b) > 0 && b[0] == '"':
		var str string
		if err := json.Unmarshal(b, &str); err != nil {
			return err
		}
		if f, err := strconv.ParseFloat(str, 64); err == nil && !math.IsInf(f, 0) && !math.IsNaN(f) {
			s.Num = &f
			return nil
		}
		s.Text = &str
		return nil
	}
	var f float64
	if err := json.Unmarshal(b, &f); err != nil {
		return err
	}
	s.Num = &f
	return nil
}

type sourceDTO struct {
	Source       string  `json:"source"`
	Origin       string  `json:"origin"`
	Confirmation string  `json:"confirmation"`
	Version      *string `json:"version"`
	Note         *string `json:"note"`
}

type moneyDTO struct {
	Amount   Dec    `json:"amount"`
	Currency string `json:"currency"`
	Scale    int    `json:"scale"`
}

func rub(v float64) moneyDTO { return moneyDTO{Amount: Dec(v), Currency: "RUB"} }

func rubPtr(v *float64) *moneyDTO {
	if v == nil {
		return nil
	}
	m := rub(*v)
	return &m
}

// pair is a Python tuple[str, Decimal]: a two-element JSON array.
type pair struct {
	Code  string
	Value Dec
}

func (p pair) MarshalJSON() ([]byte, error) { return json.Marshal([]any{p.Code, p.Value}) }

type taskDTO struct {
	ProjectID                  string    `json:"project_id"`
	TaskID                     string    `json:"task_id"`
	OperationsPerDay           Dec       `json:"operations_per_day"`
	PeakFactor                 Dec       `json:"peak_factor"`
	AutomatableShare           Dec       `json:"automatable_share"`
	OperatingHoursPerDay       Dec       `json:"operating_hours_per_day"`
	OneWayRouteM               Dec       `json:"one_way_route_m"`
	SiteSpeedLimitMps          Dec       `json:"site_speed_limit_mps"`
	LoadUnitMassKg             Dec       `json:"load_unit_mass_kg"`
	LoadIsDivisible            bool      `json:"load_is_divisible"`
	AvailableChargingPowerKw   Dec       `json:"available_charging_power_kw"`
	TargetFte                  Dec       `json:"target_fte"`
	TargetAnnualPayroll        moneyDTO  `json:"target_annual_payroll"`
	BaselineAnnualOpex         moneyDTO  `json:"baseline_annual_opex"`
	FleetOperatorsPerShift     Dec       `json:"fleet_operators_per_shift"`
	ShiftsPerDay               Dec       `json:"shifts_per_day"`
	StaffTimeLossShare         Dec       `json:"staff_time_loss_share"`
	FleetOperatorMonthlySalary moneyDTO  `json:"fleet_operator_monthly_salary"`
	TargetMonthlySalary        moneyDTO  `json:"target_monthly_salary"`
	AnnualStaffTurnover        Dec       `json:"annual_staff_turnover"`
	AnnualOtherBenefits        moneyDTO  `json:"annual_other_benefits"`
	ReplacementByHandling      []pair    `json:"replacement_by_handling"`
	HorizonYears               int       `json:"horizon_years"`
	Budget                     *moneyDTO `json:"budget"`
	Source                     sourceDTO `json:"source"`
	LiftTripShare              Dec       `json:"lift_trip_share"`
	OneWayLiftSeconds          Dec       `json:"one_way_lift_seconds"`
	IntegrationCost            *moneyDTO `json:"integration_cost"`
	AnnualConsumablesPerRobot  *moneyDTO `json:"annual_consumables_per_robot"`
}

type sourcedValueDTO struct {
	Value  Dec       `json:"value"`
	Unit   string    `json:"unit"`
	Source sourceDTO `json:"source"`
}

type candidateDTO struct {
	CandidateID                string           `json:"candidate_id"`
	RobotCode                  string           `json:"robot_code"`
	Price                      *moneyDTO        `json:"price"`
	PayloadKg                  *Dec             `json:"payload_kg"`
	MaxSpeedMps                *Dec             `json:"max_speed_mps"`
	LoadingSeconds             *Dec             `json:"loading_seconds"`
	UnloadingSeconds           *Dec             `json:"unloading_seconds"`
	AveragePowerKw             *Dec             `json:"average_power_kw"`
	HandlingMethod             *string          `json:"handling_method"`
	CatalogStatus              string           `json:"catalog_status"`
	Confirmation               string           `json:"confirmation"`
	Source                     sourceDTO        `json:"source"`
	MaturityTrl                *sourcedValueDTO `json:"maturity_trl"`
	CatalogCompletenessPercent *sourcedValueDTO `json:"catalog_completeness_percent"`
}

type normsDTO struct {
	PayrollMultiplier       Dec       `json:"payroll_multiplier"`
	ProductiveTimeShare     Dec       `json:"productive_time_share"`
	TechnicalAvailability   Dec       `json:"technical_availability"`
	FleetReserveShare       Dec       `json:"fleet_reserve_share"`
	OperatingSpeedFactor    Dec       `json:"operating_speed_factor"`
	RobotsPerCharger        Dec       `json:"robots_per_charger"`
	ChargerInstalledPrice   moneyDTO  `json:"charger_installed_price"`
	ChargerPowerKw          Dec       `json:"charger_power_kw"`
	FmsUpfrontShare         Dec       `json:"fms_upfront_share"`
	DeliveryShare           Dec       `json:"delivery_share"`
	CommissioningShare      Dec       `json:"commissioning_share"`
	TrainingCost            moneyDTO  `json:"training_cost"`
	CapexContingencyShare   Dec       `json:"capex_contingency_share"`
	AnnualServiceShare      Dec       `json:"annual_service_share"`
	AnnualLicenseShare      Dec       `json:"annual_license_share"`
	AnnualRepairShare       Dec       `json:"annual_repair_share"`
	ElectricityPrice        moneyDTO  `json:"electricity_price"`
	BatteryLifeYears        Dec       `json:"battery_life_years"`
	BatteryReplacementShare Dec       `json:"battery_replacement_share"`
	AnnualConnectivityCost  moneyDTO  `json:"annual_connectivity_cost"`
	EquipmentLifeYears      Dec       `json:"equipment_life_years"`
	DiscountRate            Dec       `json:"discount_rate"`
	LoanShare               Dec       `json:"loan_share"`
	LoanInterestRate        Dec       `json:"loan_interest_rate"`
	LoanTermYears           Dec       `json:"loan_term_years"`
	MonthlyRaasShare        Dec       `json:"monthly_raas_share"`
	RaasSetupShare          Dec       `json:"raas_setup_share"`
	RecruitmentMonthsSalary Dec       `json:"recruitment_months_salary"`
	GoodPaybackYears        Dec       `json:"good_payback_years"`
	MediumPaybackYears      Dec       `json:"medium_payback_years"`
	SitePreparationShare    Dec       `json:"site_preparation_share"`
	Source                  sourceDTO `json:"source"`
}

type scenarioDTO struct {
	AcquisitionModel string `json:"acquisition_model"`
	PriceFactor      Dec    `json:"price_factor"`
	VolumeFactor     Dec    `json:"volume_factor"`
	LaborFactor      Dec    `json:"labor_factor"`
	ModelVersion     string `json:"model_version"`
}

type evaluationRequestDTO struct {
	EvaluationID            string         `json:"evaluation_id"`
	ProjectID               string         `json:"project_id"`
	ModelVersion            string         `json:"model_version"`
	Task                    taskDTO        `json:"task"`
	Candidates              []candidateDTO `json:"candidates"`
	Norms                   normsDTO       `json:"norms"`
	Scenarios               []scenarioDTO  `json:"scenarios"`
	RequestedRankingVersion *string        `json:"requested_ranking_version"`
	CalculationCurrency     string         `json:"calculation_currency"`
	RankingWeights          []pair         `json:"ranking_weights"`
}

type modelVersionDTO struct {
	ModelVersion   string `json:"model_version"`
	RankingVersion string `json:"ranking_version"`
}

type snapshotDTO struct {
	EvaluationID string    `json:"evaluation_id"`
	Result       resultDTO `json:"result"`
}

type resultDTO struct {
	ModelVersion string                  `json:"model_version"`
	Status       string                  `json:"status"`
	Candidates   []candidateEconomicsDTO `json:"candidates"`
	Ranking      rankingDTO              `json:"ranking"`
}

type candidateEconomicsDTO struct {
	CandidateID      string      `json:"candidate_id"`
	AcquisitionModel string      `json:"acquisition_model"`
	Status           string      `json:"status"`
	Metrics          []metricDTO `json:"metrics"`
	Traces           []traceDTO  `json:"traces"`
	Risks            []string    `json:"risks"`
}

type metricDTO struct {
	Code  string `json:"code"`
	Value Scalar `json:"value"`
	Unit  string `json:"unit"`
}

type traceDTO struct {
	FormulaID string          `json:"formula_id"`
	Result    Scalar          `json:"result"`
	Unit      string          `json:"unit"`
	Inputs    []traceInputDTO `json:"inputs"`
}

type traceInputDTO struct {
	Name  string `json:"name"`
	Value Scalar `json:"value"`
}

type rankingDTO struct {
	Status       string           `json:"status"`
	ModelVersion *string          `json:"model_version"`
	Items        []rankingItemDTO `json:"items"`
}

type rankingItemDTO struct {
	CandidateID      string         `json:"candidate_id"`
	AcquisitionModel string         `json:"acquisition_model"`
	Rank             *int           `json:"rank"`
	Score            Scalar         `json:"score"`
	Status           string         `json:"status"`
	UnrankedReason   *string        `json:"unranked_reason"`
	Criteria         []criterionDTO `json:"criteria"`
}

type criterionDTO struct {
	Code             string  `json:"code"`
	RawValue         Scalar  `json:"raw_value"`
	Unit             string  `json:"unit"`
	NormalizedValue  Scalar  `json:"normalized_value"`
	ConfiguredWeight Scalar  `json:"configured_weight"`
	Contribution     Scalar  `json:"contribution"`
	IsMissing        bool    `json:"is_missing"`
	MissingReason    *string `json:"missing_reason"`
}
