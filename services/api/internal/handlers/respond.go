package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const maxBody = 2 << 20

// Problem is an RFC 7807 error body.
type Problem struct {
	Type   string              `json:"type"`
	Title  string              `json:"title"`
	Status int                 `json:"status"`
	Detail string              `json:"detail,omitempty"`
	Code   string              `json:"code,omitempty"`
	Errors []domain.FieldError `json:"errors,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeProblem(w http.ResponseWriter, p Problem) {
	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.WriteHeader(p.Status)
	_ = json.NewEncoder(w).Encode(p)
}

func (a *API) fail(w http.ResponseWriter, r *http.Request, err error) {
	var ve *domain.ValidationError
	var nf *domain.NotFoundError
	var ce *domain.ConflictError
	var fe *domain.ForbiddenError
	var ue *domain.UnavailableError
	var tm *domain.TooManyError
	switch {
	case errors.As(err, &ve):
		writeProblem(w, Problem{Type: "https://rav5.local/problems/validation", Title: "Ошибка в данных", Status: http.StatusUnprocessableEntity,
			Detail: "Проверьте отмеченные поля", Code: "validation", Errors: ve.Errors})
	case errors.As(err, &nf):
		writeProblem(w, Problem{Type: "https://rav5.local/problems/not-found", Title: "Не найдено", Status: http.StatusNotFound,
			Detail: notFoundText(nf), Code: "not_found"})
	case errors.As(err, &fe):
		writeProblem(w, Problem{Type: "https://rav5.local/problems/forbidden", Title: "Нет прав на изменение", Status: http.StatusForbidden,
			Detail: fe.Message, Code: fe.Code})
	case errors.As(err, &ce):
		writeProblem(w, Problem{Type: "https://rav5.local/problems/conflict", Title: "Конфликт", Status: http.StatusConflict,
			Detail: ce.Message, Code: ce.Code})
	case errors.As(err, &tm):
		writeProblem(w, Problem{Type: "https://rav5.local/problems/too-many-requests", Title: "Слишком много запросов",
			Status: http.StatusTooManyRequests, Detail: tm.Message, Code: tm.Code})
	case errors.As(err, &ue):
		a.log.WarnContext(r.Context(), "dependency unavailable", slog.String("path", r.URL.Path), slog.Any("error", err))
		writeProblem(w, Problem{Type: "https://rav5.local/problems/unavailable", Title: "Сервис недоступен", Status: http.StatusServiceUnavailable,
			Detail: ue.Message, Code: ue.Code})
	default:
		a.log.ErrorContext(r.Context(), "request failed", slog.String("path", r.URL.Path), slog.Any("error", err))
		writeProblem(w, Problem{Type: "about:blank", Title: "Внутренняя ошибка", Status: http.StatusInternalServerError,
			Detail: "Не удалось выполнить запрос, попробуйте ещё раз", Code: "internal"})
	}
}

var entityNames = map[string]string{
	"work_type": "класс операции", "data_source": "источник данных", "solution": "решение каталога",
	"capability": "класс операции робота", "process": "процесс", "location": "локация", "task": "задача",
	"project": "проект", "matching_run": "прогон подбора", "manual_candidate": "ручной кандидат", "evaluation": "расчёт подбора",
	"facility_type": "тип объекта", "industry": "отрасль", "norm_set": "версия нормативов",
}

func notFoundText(nf *domain.NotFoundError) string {
	name := entityNames[nf.Entity]
	if name == "" {
		name = nf.Entity
	}
	return "Не найдено: " + name + " " + nf.ID
}

func badRequest(w http.ResponseWriter, field, message string) {
	writeProblem(w, Problem{Type: "https://rav5.local/problems/bad-request", Title: "Неверный запрос", Status: http.StatusBadRequest,
		Code: "bad_request", Errors: []domain.FieldError{{Field: field, Code: "invalid", Message: message}}})
}

func readBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		badRequest(w, "body", "Тело запроса слишком большое или не читается")
		return nil, false
	}
	body = bytes.TrimPrefix(body, []byte("\xef\xbb\xbf"))
	if len(bytes.TrimSpace(body)) == 0 {
		body = []byte("{}")
	}
	return body, true
}

func decodeInto(a *API, w http.ResponseWriter, r *http.Request, dst any) bool {
	body, ok := readBody(w, r)
	if !ok {
		return false
	}
	if err := service.MergePatch(dst, body); err != nil {
		a.fail(w, r, err)
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		badRequest(w, name, "Идентификатор должен быть UUID")
		return id, false
	}
	return id, true
}

func queryList(r *http.Request, name string) []string {
	var out []string
	for _, v := range r.URL.Query()[name] {
		for _, part := range strings.Split(v, ",") {
			if p := strings.TrimSpace(part); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

func queryUUIDs(w http.ResponseWriter, r *http.Request, name string) ([]uuid.UUID, bool) {
	var out []uuid.UUID
	for _, s := range queryList(r, name) {
		id, err := uuid.Parse(s)
		if err != nil {
			badRequest(w, name, "Идентификатор должен быть UUID: "+s)
			return nil, false
		}
		out = append(out, id)
	}
	return out, true
}

func queryUUID(w http.ResponseWriter, r *http.Request, name string) (*uuid.UUID, bool) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil, true
	}
	id, err := uuid.Parse(s)
	if err != nil {
		badRequest(w, name, "Идентификатор должен быть UUID")
		return nil, false
	}
	return &id, true
}

func queryBool(w http.ResponseWriter, r *http.Request, name string) (*bool, bool) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil, true
	}
	b, err := strconv.ParseBool(s)
	if err != nil {
		badRequest(w, name, "Ожидается true или false")
		return nil, false
	}
	return &b, true
}

func queryInt(w http.ResponseWriter, r *http.Request, name string) (*int, bool) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil, true
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		badRequest(w, name, "Ожидается целое число")
		return nil, false
	}
	return &n, true
}

func pageParams(w http.ResponseWriter, r *http.Request) (limit, offset int, ok bool) {
	l, ok1 := queryInt(w, r, "limit")
	if !ok1 {
		return 0, 0, false
	}
	o, ok2 := queryInt(w, r, "offset")
	if !ok2 {
		return 0, 0, false
	}
	return domain.Deref(l), domain.Deref(o), true
}
