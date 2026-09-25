package formula

import (
	"errors"
	"testing"
)

func TestEval(t *testing.T) {
	vars := map[string]float64{
		"wh_inbound_pallets": 1000, "wh_outbound_pallets": 1000, "shifts_per_day": 2, "shift_hours": 11,
		"wh_oversize_share": 5, "active_area": 10000,
	}
	tests := []struct {
		expr string
		want float64
	}{
		{"wh_inbound_pallets + wh_outbound_pallets", 2000},
		{"shifts_per_day * shift_hours", 22},
		{"1 - wh_oversize_share / 100", 0.95},
		{"sqrt(active_area)", 100},
		{"max(shifts_per_day, 3)", 3},
	}
	for _, tt := range tests {
		got, err := Eval(tt.expr, vars)
		if err != nil {
			t.Errorf("Eval(%q): %v", tt.expr, err)
			continue
		}
		if got != tt.want {
			t.Errorf("Eval(%q) = %v, want %v", tt.expr, got, tt.want)
		}
	}
}

func TestEvalMissing(t *testing.T) {
	_, err := Eval("wh_inbound_pallets + wh_outbound_pallets", map[string]float64{"wh_inbound_pallets": 1})
	var miss *MissingError
	if !errors.As(err, &miss) || len(miss.Missing) != 1 || miss.Missing[0] != "wh_outbound_pallets" {
		t.Fatalf("err = %v, want missing wh_outbound_pallets", err)
	}
}

func TestValidate(t *testing.T) {
	if err := Validate("sqrt(active_area) * 2"); err != nil {
		t.Errorf("valid formula: %v", err)
	}
	if err := Validate("active_area *"); err == nil {
		t.Error("broken formula accepted")
	}
}

func TestIsReference(t *testing.T) {
	if !IsReference("wh_pallet_mass") {
		t.Error("single identifier is a reference")
	}
	if IsReference("wh_pallet_mass * 2") {
		t.Error("expression is not a reference")
	}
}
