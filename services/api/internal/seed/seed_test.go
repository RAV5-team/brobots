package seed

import (
	"strings"
	"testing"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/formula"
)

func TestCatalogCSV(t *testing.T) {
	rows, err := readCatalogCSV()
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 223 {
		t.Errorf("rows = %d, want 223", len(rows))
	}
	ids := map[string]bool{}
	for _, r := range rows {
		ids[r.ID] = true
	}
	if len(ids) != 187 {
		t.Errorf("unique products = %d, want 187", len(ids))
	}
}

func TestParsing(t *testing.T) {
	if p := parsePrice("2 700 000,00"); p == nil || *p != 2_700_000 {
		t.Errorf("price = %v", p)
	}
	if got := guillemets(`ООО "Ронави Роботикс"`); got != "ООО «Ронави Роботикс»" {
		t.Errorf("guillemets = %q", got)
	}
	m := payloadRe.FindStringSubmatch("Ronavi H1500 (грузоподъемность до 1 500 кг)")
	if m == nil || strings.ReplaceAll(m[1], " ", "") != "1500" {
		t.Errorf("payload = %v", m)
	}
}

func TestSeedFilesReferenceKnownCodes(t *testing.T) {
	var ref reference
	if err := readYAML("reference.yaml", &ref); err != nil {
		t.Fatal(err)
	}
	workTypes := map[string]bool{}
	for _, w := range ref.WorkTypes {
		workTypes[w.Code] = true
	}
	handling := map[string]bool{}
	for _, h := range ref.HandlingMethods {
		handling[h.Code] = true
	}
	var rf robotsFile
	if err := readYAML("robots.yaml", &rf); err != nil {
		t.Fatal(err)
	}
	for _, r := range rf.Robots {
		for _, c := range r.Capabilities {
			if !workTypes[c.WorkType] {
				t.Errorf("robot %s: unknown work type %s", r.Code, c.WorkType)
			}
			if c.HandlingMethodCode != nil && !handling[*c.HandlingMethodCode] {
				t.Errorf("robot %s: unknown handling %s", r.Code, *c.HandlingMethodCode)
			}
		}
		if h, ok := r.Spec["handlingMethodCode"].(string); ok && !handling[h] {
			t.Errorf("robot %s: unknown spec handling %s", r.Code, h)
		}
	}
	var pf struct {
		Processes []struct {
			Code     string `yaml:"code"`
			WorkType string `yaml:"workType"`
			Formulas []struct {
				FieldCode  string `yaml:"fieldCode"`
				Expression string `yaml:"expression"`
			} `yaml:"formulas"`
		} `yaml:"processes"`
	}
	if err := readYAML("processes.yaml", &pf); err != nil {
		t.Fatal(err)
	}
	if len(pf.Processes) != 12 {
		t.Errorf("processes = %d, want 12", len(pf.Processes))
	}
	for _, p := range pf.Processes {
		if !workTypes[p.WorkType] {
			t.Errorf("process %s: unknown work type %s", p.Code, p.WorkType)
		}
		for _, f := range p.Formulas {
			if _, ok := domain.TaskParamField(f.FieldCode); !ok {
				t.Errorf("process %s: unknown field %s", p.Code, f.FieldCode)
			}
			if err := formula.Validate(f.Expression); err != nil {
				t.Errorf("process %s: %v", p.Code, err)
			}
		}
	}
}
