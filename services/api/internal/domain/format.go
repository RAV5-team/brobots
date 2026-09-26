package domain

import (
	"math"
	"strconv"
	"strings"
	"time"
)

// FormatNumber renders a number the Russian way: «2 000», «0,6».
func FormatNumber(v float64) string {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return "—"
	}
	s := strconv.FormatFloat(v, 'f', -1, 64)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	intPart, frac, _ := strings.Cut(s, ".")
	if len(intPart) > 3 {
		var b strings.Builder
		for i, r := range intPart {
			if i > 0 && (len(intPart)-i)%3 == 0 {
				b.WriteRune(' ')
			}
			b.WriteRune(r)
		}
		intPart = b.String()
	}
	out := intPart
	if frac != "" {
		out += "," + frac
	}
	if neg {
		out = "-" + out
	}
	return out
}

// Date is a calendar date serialized as YYYY-MM-DD.
type Date struct {
	time.Time
}

// NewDate converts an optional time into an optional Date.
func NewDate(t *time.Time) *Date {
	if t == nil {
		return nil
	}
	return &Date{Time: *t}
}

// MarshalJSON implements json.Marshaler.
func (d Date) MarshalJSON() ([]byte, error) {
	return []byte(`"` + d.Format(time.DateOnly) + `"`), nil
}

// UnmarshalJSON implements json.Unmarshaler.
func (d *Date) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		return err
	}
	d.Time = t
	return nil
}

// TimePtr returns the underlying time of an optional Date.
func (d *Date) TimePtr() *time.Time {
	if d == nil {
		return nil
	}
	t := d.Time
	return &t
}

// Ptr returns a pointer to v.
func Ptr[T any](v T) *T { return &v }

// Deref returns the pointed value or the zero value.
func Deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}
