package httpclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/google/uuid"
)

func server(t *testing.T, h http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return New(srv.URL+"/", time.Second)
}

func TestCalculateRoundTrip(t *testing.T) {
	id := uuid.New()
	c := server(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != calc.PathCalculations {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		var req calc.Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode: %v", err)
		}
		resp := calc.Response{ModelVersion: "econ/1.0.0"}
		for _, cand := range req.Candidates {
			resp.Results = append(resp.Results, calc.Result{SolutionID: cand.SolutionID, AcquisitionModel: calc.Purchase, Calculable: true})
		}
		_ = json.NewEncoder(w).Encode(resp)
	})
	req := calc.Request{Candidates: []calc.Candidate{{}}}
	req.Candidates[0].SolutionID = id
	resp, err := c.Calculate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.ModelVersion != "econ/1.0.0" || len(resp.Results) != 1 || resp.Results[0].SolutionID != id {
		t.Errorf("response = %+v", resp)
	}
}

func TestModelVersion(t *testing.T) {
	c := server(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != calc.PathModelVersion {
			t.Errorf("path = %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"modelVersion":"econ/1.0.0"}`))
	})
	v, err := c.ModelVersion(context.Background())
	if err != nil || v != "econ/1.0.0" {
		t.Errorf("version = %q, %v", v, err)
	}
}

func TestFailuresAreUnavailable(t *testing.T) {
	for name, h := range map[string]http.HandlerFunc{
		"server error": func(w http.ResponseWriter, _ *http.Request) { http.Error(w, "boom", http.StatusInternalServerError) },
		"bad request":  func(w http.ResponseWriter, _ *http.Request) { http.Error(w, "bad", http.StatusUnprocessableEntity) },
		"invalid json": func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("not json")) },
		"no version":   func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{"results":[]}`)) },
		"timeout": func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-time.After(2 * time.Second):
			case <-r.Context().Done():
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := server(t, h).Calculate(context.Background(), calc.Request{})
			if !errors.Is(err, calc.ErrUnavailable) {
				t.Errorf("err = %v, want calc.ErrUnavailable", err)
			}
		})
	}
}

func TestNoServer(t *testing.T) {
	_, err := New("http://127.0.0.1:1", time.Second).ModelVersion(context.Background())
	if !errors.Is(err, calc.ErrUnavailable) {
		t.Errorf("err = %v, want calc.ErrUnavailable", err)
	}
}
