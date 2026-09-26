package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const projectSelect = `
SELECT p.id, p.name, p.location_id, l.name, l.facility_type_code, t.id, t.name, w.id, w.code, w.name, w.unit_label,
       p.status, p.horizon_years, p.catalog_version, p.dictionaries_version, p.model_version, p.snapshot_taken_at,
       (t.updated_at > p.snapshot_taken_at OR l.updated_at > p.snapshot_taken_at),
       ((SELECT version FROM reference_version WHERE scope = 'catalog') > p.catalog_version),
       l.deleted_at IS NOT NULL,
       p.pinned_solution_id, p.selected_solution_id, ss.name, p.selected_acquisition_model, p.copied_from_id, p.is_demo,
       p.owner_id, r.id, r.created_at, r.total_candidates, r.passed_count, r.verify_count, r.excluded_count,
       p.created_at, p.updated_at
FROM project p
JOIN location l ON l.id = p.location_id
JOIN task t ON t.id = p.task_id
JOIN work_type w ON w.id = t.work_type_id
LEFT JOIN solution ss ON ss.id = p.selected_solution_id
LEFT JOIN LATERAL (SELECT * FROM match_run mr WHERE mr.project_id = p.id ORDER BY mr.created_at DESC LIMIT 1) r ON true`

func scanProject(r pgx.Row) (domain.Project, error) {
	var p domain.Project
	var selID *uuid.UUID
	var selName, selModel *string
	var runID *uuid.UUID
	var runAt *time.Time
	var total, passed, verify, excluded *int
	err := r.Scan(&p.ID, &p.Name, &p.LocationID, &p.LocationName, &p.FacilityTypeCode, &p.Task.ID, &p.Task.Name,
		&p.Task.WorkType.ID, &p.Task.WorkType.Code, &p.Task.WorkType.Name, &p.Task.WorkType.UnitLabel,
		&p.Status, &p.HorizonYears, &p.Versions.Catalog, &p.Versions.Dictionaries, &p.Versions.Model, &p.SnapshotTakenAt,
		&p.DataChanged, &p.CatalogUpdated, &p.LocationDeleted,
		&p.PinnedSolutionID, &selID, &selName, &selModel, &p.CopiedFromID, &p.IsDemo,
		&p.OwnerID, &runID, &runAt, &total, &passed, &verify, &excluded, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return p, err
	}
	if selID != nil {
		p.Selection = &domain.Selection{SolutionID: *selID, SolutionName: domain.Deref(selName), AcquisitionModel: selModel}
	}
	if runID != nil {
		p.LatestRun = &domain.RunInfo{ID: *runID, CreatedAt: *runAt, Counts: domain.MatchCounts{
			Total: domain.Deref(total), Passed: domain.Deref(passed), NeedsVerification: domain.Deref(verify),
			Excluded: domain.Deref(excluded)}}
	}
	return p, nil
}

// ProjectFilter selects projects.
type ProjectFilter struct {
	LocationID *uuid.UUID
	TaskID     *uuid.UUID
	Status     string
}

// ListProjects returns live projects, most recently updated first.
func (q Q) ListProjects(ctx context.Context, f ProjectFilter) ([]domain.Project, error) {
	rows, err := q.db.Query(ctx, projectSelect+`
WHERE p.deleted_at IS NULL AND ($1::uuid IS NULL OR p.location_id = $1) AND ($2::uuid IS NULL OR p.task_id = $2)
  AND ($3 = '' OR p.status = $3)
ORDER BY p.updated_at DESC`, f.LocationID, f.TaskID, f.Status)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Project, error) { return scanProject(r) })
}

// GetProject returns a live project.
func (q Q) GetProject(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	p, err := scanProject(q.db.QueryRow(ctx, projectSelect+` WHERE p.id = $1 AND p.deleted_at IS NULL`, id))
	return p, notFound(err, "project", id)
}

// ProjectRecord is the writable part of a project.
type ProjectRecord struct {
	ID                 uuid.UUID
	Name               string
	LocationID         uuid.UUID
	TaskID             uuid.UUID
	Status             string
	HorizonYears       *int
	Versions           domain.Versions
	Snapshot           domain.ProjectSnapshot
	SnapshotTakenAt    time.Time
	PinnedSolutionID   *uuid.UUID
	SelectedSolutionID *uuid.UUID
	SelectedModel      *string
	CopiedFromID       *uuid.UUID
	IsDemo             bool
	// OwnerID is the Keycloak sub of the author; nil for demo projects. Set on insert only.
	OwnerID *uuid.UUID
}

// SaveProject inserts or updates a project.
func (q Q) SaveProject(ctx context.Context, r ProjectRecord) error {
	snap, err := json.Marshal(r.Snapshot)
	if err != nil {
		return fmt.Errorf("marshal snapshot: %w", err)
	}
	_, err = q.db.Exec(ctx, `
INSERT INTO project (id, name, location_id, task_id, status, horizon_years, catalog_version, dictionaries_version,
                     model_version, snapshot, snapshot_taken_at, pinned_solution_id, selected_solution_id,
                     selected_acquisition_model, copied_from_id, is_demo, owner_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, horizon_years = EXCLUDED.horizon_years,
  catalog_version = EXCLUDED.catalog_version, dictionaries_version = EXCLUDED.dictionaries_version,
  model_version = EXCLUDED.model_version, snapshot = EXCLUDED.snapshot, snapshot_taken_at = EXCLUDED.snapshot_taken_at,
  pinned_solution_id = EXCLUDED.pinned_solution_id, selected_solution_id = EXCLUDED.selected_solution_id,
  selected_acquisition_model = EXCLUDED.selected_acquisition_model, updated_at = now()`,
		r.ID, r.Name, r.LocationID, r.TaskID, r.Status, r.HorizonYears, r.Versions.Catalog, r.Versions.Dictionaries,
		r.Versions.Model, snap, r.SnapshotTakenAt, r.PinnedSolutionID, r.SelectedSolutionID, r.SelectedModel,
		r.CopiedFromID, r.IsDemo, r.OwnerID)
	return err
}

// ProjectRecordOf loads the writable part of a live project.
func (q Q) ProjectRecordOf(ctx context.Context, id uuid.UUID) (ProjectRecord, error) {
	var r ProjectRecord
	var snap []byte
	err := q.db.QueryRow(ctx, `
SELECT id, name, location_id, task_id, status, horizon_years, catalog_version, dictionaries_version, model_version,
       snapshot, snapshot_taken_at, pinned_solution_id, selected_solution_id, selected_acquisition_model, copied_from_id, is_demo,
       owner_id
FROM project WHERE id = $1 AND deleted_at IS NULL`, id).Scan(&r.ID, &r.Name, &r.LocationID, &r.TaskID, &r.Status,
		&r.HorizonYears, &r.Versions.Catalog, &r.Versions.Dictionaries, &r.Versions.Model, &snap, &r.SnapshotTakenAt,
		&r.PinnedSolutionID, &r.SelectedSolutionID, &r.SelectedModel, &r.CopiedFromID, &r.IsDemo, &r.OwnerID)
	if err != nil {
		return r, notFound(err, "project", id)
	}
	if err := json.Unmarshal(snap, &r.Snapshot); err != nil {
		return r, fmt.Errorf("unmarshal snapshot: %w", err)
	}
	return r, nil
}

// SoftDeleteProject hides a project.
func (q Q) SoftDeleteProject(ctx context.Context, id uuid.UUID) error {
	tag, err := q.db.Exec(ctx, `UPDATE project SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.NotFound("project", id.String())
	}
	return err
}

// Overrides returns the condition overrides of a project.
func (q Q) Overrides(ctx context.Context, projectID uuid.UUID) ([]matching.Override, error) {
	rows, err := q.db.Query(ctx, `SELECT check_code, value_number, value_text, value_list, note
		FROM project_condition_override WHERE project_id = $1 ORDER BY check_code`, projectID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (matching.Override, error) {
		var o matching.Override
		err := r.Scan(&o.Code, &o.Number, &o.Text, &o.List, &o.Note)
		return o, err
	})
}

// ReplaceOverrides sets the condition overrides of a project.
func (q Q) ReplaceOverrides(ctx context.Context, projectID uuid.UUID, list []matching.Override) error {
	if _, err := q.db.Exec(ctx, `DELETE FROM project_condition_override WHERE project_id = $1`, projectID); err != nil {
		return err
	}
	for _, o := range list {
		if _, err := q.db.Exec(ctx, `INSERT INTO project_condition_override (project_id, check_code, value_number, value_text, value_list, note)
			VALUES ($1, $2, $3, $4, $5, $6)`, projectID, o.Code, o.Number, o.Text, o.List, o.Note); err != nil {
			return err
		}
	}
	_, err := q.db.Exec(ctx, `UPDATE project SET updated_at = now() WHERE id = $1`, projectID)
	return err
}

// ManualCandidates returns solutions added by hand to a project.
func (q Q) ManualCandidates(ctx context.Context, projectID uuid.UUID) ([]domain.ManualCandidate, error) {
	rows, err := q.db.Query(ctx, `SELECT m.solution_id, s.name, m.reason, m.added_at FROM project_manual_candidate m
		JOIN solution s ON s.id = m.solution_id WHERE m.project_id = $1 ORDER BY m.added_at`, projectID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.ManualCandidate, error) {
		var m domain.ManualCandidate
		err := r.Scan(&m.SolutionID, &m.SolutionName, &m.Reason, &m.AddedAt)
		return m, err
	})
}

// AddManualCandidate adds a solution to the comparison by hand.
func (q Q) AddManualCandidate(ctx context.Context, projectID, solutionID uuid.UUID, reason *string) error {
	_, err := q.db.Exec(ctx, `INSERT INTO project_manual_candidate (project_id, solution_id, reason) VALUES ($1, $2, $3)
		ON CONFLICT (project_id, solution_id) DO UPDATE SET reason = EXCLUDED.reason`, projectID, solutionID, reason)
	return err
}

// RemoveManualCandidate removes a hand-added solution.
func (q Q) RemoveManualCandidate(ctx context.Context, projectID, solutionID uuid.UUID) error {
	tag, err := q.db.Exec(ctx, `DELETE FROM project_manual_candidate WHERE project_id = $1 AND solution_id = $2`, projectID, solutionID)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.NotFound("manual_candidate", solutionID.String())
	}
	return err
}

// SaveRun persists a matching run with candidates and checks.
func (q Q) SaveRun(ctx context.Context, run *matching.Run, conditions matching.Conditions) error {
	id := NewID()
	conds, err := json.Marshal(conditions)
	if err != nil {
		return err
	}
	var created time.Time
	err = q.db.QueryRow(ctx, `
INSERT INTO match_run (id, project_id, task_id, work_type_id, catalog_version, ruleset_version, conditions,
                       total_candidates, passed_count, verify_count, excluded_count)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING created_at`,
		id, run.ProjectID, run.TaskID, run.WorkType.ID, run.CatalogVersion, run.RulesetVersion, conds,
		run.Counts.Total, run.Counts.Passed, run.Counts.NeedsVerification, run.Counts.Excluded).Scan(&created)
	if err != nil {
		return err
	}
	run.ID = &id
	run.CreatedAt = &created
	for i := range run.Candidates {
		c := &run.Candidates[i]
		cid := NewID()
		c.ID = &cid
		if _, err := q.db.Exec(ctx, `
INSERT INTO match_candidate (id, run_id, solution_id, capability_id, offer_id, state, is_manual, transfer_flag, risks, summary_ru, sort)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, cid, id, c.Solution.ID, c.CapabilityID, c.OfferID, c.State,
			c.IsManual, c.TransferFlag, c.Risks, c.Summary, i); err != nil {
			return err
		}
		for j, ch := range c.Checks {
			if _, err := q.db.Exec(ctx, `
INSERT INTO match_check (candidate_id, check_code, status, robot_value, required_value, unit, robot_value_source,
                         required_value_source, message_ru, sort)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, cid, ch.Code, ch.Status, ch.RobotValue, ch.RequiredValue, ch.Unit,
				ch.RobotValueSource, ch.RequiredValueSource, ch.Message, j); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetRun loads a persisted matching run.
func (q Q) GetRun(ctx context.Context, id uuid.UUID) (matching.Run, error) {
	var run matching.Run
	var conds []byte
	var created time.Time
	var projectID uuid.UUID
	err := q.db.QueryRow(ctx, `
SELECT r.id, r.project_id, r.task_id, w.id, w.code, w.name, w.unit_label, r.catalog_version, r.ruleset_version,
       r.conditions, r.created_at
FROM match_run r JOIN work_type w ON w.id = r.work_type_id WHERE r.id = $1`, id).Scan(&id, &projectID, &run.TaskID,
		&run.WorkType.ID, &run.WorkType.Code, &run.WorkType.Name, &run.WorkType.UnitLabel, &run.CatalogVersion,
		&run.RulesetVersion, &conds, &created)
	if err != nil {
		return run, notFound(err, "matching_run", id)
	}
	run.ID, run.ProjectID, run.CreatedAt = &id, &projectID, &created
	var c matching.Conditions
	if err := json.Unmarshal(conds, &c); err != nil {
		return run, err
	}
	run.Conditions = c.List()
	rows, err := q.db.Query(ctx, `
SELECT c.id, c.solution_id, s.code, s.name, s.manufacturer, s.solution_type, s.status, s.trl, o.price_rub,
       rs.payload_kg, rs.specs_confirmed, c.capability_id, c.offer_id, rc.throughput_per_hour, c.state, c.is_manual,
       c.transfer_flag, c.risks, c.summary_ru
FROM match_candidate c
JOIN solution s ON s.id = c.solution_id
LEFT JOIN solution_offer o ON o.id = c.offer_id
LEFT JOIN robot_spec rs ON rs.solution_id = c.solution_id
LEFT JOIN robot_capability rc ON rc.id = c.capability_id
WHERE c.run_id = $1 ORDER BY c.sort`, id)
	if err != nil {
		return run, err
	}
	cands, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (matching.Candidate, error) {
		var c matching.Candidate
		var cid uuid.UUID
		var summary *string
		err := r.Scan(&cid, &c.Solution.ID, &c.Solution.Code, &c.Solution.Name, &c.Solution.Manufacturer,
			&c.Solution.SolutionType, &c.Solution.Status, &c.Solution.Trl, &c.Solution.PriceRub, &c.Solution.PayloadKg,
			&c.Solution.SpecsConfirmed, &c.CapabilityID, &c.OfferID, &c.ThroughputPerHour, &c.State, &c.IsManual,
			&c.TransferFlag, &c.Risks, &summary)
		c.ID = &cid
		c.Summary = domain.Deref(summary)
		c.Checks = []matching.Check{}
		return c, err
	})
	if err != nil {
		return run, err
	}
	idx := make(map[uuid.UUID]int, len(cands))
	for i, c := range cands {
		idx[*c.ID] = i
	}
	rows, err = q.db.Query(ctx, `
SELECT k.candidate_id, k.check_code, k.status, k.robot_value, k.required_value, k.unit, k.robot_value_source,
       k.required_value_source, k.message_ru
FROM match_check k JOIN match_candidate c ON c.id = k.candidate_id WHERE c.run_id = $1 ORDER BY k.sort`, id)
	if err != nil {
		return run, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid uuid.UUID
		var ch matching.Check
		var robot, required, unit, rsrc, qsrc *string
		if err := rows.Scan(&cid, &ch.Code, &ch.Status, &robot, &required, &unit, &rsrc, &qsrc, &ch.Message); err != nil {
			return run, err
		}
		ch.RobotValue, ch.RequiredValue, ch.Unit = domain.Deref(robot), domain.Deref(required), domain.Deref(unit)
		ch.RobotValueSource, ch.RequiredValueSource = domain.Deref(rsrc), domain.Deref(qsrc)
		ch.Label = matching.CheckLabel(ch.Code)
		cands[idx[cid]].Checks = append(cands[idx[cid]].Checks, ch)
	}
	run.Candidates = cands
	run.Counts = matching.Count(cands)
	return run, rows.Err()
}

// LatestRunID returns the latest run of a project.
func (q Q) LatestRunID(ctx context.Context, projectID uuid.UUID) (*uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM match_run WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`, projectID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &id, err
}
