package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// SimulationRunRecord is a run of the «Симуляция» step: the link to the job of services/simulation.
type SimulationRunRecord struct {
	ID            uuid.UUID
	ProjectID     uuid.UUID
	JobID         string
	SimulationID  *string
	Status        string
	RobotCount    int
	ChargerCount  int
	Conditions    json.RawMessage
	Assumptions   []string
	Error         *string
	InputsVersion int
	OwnerID       *uuid.UUID
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// InsertSimulationRun stores a started run.
func (q Q) InsertSimulationRun(ctx context.Context, r *SimulationRunRecord) error {
	assumptions, err := json.Marshal(r.Assumptions)
	if err != nil {
		return fmt.Errorf("marshal assumptions: %w", err)
	}
	conditions := r.Conditions
	if len(conditions) == 0 {
		conditions = json.RawMessage("{}")
	}
	return q.db.QueryRow(ctx, `
INSERT INTO simulation_run (id, project_id, job_id, status, robot_count, charger_count, conditions, assumptions,
                            inputs_version, owner_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING created_at, updated_at`,
		r.ID, r.ProjectID, r.JobID, r.Status, r.RobotCount, r.ChargerCount, []byte(conditions), assumptions,
		r.InputsVersion, r.OwnerID).Scan(&r.CreatedAt, &r.UpdatedAt)
}

// GetSimulationRun loads a run.
func (q Q) GetSimulationRun(ctx context.Context, id uuid.UUID) (SimulationRunRecord, error) {
	var r SimulationRunRecord
	var conditions, assumptions []byte
	err := q.db.QueryRow(ctx, `
SELECT id, project_id, job_id, simulation_id, status, robot_count, charger_count, conditions, assumptions, error,
       inputs_version, owner_id, created_at, updated_at
FROM simulation_run WHERE id = $1`, id).Scan(&r.ID, &r.ProjectID, &r.JobID, &r.SimulationID, &r.Status, &r.RobotCount,
		&r.ChargerCount, &conditions, &assumptions, &r.Error, &r.InputsVersion, &r.OwnerID, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return r, notFound(err, "simulation_run", id)
	}
	r.Conditions = conditions
	if err := json.Unmarshal(assumptions, &r.Assumptions); err != nil {
		return r, fmt.Errorf("unmarshal assumptions: %w", err)
	}
	return r, nil
}

// UpdateSimulationRun records the progress of a run.
func (q Q) UpdateSimulationRun(ctx context.Context, id uuid.UUID, status string, simulationID, errText *string) error {
	_, err := q.db.Exec(ctx, `UPDATE simulation_run SET status = $2, simulation_id = COALESCE($3, simulation_id),
		error = $4, updated_at = now() WHERE id = $1`, id, status, simulationID, errText)
	return err
}
