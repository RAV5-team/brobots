package service

import (
	"testing"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

func candidate(models ...string) calc.Candidate {
	return calc.Candidate{RobotCard: domain.RobotCard{SolutionID: uuid.New(), AcquisitionModels: models}}
}

func TestCompleteResults(t *testing.T) {
	both, purchaseOnly := candidate(), candidate(calc.Purchase)
	req := calc.Request{AcquisitionModels: []string{calc.Purchase, calc.RaaS}, Candidates: []calc.Candidate{both, purchaseOnly}}
	resp := calc.Response{ModelVersion: "v1", Results: []calc.Result{
		{SolutionID: both.SolutionID, AcquisitionModel: calc.RaaS, Calculable: true},
		{SolutionID: purchaseOnly.SolutionID, AcquisitionModel: calc.Purchase, Calculable: true},
	}}
	out, err := completeResults(req, resp)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 {
		t.Fatalf("results = %d, want 3: both models of the first robot and purchase of the second", len(out))
	}
	if out[0].SolutionID != both.SolutionID || out[0].AcquisitionModel != calc.Purchase || out[0].Calculable || out[0].Reason == nil {
		t.Errorf("missing result must become not calculable in request order: %+v", out[0])
	}
	for _, r := range out {
		if r.Trace == nil {
			t.Errorf("trace of %s %s is nil", r.SolutionID, r.AcquisitionModel)
		}
	}
}

func TestCompleteResultsRejectsForeignAnswers(t *testing.T) {
	c := candidate(calc.Purchase)
	req := calc.Request{AcquisitionModels: []string{calc.Purchase, calc.RaaS}, Candidates: []calc.Candidate{c}}
	for name, resp := range map[string]calc.Response{
		"no version":        {Results: []calc.Result{}},
		"not requested":     {ModelVersion: "v1", Results: []calc.Result{{SolutionID: uuid.New(), AcquisitionModel: calc.Purchase}}},
		"model not offered": {ModelVersion: "v1", Results: []calc.Result{{SolutionID: c.SolutionID, AcquisitionModel: calc.RaaS}}},
		"duplicate": {ModelVersion: "v1", Results: []calc.Result{
			{SolutionID: c.SolutionID, AcquisitionModel: calc.Purchase}, {SolutionID: c.SolutionID, AcquisitionModel: calc.Purchase}}},
	} {
		if _, err := completeResults(req, resp); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestAssessable(t *testing.T) {
	for _, tc := range []struct {
		state  string
		manual bool
		want   bool
	}{
		{matching.StatePassed, false, true},
		{matching.StateNeedsVerification, false, true},
		{matching.StateExcluded, false, false},
		{matching.StateExcluded, true, true},
	} {
		c := matching.Candidate{IsManual: tc.manual}
		c.State = tc.state
		if got := assessable(c); got != tc.want {
			t.Errorf("%s manual=%v: %v, want %v", tc.state, tc.manual, got, tc.want)
		}
	}
}

func TestHorizonOf(t *testing.T) {
	rec := store.ProjectRecord{}
	if horizonOf(rec, 6) != 6 {
		t.Errorf("default horizon = %d", horizonOf(rec, 6))
	}
	rec.Snapshot.Location.HorizonYears = domain.Ptr(7)
	if horizonOf(rec, 6) != 7 {
		t.Errorf("location horizon = %d", horizonOf(rec, 6))
	}
	rec.HorizonYears = domain.Ptr(3)
	if horizonOf(rec, 6) != 3 {
		t.Errorf("project horizon = %d", horizonOf(rec, 6))
	}
}

func TestSavedProjectIsFrozen(t *testing.T) {
	if err := editable(store.ProjectRecord{Status: domain.ProjectDraft}); err != nil {
		t.Errorf("draft: %v", err)
	}
	if err := editable(store.ProjectRecord{Status: domain.ProjectSaved}); err == nil {
		t.Error("a saved project must reject changes")
	}
}
