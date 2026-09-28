package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// The orchestrator runs the lifecycle of one project (docs/orchestrator.md): matching, the
// calculation of every candidate, the selection of a robot copied into the snapshot, save and reopen.

// defaultHorizonYears is used when neither the project, its location nor the norms set a horizon.
const defaultHorizonYears = 5

// Evaluation is the «Подбор» tab: a matching run with the calculation of its candidates.
type Evaluation struct {
	ID                  uuid.UUID            `json:"id"`
	ProjectID           uuid.UUID            `json:"projectId"`
	ModelVersion        string               `json:"modelVersion" description:"Версия ядра, которой посчитаны цифры"`
	CurrentModelVersion *string              `json:"currentModelVersion" description:"Версия ядра сейчас; null — калькулятор не ответил"`
	ModelOutdated       bool                 `json:"modelOutdated" description:"Ядро обновилось после расчёта; сохранённые цифры не пересчитываются"`
	RankingVersion      *string              `json:"rankingVersion" description:"Методика рейтинга; null — калькулятор не ранжирует (мок-модель)"`
	NormsVersion        *int                 `json:"normsVersion" description:"Версия нормативов А5, на которой посчитаны цифры"`
	Stale               bool                 `json:"stale" description:"Параметры проекта изменились после расчёта — нужен новый расчёт"`
	CatalogVersion      int                  `json:"catalogVersion"`
	HorizonYears        int                  `json:"horizonYears"`
	AcquisitionModels   []string             `json:"acquisitionModels"`
	MatchRunID          uuid.UUID            `json:"matchRunId"`
	RulesetVersion      string               `json:"rulesetVersion"`
	Conditions          []matching.Condition `json:"conditions"`
	Counts              domain.MatchCounts   `json:"counts"`
	RecommendedResultID *uuid.UUID           `json:"recommendedResultId" description:"Первое место рейтинга — «Рекомендация системы»; null — рейтинга нет"`
	Candidates          []EvaluatedCandidate `json:"candidates" description:"Сначала кандидаты с лучшим местом в рейтинге, затем без места, исключённые в конце"`
	CalcDefaults        domain.CalcParams    `json:"calcDefaults" description:"«Параметры расчёта»: значения снимка и каталога до правок пользователя; поля робота — у решения solutionId"`
	CalcOverrides       domain.CalcParams    `json:"calcOverrides" description:"«Параметры расчёта», изменённые пользователем в проекте"`
	CreatedAt           time.Time            `json:"createdAt"`
}

// EvaluateInput starts a calculation, optionally with new «Параметры расчёта».
type EvaluateInput struct {
	CalcOverrides *domain.CalcParams `json:"calcOverrides" description:"Правки «Параметров расчёта» целиком; пусто — прежние. {} — вернуть исходные значения"`
}

// EvaluatedCandidate is a matching candidate with its calculation per acquisition model.
type EvaluatedCandidate struct {
	Match   matching.Candidate `json:"match"`
	Robot   *domain.RobotCard  `json:"robot" description:"Поля робота на момент расчёта; null — исключённый кандидат не считался"`
	Results []store.CalcResult `json:"results"`
}

// Evaluate runs matching on the project snapshot and calculates every candidate that can be
// assessed: passed, needing verification or added by hand. The matching run is saved even when
// the calculator does not answer. The selection moves to the new calculation when the selected
// configuration is calculated again, otherwise it is dropped.
func (s *Service) Evaluate(ctx context.Context, id uuid.UUID, body []byte) (Evaluation, error) {
	var in EvaluateInput
	if len(body) > 0 {
		if err := MergePatch(&in, body); err != nil {
			return Evaluation{}, err
		}
	}
	if in.CalcOverrides != nil {
		if err := s.putCalcOverrides(ctx, id, *in.CalcOverrides); err != nil {
			return Evaluation{}, err
		}
	}
	run, err := s.RunMatching(ctx, id)
	if err != nil {
		return Evaluation{}, err
	}
	rec, err := s.draftProject(ctx, s.st.Q(), id)
	if err != nil {
		return Evaluation{}, err
	}
	req, err := s.calcRequest(ctx, s.st.Q(), rec, run)
	if err != nil {
		return Evaluation{}, err
	}
	resp, err := s.calc.Calculate(ctx, req)
	switch {
	case errors.Is(err, calc.ErrRejected):
		return Evaluation{}, domain.Unavailable("calculation_rejected",
			"Сервис расчёта экономики отклонил входные данные проекта. Подбор сохранён — проверьте параметры задачи и нормативы", err)
	case err != nil:
		return Evaluation{}, domain.Unavailable("calculation_unavailable",
			"Сервис расчёта экономики не ответил. Подбор сохранён — повторите расчёт позже", err)
	}
	results, err := completeResults(req, resp)
	if err != nil {
		return Evaluation{}, domain.Unavailable("calculation_invalid", "Сервис расчёта экономики вернул ответ не по контракту", err)
	}
	cr := store.CalcRunRecord{ID: req.RunID, ProjectID: rec.ID, MatchRunID: *run.ID, ModelVersion: resp.ModelVersion,
		RankingVersion: resp.RankingVersion, CatalogVersion: run.CatalogVersion, InputsVersion: rec.InputsVersion,
		HorizonYears: req.HorizonYears, Request: req}
	if req.Norms.ID != uuid.Nil {
		cr.NormSetID = &req.Norms.ID
	}
	err = s.st.Tx(ctx, func(q store.Q) error {
		stored, err := q.SaveCalcRun(ctx, &cr, results)
		if err != nil {
			return err
		}
		if rec.SelectedSolutionID == nil && rec.Snapshot.Robot == nil {
			return nil
		}
		reselect(&rec, cr, stored)
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return Evaluation{}, err
	}
	return s.evaluation(ctx, s.st.Q(), rec, cr, run, &resp.ModelVersion)
}

// putCalcOverrides replaces the «Параметры расчёта» of a draft; a change makes the calculation stale.
func (s *Service) putCalcOverrides(ctx context.Context, id uuid.UUID, p domain.CalcParams) error {
	var v domain.Validator
	validateCalcParams(&v, p)
	if err := v.Err(); err != nil {
		return err
	}
	return s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.draftProject(ctx, q, id)
		if err != nil {
			return err
		}
		if reflect.DeepEqual(rec.CalcOverrides, p) {
			return nil
		}
		rec.CalcOverrides = p
		if err := q.SaveProject(ctx, rec); err != nil {
			return err
		}
		return q.BumpProjectInputs(ctx, id)
	})
}

// reselect keeps the selected configuration on a new calculation (D-89): the robot is copied again from the new
// calculation input. A configuration that is no longer calculable drops the selection.
func reselect(rec *store.ProjectRecord, cr store.CalcRunRecord, results []store.CalcResult) {
	solution, model := rec.SelectedSolutionID, rec.SelectedModel
	clearSelection(rec)
	if solution == nil || model == nil {
		return
	}
	for _, r := range results {
		if r.SolutionID != *solution || r.AcquisitionModel != *model || !r.Calculable {
			continue
		}
		for _, c := range cr.Request.Candidates {
			if c.SolutionID != r.SolutionID {
				continue
			}
			rec.Snapshot.Robot = &domain.RobotSnapshot{RobotCard: c.RobotCard, AcquisitionModel: r.AcquisitionModel,
				CalcRunID: cr.ID, CalcResultID: r.ID, TakenAt: time.Now()}
			rec.SelectedSolutionID, rec.SelectedModel, rec.SelectedCalcResultID = &c.SolutionID, &r.AcquisitionModel, &r.ID
			return
		}
	}
}

// GetEvaluation returns the latest calculation as saved; the calculator is not called for figures.
func (s *Service) GetEvaluation(ctx context.Context, id uuid.UUID) (Evaluation, error) {
	q := s.st.Q()
	rec, err := s.visibleProject(ctx, q, id, false)
	if err != nil {
		return Evaluation{}, err
	}
	cr, err := q.LatestCalcRun(ctx, id)
	if err != nil {
		return Evaluation{}, err
	}
	if cr == nil {
		return Evaluation{}, domain.NotFound("evaluation", "latest")
	}
	run, err := q.GetRun(ctx, cr.MatchRunID)
	if err != nil {
		return Evaluation{}, err
	}
	var current *string
	if v, err := s.calc.ModelVersion(ctx); err == nil {
		current = &v
	} else {
		s.log.WarnContext(ctx, "calculator model version is unknown", slog.Any("error", err))
	}
	return s.evaluation(ctx, q, rec, *cr, run, current)
}

func (s *Service) evaluation(ctx context.Context, q store.Q, rec store.ProjectRecord, cr store.CalcRunRecord, run matching.Run,
	current *string) (Evaluation, error) {
	results, err := q.CalcResults(ctx, cr.ID)
	if err != nil {
		return Evaluation{}, err
	}
	bySolution := map[uuid.UUID][]store.CalcResult{}
	for _, r := range results {
		bySolution[r.SolutionID] = append(bySolution[r.SolutionID], r)
	}
	robots := map[uuid.UUID]domain.RobotCard{}
	for _, c := range cr.Request.Candidates {
		robots[c.SolutionID] = c.RobotCard
	}
	ev := Evaluation{
		ID: cr.ID, ProjectID: cr.ProjectID, ModelVersion: cr.ModelVersion, CurrentModelVersion: current,
		ModelOutdated: current != nil && *current != cr.ModelVersion, RankingVersion: cr.RankingVersion,
		Stale: cr.InputsVersion != rec.InputsVersion, CatalogVersion: cr.CatalogVersion, HorizonYears: cr.HorizonYears,
		AcquisitionModels: cr.Request.AcquisitionModels, MatchRunID: cr.MatchRunID, RulesetVersion: run.RulesetVersion,
		Conditions: run.Conditions, Counts: run.Counts, Candidates: make([]EvaluatedCandidate, 0, len(run.Candidates)),
		CalcDefaults: calcDefaults(cr, results, calcRobot(rec.CalcOverrides, rec)), CalcOverrides: rec.CalcOverrides,
		CreatedAt: cr.CreatedAt,
	}
	if cr.Request.Norms.Version > 0 {
		ev.NormsVersion = &cr.Request.Norms.Version
	}
	for _, r := range results {
		if r.Calculable && r.Rank != nil && *r.Rank == 1 && ev.RecommendedResultID == nil {
			ev.RecommendedResultID = &r.ID
		}
	}
	for _, c := range run.Candidates {
		ec := EvaluatedCandidate{Match: c, Results: bySolution[c.Solution.ID]}
		if ec.Results == nil {
			ec.Results = []store.CalcResult{}
		}
		if card, ok := robots[c.Solution.ID]; ok {
			ec.Robot = &card
		}
		ev.Candidates = append(ev.Candidates, ec)
	}
	slices.SortStableFunc(ev.Candidates, func(a, b EvaluatedCandidate) int { return bestRank(a) - bestRank(b) })
	return ev, nil
}

// bestRank orders candidates for the screen: ranked by place, then calculated without a place,
// then excluded ones (no results).
func bestRank(c EvaluatedCandidate) int {
	const unranked, excluded = 1 << 20, 1 << 21
	if len(c.Results) == 0 {
		return excluded
	}
	best := unranked
	for _, r := range c.Results {
		if r.Rank != nil && *r.Rank < best {
			best = *r.Rank
		}
	}
	return best
}

// calcRequest freezes the calculation input: the project snapshot, the pinned norms and the catalog
// fields of the candidates as they are now. The catalog keeps no history, so this copy is what the
// figures rest on.
func (s *Service) calcRequest(ctx context.Context, q store.Q, rec store.ProjectRecord, run matching.Run) (calc.Request, error) {
	snap := rec.Snapshot
	norms, err := s.projectNorms(ctx, q, rec)
	if err != nil {
		return calc.Request{}, err
	}
	defs, err := q.ParameterDefinitions(ctx, snap.Location.FacilityTypeCode)
	if err != nil {
		return calc.Request{}, err
	}
	roleOf := make(map[string]string, len(defs))
	for _, d := range defs {
		if d.Role != nil {
			roleOf[d.Code] = *d.Role
		}
	}
	params := make(map[string]any, len(snap.Parameters))
	roles := map[string]float64{}
	for _, p := range snap.Parameters {
		params[p.Code] = p.Value
		if n, ok := p.Value.(float64); ok && roleOf[p.Code] != "" {
			roles[roleOf[p.Code]] = n
		}
	}
	staff := snap.Location.StaffGroups
	if staff == nil {
		staff = []domain.StaffGroup{}
	}
	defaultHorizon := defaultHorizonYears
	if v, ok := norms.Value("horizon_years"); ok && v > 0 {
		defaultHorizon = int(v)
	}
	req := calc.Request{
		RunID: store.NewID(), ProjectID: rec.ID, HorizonYears: horizonOf(rec, defaultHorizon),
		AcquisitionModels: []string{calc.Purchase, calc.RaaS}, Norms: norms,
		Location: calc.Location{ID: snap.Location.ID, Name: snap.Location.Name, FacilityTypeCode: snap.Location.FacilityTypeCode,
			CapexBudget: snap.Location.CapexBudget, Parameters: params, Roles: roles, StaffGroups: staff},
		Task: calc.Task{ID: snap.Task.ID, Name: snap.Task.Name, WorkType: snap.Task.WorkType, KpiUnit: snap.Task.KpiUnit,
			Params: snap.Task.Params, HandlingMethods: snap.Task.HandlingMethods, Workers: snap.Task.Workers, Derived: snap.Task.Derived},
		Candidates: []calc.Candidate{},
	}
	for _, c := range run.Candidates {
		if !assessable(c) {
			continue
		}
		sol, err := q.GetSolution(ctx, c.Solution.ID)
		if err != nil {
			return req, err
		}
		req.Candidates = append(req.Candidates, calc.Candidate{RobotCard: domain.NewRobotCard(sol, snap.Task.WorkType.ID),
			MatchState: c.State, IsManual: c.IsManual})
	}
	defaults := baseDefaults(req)
	req.Defaults = &defaults
	if rec.CalcOverrides.IsEmpty() {
		return req, nil
	}
	robot := calcRobot(rec.CalcOverrides, rec)
	var fleet *int
	if robot != nil && rec.CalcOverrides.ServiceCostRubPerYear != nil {
		prev, err := q.LatestCalcRun(ctx, rec.ID)
		if err != nil {
			return req, err
		}
		if prev != nil {
			results, err := q.CalcResults(ctx, prev.ID)
			if err != nil {
				return req, err
			}
			fleet = fleetOf(results, *robot)
		}
	}
	applyCalcParams(&req, rec.CalcOverrides, robot, fleet)
	return req, nil
}

// assessable: an excluded robot is calculated only when the user added it by hand (ТЗ 3.4.4).
func assessable(c matching.Candidate) bool {
	return c.IsManual || c.State != matching.StateExcluded
}

// horizonOf is the horizon of the project, else of its location, else the default of the norms.
func horizonOf(rec store.ProjectRecord, def int) int {
	switch {
	case rec.HorizonYears != nil:
		return *rec.HorizonYears
	case rec.Snapshot.Location.HorizonYears != nil:
		return *rec.Snapshot.Location.HorizonYears
	}
	return def
}

// completeResults checks the answer against the request: one result per candidate and offered
// acquisition model. A missing result becomes «not calculable»; an unexpected one is an error.
func completeResults(req calc.Request, resp calc.Response) ([]calc.Result, error) {
	if resp.ModelVersion == "" {
		return nil, fmt.Errorf("empty modelVersion")
	}
	type key struct {
		solution uuid.UUID
		model    string
	}
	got := map[key]calc.Result{}
	for _, r := range resp.Results {
		k := key{r.SolutionID, r.AcquisitionModel}
		if _, dup := got[k]; dup {
			return nil, fmt.Errorf("duplicate result for %s %s", r.SolutionID, r.AcquisitionModel)
		}
		got[k] = r
	}
	out := make([]calc.Result, 0, len(got))
	for _, c := range req.Candidates {
		for _, m := range c.Models(req.AcquisitionModels) {
			k := key{c.SolutionID, m}
			r, ok := got[k]
			if !ok {
				r = calc.Result{SolutionID: c.SolutionID, AcquisitionModel: m,
					Reason: domain.Ptr("Сервис расчёта не вернул результат для этой модели приобретения")}
			}
			if r.Trace == nil {
				r.Trace = []calc.TraceItem{}
			}
			delete(got, k)
			out = append(out, r)
		}
	}
	if len(got) > 0 {
		extra := make([]string, 0, len(got))
		for k := range got {
			extra = append(extra, k.solution.String()+" "+k.model)
		}
		return nil, fmt.Errorf("results were not requested: %s", strings.Join(extra, ", "))
	}
	return out, nil
}

// SelectionInput chooses the robot and the acquisition model among the calculated results.
type SelectionInput struct {
	SolutionID       *uuid.UUID `json:"solutionId" description:"null снимает выбор"`
	AcquisitionModel *string    `json:"acquisitionModel" enum:"purchase,raas"`
}

// PutSelection selects a calculated robot and copies its fields from the calculation input into
// the project snapshot, so the project keeps exactly the data the shown figures rest on.
func (s *Service) PutSelection(ctx context.Context, id uuid.UUID, body []byte) (domain.Project, error) {
	var in SelectionInput
	if err := MergePatch(&in, body); err != nil {
		return domain.Project{}, err
	}
	if in.SolutionID != nil {
		var v domain.Validator
		if in.AcquisitionModel == nil {
			v.Add("acquisitionModel", "required", "Не выбрана модель приобретения", "purchase — покупка, raas — аренда")
		} else {
			v.OneOf("acquisitionModel", "Модель приобретения", *in.AcquisitionModel, []string{calc.Purchase, calc.RaaS})
		}
		if err := v.Err(); err != nil {
			return domain.Project{}, err
		}
	}
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.draftProject(ctx, q, id)
		if err != nil {
			return err
		}
		if in.SolutionID == nil {
			clearSelection(&rec)
			return q.SaveProject(ctx, rec)
		}
		cr, err := s.currentCalcRun(ctx, q, rec)
		if err != nil {
			return err
		}
		results, err := q.CalcResults(ctx, cr.ID)
		if err != nil {
			return err
		}
		var chosen *store.CalcResult
		for i := range results {
			if results[i].SolutionID == *in.SolutionID && results[i].AcquisitionModel == *in.AcquisitionModel {
				chosen = &results[i]
			}
		}
		if chosen == nil {
			return domain.Conflict("not_calculated", "Для этого решения и модели приобретения нет расчёта в последнем подборе")
		}
		if !chosen.Calculable {
			return domain.Conflict("not_calculable", "Решение нельзя выбрать: "+domain.Deref(chosen.Reason))
		}
		var card *domain.RobotCard
		for _, c := range cr.Request.Candidates {
			if c.SolutionID == chosen.SolutionID {
				card = &c.RobotCard
			}
		}
		if card == nil {
			return fmt.Errorf("calc run %s has a result without a candidate %s", cr.ID, chosen.SolutionID)
		}
		model := chosen.AcquisitionModel
		rec.Snapshot.Robot = &domain.RobotSnapshot{RobotCard: *card, AcquisitionModel: model, CalcRunID: cr.ID,
			CalcResultID: chosen.ID, TakenAt: time.Now()}
		rec.SelectedSolutionID, rec.SelectedModel, rec.SelectedCalcResultID = &card.SolutionID, &model, &chosen.ID
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// currentCalcRun is the latest calculation, required to match the current project inputs.
func (s *Service) currentCalcRun(ctx context.Context, q store.Q, rec store.ProjectRecord) (store.CalcRunRecord, error) {
	cr, err := q.LatestCalcRun(ctx, rec.ID)
	if err != nil {
		return store.CalcRunRecord{}, err
	}
	if cr == nil {
		return store.CalcRunRecord{}, domain.Conflict("evaluation_required",
			"Сначала рассчитайте подбор: выбрать можно только робота с посчитанными показателями")
	}
	if cr.InputsVersion != rec.InputsVersion {
		return store.CalcRunRecord{}, domain.Conflict("evaluation_stale",
			"Параметры проекта изменились после расчёта — пересчитайте подбор")
	}
	return *cr, nil
}

// SaveProject freezes a draft: the snapshot with the selected robot, its calculation and the
// model version. After that the figures of the project do not change.
func (s *Service) SaveProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.visibleProject(ctx, q, id, true)
		if err != nil {
			return err
		}
		if rec.Status == domain.ProjectSaved {
			return domain.Conflict("project_saved", "Проект уже сохранён")
		}
		if rec.SelectedCalcResultID == nil || rec.Snapshot.Robot == nil {
			return domain.Conflict("selection_required", "Выберите робота по результатам расчёта — без выбора проект не сохранить")
		}
		cr, err := s.currentCalcRun(ctx, q, rec)
		if err != nil {
			return err
		}
		if cr.ID != rec.Snapshot.Robot.CalcRunID {
			return domain.Conflict("evaluation_stale", "Робот выбран по прежнему расчёту — выберите его заново")
		}
		summary, err := resultSummary(ctx, q, cr.ID, *rec.SelectedCalcResultID)
		if err != nil {
			return err
		}
		now := time.Now()
		rec.Status, rec.SavedAt, rec.Versions.Model = domain.ProjectSaved, &now, &cr.ModelVersion
		rec.ResultSummary = summary
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// ReopenProject returns a saved project to a draft. Its calculations stay in the history.
func (s *Service) ReopenProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.visibleProject(ctx, q, id, true)
		if err != nil || rec.Status == domain.ProjectDraft {
			return err
		}
		rec.Status, rec.SavedAt, rec.ResultSummary = domain.ProjectDraft, nil, nil
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

// resultSummary freezes the figures of the selected result for the projects list and the dashboard.
func resultSummary(ctx context.Context, q store.Q, runID, resultID uuid.UUID) (*domain.ResultSummary, error) {
	results, err := q.CalcResults(ctx, runID)
	if err != nil {
		return nil, err
	}
	for _, r := range results {
		if r.ID != resultID {
			continue
		}
		return &domain.ResultSummary{AcquisitionModel: r.AcquisitionModel, CapexRub: domain.Deref(r.CapexRub),
			OpexYearRub: domain.Deref(r.OpexYearRub), PaybackYears: r.PaybackYears, NetEffectYearRub: r.NetEffectYearRub}, nil
	}
	return nil, fmt.Errorf("calc result %s is not in run %s", resultID, runID)
}

// RequestQuote records a request for a commercial offer on the selected configuration (08b, D-106).
// The assessment does not change, so a saved project accepts it too.
func (s *Service) RequestQuote(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	err := s.st.Tx(ctx, func(q store.Q) error {
		rec, err := s.visibleProject(ctx, q, id, true)
		if err != nil {
			return err
		}
		if rec.Snapshot.Robot == nil {
			return domain.Conflict("selection_required", "Запросить КП можно, когда на подборе выбран вариант")
		}
		now := time.Now()
		rec.QuoteRequestedAt = &now
		return q.SaveProject(ctx, rec)
	})
	if err != nil {
		return domain.Project{}, err
	}
	return s.GetProject(ctx, id)
}

func clearSelection(rec *store.ProjectRecord) {
	rec.Snapshot.Robot = nil
	rec.SelectedSolutionID, rec.SelectedModel, rec.SelectedCalcResultID = nil, nil, nil
}
