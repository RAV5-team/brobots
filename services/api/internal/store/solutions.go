package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const solutionSelect = `
SELECT s.id, s.code, s.kind, s.name, s.manufacturer, s.organizer_ids, s.product_class, s.type_group, s.solution_type,
       s.status, s.trl, s.market_potential, s.region, s.country, s.description, s.cases_text, s.organizer_scenarios,
       s.acquisition_models, s.tested_by_fcbas, s.in_registry_719, s.photo_url, s.cost_type, s.quantity_rule,
       s.compatible_with, s.software_cost_pct, s.service_cost_pct, s.service_life_years, s.source_id, s.is_active,
       s.created_at, s.updated_at,
       o.id, o.price_rub, o.price_percent, o.price_unit, o.price_includes_vat,
       r.solution_id, r.payload_kg, r.payload_exact, r.length_mm, r.width_mm, r.height_mm, r.dimensions_exact,
       r.mass_kg, r.max_speed_mps, r.autonomy_h, r.charge_time_min, r.min_temp_c, r.min_temp_exact, r.max_temp_c,
       r.avg_power_kw, r.load_time_s, r.unload_time_s, r.lift_height_mm, r.positioning_accuracy_mm, r.navigation_type,
       r.handling_method_code, r.indoor_allowed, r.outdoor_allowed, r.min_passage_mm, r.floor_requirements,
       r.charging_infra, r.connectivity, r.integrations, r.service_terms, r.specs_confirmed, r.specs_source_text,
       r.specs_source_id, r.specs_actualized_on
FROM solution s
LEFT JOIN solution_offer o ON o.solution_id = s.id AND o.is_default
LEFT JOIN robot_spec r ON r.solution_id = s.id`

func scanSolution(row pgx.Row) (domain.Solution, error) {
	var s domain.Solution
	var offerID *uuid.UUID
	var priceRub, pricePct *float64
	var priceUnit *string
	var priceVat *bool
	var specID *uuid.UUID
	var sp domain.RobotSpec
	var payloadExact, dimsExact, tempExact *bool
	var specsConfirmed *string
	var actualized *time.Time
	err := row.Scan(&s.ID, &s.Code, &s.Kind, &s.Name, &s.Manufacturer, &s.OrganizerIDs, &s.ProductClass, &s.TypeGroup,
		&s.SolutionType, &s.Status, &s.Trl, &s.MarketPotential, &s.Region, &s.Country, &s.Description, &s.CasesText,
		&s.OrganizerScenarios, &s.AcquisitionModels, &s.Badges.TestedByFcbas, &s.Badges.InRegistry719, &s.PhotoURL,
		&s.CostType, &s.QuantityRule, &s.CompatibleWith, &s.SoftwareCostPct, &s.ServiceCostPct, &s.ServiceLifeYears,
		&s.SourceID, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		&offerID, &priceRub, &pricePct, &priceUnit, &priceVat,
		&specID, &sp.PayloadKg, &payloadExact, &sp.LengthMm, &sp.WidthMm, &sp.HeightMm, &dimsExact,
		&sp.MassKg, &sp.MaxSpeedMps, &sp.AutonomyH, &sp.ChargeTimeMin, &sp.MinTempC, &tempExact, &sp.MaxTempC,
		&sp.AvgPowerKw, &sp.LoadTimeS, &sp.UnloadTimeS, &sp.LiftHeightMm, &sp.PositioningAccuracyMm, &sp.NavigationType,
		&sp.HandlingMethodCode, &sp.IndoorAllowed, &sp.OutdoorAllowed, &sp.MinPassageMm, &sp.FloorRequirements,
		&sp.ChargingInfra, &sp.Connectivity, &sp.Integrations, &sp.ServiceTerms, &specsConfirmed, &sp.SpecsSourceText,
		&sp.SpecsSourceID, &actualized)
	if err != nil {
		return s, err
	}
	if priceUnit != nil {
		s.Price = &domain.Price{OfferID: offerID, AmountRub: priceRub, Percent: pricePct, Unit: *priceUnit, IncludesVat: domain.Deref(priceVat)}
	}
	if specID != nil {
		sp.PayloadExact = domain.Deref(payloadExact)
		sp.DimensionsExact = domain.Deref(dimsExact)
		sp.MinTempExact = domain.Deref(tempExact)
		sp.SpecsConfirmed = domain.Deref(specsConfirmed)
		sp.SpecsActualizedOn = domain.NewDate(actualized)
		if sp.Connectivity == nil {
			sp.Connectivity = []string{}
		}
		if sp.Integrations == nil {
			sp.Integrations = []string{}
		}
		s.Spec = &sp
	}
	s.Industries = []string{}
	s.Capabilities = []domain.Capability{}
	return s, nil
}

// SolutionFilter narrows the loaded solutions in SQL; fine filters run in the service.
type SolutionFilter struct {
	IDs           []uuid.UUID
	Kind          string
	IncludeHidden bool
}

// ListSolutions loads solutions with spec, default price, industries and capabilities.
func (q Q) ListSolutions(ctx context.Context, f SolutionFilter) ([]domain.Solution, error) {
	sql := solutionSelect + ` WHERE ($1 OR s.is_active) AND ($2 = '' OR s.kind = $2)`
	args := []any{f.IncludeHidden, f.Kind}
	if f.IDs != nil {
		sql += ` AND s.id = ANY($3)`
		args = append(args, f.IDs)
	}
	rows, err := q.db.Query(ctx, sql+` ORDER BY s.name`, args...)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Solution, error) { return scanSolution(r) })
	if err != nil {
		return nil, err
	}
	if err := q.attachSolutionChildren(ctx, list); err != nil {
		return nil, err
	}
	return list, nil
}

// GetSolution returns one solution with its offers.
func (q Q) GetSolution(ctx context.Context, id uuid.UUID) (domain.Solution, error) {
	list, err := q.ListSolutions(ctx, SolutionFilter{IDs: []uuid.UUID{id}, IncludeHidden: true})
	if err != nil {
		return domain.Solution{}, err
	}
	if len(list) == 0 {
		return domain.Solution{}, domain.NotFound("solution", id.String())
	}
	s := list[0]
	if s.Offers, err = q.Offers(ctx, id); err != nil {
		return s, err
	}
	s.UsedInProjects, err = q.SolutionProjectsCount(ctx, id)
	return s, err
}

// SolutionIDByCode finds a solution by code.
func (q Q) SolutionIDByCode(ctx context.Context, code string) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM solution WHERE code = $1`, code).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return id, false, nil
	}
	return id, err == nil, err
}

func (q Q) attachSolutionChildren(ctx context.Context, list []domain.Solution) error {
	if len(list) == 0 {
		return nil
	}
	idx := make(map[uuid.UUID]int, len(list))
	ids := make([]uuid.UUID, len(list))
	for i, s := range list {
		idx[s.ID] = i
		ids[i] = s.ID
	}
	rows, err := q.db.Query(ctx, `SELECT si.solution_id, i.name_ru FROM solution_industry si
		JOIN industry i ON i.code = si.industry_code WHERE si.solution_id = ANY($1) ORDER BY i.sort`, ids)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id uuid.UUID
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			rows.Close()
			return err
		}
		list[idx[id]].Industries = append(list[idx[id]].Industries, name)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	caps, err := q.capabilities(ctx, `c.solution_id = ANY($1)`, ids)
	if err != nil {
		return err
	}
	for _, c := range caps {
		s := &list[idx[c.SolutionID]]
		c.Resolve(s.Spec)
		s.Capabilities = append(s.Capabilities, c)
	}
	for i := range list {
		list[i].ComputeCompleteness()
	}
	return nil
}

const capabilitySelect = `
SELECT c.id, c.solution_id, w.id, w.code, w.name, w.unit_label, c.throughput_per_hour, c.throughput_range_text,
       c.throughput_exact, c.handling_method_code, c.environment, c.lift_height_mm, c.source_text, c.source_id, c.is_active
FROM robot_capability c JOIN work_type w ON w.id = c.work_type_id`

func (q Q) capabilities(ctx context.Context, where string, args ...any) ([]domain.Capability, error) {
	rows, err := q.db.Query(ctx, capabilitySelect+` WHERE `+where+` ORDER BY w.code`, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Capability, error) {
		var c domain.Capability
		err := r.Scan(&c.ID, &c.SolutionID, &c.WorkType.ID, &c.WorkType.Code, &c.WorkType.Name, &c.WorkType.UnitLabel,
			&c.ThroughputPerHour, &c.ThroughputRangeText, &c.ThroughputExact, &c.HandlingMethodCode, &c.Environment,
			&c.LiftHeightMm, &c.SourceText, &c.SourceID, &c.IsActive)
		return c, err
	})
}

// Capabilities returns all capability rows of a solution.
func (q Q) Capabilities(ctx context.Context, solutionID uuid.UUID) ([]domain.Capability, error) {
	return q.capabilities(ctx, `c.solution_id = $1`, solutionID)
}

// SaveCapability inserts or updates a capability row keyed by (solution, work type).
func (q Q) SaveCapability(ctx context.Context, c domain.Capability) error {
	_, err := q.db.Exec(ctx, `
INSERT INTO robot_capability (id, solution_id, work_type_id, throughput_per_hour, throughput_range_text, throughput_exact,
                              handling_method_code, environment, lift_height_mm, source_text, source_id, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (solution_id, work_type_id) DO UPDATE SET
  throughput_per_hour = EXCLUDED.throughput_per_hour, throughput_range_text = EXCLUDED.throughput_range_text,
  throughput_exact = EXCLUDED.throughput_exact, handling_method_code = EXCLUDED.handling_method_code,
  environment = EXCLUDED.environment, lift_height_mm = EXCLUDED.lift_height_mm, source_text = EXCLUDED.source_text,
  source_id = EXCLUDED.source_id, is_active = EXCLUDED.is_active, updated_at = now()`,
		c.ID, c.SolutionID, c.WorkType.ID, c.ThroughputPerHour, c.ThroughputRangeText, c.ThroughputExact,
		c.HandlingMethodCode, c.Environment, c.LiftHeightMm, c.SourceText, c.SourceID, c.IsActive)
	return err
}

// SetCapabilityActive activates or hides a capability row.
func (q Q) SetCapabilityActive(ctx context.Context, solutionID, capID uuid.UUID, active bool) error {
	tag, err := q.db.Exec(ctx, `UPDATE robot_capability SET is_active = $3, updated_at = now() WHERE id = $2 AND solution_id = $1`,
		solutionID, capID, active)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.NotFound("capability", capID.String())
	}
	return err
}

// SaveSolution inserts or updates the solution row.
func (q Q) SaveSolution(ctx context.Context, s domain.Solution) error {
	_, err := q.db.Exec(ctx, `
INSERT INTO solution (id, code, kind, name, manufacturer, organizer_ids, product_class, type_group, solution_type, status,
                      trl, market_potential, region, country, description, cases_text, organizer_scenarios,
                      acquisition_models, tested_by_fcbas, in_registry_719, photo_url, cost_type, quantity_rule,
                      compatible_with, software_cost_pct, service_cost_pct, service_life_years, source_id, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code, kind = EXCLUDED.kind, name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
  organizer_ids = EXCLUDED.organizer_ids, product_class = EXCLUDED.product_class, type_group = EXCLUDED.type_group,
  solution_type = EXCLUDED.solution_type, status = EXCLUDED.status, trl = EXCLUDED.trl,
  market_potential = EXCLUDED.market_potential, region = EXCLUDED.region, country = EXCLUDED.country,
  description = EXCLUDED.description, cases_text = EXCLUDED.cases_text, organizer_scenarios = EXCLUDED.organizer_scenarios,
  acquisition_models = EXCLUDED.acquisition_models, tested_by_fcbas = EXCLUDED.tested_by_fcbas,
  in_registry_719 = EXCLUDED.in_registry_719, photo_url = EXCLUDED.photo_url, cost_type = EXCLUDED.cost_type,
  quantity_rule = EXCLUDED.quantity_rule, compatible_with = EXCLUDED.compatible_with,
  software_cost_pct = EXCLUDED.software_cost_pct, service_cost_pct = EXCLUDED.service_cost_pct,
  service_life_years = EXCLUDED.service_life_years, source_id = EXCLUDED.source_id, is_active = EXCLUDED.is_active,
  updated_at = now()`,
		s.ID, s.Code, s.Kind, s.Name, s.Manufacturer, nonNil(s.OrganizerIDs), s.ProductClass, s.TypeGroup, s.SolutionType,
		s.Status, s.Trl, s.MarketPotential, s.Region, s.Country, s.Description, s.CasesText, nonNil(s.OrganizerScenarios),
		nonNil(s.AcquisitionModels), s.Badges.TestedByFcbas, s.Badges.InRegistry719, s.PhotoURL, s.CostType, s.QuantityRule,
		s.CompatibleWith, s.SoftwareCostPct, s.ServiceCostPct, s.ServiceLifeYears, s.SourceID, s.IsActive)
	return err
}

// SaveRobotSpec inserts or replaces the robot spec; nil removes it.
func (q Q) SaveRobotSpec(ctx context.Context, solutionID uuid.UUID, sp *domain.RobotSpec) error {
	if sp == nil {
		_, err := q.db.Exec(ctx, `DELETE FROM robot_spec WHERE solution_id = $1`, solutionID)
		return err
	}
	confirmed := sp.SpecsConfirmed
	if confirmed == "" {
		confirmed = "no"
	}
	_, err := q.db.Exec(ctx, `
INSERT INTO robot_spec (solution_id, payload_kg, payload_exact, length_mm, width_mm, height_mm, dimensions_exact, mass_kg,
                        max_speed_mps, autonomy_h, charge_time_min, min_temp_c, min_temp_exact, max_temp_c, avg_power_kw,
                        load_time_s, unload_time_s, lift_height_mm, positioning_accuracy_mm, navigation_type,
                        handling_method_code, indoor_allowed, outdoor_allowed, min_passage_mm, floor_requirements,
                        charging_infra, connectivity, integrations, service_terms, specs_confirmed, specs_source_text,
                        specs_source_id, specs_actualized_on)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30, $31, $32, $33)
ON CONFLICT (solution_id) DO UPDATE SET
  payload_kg = EXCLUDED.payload_kg, payload_exact = EXCLUDED.payload_exact, length_mm = EXCLUDED.length_mm,
  width_mm = EXCLUDED.width_mm, height_mm = EXCLUDED.height_mm, dimensions_exact = EXCLUDED.dimensions_exact,
  mass_kg = EXCLUDED.mass_kg, max_speed_mps = EXCLUDED.max_speed_mps, autonomy_h = EXCLUDED.autonomy_h,
  charge_time_min = EXCLUDED.charge_time_min, min_temp_c = EXCLUDED.min_temp_c, min_temp_exact = EXCLUDED.min_temp_exact,
  max_temp_c = EXCLUDED.max_temp_c, avg_power_kw = EXCLUDED.avg_power_kw, load_time_s = EXCLUDED.load_time_s,
  unload_time_s = EXCLUDED.unload_time_s, lift_height_mm = EXCLUDED.lift_height_mm,
  positioning_accuracy_mm = EXCLUDED.positioning_accuracy_mm, navigation_type = EXCLUDED.navigation_type,
  handling_method_code = EXCLUDED.handling_method_code, indoor_allowed = EXCLUDED.indoor_allowed,
  outdoor_allowed = EXCLUDED.outdoor_allowed, min_passage_mm = EXCLUDED.min_passage_mm,
  floor_requirements = EXCLUDED.floor_requirements, charging_infra = EXCLUDED.charging_infra,
  connectivity = EXCLUDED.connectivity, integrations = EXCLUDED.integrations, service_terms = EXCLUDED.service_terms,
  specs_confirmed = EXCLUDED.specs_confirmed, specs_source_text = EXCLUDED.specs_source_text,
  specs_source_id = EXCLUDED.specs_source_id, specs_actualized_on = EXCLUDED.specs_actualized_on, updated_at = now()`,
		solutionID, sp.PayloadKg, sp.PayloadExact, sp.LengthMm, sp.WidthMm, sp.HeightMm, sp.DimensionsExact, sp.MassKg,
		sp.MaxSpeedMps, sp.AutonomyH, sp.ChargeTimeMin, sp.MinTempC, sp.MinTempExact, sp.MaxTempC, sp.AvgPowerKw,
		sp.LoadTimeS, sp.UnloadTimeS, sp.LiftHeightMm, sp.PositioningAccuracyMm, sp.NavigationType,
		sp.HandlingMethodCode, sp.IndoorAllowed, sp.OutdoorAllowed, sp.MinPassageMm, sp.FloorRequirements,
		sp.ChargingInfra, nonNil(sp.Connectivity), nonNil(sp.Integrations), sp.ServiceTerms, confirmed, sp.SpecsSourceText,
		sp.SpecsSourceID, sp.SpecsActualizedOn.TimePtr())
	return err
}

// ReplaceIndustries sets the industries of a solution by Russian names or codes.
func (q Q) ReplaceIndustries(ctx context.Context, solutionID uuid.UUID, industries []string) error {
	if _, err := q.db.Exec(ctx, `DELETE FROM solution_industry WHERE solution_id = $1`, solutionID); err != nil {
		return err
	}
	for _, ind := range industries {
		tag, err := q.db.Exec(ctx, `INSERT INTO solution_industry (solution_id, industry_code)
			SELECT $1, code FROM industry WHERE code = $2 OR name_ru = $2 ON CONFLICT DO NOTHING`, solutionID, ind)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return domain.NotFound("industry", ind)
		}
	}
	return nil
}

// Offers returns all offers of a solution, default first.
func (q Q) Offers(ctx context.Context, solutionID uuid.UUID) ([]domain.Offer, error) {
	rows, err := q.db.Query(ctx, `SELECT id, label, price_rub, price_percent, price_unit, price_includes_vat, is_default,
		organizer_row_ref, source_id FROM solution_offer WHERE solution_id = $1 ORDER BY is_default DESC, created_at`, solutionID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (domain.Offer, error) {
		var o domain.Offer
		err := r.Scan(&o.ID, &o.Label, &o.Price.AmountRub, &o.Price.Percent, &o.Price.Unit, &o.Price.IncludesVat,
			&o.IsDefault, &o.OrganizerRowRef, &o.SourceID)
		return o, err
	})
}

// DefaultOfferID returns the default offer of a solution.
func (q Q) DefaultOfferID(ctx context.Context, solutionID uuid.UUID) (*uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `SELECT id FROM solution_offer WHERE solution_id = $1 AND is_default`, solutionID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &id, err
}

// SaveOffer inserts an offer; a default offer replaces the previous default.
func (q Q) SaveOffer(ctx context.Context, solutionID uuid.UUID, o domain.Offer) error {
	if o.IsDefault {
		if _, err := q.db.Exec(ctx, `UPDATE solution_offer SET is_default = false WHERE solution_id = $1 AND id <> $2`, solutionID, o.ID); err != nil {
			return err
		}
	}
	_, err := q.db.Exec(ctx, `
INSERT INTO solution_offer (id, solution_id, label, price_rub, price_percent, price_includes_vat, price_unit, is_default,
                            organizer_row_ref, source_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, price_rub = EXCLUDED.price_rub, price_percent = EXCLUDED.price_percent,
  price_includes_vat = EXCLUDED.price_includes_vat, price_unit = EXCLUDED.price_unit, is_default = EXCLUDED.is_default,
  organizer_row_ref = EXCLUDED.organizer_row_ref, source_id = EXCLUDED.source_id`,
		o.ID, solutionID, o.Label, o.Price.AmountRub, o.Price.Percent, o.Price.IncludesVat, o.Price.Unit, o.IsDefault,
		o.OrganizerRowRef, o.SourceID)
	return err
}

// SetDefaultPrice updates the default offer price or creates the default offer; nil removes it.
func (q Q) SetDefaultPrice(ctx context.Context, solutionID uuid.UUID, p *domain.Price) error {
	if p == nil {
		_, err := q.db.Exec(ctx, `DELETE FROM solution_offer WHERE solution_id = $1 AND is_default`, solutionID)
		return err
	}
	id, err := q.DefaultOfferID(ctx, solutionID)
	if err != nil {
		return err
	}
	o := domain.Offer{ID: NewID(), Label: "Базовое предложение", Price: *p, IsDefault: true}
	if id != nil {
		o.ID = *id
	}
	return q.SaveOffer(ctx, solutionID, o)
}

// NextSolutionCode returns a new code with the given prefix, e.g. RB-0224.
func (q Q) NextSolutionCode(ctx context.Context, prefix string) (string, error) {
	for {
		var n int64
		if err := q.db.QueryRow(ctx, `SELECT nextval('solution_code_seq')`).Scan(&n); err != nil {
			return "", err
		}
		code := fmt.Sprintf("%s-%04d", prefix, n)
		if _, found, err := q.SolutionIDByCode(ctx, code); err != nil {
			return "", err
		} else if !found {
			return code, nil
		}
	}
}

// SolutionProjectsCount counts live projects that reference a solution.
func (q Q) SolutionProjectsCount(ctx context.Context, id uuid.UUID) (int, error) {
	var n int
	err := q.db.QueryRow(ctx, `
SELECT count(DISTINCT p.id) FROM project p
WHERE p.deleted_at IS NULL AND (
  p.pinned_solution_id = $1 OR p.selected_solution_id = $1
  OR EXISTS (SELECT 1 FROM project_manual_candidate m WHERE m.project_id = p.id AND m.solution_id = $1)
  OR EXISTS (SELECT 1 FROM match_run r JOIN match_candidate c ON c.run_id = r.id
             WHERE r.project_id = p.id AND c.solution_id = $1))`, id).Scan(&n)
	return n, err
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
