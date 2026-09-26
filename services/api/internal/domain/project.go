package domain

import (
	"time"

	"github.com/google/uuid"
)

// Versions are the data versions pinned by a project (ТЗ 3.1.5).
type Versions struct {
	Catalog      int     `json:"catalog"`
	Dictionaries int     `json:"dictionaries"`
	Model        *string `json:"model"`
}

// ReferenceVersion is a current version counter.
type ReferenceVersion struct {
	Scope     string    `json:"scope"`
	Version   int       `json:"version"`
	Label     string    `json:"label"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ProjectSnapshot freezes the inputs of a project.
type ProjectSnapshot struct {
	Location   Location         `json:"location"`
	Parameters []ParameterValue `json:"parameters"`
	Task       Task             `json:"task"`
}

// Selection is the configuration chosen by the user.
type Selection struct {
	SolutionID       uuid.UUID `json:"solutionId"`
	SolutionName     string    `json:"solutionName"`
	AcquisitionModel *string   `json:"acquisitionModel"`
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
	ID               uuid.UUID      `json:"id"`
	Name             string         `json:"name"`
	LocationID       uuid.UUID      `json:"locationId"`
	LocationName     string         `json:"locationName"`
	FacilityTypeCode string         `json:"facilityTypeCode"`
	Task             ProjectTaskRef `json:"task"`
	Status           string         `json:"status" enum:"params,matching,simulation,economics,result"`
	HorizonYears     *int           `json:"horizonYears"`
	Versions         Versions       `json:"versions"`
	SnapshotTakenAt  time.Time      `json:"snapshotTakenAt"`
	DataChanged      bool           `json:"dataChanged"`
	CatalogUpdated   bool           `json:"catalogUpdated"`
	LocationDeleted  bool           `json:"locationDeleted"`
	PinnedSolutionID *uuid.UUID     `json:"pinnedSolutionId"`
	Selection        *Selection     `json:"selection"`
	CopiedFromID     *uuid.UUID     `json:"copiedFromId"`
	IsDemo           bool           `json:"isDemo"`
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
