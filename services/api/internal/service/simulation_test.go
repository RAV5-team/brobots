package service

import (
	"math"
	"reflect"
	"testing"

	"github.com/brobots/api/internal/domain"
)

func TestPeakWindows(t *testing.T) {
	got := peakWindows("in", []int{15, 8, 9, 9, 10, 14, 30})
	want := []any{
		map[string]any{"flow": "in", "start_h": 8, "dur_h": 3},
		map[string]any{"flow": "in", "start_h": 14, "dur_h": 2},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("windows = %+v", got)
	}
}

func TestSimulationRequest(t *testing.T) {
	width := 1000
	snap := domain.ProjectSnapshot{
		Task: domain.Task{
			Params: domain.TaskParams{DailyVolume: domain.Ptr(2000.0), WorkHoursPerDay: domain.Ptr(22.0), AutomationShare: domain.Ptr(0.95),
				PeakFactor: domain.Ptr(1.5), RouteLengthM: domain.Ptr(100.0)},
			Derived: domain.TaskDerived{PeakToRobotizePerHour: domain.Ptr(129.5), AvgHourlyToRobotize: domain.Ptr(86.4)},
		},
		Robot: &domain.RobotSnapshot{RobotCard: domain.RobotCard{Code: "DMR-CARRIER-P", Name: "DMR Carrier P",
			Spec: &domain.RobotSpec{MaxSpeedMps: domain.Ptr(1.5), WidthMm: &width, LoadTimeS: domain.Ptr(60.0), UnloadTimeS: domain.Ptr(60.0)}}},
	}
	req, assumptions := simulationRequest(simInput{snap: snap, cycleS: domain.Ptr(342.0), roles: map[string]float64{"shifts_per_day": 2, "active_area": 10000},
		fleet: Fleet{Robots: 19, Stations: 5}, conditions: SimulationConditions{Tolerance: domain.Ptr(0.05)}, projectName: "Проект"})

	cfg := req["configuration"].(map[string]any)
	calc := cfg["calc"].(map[string]any)
	if cfg["robot_count"] != 19 || calc["cycle_s"] != 342.0 || calc["peak_trips_h"] != 129.5 {
		t.Errorf("configuration = %+v", cfg)
	}
	// eff_prod = cycles per hour × utilization × availability (services/simulation demo input).
	if eff := calc["eff_prod"].(float64); math.Abs(eff-3600/342.0*0.8*0.95) > 1e-9 {
		t.Errorf("eff_prod = %v", eff)
	}
	task := req["task"].(map[string]any)
	if task["shifts"] != 2 || task["shift_h"] != 11 || task["in_per_day"] != 1000.0 || math.Abs(task["manual_share"].(float64)-0.05) > 1e-9 {
		t.Errorf("task = %+v", task)
	}
	if len(assumptions) != 2 { // autonomy and charge time are missing in the catalog
		t.Errorf("assumptions = %v", assumptions)
	}
	params := req["scenarios"].([]any)[0].(map[string]any)["simulation_params"].(map[string]any)
	if params["verification"].(map[string]any)["tolerance"] != 0.05 || len(params) != 1 {
		t.Errorf("simulation params = %+v", params)
	}
}
