// Package formula evaluates process formulas over location parameters,
// for example "wh_inbound_pallets + wh_outbound_pallets" or "sqrt(active_area)".
package formula

import (
	"fmt"
	"math"
	"regexp"

	"github.com/expr-lang/expr"
)

var functions = map[string]any{
	"sqrt": math.Sqrt,
	"min":  math.Min,
	"max":  math.Max,
	"ceil": math.Ceil,
	"round": func(v float64) float64 {
		return math.Round(v)
	},
}

var identRe = regexp.MustCompile(`[A-Za-z_][A-Za-z0-9_]*`)

// Validate checks the expression syntax without variable values.
func Validate(expression string) error {
	env := make(map[string]any, len(functions))
	for k, v := range functions {
		env[k] = v
	}
	for _, id := range Variables(expression) {
		env[id] = 1.0
	}
	if _, err := expr.Compile(expression, expr.Env(env), expr.AsFloat64()); err != nil {
		return fmt.Errorf("формула «%s» не разбирается: %w", expression, err)
	}
	return nil
}

// Variables returns the identifiers used by the expression, except functions.
func Variables(expression string) []string {
	seen := map[string]bool{}
	var out []string
	for _, id := range identRe.FindAllString(expression, -1) {
		if _, fn := functions[id]; fn || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

// MissingError reports variables that have no value on the location.
type MissingError struct {
	Missing []string
}

func (e *MissingError) Error() string {
	return fmt.Sprintf("нет значений: %v", e.Missing)
}

// Eval computes the expression with numeric variables.
func Eval(expression string, vars map[string]float64) (float64, error) {
	env := make(map[string]any, len(vars)+len(functions))
	for k, v := range functions {
		env[k] = v
	}
	var missing []string
	for _, id := range Variables(expression) {
		v, ok := vars[id]
		if !ok {
			missing = append(missing, id)
			continue
		}
		env[id] = v
	}
	if len(missing) > 0 {
		return 0, &MissingError{Missing: missing}
	}
	program, err := expr.Compile(expression, expr.Env(env), expr.AsFloat64())
	if err != nil {
		return 0, fmt.Errorf("формула «%s»: %w", expression, err)
	}
	out, err := expr.Run(program, env)
	if err != nil {
		return 0, fmt.Errorf("формула «%s»: %w", expression, err)
	}
	f, ok := out.(float64)
	if !ok || math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, fmt.Errorf("формула «%s» дала нечисловой результат", expression)
	}
	return f, nil
}

// IsReference reports whether the expression is a single variable, i.e. a value taken from the location as is.
func IsReference(expression string) bool {
	return identRe.FindString(expression) == expression && len(Variables(expression)) == 1
}
