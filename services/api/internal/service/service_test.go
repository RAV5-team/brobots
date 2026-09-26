package service

import (
	"errors"
	"testing"

	"github.com/brobots/api/internal/domain"
)

func TestMergePatch(t *testing.T) {
	in := SolutionInput{Name: "AMR 800", Manufacturer: "Морос", Kind: "robot",
		Spec: &domain.RobotSpec{PayloadKg: domain.Ptr(800.0), WidthMm: domain.Ptr(640)}}
	body := []byte(`{"name": "AMR 800 v2", "spec": {"payloadKg": 900, "widthMm": null}, "region": "Москва"}`)
	if err := MergePatch(&in, body); err != nil {
		t.Fatal(err)
	}
	if in.Name != "AMR 800 v2" || in.Manufacturer != "Морос" {
		t.Errorf("top-level merge: %+v", in)
	}
	if *in.Spec.PayloadKg != 900 || in.Spec.WidthMm != nil {
		t.Errorf("nested merge: payload=%v width=%v", in.Spec.PayloadKg, in.Spec.WidthMm)
	}
	if in.Region == nil || *in.Region != "Москва" {
		t.Errorf("region = %v", in.Region)
	}
}

func TestMergePatchErrors(t *testing.T) {
	tests := map[string]string{
		`{"unknown": 1}`:    "unknown_field",
		`{"name": 5}`:       "invalid_type",
		`{"name": "x"`:      "invalid_json",
		`{"trl": "девять"}`: "invalid_type",
	}
	for body, code := range tests {
		var in SolutionInput
		err := MergePatch(&in, []byte(body))
		var ve *domain.ValidationError
		if !errors.As(err, &ve) || ve.Errors[0].Code != code {
			t.Errorf("%s: err = %v, want %s", body, err, code)
		}
	}
}

func TestValidateSolution(t *testing.T) {
	in := SolutionInput{Kind: "robot", Name: "Робот", Manufacturer: "ООО",
		Price: &domain.Price{AmountRub: domain.Ptr(-1.0)}, Trl: domain.Ptr(12),
		Spec: &domain.RobotSpec{MinTempC: domain.Ptr(30.0), MaxTempC: domain.Ptr(10.0)}}
	var v domain.Validator
	validateSolution(&in, &v)
	err := v.Err()
	var ve *domain.ValidationError
	if !errors.As(err, &ve) {
		t.Fatal("expected validation errors")
	}
	fields := map[string]bool{}
	for _, fe := range ve.Errors {
		fields[fe.Field] = true
	}
	for _, f := range []string{"price.amountRub", "trl", "spec.minTempC"} {
		if !fields[f] {
			t.Errorf("no error for %s in %+v", f, ve.Errors)
		}
	}
	if in.Price.Unit != "item" || in.Spec.SpecsConfirmed != "no" {
		t.Errorf("defaults not applied: %+v %+v", in.Price, in.Spec)
	}
}

func TestPaginate(t *testing.T) {
	p := paginate([]int{1, 2, 3, 4, 5}, 2, 3)
	if p.Total != 5 || len(p.Items) != 2 || p.Items[0] != 4 {
		t.Errorf("page = %+v", p)
	}
	if p := paginate([]int{1}, 10, 5); len(p.Items) != 0 || p.Items == nil {
		t.Errorf("offset beyond end = %+v", p)
	}
}
