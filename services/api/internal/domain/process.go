package domain

import (
	"time"

	"github.com/google/uuid"
)

// HandlingShare is an allowed handling method with its labor replacement ratio.
type HandlingShare struct {
	Code                  string   `json:"code"`
	LaborReplacementRatio *float64 `json:"laborReplacementRatio"`
}

// Formula computes a task parameter from location parameters.
type Formula struct {
	FieldCode   string  `json:"fieldCode"`
	Expression  string  `json:"expression"`
	Description *string `json:"description"`
}

// Process is a reference work template with exactly one operation class.
type Process struct {
	ID                    uuid.UUID   `json:"id"`
	Code                  string      `json:"code"`
	Name                  string      `json:"name"`
	Description           *string     `json:"description"`
	WorkType              WorkTypeRef `json:"workType"`
	WorkCategoryCode      *string     `json:"workCategoryCode"`
	KpiUnit               *string     `json:"kpiUnit"`
	IsCustom              bool        `json:"isCustom"`
	CreatedFromLocationID *uuid.UUID  `json:"createdFromLocationId"`
	// OwnerID is the author of a user process; nil for a reference process. Not exposed.
	OwnerID                *uuid.UUID      `json:"-"`
	DefaultWorkerRole      *string         `json:"defaultWorkerRole"`
	DefaultWorkerTimeShare *float64        `json:"defaultWorkerTimeShare"`
	FacilityTypes          []string        `json:"facilityTypes"`
	HandlingMethods        []HandlingShare `json:"handlingMethods"`
	Formulas               []Formula       `json:"formulas"`
	Defaults               TaskParams      `json:"defaults"`
	IsActive               bool            `json:"isActive"`
	RobotsCount            int             `json:"robotsCount"`
	LocationsCount         int             `json:"locationsCount"`
	CreatedAt              time.Time       `json:"createdAt"`
	UpdatedAt              time.Time       `json:"updatedAt"`
}

// ProcessUsage is a task created from the process, shown on the process card.
type ProcessUsage struct {
	TaskID               uuid.UUID `json:"taskId"`
	TaskName             string    `json:"taskName"`
	LocationID           uuid.UUID `json:"locationId"`
	LocationName         string    `json:"locationName"`
	FacilityTypeCode     string    `json:"facilityTypeCode"`
	DailyVolume          *float64  `json:"dailyVolume"`
	PeakIntensityPerHour *float64  `json:"peakIntensityPerHour"`
	Workers              string    `json:"workers"`
	LaborCostRubYear     *float64  `json:"laborCostRubYear"`
	AutomationShare      *float64  `json:"automationShare"`
	Ready                bool      `json:"ready"`
}

// ProcessDetail is a process with its usage on locations.
type ProcessDetail struct {
	Process
	Usage []ProcessUsage `json:"usage"`
}
