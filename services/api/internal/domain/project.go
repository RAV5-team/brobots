package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Project statuses: a draft is edited and recalculated, a saved project is frozen.
const (
	ProjectDraft = "draft"
	ProjectSaved = "saved"
)

// ProjectSteps are the steps of the assessment (PRD 11): params → matching → simulation → economics.
var ProjectSteps = []string{"params", "matching", "simulation", "economics"}

// CalcParams are the seven fields of the «Параметры расчёта» panel (PRD 11.3, ТЗ 3.5.3). As overrides every
// field is optional: empty keeps the value of the snapshot.
type CalcParams struct {
	StaffCostRubPerMonth  *float64 `json:"staffCostRubPerMonth" description:"Оклад исполнителя gross, ₽ в месяц"`
	WorkHoursPerDay       *float64 `json:"workHoursPerDay" description:"Часов работы процесса в сутки"`
	RobotTripsPerHour     *float64 `json:"robotTripsPerHour" description:"Рейсов в час у решения solutionId; пока справочно — модель экономики её не принимает"`
	RobotPriceRub         *float64 `json:"robotPriceRub" description:"Цена единицы решения solutionId, ₽"`
	ServiceCostRubPerYear *float64 `json:"serviceCostRubPerYear" description:"Обслуживание парка решения solutionId, ₽ в год (покупка)"`
	Utilization           *float64 `json:"utilization" description:"Загрузка парка, доля 0–1; пока справочно — модель экономики её считает сама"`
	HorizonYears          *int     `json:"horizonYears" description:"Горизонт расчёта, лет, не меньше 5"`
	SolutionID            *uuid.UUID `json:"solutionId" description:"Решение, к которому относятся поля робота; пусто — выбранное или рекомендованное"`
}

// IsEmpty reports that no field is overridden.
func (c CalcParams) IsEmpty() bool {
	return c.StaffCostRubPerMonth == nil && c.WorkHoursPerDay == nil && c.RobotTripsPerHour == nil && c.RobotPriceRub == nil &&
		c.ServiceCostRubPerYear == nil && c.Utilization == nil && c.HorizonYears == nil
}

// ResultSummary is the figures of the selected scenario frozen at save (PRD 11.1, 11.6).
type ResultSummary struct {
	AcquisitionModel string   `json:"acquisitionModel" enum:"purchase,raas" required:"true"`
	CapexRub         float64  `json:"capexRub" required:"true"`
	OpexYearRub      float64  `json:"opexYearRub" required:"true"`
	PaybackYears     *float64 `json:"paybackYears" required:"true" description:"null — не окупается"`
	NetEffectYearRub *float64 `json:"netEffectYearRub" required:"true" description:"Годовой денежный эффект к текущему процессу"`
}

// Versions are the data versions pinned by a project (ТЗ 3.1.5).
type Versions struct {
	Catalog      int     `json:"catalog"`
	Dictionaries int     `json:"dictionaries"`
	Model        *string `json:"model"`
	Norms        *int    `json:"norms" description:"Версия нормативов А5, на которой считается проект; null — проект создан до версионирования нормативов"`
}

// ReferenceVersion is a current version counter.
type ReferenceVersion struct {
	Scope     string    `json:"scope"`
	Version   int       `json:"version"`
	Label     string    `json:"label"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ProjectSnapshot freezes the inputs of a project: the location and task when the project is
// created, the robot when the user selects it (docs/orchestrator.md).
type ProjectSnapshot struct {
	Location   Location         `json:"location"`
	Parameters []ParameterValue `json:"parameters"`
	Task       Task             `json:"task"`
	Robot      *RobotSnapshot   `json:"robot,omitempty" description:"Выбранный робот; появляется после выбора"`
}

// RobotCard holds the catalog fields of a robot used by matching and calculation.
type RobotCard struct {
	SolutionID        uuid.UUID   `json:"solutionId"`
	Code              string      `json:"code"`
	Name              string      `json:"name"`
	Manufacturer      string      `json:"manufacturer"`
	SolutionType      *string     `json:"solutionType"`
	Status            *string     `json:"status" enum:"operation,piloting,rnd"`
	Trl               *int        `json:"trl"`
	AcquisitionModels []string    `json:"acquisitionModels"`
	SoftwareCostPct   *float64    `json:"softwareCostPct" description:"Стоимость ПО в год, % от стоимости робота"`
	ServiceCostPct    *float64    `json:"serviceCostPct" description:"Обслуживание в год, % от стоимости робота"`
	ServiceLifeYears  *float64    `json:"serviceLifeYears"`
	CompletenessPct   *int        `json:"completenessPct" description:"Полнота обязательных характеристик, %; null — в расчётах до версии с рейтингом"`
	Spec              *RobotSpec  `json:"spec"`
	Capability        *Capability `json:"capability" description:"Строка класса операции задачи"`
	Offer             *Offer      `json:"offer" description:"Предложение с ценой по умолчанию"`
}

// NewRobotCard copies the fields of a catalog solution for a work type.
func NewRobotCard(s Solution, workTypeID uuid.UUID) RobotCard {
	completeness := s.CompletenessPct
	card := RobotCard{
		SolutionID: s.ID, Code: s.Code, Name: s.Name, Manufacturer: s.Manufacturer, SolutionType: s.SolutionType,
		Status: s.Status, Trl: s.Trl, AcquisitionModels: s.AcquisitionModels, SoftwareCostPct: s.SoftwareCostPct,
		ServiceCostPct: s.ServiceCostPct, ServiceLifeYears: s.ServiceLifeYears, CompletenessPct: &completeness, Spec: s.Spec,
		Capability: s.ActiveCapability(workTypeID),
	}
	for i := range s.Offers {
		if s.Offers[i].IsDefault {
			card.Offer = &s.Offers[i]
		}
	}
	if card.Offer == nil && s.Price != nil {
		card.Offer = &Offer{Label: "По умолчанию", Price: *s.Price, IsDefault: true}
		if s.Price.OfferID != nil {
			card.Offer.ID = *s.Price.OfferID
		}
	}
	return card
}

// RobotSnapshot is the selected robot frozen in the project, taken from the calculation input.
type RobotSnapshot struct {
	RobotCard
	AcquisitionModel string    `json:"acquisitionModel" enum:"purchase,raas"`
	CalcRunID        uuid.UUID `json:"calcRunId"`
	CalcResultID     uuid.UUID `json:"calcResultId"`
	TakenAt          time.Time `json:"takenAt"`
}

// Selection is the configuration chosen by the user.
type Selection struct {
	SolutionID       uuid.UUID  `json:"solutionId"`
	SolutionName     string     `json:"solutionName"`
	AcquisitionModel *string    `json:"acquisitionModel"`
	CalcResultID     *uuid.UUID `json:"calcResultId"`
}

// EvaluationInfo is a short description of the latest calculation of a project.
type EvaluationInfo struct {
	ID           uuid.UUID `json:"id"`
	ModelVersion string    `json:"modelVersion"`
	CreatedAt    time.Time `json:"createdAt"`
	Stale        bool      `json:"stale" description:"Параметры проекта изменились после расчёта"`
}

// RunInfo is a short description of a matching run.
type RunInfo struct {
	ID        uuid.UUID   `json:"id"`
	CreatedAt time.Time   `json:"createdAt"`
	Counts    MatchCounts `json:"counts"`
}

// MatchCounts are candidate counts by state.
type MatchCounts struct {
	Total             int `json:"total"`
	Passed            int `json:"passed"`
	NeedsVerification int `json:"needsVerification"`
	Excluded          int `json:"excluded"`
	Manual            int `json:"manual"`
}

// ProjectTaskRef is the task of a project.
type ProjectTaskRef struct {
	ID       uuid.UUID   `json:"id"`
	Name     string      `json:"name"`
	WorkType WorkTypeRef `json:"workType"`
}

// Project is an assessment of exactly one task on one location.
type Project struct {
	ID               uuid.UUID       `json:"id"`
	Name             string          `json:"name"`
	LocationID       uuid.UUID       `json:"locationId"`
	LocationName     string          `json:"locationName"`
	FacilityTypeCode string          `json:"facilityTypeCode"`
	Task             ProjectTaskRef  `json:"task"`
	Status           string          `json:"status" enum:"draft,saved" description:"draft — черновик, saved — оценка закреплена"`
	SavedAt          *time.Time      `json:"savedAt"`
	HorizonYears     *int            `json:"horizonYears"`
	Versions         Versions        `json:"versions"`
	SnapshotTakenAt  time.Time       `json:"snapshotTakenAt"`
	LatestEvaluation *EvaluationInfo `json:"latestEvaluation"`
	DataChanged      bool            `json:"dataChanged"`
	CatalogUpdated   bool            `json:"catalogUpdated"`
	NormsUpdated     bool            `json:"normsUpdated" description:"Есть версия нормативов новее закреплённой; применяется через refresh-snapshot"`
	LocationDeleted  bool            `json:"locationDeleted"`
	PinnedSolutionID *uuid.UUID      `json:"pinnedSolutionId"`
	Selection        *Selection      `json:"selection"`
	CopiedFromID     *uuid.UUID      `json:"copiedFromId"`
	IsDemo           bool            `json:"isDemo"`
	Step             string          `json:"step" enum:"params,matching,simulation,economics" description:"Самый дальний открытый шаг черновика"`
	Inputs           json.RawMessage `json:"inputs" description:"Решения пользователя по шагам в модели фронтенда; null — шаги ещё не проходили"`
	ResultSummary    *ResultSummary  `json:"resultSummary" description:"Цифры выбранного сценария на момент сохранения; null — у черновика"`
	QuoteRequestedAt *time.Time      `json:"quoteRequestedAt" description:"Когда запрошено коммерческое предложение"`
	// OwnerID is the Keycloak sub of the author; nil for demo projects. Not exposed.
	OwnerID   *uuid.UUID `json:"-"`
	LatestRun *RunInfo   `json:"latestRun"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// ManualCandidate is a solution added to the comparison by hand (ТЗ 3.4.4).
type ManualCandidate struct {
	SolutionID   uuid.UUID `json:"solutionId"`
	SolutionName string    `json:"solutionName"`
	Reason       *string   `json:"reason"`
	AddedAt      time.Time `json:"addedAt"`
}

// Dashboard is the summary for the dashboard screen.
type Dashboard struct {
	Locations struct {
		Total          int            `json:"total"`
		ByFacilityType map[string]int `json:"byFacilityType"`
	} `json:"locations"`
	Projects struct {
		Total      int `json:"total"`
		Calculated int `json:"calculated"`
	} `json:"projects"`
	ManualLaborCostRubYear float64            `json:"manualLaborCostRubYear"`
	FoundSavingsRubYear    *float64           `json:"foundSavingsRubYear"`
	Versions               []ReferenceVersion `json:"versions"`
	RecentProjects         []Project          `json:"recentProjects"`
	TopLocations           []Location         `json:"topLocations"`
}
