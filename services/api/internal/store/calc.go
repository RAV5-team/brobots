package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CalcRunRecord is a stored calculation of the matching candidates of a project.
type CalcRunRecord struct {
	ID             uuid.UUID
	ProjectID      uuid.UUID
	MatchRunID     uuid.UUID
	ModelVersion   string
	RankingVersion *string
	NormSetID      *uuid.UUID
	CatalogVersion int
	InputsVersion  int
	HorizonYears   int
	Request        calc.Request
	CreatedAt      time.Time
}

// CalcResult is a stored calculation result.
type CalcResult struct {
	ID uuid.UUID `json:"id"`
	calc.Result
}

// SaveCalcRun stores a calculation with its results; it assigns the result ids, the creation
// time and the run id unless the caller set it (the id is sent to the calculator beforehand).
func (q Q) SaveCalcRun(ctx context.Context, run *CalcRunRecord, results []calc.Result) ([]CalcResult, error) {
	if run.ID == uuid.Nil {
		run.ID = NewID()
	}
	req, err := json.Marshal(run.Request)
	if err != nil {
		return nil, fmt.Errorf("marshal calc request: %w", err)
	}
	if err := q.db.QueryRow(ctx, `
INSERT INTO calc_run (id, project_id, match_run_id, model_version, ranking_version, norm_set_id, catalog_version,
                      inputs_version, horizon_years, request)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING created_at`,
		run.ID, run.ProjectID, run.MatchRunID, run.ModelVersion, run.RankingVersion, run.NormSetID, run.CatalogVersion,
		run.InputsVersion, run.HorizonYears, req,
	).Scan(&run.CreatedAt); err != nil {
		return nil, err
	}
	out := make([]CalcResult, 0, len(results))
	for i, r := range results {
		trace, err := json.Marshal(r.Trace)
		if err != nil {
			return nil, fmt.Errorf("marshal trace: %w", err)
		}
		details, err := json.Marshal(r.Details)
		if err != nil {
			return nil, fmt.Errorf("marshal details: %w", err)
		}
		if r.Warnings == nil {
			r.Warnings = []string{}
		}
		stored := CalcResult{ID: NewID(), Result: r}
		if _, err := q.db.Exec(ctx, `
INSERT INTO calc_result (id, calc_run_id, solution_id, acquisition_model, calculable, reason, robot_count, charger_count,
                         capex_rub, opex_year_rub, labor_savings_year_rub, net_effect_year_rub, payback_years, roi, tco_rub,
                         budget_over_rub, budget_over_pct, trace, warnings, sort, rank, score, feasibility, details)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
			stored.ID, run.ID, r.SolutionID, r.AcquisitionModel, r.Calculable, r.Reason, r.RobotCount, r.ChargerCount,
			r.CapexRub, r.OpexYearRub, r.LaborSavingsYearRub, r.NetEffectYearRub, r.PaybackYears, r.Roi, r.TcoRub,
			r.BudgetOverRub, r.BudgetOverPct, trace, r.Warnings, i, r.Rank, r.Score, r.Feasibility, details); err != nil {
			return nil, err
		}
		out = append(out, stored)
	}
	return out, nil
}

const calcRunSelect = `SELECT id, project_id, match_run_id, model_version, ranking_version, norm_set_id, catalog_version,
       inputs_version, horizon_years, request, created_at FROM calc_run`

func scanCalcRun(row pgx.Row) (CalcRunRecord, error) {
	var r CalcRunRecord
	var req []byte
	if err := row.Scan(&r.ID, &r.ProjectID, &r.MatchRunID, &r.ModelVersion, &r.RankingVersion, &r.NormSetID,
		&r.CatalogVersion, &r.InputsVersion, &r.HorizonYears, &req, &r.CreatedAt); err != nil {
		return r, err
	}
	if err := json.Unmarshal(req, &r.Request); err != nil {
		return r, fmt.Errorf("unmarshal calc request: %w", err)
	}
	return r, nil
}

// LatestCalcRun returns the latest calculation of a project, or nil.
func (q Q) LatestCalcRun(ctx context.Context, projectID uuid.UUID) (*CalcRunRecord, error) {
	r, err := scanCalcRun(q.db.QueryRow(ctx, calcRunSelect+` WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`, projectID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// GetCalcRun returns a calculation.
func (q Q) GetCalcRun(ctx context.Context, id uuid.UUID) (CalcRunRecord, error) {
	r, err := scanCalcRun(q.db.QueryRow(ctx, calcRunSelect+` WHERE id = $1`, id))
	return r, notFound(err, "evaluation", id)
}

// CalcResults returns the results of a calculation in the order of the request.
func (q Q) CalcResults(ctx context.Context, runID uuid.UUID) ([]CalcResult, error) {
	rows, err := q.db.Query(ctx, `
SELECT id, solution_id, acquisition_model, calculable, reason, robot_count, charger_count, capex_rub::float8,
       opex_year_rub::float8, labor_savings_year_rub::float8, net_effect_year_rub::float8, payback_years::float8,
       roi::float8, tco_rub::float8, budget_over_rub::float8, budget_over_pct::float8, trace, warnings, rank,
       score::float8, feasibility, details
FROM calc_result WHERE calc_run_id = $1 ORDER BY sort`, runID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (CalcResult, error) {
		var r CalcResult
		var trace, details []byte
		if err := row.Scan(&r.ID, &r.SolutionID, &r.AcquisitionModel, &r.Calculable, &r.Reason, &r.RobotCount, &r.ChargerCount,
			&r.CapexRub, &r.OpexYearRub, &r.LaborSavingsYearRub, &r.NetEffectYearRub, &r.PaybackYears, &r.Roi, &r.TcoRub,
			&r.BudgetOverRub, &r.BudgetOverPct, &trace, &r.Warnings, &r.Rank, &r.Score, &r.Feasibility, &details); err != nil {
			return r, err
		}
		if err := json.Unmarshal(trace, &r.Trace); err != nil {
			return r, fmt.Errorf("unmarshal trace: %w", err)
		}
		if err := json.Unmarshal(details, &r.Details); err != nil {
			return r, fmt.Errorf("unmarshal details: %w", err)
		}
		return r, nil
	})
}
