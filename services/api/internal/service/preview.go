package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// The guest preview (roles model §5, D-14): a guest walks a demo evaluation and recalculates it with own conditions.
// api computes the matching, the economics and starts the simulation the same way as for a user, but writes nothing:
// the guest's state lives in the browser. The economics service calculates without a snapshot (dry run); a guest
// simulation job runs in services/simulation as a job of api itself, which removes it after a TTL.

// PreviewInput changes a demo project for one calculation; an empty field is as in the project.
type PreviewInput struct {
	TaskConditions *[]matching.Override `json:"taskConditions" description:"Условия задачи; пусто — как в проекте"`
	CalcOverrides  *domain.CalcParams   `json:"calcOverrides" description:"«Параметры расчёта»; пусто — как в проекте"`
}

// PreviewSimulationInput starts a guest simulation of one calculated configuration of a demo project.
type PreviewSimulationInput struct {
	TaskConditions   *[]matching.Override `json:"taskConditions" description:"Условия задачи; пусто — как в проекте"`
	CalcOverrides    *domain.CalcParams   `json:"calcOverrides" description:"«Параметры расчёта»; пусто — как в проекте"`
	SolutionID       *uuid.UUID           `json:"solutionId" required:"true"`
	AcquisitionModel *string              `json:"acquisitionModel" required:"true" enum:"purchase,raas"`
	Fleet            *Fleet               `json:"fleet" description:"Состав этапа 1; пусто — как в расчёте подбора"`
	Conditions       SimulationConditions `json:"conditions"`
}

// PreviewSimulationRun is a guest simulation job; it is known by the job id only.
type PreviewSimulationRun struct {
	ID           string              `json:"id" required:"true" description:"Задание в services/simulation"`
	Status       string              `json:"status" required:"true" enum:"queued,running,done,error"`
	Log          []string            `json:"log" required:"true"`
	ElapsedS     float64             `json:"elapsedS" required:"true"`
	Fleet        *Fleet              `json:"fleet" description:"Есть в ответе на запуск"`
	SimulationID *string             `json:"simulationId"`
	Error        *string             `json:"error"`
	Errors       []domain.FieldError `json:"errors"`
	Assumptions  []string            `json:"assumptions" required:"true" description:"Есть в ответе на запуск; при опросе пусто"`
}

var errUnconfiguredGuestSim = errors.New("the internal simulation client is not configured (KC_CLIENT_ID, SIMULATION_URL)")

// jobIDPattern is the form of a services/simulation job id; anything else is not a guest job.
var jobIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// WithGuestSimulator connects the internal paths of services/simulation for guest runs; without it they answer 503.
func (s *Service) WithGuestSimulator(sim Simulator) *Service {
	s.guestSim = sim
	return s
}

func (s *Service) guestSimulator() (Simulator, error) {
	if s.guestSim == nil {
		return nil, simulationUnavailable(errUnconfiguredGuestSim)
	}
	return s.guestSim, nil
}

// Preview matches and calculates a demo project with the given changes and returns the figures; nothing is saved.
func (s *Service) Preview(ctx context.Context, id uuid.UUID, body []byte) (Evaluation, error) {
	var in PreviewInput
	if err := parseOptional(&in, body); err != nil {
		return Evaluation{}, err
	}
	p, err := s.computePreview(ctx, id, in)
	if err != nil {
		return Evaluation{}, err
	}
	return evaluationOf(p.rec, p.cr, p.run, p.results, &p.cr.ModelVersion), nil
}

// StartPreviewSimulation queues a guest simulation of a configuration calculated in the preview.
func (s *Service) StartPreviewSimulation(ctx context.Context, id uuid.UUID, body []byte) (PreviewSimulationRun, error) {
	var in PreviewSimulationInput
	if err := parseOptional(&in, body); err != nil {
		return PreviewSimulationRun{}, err
	}
	var v domain.Validator
	if in.SolutionID == nil {
		v.Add("solutionId", "required", "Не выбрано решение", "Выберите вариант на шаге «Подбор»")
	}
	if in.AcquisitionModel == nil {
		v.Add("acquisitionModel", "required", "Не выбрана модель приобретения", "purchase — покупка, raas — аренда")
	}
	if err := v.Err(); err != nil {
		return PreviewSimulationRun{}, err
	}
	sim, err := s.guestSimulator()
	if err != nil {
		return PreviewSimulationRun{}, err
	}
	p, err := s.computePreview(ctx, id, PreviewInput{TaskConditions: in.TaskConditions, CalcOverrides: in.CalcOverrides})
	if err != nil {
		return PreviewSimulationRun{}, err
	}
	rec, result, ok := p.selected(*in.SolutionID, *in.AcquisitionModel)
	if !ok {
		return PreviewSimulationRun{}, domain.Conflict("selection_not_calculable",
			"Выбранный вариант не посчитан на этих условиях — выберите другой на шаге «Подбор»")
	}
	job, err := s.simulationJob(ctx, s.st.Q(), rec, result, SimulationRunInput{Fleet: in.Fleet, Conditions: in.Conditions})
	if err != nil {
		return PreviewSimulationRun{}, err
	}
	jobID, err := sim.Submit(ctx, "", job.request)
	if err != nil {
		return PreviewSimulationRun{}, simulationError(err)
	}
	return PreviewSimulationRun{ID: jobID, Status: simQueued, Log: []string{}, Fleet: &job.fleet,
		Assumptions: job.assumptions}, nil
}

// GetPreviewSimulation returns the progress of a guest simulation job.
func (s *Service) GetPreviewSimulation(ctx context.Context, jobID string) (PreviewSimulationRun, error) {
	sim, err := s.guestSimulator()
	if err != nil {
		return PreviewSimulationRun{}, err
	}
	if !jobIDPattern.MatchString(jobID) {
		return PreviewSimulationRun{}, domain.NotFound("simulation_run", jobID)
	}
	job, err := sim.Job(ctx, "", jobID)
	if err != nil {
		return PreviewSimulationRun{}, simulationError(err)
	}
	out := PreviewSimulationRun{ID: jobID, Status: job.Status, Log: job.Log, ElapsedS: job.Elapsed, Error: job.Error,
		Assumptions: []string{}}
	if out.Log == nil {
		out.Log = []string{}
	}
	for _, e := range job.Errors {
		out.Errors = append(out.Errors, domain.FieldError{Field: e.Field, Code: "simulation_rejected", Message: e.Message})
	}
	if job.Status == simDone {
		if len(job.SimulationIDs) == 0 {
			out.Status, out.Error = simError, domain.Ptr("Симуляция завершилась без прогона")
		} else {
			out.SimulationID = &job.SimulationIDs[0]
		}
	}
	return out, nil
}

// PreviewSimulationResult returns the finished guest run as services/simulation stores it.
func (s *Service) PreviewSimulationResult(ctx context.Context, jobID string) (json.RawMessage, error) {
	simulationID, sim, err := s.finishedPreview(ctx, jobID)
	if err != nil {
		return nil, err
	}
	out, err := sim.Run(ctx, "", simulationID)
	return out, simulationError(err)
}

// PreviewSimulationTraces opens the 2D traces of a finished guest run; the caller copies and closes the body.
func (s *Service) PreviewSimulationTraces(ctx context.Context, jobID string, gzip bool) (*http.Response, error) {
	simulationID, sim, err := s.finishedPreview(ctx, jobID)
	if err != nil {
		return nil, err
	}
	resp, err := sim.Traces(ctx, "", simulationID, gzip)
	return resp, simulationError(err)
}

func (s *Service) finishedPreview(ctx context.Context, jobID string) (string, Simulator, error) {
	run, err := s.GetPreviewSimulation(ctx, jobID)
	if err != nil {
		return "", nil, err
	}
	if run.SimulationID == nil {
		return "", nil, domain.Conflict("simulation_not_finished", "Прогон ещё не готов — дождитесь завершения")
	}
	return *run.SimulationID, s.guestSim, nil
}

// preview is a calculation of a demo project held in memory: ids are generated, nothing is stored.
type preview struct {
	rec     store.ProjectRecord
	run     matching.Run
	cr      store.CalcRunRecord
	results []store.CalcResult
}

// selected is the project with the robot of the calculated configuration, as a selection would put it.
func (p preview) selected(solutionID uuid.UUID, model string) (store.ProjectRecord, store.CalcResult, bool) {
	for _, r := range p.results {
		if r.SolutionID != solutionID || r.AcquisitionModel != model || !r.Calculable {
			continue
		}
		for _, c := range p.cr.Request.Candidates {
			if c.SolutionID != solutionID {
				continue
			}
			rec := p.rec
			rec.Snapshot.Robot = &domain.RobotSnapshot{RobotCard: c.RobotCard, AcquisitionModel: model,
				CalcRunID: p.cr.ID, CalcResultID: r.ID, TakenAt: time.Now()}
			return rec, r, true
		}
	}
	return store.ProjectRecord{}, store.CalcResult{}, false
}

// computePreview runs the matching and the calculation of a demo project in memory.
func (s *Service) computePreview(ctx context.Context, id uuid.UUID, in PreviewInput) (preview, error) {
	q := s.st.Q()
	rec, err := s.visibleProject(ctx, q, id, false)
	if err != nil {
		return preview{}, err
	}
	if !rec.IsDemo {
		return preview{}, domain.Forbidden("preview_demo_only",
			"Расчёт без сохранения доступен только в демо-проектах. В своём проекте запустите подбор — он сохранится")
	}
	overrides, err := q.Overrides(ctx, id)
	if err != nil {
		return preview{}, err
	}
	if in.TaskConditions != nil {
		if err := s.validateOverrides(ctx, q, *in.TaskConditions); err != nil {
			return preview{}, err
		}
		overrides = *in.TaskConditions
	}
	if in.CalcOverrides != nil {
		var v domain.Validator
		validateCalcParams(&v, *in.CalcOverrides)
		if err := v.Err(); err != nil {
			return preview{}, err
		}
		rec.CalcOverrides = *in.CalcOverrides
	}
	manual, err := q.ManualCandidates(ctx, id)
	if err != nil {
		return preview{}, err
	}
	ids := make([]uuid.UUID, len(manual))
	for i, m := range manual {
		ids[i] = m.SolutionID
	}
	run, err := s.screenProject(ctx, q, rec, matching.BuildConditions(rec.Snapshot.Task, overrides), ids)
	if err != nil {
		return preview{}, err
	}
	run.ID = domain.Ptr(store.NewID())
	req, err := s.calcRequest(ctx, q, rec, run)
	if err != nil {
		return preview{}, err
	}
	req.DryRun = true
	resp, results, err := s.calculate(ctx, req, "Ничего не сохранено — ")
	if err != nil {
		return preview{}, err
	}
	stored := make([]store.CalcResult, len(results))
	for i, r := range results {
		stored[i] = store.CalcResult{ID: store.NewID(), Result: r}
	}
	cr := store.CalcRunRecord{ID: req.RunID, ProjectID: rec.ID, MatchRunID: *run.ID, ModelVersion: resp.ModelVersion,
		RankingVersion: resp.RankingVersion, CatalogVersion: run.CatalogVersion, InputsVersion: rec.InputsVersion,
		HorizonYears: req.HorizonYears, Request: req, CreatedAt: time.Now()}
	return preview{rec: rec, run: run, cr: cr, results: stored}, nil
}

// parseOptional reads an optional JSON body: an empty body keeps dst as it is.
func parseOptional(dst any, body []byte) error {
	if len(body) == 0 {
		return nil
	}
	return MergePatch(dst, body)
}
