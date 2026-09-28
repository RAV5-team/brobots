package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"time"

	"github.com/brobots/api/internal/clients/simulation"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// The «Симуляция» step (PRD 11.4, docs/orchestrator.md): the orchestrator checks the selected configuration in
// services/simulation. The input is built from the project snapshot, the selected robot and its calculation, and the
// conditions of stage 2 in the web model. The run is stored by services/simulation; api keeps the link.

// Simulator is the port of services/simulation.
type Simulator interface {
	Submit(ctx context.Context, token string, request any) (string, error)
	Job(ctx context.Context, token, jobID string) (simulation.Job, error)
	Run(ctx context.Context, token, simulationID string) (json.RawMessage, error)
	Traces(ctx context.Context, token, simulationID string, gzip bool) (*http.Response, error)
}

// WithSimulator connects services/simulation; without it the step answers 503.
func (s *Service) WithSimulator(sim Simulator) *Service {
	s.sim = sim
	return s
}

type bearerKey struct{}

// WithBearer passes the Authorization header of the caller: the simulation service is called on the user's behalf.
func WithBearer(ctx context.Context, header string) context.Context {
	return context.WithValue(ctx, bearerKey{}, header)
}

func bearerOf(ctx context.Context) string {
	v, _ := ctx.Value(bearerKey{}).(string)
	return v
}

// Run statuses; cancelled is set by api: services/simulation has no job cancellation.
const (
	simQueued    = "queued"
	simRunning   = "running"
	simDone      = "done"
	simError     = "error"
	simCancelled = "cancelled"
)

// Fleet is the configuration checked by the simulation.
type Fleet struct {
	Robots   int `json:"robots" required:"true"`
	Stations int `json:"stations" required:"true"`
}

// PeakHours are the peak hours 0–23 of receiving and shipping.
type PeakHours struct {
	Inbound  []int `json:"inbound"`
	Outbound []int `json:"outbound"`
}

// SimulationConditions are the conditions of stage 2 as the web edits them; an empty field comes from the task or the
// simulation defaults.
type SimulationConditions struct {
	FirstShiftStartHour   *int       `json:"firstShiftStartHour"`
	ShiftsPerDay          *int       `json:"shiftsPerDay"`
	ShiftHours            *int       `json:"shiftHours"`
	PeakFactor            *float64   `json:"peakFactor"`
	PeakHours             *PeakHours `json:"peakHours"`
	InboundPalletsPerDay  *float64   `json:"inboundPalletsPerDay"`
	OutboundPalletsPerDay *float64   `json:"outboundPalletsPerDay"`
	ManualShare           *float64   `json:"manualShare"`
	MaxWaitMin            *float64   `json:"maxWaitMin"`
	OnTimeTarget          *float64   `json:"onTimeTarget"`
	GrowthReserve         *float64   `json:"growthReserve"`
	Traffic               *string    `json:"traffic" enum:"rare,sometimes,often,very_often"`
	FastMoversAtGates     *bool      `json:"fastMoversAtGates"`
	RepairHours           *float64   `json:"repairHours"`
	RouteLengthM          *float64   `json:"routeLengthM"`
	OperatorTimeShare     *float64   `json:"operatorTimeShare" description:"Для экономики; в симуляцию не передаётся"`
	LaborReplacementRatio *float64   `json:"laborReplacementRatio" description:"Для экономики; в симуляцию не передаётся"`
	Tolerance             *float64   `json:"tolerance"`
	FleetPolicy           *string    `json:"fleetPolicy" enum:"add_only,add_and_reduce"`
	DesignVolume          *string    `json:"designVolume" enum:"current,growth"`
}

// SimulationRunInput starts a run of the selected configuration.
type SimulationRunInput struct {
	Fleet      *Fleet               `json:"fleet" description:"Состав этапа 1; пусто — как в выбранном расчёте подбора"`
	Conditions SimulationConditions `json:"conditions"`
}

// SimulationRun is a run of the «Симуляция» step with its progress.
type SimulationRun struct {
	ID           uuid.UUID           `json:"id" required:"true"`
	ProjectID    uuid.UUID           `json:"projectId" required:"true"`
	Status       string              `json:"status" required:"true" enum:"queued,running,done,error,cancelled"`
	Log          []string            `json:"log" required:"true" description:"Журнал прогона строками"`
	ElapsedS     float64             `json:"elapsedS" required:"true"`
	Fleet        Fleet               `json:"fleet" required:"true"`
	SimulationID *string             `json:"simulationId" description:"Прогон в services/simulation; есть у готового"`
	Error        *string             `json:"error"`
	Errors       []domain.FieldError `json:"errors" description:"Поля входа, которые не приняла симуляция"`
	Assumptions  []string            `json:"assumptions" required:"true" description:"Значения входа, принятые допущением: ТТХ робота, которых нет в каталоге"`
	Stale        bool                `json:"stale" required:"true" description:"Параметры проекта изменились после запуска"`
	CreatedAt    time.Time           `json:"createdAt" required:"true"`
}

func simulationUnavailable(err error) error {
	return domain.Unavailable("simulation_unavailable",
		"Сервис симуляции не ответил. Повторите прогон через минуту", err)
}

func (s *Service) simulator() (Simulator, error) {
	if s.sim == nil {
		return nil, simulationUnavailable(errors.New("SIMULATION_URL is not set"))
	}
	return s.sim, nil
}

// StartSimulation queues a run of the selected configuration. Reading the project is enough: a guest checks a demo
// project too (D-14); the web records the run in the decisions of a draft it may change.
func (s *Service) StartSimulation(ctx context.Context, projectID uuid.UUID, body []byte) (SimulationRun, error) {
	var in SimulationRunInput
	if err := MergePatch(&in, body); err != nil {
		return SimulationRun{}, err
	}
	sim, err := s.simulator()
	if err != nil {
		return SimulationRun{}, err
	}
	q := s.st.Q()
	rec, err := s.visibleProject(ctx, q, projectID, false)
	if err != nil {
		return SimulationRun{}, err
	}
	if err := editable(rec); err != nil {
		return SimulationRun{}, err
	}
	if rec.Snapshot.Robot == nil || rec.SelectedCalcResultID == nil {
		return SimulationRun{}, domain.Conflict("selection_required", "Выберите вариант на шаге «Подбор» — симуляция проверяет выбранную конфигурацию")
	}
	result, err := s.selectedResult(ctx, q, rec)
	if err != nil {
		return SimulationRun{}, err
	}
	fleet := Fleet{Robots: domain.Deref(result.RobotCount), Stations: domain.Deref(result.ChargerCount)}
	if in.Fleet != nil {
		fleet = *in.Fleet
	}
	var v domain.Validator
	v.Range("fleet.robots", "Роботов", domain.Ptr(float64(fleet.Robots)), domain.Ptr(1.0), domain.Ptr(500.0), "")
	v.Range("fleet.stations", "Зарядных станций", domain.Ptr(float64(fleet.Stations)), domain.Ptr(0.0), domain.Ptr(500.0), "")
	if err := v.Err(); err != nil {
		return SimulationRun{}, err
	}
	norms, err := s.projectNorms(ctx, q, rec)
	if err != nil {
		return SimulationRun{}, err
	}
	roles, err := s.locationRoles(ctx, q, rec.Snapshot)
	if err != nil {
		return SimulationRun{}, err
	}
	request, assumptions := simulationRequest(simInput{snap: rec.Snapshot, cycleS: result.Details.CycleTimeS, norms: norms,
		roles: roles, fleet: fleet, conditions: in.Conditions, projectName: rec.Name})

	jobID, err := sim.Submit(ctx, bearerOf(ctx), request)
	if err != nil {
		return SimulationRun{}, simulationError(err)
	}
	conditions, err := json.Marshal(in.Conditions)
	if err != nil {
		return SimulationRun{}, err
	}
	run := store.SimulationRunRecord{ID: store.NewID(), ProjectID: rec.ID, JobID: jobID, Status: simQueued,
		RobotCount: fleet.Robots, ChargerCount: fleet.Stations, Conditions: conditions, Assumptions: assumptions,
		InputsVersion: rec.InputsVersion, OwnerID: accessOf(ctx).owner()}
	if err := q.InsertSimulationRun(ctx, &run); err != nil {
		return SimulationRun{}, err
	}
	return simulationRunOf(run, rec, nil), nil
}

// GetSimulation returns a run; a queued or running one is polled in services/simulation.
func (s *Service) GetSimulation(ctx context.Context, id uuid.UUID) (SimulationRun, error) {
	q := s.st.Q()
	run, rec, err := s.visibleSimulation(ctx, q, id)
	if err != nil {
		return SimulationRun{}, err
	}
	if run.Status != simQueued && run.Status != simRunning {
		return simulationRunOf(run, rec, nil), nil
	}
	sim, err := s.simulator()
	if err != nil {
		return SimulationRun{}, err
	}
	job, err := sim.Job(ctx, bearerOf(ctx), run.JobID)
	if err != nil {
		return SimulationRun{}, simulationError(err)
	}
	status, simulationID := job.Status, run.SimulationID
	if status == simDone {
		if len(job.SimulationIDs) == 0 {
			status, job.Error = simError, domain.Ptr("Симуляция завершилась без прогона")
		} else {
			simulationID = &job.SimulationIDs[0]
		}
	}
	if status != run.Status || simulationID != run.SimulationID {
		if err := q.UpdateSimulationRun(ctx, id, status, simulationID, job.Error); err != nil {
			return SimulationRun{}, err
		}
		run.Status, run.SimulationID, run.Error = status, simulationID, job.Error
	}
	return simulationRunOf(run, rec, &job), nil
}

// CancelSimulation stops following a run: services/simulation cannot cancel a job, so api marks the run cancelled
// and does not read its result.
func (s *Service) CancelSimulation(ctx context.Context, id uuid.UUID) error {
	q := s.st.Q()
	run, _, err := s.visibleSimulation(ctx, q, id)
	if err != nil {
		return err
	}
	if run.Status != simQueued && run.Status != simRunning {
		return domain.Conflict("simulation_finished", "Прогон уже завершён — остановить его нельзя")
	}
	return q.UpdateSimulationRun(ctx, id, simCancelled, nil, nil)
}

// SimulationResult returns the finished run as services/simulation stores it.
func (s *Service) SimulationResult(ctx context.Context, id uuid.UUID) (json.RawMessage, error) {
	simulationID, sim, err := s.finishedSimulation(ctx, id)
	if err != nil {
		return nil, err
	}
	out, err := sim.Run(ctx, bearerOf(ctx), simulationID)
	return out, simulationError(err)
}

// SimulationTraces opens the 2D traces of a finished run; the caller copies and closes the body.
func (s *Service) SimulationTraces(ctx context.Context, id uuid.UUID, gzip bool) (*http.Response, error) {
	simulationID, sim, err := s.finishedSimulation(ctx, id)
	if err != nil {
		return nil, err
	}
	resp, err := sim.Traces(ctx, bearerOf(ctx), simulationID, gzip)
	return resp, simulationError(err)
}

func (s *Service) finishedSimulation(ctx context.Context, id uuid.UUID) (string, Simulator, error) {
	run, _, err := s.visibleSimulation(ctx, s.st.Q(), id)
	if err != nil {
		return "", nil, err
	}
	if run.Status != simDone || run.SimulationID == nil {
		return "", nil, domain.Conflict("simulation_not_finished", "Прогон ещё не готов — дождитесь завершения")
	}
	sim, err := s.simulator()
	return domain.Deref(run.SimulationID), sim, err
}

// visibleSimulation loads a run through its project: a run of a hidden project is not found.
func (s *Service) visibleSimulation(ctx context.Context, q store.Q, id uuid.UUID) (store.SimulationRunRecord, store.ProjectRecord, error) {
	run, err := q.GetSimulationRun(ctx, id)
	if err != nil {
		return run, store.ProjectRecord{}, err
	}
	rec, err := s.visibleProject(ctx, q, run.ProjectID, false)
	if err != nil {
		return run, rec, domain.NotFound("simulation_run", id.String())
	}
	return run, rec, nil
}

func (s *Service) selectedResult(ctx context.Context, q store.Q, rec store.ProjectRecord) (store.CalcResult, error) {
	results, err := q.CalcResults(ctx, rec.Snapshot.Robot.CalcRunID)
	if err != nil {
		return store.CalcResult{}, err
	}
	for _, r := range results {
		if r.ID == *rec.SelectedCalcResultID {
			return r, nil
		}
	}
	return store.CalcResult{}, fmt.Errorf("selected calc result %s is not in run %s", *rec.SelectedCalcResultID, rec.Snapshot.Robot.CalcRunID)
}

// locationRoles are the numeric location parameters by their calculation role (active_area, shifts_per_day…).
func (s *Service) locationRoles(ctx context.Context, q store.Q, snap domain.ProjectSnapshot) (map[string]float64, error) {
	defs, err := q.ParameterDefinitions(ctx, snap.Location.FacilityTypeCode)
	if err != nil {
		return nil, err
	}
	roleOf := make(map[string]string, len(defs))
	for _, d := range defs {
		if d.Role != nil {
			roleOf[d.Code] = *d.Role
		}
	}
	roles := map[string]float64{}
	for _, p := range snap.Parameters {
		if n, ok := p.Value.(float64); ok && roleOf[p.Code] != "" {
			roles[roleOf[p.Code]] = n
		}
	}
	return roles, nil
}

func simulationError(err error) error {
	var rejected *simulation.RejectedError
	switch {
	case err == nil:
		return nil
	case errors.As(err, &rejected):
		fields := make([]domain.FieldError, 0, len(rejected.Errors))
		for _, e := range rejected.Errors {
			fields = append(fields, domain.FieldError{Field: e.Field, Code: "simulation_rejected", Message: e.Message})
		}
		if len(fields) == 0 {
			fields = append(fields, domain.FieldError{Field: "conditions", Code: "simulation_rejected", Message: rejected.Message})
		}
		return &domain.ValidationError{Errors: fields}
	case errors.Is(err, simulation.ErrNotFound):
		return domain.NotFound("simulation_run", "service")
	}
	return simulationUnavailable(err)
}

func simulationRunOf(run store.SimulationRunRecord, rec store.ProjectRecord, job *simulation.Job) SimulationRun {
	out := SimulationRun{ID: run.ID, ProjectID: run.ProjectID, Status: run.Status, Log: []string{},
		Fleet: Fleet{Robots: run.RobotCount, Stations: run.ChargerCount}, SimulationID: run.SimulationID, Error: run.Error,
		Assumptions: run.Assumptions, Stale: run.InputsVersion != rec.InputsVersion, CreatedAt: run.CreatedAt}
	if out.Assumptions == nil {
		out.Assumptions = []string{}
	}
	if job != nil {
		out.Log, out.ElapsedS = job.Log, job.Elapsed
		for _, e := range job.Errors {
			out.Errors = append(out.Errors, domain.FieldError{Field: e.Field, Code: "simulation_rejected", Message: e.Message})
		}
		if out.Log == nil {
			out.Log = []string{}
		}
	}
	return out
}

// Robot fields the simulation needs but the catalog may miss: the run goes on an assumption shown to the user.
const (
	assumedSpeedMps   = 1.5
	assumedAutonomyH  = 8.0
	assumedChargeMin  = 60.0
	assumedWidthMm    = 800.0
	defaultShiftStart = 7
	defaultShifts     = 2.0
	maxManualShare    = 0.9
	secondsPerHour    = 3600.0
)

type simInput struct {
	snap        domain.ProjectSnapshot
	cycleS      *float64
	norms       domain.NormSet
	roles       map[string]float64
	fleet       Fleet
	conditions  SimulationConditions
	projectName string
}

// simulationRequest builds the request of POST /api/simulations (services/simulation/README.md, «Запрос»). Only the
// fields of the contract are sent: money stays in api and economics.
func simulationRequest(in simInput) (map[string]any, []string) {
	var assumptions []string
	robot := in.snap.Robot
	spec := domain.RobotSpec{}
	if robot.Spec != nil {
		spec = *robot.Spec
	}
	norm := func(code string, def float64) float64 {
		if v, ok := in.norms.Value(code); ok {
			return v
		}
		return def
	}
	orAssume := func(v *float64, def float64, label string) float64 {
		if v != nil && *v > 0 {
			return *v
		}
		assumptions = append(assumptions, fmt.Sprintf("%s — нет в каталоге, принято %s", label, domain.FormatNumber(def)))
		return def
	}
	speed := orAssume(spec.MaxSpeedMps, assumedSpeedMps, "Скорость робота, м/с")
	handling := norm("default_handling_seconds", 30)
	load := orAssume(spec.LoadTimeS, handling, "Погрузка, с")
	unload := orAssume(spec.UnloadTimeS, handling, "Разгрузка, с")
	var width *float64
	if spec.WidthMm != nil {
		width = domain.Ptr(float64(*spec.WidthMm))
	}
	robotBlock := map[string]any{
		"name": robot.Name, "v_max": speed,
		"autonomy_h":      orAssume(spec.AutonomyH, assumedAutonomyH, "Автономность, ч"),
		"charge_time_min": orAssume(spec.ChargeTimeMin, assumedChargeMin, "Время зарядки, мин"),
		"t_load_s":        load, "t_unload_s": unload,
		"width_mm":        orAssume(width, assumedWidthMm, "Ширина робота, мм"),
	}

	params, derived := in.snap.Task.Params, in.snap.Task.Derived
	c := in.conditions
	util, kv := norm("productive_time_share", 0.8), norm("operating_speed_factor", 0.6)
	avail, reserve := math.Min(math.Max(norm("technical_availability", 0.95), 0.5), 0.999), norm("fleet_reserve_share", 0.15)
	route := domain.Deref(params.RouteLengthM)
	if c.RouteLengthM != nil {
		route = *c.RouteLengthM
	}
	route = math.Max(route, 1)
	cycle := 2*route/(speed*kv) + load + unload
	if in.cycleS != nil && *in.cycleS > 0 && c.RouteLengthM == nil {
		cycle = *in.cycleS
	}
	calcBlock := map[string]any{
		"peak_trips_h": domain.Deref(derived.PeakToRobotizePerHour), "route_len_m": route, "cycle_s": cycle,
		"eff_prod": secondsPerHour / cycle * util * avail, "n_util": util, "n_kv": kv, "n_avail": avail, "n_reserve": reserve,
	}
	if derived.AvgHourlyToRobotize != nil {
		calcBlock["avg_trips_h"] = *derived.AvgHourlyToRobotize
	}

	location := map[string]any{}
	if area, ok := in.roles["active_area"]; ok && area >= 100 {
		location["active_area_m2"] = area
	}
	if aisle, ok := in.roles["min_aisle_width"]; ok && aisle >= 0.8 {
		location["aisle_rack_m"] = aisle
	} else if params.MinAisleWidthM != nil && *params.MinAisleWidthM >= 0.8 {
		location["aisle_rack_m"] = *params.MinAisleWidthM
	}
	if params.SiteSpeedLimitMps != nil && *params.SiteSpeedLimitMps >= 0.1 {
		location["speed_limit_m_s"] = *params.SiteSpeedLimitMps
	}

	shifts := in.roles["shifts_per_day"]
	if shifts < 1 || shifts > 3 {
		shifts = defaultShifts
	}
	hours := domain.Deref(params.WorkHoursPerDay)
	if hours <= 0 {
		hours = shifts * in.roles["shift_hours"]
	}
	volume := domain.Deref(params.DailyVolume)
	task := map[string]any{
		"shift_start_h": defaultShiftStart, "shifts": int(shifts),
		"shift_h":      int(math.Min(math.Max(math.Round(hours/shifts), 1), 24)),
		"in_per_day":   volume / 2, "out_per_day": volume / 2,
		"manual_share": math.Min(math.Max(1-domain.Deref(params.AutomationShare), 0), maxManualShare),
	}
	if params.PeakFactor != nil {
		task["peak_k"] = math.Min(math.Max(*params.PeakFactor, 1), 5)
	}

	return map[string]any{
		"configuration": map[string]any{
			"configuration_id": robot.Code, "robot_count": in.fleet.Robots, "charger_count": in.fleet.Stations,
			"robot": robotBlock, "calc": calcBlock,
		},
		"location": location,
		"task":     task,
		"scenarios": []any{map[string]any{"name": in.projectName, "simulation_params": simulationParams(c,
			norm("simulation_tolerance", 0.10))}},
	}, assumptions
}

var trafficLevels = map[string]string{"rare": "none", "sometimes": "low", "often": "mid", "very_often": "high"}

// simulationParams maps the conditions of stage 2 onto simulation_params; empty fields are left to the simulation.
func simulationParams(c SimulationConditions, tolerance float64) map[string]any {
	out := map[string]any{}
	group := func(name string) map[string]any {
		g, ok := out[name].(map[string]any)
		if !ok {
			g = map[string]any{}
			out[name] = g
		}
		return g
	}
	set := func(g, field string, v any, present bool) {
		if present {
			group(g)[field] = v
		}
	}
	set("schedule", "shift_start_h", domain.Deref(c.FirstShiftStartHour), c.FirstShiftStartHour != nil)
	set("schedule", "shifts", domain.Deref(c.ShiftsPerDay), c.ShiftsPerDay != nil)
	set("schedule", "shift_h", domain.Deref(c.ShiftHours), c.ShiftHours != nil)
	set("schedule", "peak_k", domain.Deref(c.PeakFactor), c.PeakFactor != nil)
	if c.PeakHours != nil {
		peaks := append(peakWindows("in", c.PeakHours.Inbound), peakWindows("out", c.PeakHours.Outbound)...)
		if len(peaks) > 0 {
			group("schedule")["peaks"] = peaks
		}
	}
	set("flows", "in_per_day", domain.Deref(c.InboundPalletsPerDay), c.InboundPalletsPerDay != nil)
	set("flows", "out_per_day", domain.Deref(c.OutboundPalletsPerDay), c.OutboundPalletsPerDay != nil)
	if c.ManualShare != nil {
		group("flows")["manual_share"] = math.Min(*c.ManualShare, maxManualShare)
	}
	set("service", "wait_limit_min", domain.Deref(c.MaxWaitMin), c.MaxWaitMin != nil)
	set("service", "on_time_target", domain.Deref(c.OnTimeTarget), c.OnTimeTarget != nil)
	if c.GrowthReserve != nil {
		out["growth"] = *c.GrowthReserve
	}
	if c.Traffic != nil {
		if level, ok := trafficLevels[*c.Traffic]; ok {
			group("site_conditions")["traffic"] = level
		}
	}
	if c.FastMoversAtGates != nil {
		abc := "none"
		if *c.FastMoversAtGates {
			abc = "full"
		}
		group("site_conditions")["abc"] = abc
	}
	set("site_conditions", "mttr_h", domain.Deref(c.RepairHours), c.RepairHours != nil)
	if c.Tolerance != nil {
		tolerance = *c.Tolerance
	}
	group("verification")["tolerance"] = tolerance
	set("verification", "fleet_policy", domain.Deref(c.FleetPolicy), c.FleetPolicy != nil)
	set("verification", "design_volume", domain.Deref(c.DesignVolume), c.DesignVolume != nil)
	return out
}

// peakWindows turns peak hours 0–23 into windows {flow, start_h, dur_h} of consecutive hours.
func peakWindows(flow string, hours []int) []any {
	sorted := slices.Clone(hours)
	slices.Sort(sorted)
	sorted = slices.Compact(sorted)
	var out []any
	for i := 0; i < len(sorted); {
		j := i
		for j+1 < len(sorted) && sorted[j+1] == sorted[j]+1 {
			j++
		}
		if sorted[i] >= 0 && sorted[i] <= 23 {
			out = append(out, map[string]any{"flow": flow, "start_h": sorted[i], "dur_h": j - i + 1})
		}
		i = j + 1
	}
	return out
}
