// Package economics is the calc.Calculator backed by services/economics: it maps the frozen
// project input to POST /api/v1/evaluations and the evaluation snapshot back to calc results.
// The contract is packages/contracts/openapi/economics.yaml, exported from the FastAPI app.
package economics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/go-chi/chi/v5/middleware"
)

// HTTP paths of the economics service.
const (
	PathEvaluations  = "/api/v1/evaluations"
	PathModelVersion = "/api/v1/model-version"
)

const maxResponse = 32 << 20

// Client calls the economics service.
type Client struct {
	base string
	http *http.Client
}

// New creates a client for the service at baseURL; timeout bounds every call.
func New(baseURL string, timeout time.Duration) *Client {
	return &Client{base: strings.TrimSuffix(baseURL, "/"), http: &http.Client{Timeout: timeout}}
}

// ModelVersion is the calculation model the service runs now.
func (c *Client) ModelVersion(ctx context.Context) (string, error) {
	v, err := c.versions(ctx)
	return v.ModelVersion, err
}

func (c *Client) versions(ctx context.Context) (modelVersionDTO, error) {
	var out modelVersionDTO
	if err := c.do(ctx, http.MethodGet, PathModelVersion, nil, &out); err != nil {
		return out, err
	}
	if out.ModelVersion == "" {
		return out, fmt.Errorf("%w: empty model_version", calc.ErrUnavailable)
	}
	return out, nil
}

// Calculate evaluates the candidates of one project on the model version the service runs now.
func (c *Client) Calculate(ctx context.Context, req calc.Request) (calc.Response, error) {
	v, err := c.versions(ctx)
	if err != nil {
		return calc.Response{}, err
	}
	p, err := buildPlan(req, v.ModelVersion)
	if err != nil {
		return calc.Response{}, err
	}
	resp := calc.Response{ModelVersion: v.ModelVersion, Results: p.preset}
	if p.payload == nil {
		if resp.Results == nil {
			resp.Results = []calc.Result{}
		}
		return resp, nil
	}
	var snap snapshotDTO
	if err := c.do(ctx, http.MethodPost, PathEvaluations, p.payload, &snap); err != nil {
		return calc.Response{}, err
	}
	resp.ModelVersion = snap.Result.ModelVersion
	if resp.ModelVersion == "" {
		return calc.Response{}, fmt.Errorf("%w: empty model_version in the evaluation", calc.ErrUnavailable)
	}
	if rv := snap.Result.Ranking.ModelVersion; rv != nil && snap.Result.Ranking.Status == "available" {
		resp.RankingVersion = rv
	}
	resp.Results = mapResults(p, snap)
	return resp, nil
}

// do performs one call. Network, 5xx and decoding failures wrap calc.ErrUnavailable; 409 and 422
// mean the service refused the input and wrap calc.ErrRejected.
func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, body)
	if err != nil {
		return fmt.Errorf("%w: %w", calc.ErrUnavailable, err)
	}
	req.Header.Set("Accept", "application/json")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if id := middleware.GetReqID(ctx); id != "" {
		req.Header.Set("X-Request-ID", id)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %s %s: %w", calc.ErrUnavailable, method, path, err)
	}
	defer resp.Body.Close() //nolint:errcheck // the body is fully read below
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponse))
	if err != nil {
		return fmt.Errorf("%w: %s %s: read: %w", calc.ErrUnavailable, method, path, err)
	}
	switch {
	case resp.StatusCode == http.StatusConflict || resp.StatusCode == http.StatusUnprocessableEntity:
		return fmt.Errorf("%w: %s %s: status %d: %s", calc.ErrRejected, method, path, resp.StatusCode, snippet(data))
	case resp.StatusCode < 200 || resp.StatusCode > 299:
		return fmt.Errorf("%w: %s %s: status %d: %s", calc.ErrUnavailable, method, path, resp.StatusCode, snippet(data))
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("%w: %s %s: decode: %w", calc.ErrUnavailable, method, path, err)
	}
	return nil
}

func snippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 500 {
		s = s[:500] + "…"
	}
	return s
}
