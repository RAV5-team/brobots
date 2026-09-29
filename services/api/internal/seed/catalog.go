package seed

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

func loadParameters(ctx context.Context, q store.Q) error {
	f, err := data.Open("data/parameters.csv")
	if err != nil {
		return err
	}
	defer f.Close() //nolint:errcheck // embedded read-only file
	r := csv.NewReader(f)
	r.Comma = ';'
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		return err
	}
	col := map[string]int{}
	for i, h := range header {
		col[h] = i
	}
	for {
		rec, err := r.Read()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("parameters.csv: %w", err)
		}
		get := func(name string) string {
			i, ok := col[name]
			if !ok || i >= len(rec) {
				return ""
			}
			return strings.TrimSpace(rec[i])
		}
		d := domain.ParameterDefinition{
			Code: get("code"), FacilityTypeCode: get("facility_type"), GroupName: get("group"), Name: get("name"),
			Unit: optional(get("unit")), ValueType: get("value_type"), BaseValueNumber: optionalFloat(get("base_number")),
			BaseValueText: optional(get("base_text")), MinValue: optionalFloat(get("min")), MaxValue: optionalFloat(get("max")),
			EnumValues: splitList(get("enum")), IsRequired: get("is_required") == "true", IsConstant: get("is_constant") == "true",
			Role: optional(get("role")), StaffRole: optional(get("staff_role")), StaffAttr: optional(get("staff_attr")),
			FormSection: get("form_section"), SourceNote: optional(get("hint")),
			RouteOnly: get("route_only") == "true", CheckedByMatching: get("checked_by_matching") == "true",
			PairCode: optional(get("pair_code")),
		}
		d.Sort, _ = strconv.Atoi(get("sort"))
		if err := q.SaveParameterDefinition(ctx, d); err != nil {
			return fmt.Errorf("parameter %s: %w", d.Code, err)
		}
	}
}

func splitList(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, "|")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func optionalFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", "."), 64)
	if err != nil {
		return nil
	}
	return &v
}

type seedCapability struct {
	WorkType            string   `yaml:"workType"`
	ThroughputPerHour   *float64 `yaml:"throughputPerHour"`
	ThroughputRangeText *string  `yaml:"throughputRangeText"`
	HandlingMethodCode  *string  `yaml:"handlingMethodCode"`
	Environment         *string  `yaml:"environment"`
	LiftHeightMm        *int     `yaml:"liftHeightMm"`
	SourceText          *string  `yaml:"sourceText"`
}

type seedRobot struct {
	OrganizerID   string           `yaml:"organizerId"`
	Code          string           `yaml:"code"`
	Name          string           `yaml:"name"`
	Manufacturer  string           `yaml:"manufacturer"`
	ProductClass  *string          `yaml:"productClass"`
	TypeGroup     *string          `yaml:"typeGroup"`
	SolutionType  *string          `yaml:"solutionType"`
	Country       *string          `yaml:"country"`
	Description   *string          `yaml:"description"`
	TestedByFcbas bool             `yaml:"testedByFcbas"`
	InRegistry719 bool             `yaml:"inRegistry719"`
	Spec          map[string]any   `yaml:"spec"`
	Capabilities  []seedCapability `yaml:"capabilities"`
}

type robotsFile struct {
	Robots []seedRobot `yaml:"robots"`
	Badges struct {
		TestedByFcbas []string `yaml:"testedByFcbas"`
		InRegistry719 []string `yaml:"inRegistry719"`
	} `yaml:"badges"`
	ScenarioHints []struct {
		Contains           string  `yaml:"contains"`
		WorkType           string  `yaml:"workType"`
		HandlingMethodCode *string `yaml:"handlingMethodCode"`
		Environment        *string `yaml:"environment"`
	} `yaml:"scenarioHints"`
}

type startupItem struct {
	Code           string   `yaml:"code"`
	Kind           string   `yaml:"kind"`
	Name           string   `yaml:"name"`
	Manufacturer   string   `yaml:"manufacturer"`
	SolutionType   *string  `yaml:"solutionType"`
	Description    *string  `yaml:"description"`
	Price          *float64 `yaml:"price"`
	Percent        *float64 `yaml:"percent"`
	Unit           string   `yaml:"unit"`
	CostType       *string  `yaml:"costType"`
	QuantityRule   *string  `yaml:"quantityRule"`
	CompatibleWith *string  `yaml:"compatibleWith"`
}

// catalogRow is one line of catalog_export_v4.csv; columns «тип» and «Тип» differ only by case,
// so they are read by position.
type catalogRow struct {
	ID, Name, Class, Status, Company, Description, TypeGroup, Subtype, Scenario, Cases, Trl, Potential, Region, Industry, Price string
}

func readCatalogCSV() ([]catalogRow, error) {
	f, err := data.Open("data/catalog_export_v4.csv")
	if err != nil {
		return nil, err
	}
	defer f.Close() //nolint:errcheck // embedded read-only file
	r := csv.NewReader(f)
	r.Comma = ';'
	r.LazyQuotes = true
	r.FieldsPerRecord = 15
	if _, err := r.Read(); err != nil {
		return nil, err
	}
	var rows []catalogRow
	for {
		rec, err := r.Read()
		if err == io.EOF {
			return rows, nil
		}
		if err != nil {
			return nil, fmt.Errorf("catalog_export_v4.csv: %w", err)
		}
		for i := range rec {
			rec[i] = strings.TrimSpace(rec[i])
		}
		rows = append(rows, catalogRow{rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6], rec[7], rec[8], rec[9], rec[10], rec[11], rec[12], rec[13], rec[14]})
	}
}

var (
	payloadRe = regexp.MustCompile(`грузоподъемность до ([\d\s]+) кг`)
	subtypes  = map[string]string{"Робот уборщик": "Робот-уборщик", "Робот-штабелер": "Робот-штабелёр", "Робот инвентаризатор": "Робот-инвентаризатор"}
)

// guillemets turns ASCII quotes of company names into «».
func guillemets(s string) string {
	var b strings.Builder
	open := true
	for _, r := range s {
		if r == '"' {
			if open {
				b.WriteRune('«')
			} else {
				b.WriteRune('»')
			}
			open = !open
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func parsePrice(s string) *float64 {
	s = strings.NewReplacer(" ", "", "\u00a0", "", ",", ".").Replace(s)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || v <= 0 {
		return nil
	}
	return &v
}

func uniqueAppend(list []string, v string) []string {
	if v == "" {
		return list
	}
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}

// loadCatalog imports the organizer catalog, demo robot specs and startup items; returns inserted count.
func loadCatalog(ctx context.Context, q store.Q, sources map[string]uuid.UUID) (int, error) {
	var rf robotsFile
	if err := readYAML("robots.yaml", &rf); err != nil {
		return 0, err
	}
	var si struct {
		Items []startupItem `yaml:"items"`
	}
	if err := readYAML("startup_items.yaml", &si); err != nil {
		return 0, err
	}
	rows, err := readCatalogCSV()
	if err != nil {
		return 0, err
	}
	workTypes := map[string]domain.WorkTypeRef{}
	wts, err := q.ListWorkTypes(ctx, true)
	if err != nil {
		return 0, err
	}
	for _, w := range wts {
		workTypes[w.Code] = w.Ref()
	}
	demo := map[string]seedRobot{}
	for _, r := range rf.Robots {
		if r.OrganizerID != "" {
			demo[r.OrganizerID] = r
		}
	}
	tested := map[string]bool{}
	for _, n := range rf.Badges.TestedByFcbas {
		tested[n] = true
	}
	registry := map[string]bool{}
	for _, n := range rf.Badges.InRegistry719 {
		registry[n] = true
	}

	var order []string
	groups := map[string][]catalogRow{}
	for _, r := range rows {
		if _, ok := groups[r.ID]; !ok {
			order = append(order, r.ID)
		}
		groups[r.ID] = append(groups[r.ID], r)
	}
	inserted := 0
	for _, id := range order {
		g := groups[id]
		first := g[0]
		sr, isDemo := demo[id]
		code := "FCB-" + strings.ToUpper(id[:8])
		if isDemo {
			code = sr.Code
		}
		// Фото карточки — PNG из каталога организатора, имя файла совпадает с id строки CSV.
		photoURL := "/catalog/" + id + ".png"
		if existingID, found, err := q.SolutionIDByCode(ctx, code); err != nil {
			return inserted, err
		} else if found {
			if err := q.SetSolutionPhotoIfEmpty(ctx, existingID, photoURL); err != nil {
				return inserted, fmt.Errorf("solution %s photo: %w", code, err)
			}
			continue
		}
		sol := domain.Solution{ID: seedID("solution", code), Code: code, Kind: "robot", Name: first.Name,
			Manufacturer: guillemets(first.Company), OrganizerIDs: []string{id}, IsActive: true,
			PhotoURL: &photoURL, SourceID: domain.Ptr(sources["catalog_v4"]), OrganizerScenarios: []string{}, AcquisitionModels: []string{"purchase", "raas"}}
		if first.Class == "software" {
			sol.Kind = "software"
			sol.CostType = domain.Ptr("capex")
			sol.AcquisitionModels = []string{"purchase"}
		}
		sol.ProductClass = optional(first.Class)
		sol.Status = optional(first.Status)
		sol.TypeGroup = optional(first.TypeGroup)
		if st := first.Subtype; st != "" {
			if n, ok := subtypes[st]; ok {
				st = n
			}
			sol.SolutionType = &st
		}
		if t, err := strconv.Atoi(first.Trl); err == nil {
			sol.Trl = &t
		}
		if p := optionalFloat(first.Potential); p != nil {
			sol.MarketPotential = domain.Ptr(int(*p))
		}
		sol.Region, sol.Description = optional(first.Region), optional(first.Description)
		sol.Country = domain.Ptr("Россия")
		var industries []string
		for _, r := range g {
			industries = uniqueAppend(industries, r.Industry)
			for _, sc := range strings.Split(r.Scenario, ",") {
				sc = strings.ReplaceAll(strings.TrimSpace(sc), "биоматериаловм", "биоматериалов")
				sol.OrganizerScenarios = uniqueAppend(sol.OrganizerScenarios, sc)
			}
			if sol.CasesText == nil {
				sol.CasesText = optional(r.Cases)
			}
		}
		sol.Badges = domain.Badges{TestedByFcbas: tested[first.Name], InRegistry719: registry[first.Name]}
		if isDemo {
			sol.Badges.TestedByFcbas = sol.Badges.TestedByFcbas || sr.TestedByFcbas
			sol.Badges.InRegistry719 = sol.Badges.InRegistry719 || sr.InRegistry719
			if sr.SolutionType != nil {
				sol.SolutionType = sr.SolutionType
			}
		}
		if err := q.SaveSolution(ctx, sol); err != nil {
			return inserted, fmt.Errorf("solution %s: %w", code, err)
		}
		if err := q.ReplaceIndustries(ctx, sol.ID, industries); err != nil {
			return inserted, fmt.Errorf("solution %s industries: %w", code, err)
		}
		seenPrice := map[float64]bool{}
		for i, r := range g {
			p := parsePrice(r.Price)
			if p == nil || seenPrice[*p] {
				continue
			}
			label := "Цена каталога ФЦ БАС"
			if len(seenPrice) > 0 {
				label = "Альтернативное предложение · отрасль «" + r.Industry + "»"
			}
			seenPrice[*p] = true
			offer := domain.Offer{ID: seedID("offer", fmt.Sprintf("%s:%d", code, i)), Label: label, IsDefault: len(seenPrice) == 1,
				Price: domain.Price{AmountRub: p, Unit: "item", IncludesVat: true}, OrganizerRowRef: domain.Ptr(fmt.Sprintf("%s#%d", id, i+1)),
				SourceID: domain.Ptr(sources["catalog_v4"])}
			if err := q.SaveOffer(ctx, sol.ID, offer); err != nil {
				return inserted, fmt.Errorf("solution %s offer: %w", code, err)
			}
		}
		if sol.Kind == "robot" {
			spec := &domain.RobotSpec{SpecsConfirmed: "no", SpecsSourceText: domain.Ptr("Каталог ФЦ БАС: ТТХ отдельными полями не даны")}
			if m := payloadRe.FindStringSubmatch(first.Name); m != nil {
				if v := optionalFloat(strings.ReplaceAll(m[1], " ", "")); v != nil {
					spec.PayloadKg, spec.PayloadExact = v, true
					spec.SpecsSourceText = domain.Ptr("Каталог ФЦ БАС: грузоподъёмность из названия позиции")
				}
			}
			var caps []seedCapability
			if isDemo {
				if spec, err = demoSpec(sr, sources); err != nil {
					return inserted, err
				}
				caps = sr.Capabilities
			} else {
				for _, h := range rf.ScenarioHints {
					for _, sc := range sol.OrganizerScenarios {
						if strings.Contains(sc, h.Contains) {
							caps = append(caps, seedCapability{WorkType: h.WorkType, HandlingMethodCode: h.HandlingMethodCode,
								Environment: h.Environment, SourceText: domain.Ptr("Подсказка по сценарию организатора «" + sc + "» — проверить")})
						}
					}
				}
			}
			if err := q.SaveRobotSpec(ctx, sol.ID, spec); err != nil {
				return inserted, fmt.Errorf("solution %s spec: %w", code, err)
			}
			if err := saveCapabilities(ctx, q, sol.ID, code, caps, workTypes); err != nil {
				return inserted, err
			}
		}
		inserted++
	}
	for _, sr := range rf.Robots {
		if sr.OrganizerID != "" {
			continue
		}
		if _, found, err := q.SolutionIDByCode(ctx, sr.Code); err != nil {
			return inserted, err
		} else if found {
			continue
		}
		sol := domain.Solution{ID: seedID("solution", sr.Code), Code: sr.Code, Kind: "robot", Name: sr.Name, Manufacturer: sr.Manufacturer,
			ProductClass: sr.ProductClass, TypeGroup: sr.TypeGroup, SolutionType: sr.SolutionType, Country: sr.Country,
			Description: sr.Description, IsActive: true, OrganizerScenarios: []string{}, AcquisitionModels: []string{"purchase"},
			SourceID: domain.Ptr(sources["examples"]), Status: domain.Ptr("operation")}
		if err := q.SaveSolution(ctx, sol); err != nil {
			return inserted, fmt.Errorf("solution %s: %w", sr.Code, err)
		}
		spec, err := demoSpec(sr, sources)
		if err != nil {
			return inserted, err
		}
		if err := q.SaveRobotSpec(ctx, sol.ID, spec); err != nil {
			return inserted, err
		}
		if err := saveCapabilities(ctx, q, sol.ID, sr.Code, sr.Capabilities, workTypes); err != nil {
			return inserted, err
		}
		inserted++
	}
	for _, it := range si.Items {
		if _, found, err := q.SolutionIDByCode(ctx, it.Code); err != nil {
			return inserted, err
		} else if found {
			continue
		}
		sol := domain.Solution{ID: seedID("solution", it.Code), Code: it.Code, Kind: it.Kind, Name: it.Name, Manufacturer: it.Manufacturer,
			SolutionType: it.SolutionType, Description: it.Description, CostType: it.CostType, QuantityRule: it.QuantityRule,
			CompatibleWith: it.CompatibleWith, IsActive: true, OrganizerScenarios: []string{}, AcquisitionModels: []string{"purchase"},
			SourceID: domain.Ptr(sources["startup_items"])}
		if err := q.SaveSolution(ctx, sol); err != nil {
			return inserted, fmt.Errorf("startup item %s: %w", it.Code, err)
		}
		unit := it.Unit
		if unit == "" {
			unit = "item"
		}
		price := domain.Price{AmountRub: it.Price, Percent: it.Percent, Unit: unit, IncludesVat: true}
		if err := q.SaveOffer(ctx, sol.ID, domain.Offer{ID: seedID("offer", it.Code), Label: "Оценка команды", Price: price,
			IsDefault: true, SourceID: domain.Ptr(sources["startup_items"])}); err != nil {
			return inserted, fmt.Errorf("startup item %s offer: %w", it.Code, err)
		}
		inserted++
	}
	return inserted, nil
}

func demoSpec(sr seedRobot, sources map[string]uuid.UUID) (*domain.RobotSpec, error) {
	b, err := toJSON(sr.Spec)
	if err != nil {
		return nil, err
	}
	var spec domain.RobotSpec
	if err := json.Unmarshal(b, &spec); err != nil {
		return nil, fmt.Errorf("robot %s spec: %w", sr.Code, err)
	}
	src := sources["vendor_sites"]
	if strings.Contains(domain.Deref(spec.SpecsSourceText), "Примеры решений") {
		src = sources["examples"]
	}
	spec.SpecsSourceID = &src
	return &spec, nil
}

func saveCapabilities(ctx context.Context, q store.Q, solutionID uuid.UUID, code string, caps []seedCapability, workTypes map[string]domain.WorkTypeRef) error {
	seen := map[string]bool{}
	for _, c := range caps {
		if seen[c.WorkType] {
			continue
		}
		seen[c.WorkType] = true
		wt, ok := workTypes[c.WorkType]
		if !ok {
			return fmt.Errorf("robot %s: unknown work type %s", code, c.WorkType)
		}
		if err := q.SaveCapability(ctx, domain.Capability{ID: seedID("capability", code+":"+c.WorkType), SolutionID: solutionID,
			WorkType: wt, ThroughputPerHour: c.ThroughputPerHour, ThroughputRangeText: c.ThroughputRangeText,
			HandlingMethodCode: c.HandlingMethodCode, Environment: c.Environment, LiftHeightMm: c.LiftHeightMm,
			SourceText: c.SourceText, IsActive: true}); err != nil {
			return fmt.Errorf("robot %s capability %s: %w", code, c.WorkType, err)
		}
	}
	return nil
}
