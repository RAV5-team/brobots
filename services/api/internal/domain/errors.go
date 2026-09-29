// Package domain holds the entities of the location, catalog and matching blocks
// together with their validation rules and pure calculations.
package domain

import (
	"fmt"
	"strings"
)

// NotFoundError reports a missing entity.
type NotFoundError struct {
	Entity string
	ID     string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("%s %s not found", e.Entity, e.ID)
}

// NotFound builds a NotFoundError.
func NotFound(entity, id string) error {
	return &NotFoundError{Entity: entity, ID: id}
}

// ConflictError reports a state conflict such as a duplicate key.
type ConflictError struct {
	Code    string
	Message string
}

func (e *ConflictError) Error() string { return e.Message }

// Conflict builds a ConflictError with a user-facing Russian message.
func Conflict(code, message string) error {
	return &ConflictError{Code: code, Message: message}
}

// ForbiddenError reports a visible entity the caller may not change, such as demo data.
type ForbiddenError struct {
	Code    string
	Message string
}

func (e *ForbiddenError) Error() string { return e.Message }

// Forbidden builds a ForbiddenError with a user-facing Russian message.
func Forbidden(code, message string) error {
	return &ForbiddenError{Code: code, Message: message}
}

// TooManyError reports a shared resource the caller has to wait for, such as the guest simulation slots.
type TooManyError struct {
	Code    string
	Message string
}

func (e *TooManyError) Error() string { return e.Message }

// TooMany builds a TooManyError with a user-facing Russian message.
func TooMany(code, message string) error {
	return &TooManyError{Code: code, Message: message}
}

// UnavailableError reports a dependency that did not answer, such as the economics service.
type UnavailableError struct {
	Code    string
	Message string
	Err     error
}

func (e *UnavailableError) Error() string { return e.Message + ": " + e.Err.Error() }

func (e *UnavailableError) Unwrap() error { return e.Err }

// Unavailable builds an UnavailableError with a user-facing Russian message.
func Unavailable(code, message string, err error) error {
	return &UnavailableError{Code: code, Message: message, Err: err}
}

// FieldError describes one invalid input field in user-facing Russian.
type FieldError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Hint    string `json:"hint,omitempty"`
}

// ValidationError aggregates field errors of a request.
type ValidationError struct {
	Errors []FieldError
}

func (e *ValidationError) Error() string {
	parts := make([]string, 0, len(e.Errors))
	for _, fe := range e.Errors {
		parts = append(parts, fe.Field+": "+fe.Message)
	}
	return "validation failed: " + strings.Join(parts, "; ")
}

// Validator collects field errors.
type Validator struct {
	errs []FieldError
}

// Add records a field error.
func (v *Validator) Add(field, code, message, hint string) {
	v.errs = append(v.errs, FieldError{Field: field, Code: code, Message: message, Hint: hint})
}

// Merge appends already built field errors.
func (v *Validator) Merge(errs []FieldError) {
	v.errs = append(v.errs, errs...)
}

// Required checks that a string value is not blank.
func (v *Validator) Required(field, label, value string) {
	if strings.TrimSpace(value) == "" {
		v.Add(field, "required", fmt.Sprintf("Поле «%s» не заполнено", label), "Заполните поле")
	}
}

// OneOf checks that a value belongs to the allowed set.
func (v *Validator) OneOf(field, label, value string, allowed []string) {
	for _, a := range allowed {
		if a == value {
			return
		}
	}
	v.Add(field, "invalid_value",
		fmt.Sprintf("Поле «%s»: значение «%s» не из списка", label, value),
		"Допустимые значения: "+strings.Join(allowed, ", "))
}

// Range checks an optional number against optional bounds.
func (v *Validator) Range(field, label string, value *float64, min, max *float64, unit string) {
	if value == nil {
		return
	}
	if (min != nil && *value < *min) || (max != nil && *value > *max) {
		v.Add(field, "out_of_range",
			fmt.Sprintf("Поле «%s»: %s%s вне допустимого диапазона", label, FormatNumber(*value), unitSuffix(unit)),
			"Допустимо "+RangeText(min, max, unit))
	}
}

// Err returns a ValidationError when errors were collected.
func (v *Validator) Err() error {
	if len(v.errs) == 0 {
		return nil
	}
	return &ValidationError{Errors: v.errs}
}

// RangeText renders bounds like «10 000–100 000 м²».
func RangeText(min, max *float64, unit string) string {
	switch {
	case min != nil && max != nil:
		return FormatNumber(*min) + "–" + FormatNumber(*max) + unitSuffix(unit)
	case min != nil:
		return "от " + FormatNumber(*min) + unitSuffix(unit)
	case max != nil:
		return "до " + FormatNumber(*max) + unitSuffix(unit)
	}
	return "любое значение"
}

func unitSuffix(unit string) string {
	if unit == "" {
		return ""
	}
	return " " + unit
}
