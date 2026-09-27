package economics

import (
	"math"
	"sort"
	"strings"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
)

// Metric codes of the headline figures. OPEX is the process cost after the robots start, TCO the
// process cost over the horizon: the figures PRD 11.5 compares with the current process.
const (
	mRobots       = "candidate.fleet.robot_count"
	mChargers     = "candidate.fleet.charger_count"
	mCapex        = "candidate.capex.total"
	mOpex         = "candidate.opex.annual_process_opex"
	mLabor        = "candidate.labor.annual_payroll_saving"
	mNet          = "candidate.effects.net_annual_benefit"
	mPayback      = "candidate.returns.simple_payback_years"
	mRoi          = "candidate.returns.workbook_roi"
	mTco          = "candidate.returns.robotized_process_tco"
	mOver         = "candidate.budget.overage"
	mOverShare    = "candidate.budget.overage_share"
	mUtilization  = "candidate.fleet.average_utilization"
	mCycle        = "candidate.productivity.cycle_seconds"
	mBaseOpex     = "candidate.opex.baseline_annual_opex"
	mBaseTco      = "candidate.returns.baseline_process_tco"
	mInterpretion = "candidate.interpretation"
)

// scoreScale converts the 0–100 score of ranking-v1 into the 0–1 score of the API.
const scoreScale = 100

func mapResults(p plan, snap snapshotDTO) []calc.Result {
	type key struct{ id, model string }
	ranking := map[key]rankingItemDTO{}
	for _, it := range snap.Result.Ranking.Items {
		ranking[key{it.CandidateID, it.AcquisitionModel}] = it
	}
	out := append([]calc.Result{}, p.preset...)
	for _, ce := range snap.Result.Candidates {
		cp := p.cands[ce.CandidateID]
		if cp == nil || !contains(cp.models, ce.AcquisitionModel) {
			continue // the service calculates every scenario for every candidate
		}
		out = append(out, p.result(cp, ce, ranking[key{ce.CandidateID, ce.AcquisitionModel}]))
	}
	rerank(out)
	return out
}

// rerank numbers the places again over the kept results: the service also ranked the models a
// robot is not offered with. Equal scores share a place, as in ranking-v1 (1, 1, 3).
func rerank(results []calc.Result) {
	var ranked []*calc.Result
	for i := range results {
		if results[i].Rank != nil && results[i].Score != nil {
			ranked = append(ranked, &results[i])
		}
	}
	sort.SliceStable(ranked, func(i, j int) bool { return *ranked[i].Score > *ranked[j].Score })
	place := 0
	for i, r := range ranked {
		if i == 0 || *r.Score != *ranked[i-1].Score {
			place = i + 1
		}
		r.Rank = domain.Ptr(place)
	}
}

func (p plan) result(cp *candidatePlan, ce candidateEconomicsDTO, rank rankingItemDTO) calc.Result {
	r := calc.Result{SolutionID: cp.cand.SolutionID, AcquisitionModel: ce.AcquisitionModel, Trace: []calc.TraceItem{}}
	var risks []string
	for _, risk := range ce.Risks {
		if p.powerUnknown && risk == riskChargingPower {
			continue
		}
		risks = append(risks, riskRu(risk))
	}
	r.Warnings = append(append(append([]string{}, p.warnings...), cp.warnings...), risks...)
	r.Details.Assumptions = append(append([]calc.AssumptionValue{}, p.assumptions...), cp.assumptions...)
	if ce.Status != "applicable" {
		reason := strings.Join(risks, "; ")
		if reason == "" {
			reason = "Сервис расчёта не смог посчитать экономику решения"
		}
		r.Reason = &reason
		return r
	}
	m := make(map[string]Scalar, len(ce.Metrics))
	for _, x := range ce.Metrics {
		m[x.Code] = x.Value
	}
	r.Calculable = true
	r.RobotCount, r.ChargerCount = intOf(m[mRobots]), intOf(m[mChargers])
	r.CapexRub, r.OpexYearRub, r.LaborSavingsYearRub = money(m[mCapex]), money(m[mOpex]), money(m[mLabor])
	r.NetEffectYearRub, r.TcoRub, r.BudgetOverRub = money(m[mNet]), money(m[mTco]), money(m[mOver])
	r.PaybackYears, r.Roi, r.BudgetOverPct = rounded(m[mPayback], 2), rounded(m[mRoi], 3), rounded(m[mOverShare], 3)
	if it := m[mInterpretion]; it.Text != nil {
		if code, _, ok := feasibility(*it.Text); ok {
			r.Feasibility = &code
		}
	}
	r.Details.FleetUtilization, r.Details.CycleTimeS = rounded(m[mUtilization], 4), rounded(m[mCycle], 1)
	r.Details.BaselineOpexYearRub, r.Details.BaselineTcoRub = money(m[mBaseOpex]), money(m[mBaseTco])
	r.Details.CapexItems, r.Details.OpexItems = costItems(capexItems, m), costItems(opexItems, m)
	if rank.Rank != nil {
		r.Rank = rank.Rank
		if rank.Score.Num != nil {
			r.Score = domain.Ptr(round(*rank.Score.Num/scoreScale, 4))
		}
	}
	for _, c := range rank.Criteria {
		sc := calc.ScoreCriterion{Code: c.Code, Label: criterionLabels[c.Code], RawValue: rounded(c.RawValue, 4),
			Unit: unitRu(c.Unit), Normalized: rounded(c.NormalizedValue, 4), Missing: c.IsMissing, MissingReason: c.MissingReason}
		if c.ConfiguredWeight.Num != nil {
			sc.Weight = *c.ConfiguredWeight.Num
		}
		if c.Contribution.Num != nil {
			sc.Contribution = domain.Ptr(round(*c.Contribution.Num/scoreScale, 4))
		}
		r.Details.ScoreCriteria = append(r.Details.ScoreCriteria, sc)
	}
	for _, t := range ce.Traces {
		r.Trace = append(r.Trace, traceItem(t))
	}
	return r
}

func traceItem(t traceDTO) calc.TraceItem {
	label, ok := traceLabels[t.FormulaID]
	if !ok {
		label = t.FormulaID
	}
	item := calc.TraceItem{Code: t.FormulaID, Label: label, Unit: unitRu(t.Unit), Source: "derived"}
	switch {
	case t.Result.Num != nil:
		item.Value = domain.Ptr(round(*t.Result.Num, 6))
	case t.Result.Bool != nil:
		item.Text = domain.Ptr(map[bool]string{true: "да", false: "нет"}[*t.Result.Bool])
	case t.Result.Text != nil:
		text := *t.Result.Text
		if _, ru, ok := feasibility(text); ok {
			text = ru
		}
		item.Text = &text
	}
	for _, in := range t.Inputs {
		ti := calc.TraceInput{Name: in.Name}
		switch {
		case in.Value.Num != nil:
			ti.Value = domain.Ptr(round(*in.Value.Num, 6))
		case in.Value.Bool != nil:
			ti.Text = domain.Ptr(map[bool]string{true: "да", false: "нет"}[*in.Value.Bool])
		case in.Value.Text != nil:
			ti.Text = in.Value.Text
		}
		item.Inputs = append(item.Inputs, ti)
	}
	return item
}

func costItems(codes []string, m map[string]Scalar) []calc.CostItem {
	out := make([]calc.CostItem, 0, len(codes))
	for _, code := range codes {
		v, ok := m[code]
		if !ok {
			continue
		}
		out = append(out, calc.CostItem{Code: strings.TrimPrefix(code, "candidate."), Label: traceLabels[code], AmountRub: money(v)})
	}
	return out
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func money(s Scalar) *float64 { return rounded(s, 2) }

func rounded(s Scalar, digits int) *float64 {
	if s.Num == nil {
		return nil
	}
	return domain.Ptr(round(*s.Num, digits))
}

func intOf(s Scalar) *int {
	if s.Num == nil {
		return nil
	}
	return domain.Ptr(int(math.Round(*s.Num)))
}

func round(v float64, digits int) float64 {
	p := math.Pow(10, float64(digits))
	return math.Round(v*p) / p
}
