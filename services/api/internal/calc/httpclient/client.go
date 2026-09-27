// Package httpclient calls the calculation of services/economics over HTTP
// (packages/contracts/openapi/economics.yaml).
package httpclient

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
)

const maxResponse = 16 << 20

// Client is a calc.Calculator backed by the economics service.
type Client struct {
	base string
	http *http.Client
}

// New creates a client for the service at baseURL; timeout bounds every call.
func New(baseURL string, timeout time.Duration) *Client {
	return &Client{base: strings.TrimSuffix(baseURL, "/"), http: &http.Client{Timeout: timeout}}
}

// ModelVersion asks the service which formulas it runs.
func (c *Client) ModelVersion(ctx context.Context) (string, error) {
	var out calc.ModelVersionResponse
	if err := c.do(ctx, http.MethodGet, calc.PathModelVersion, nil, &out); err != nil {
		return "", err
	}
	if out.ModelVersion == "" {
		return "", fmt.Errorf("%w: empty modelVersion", calc.ErrUnavailable)
	}
	return out.ModelVersion, nil
}

// Calculate sends the candidates of one project task.
func (c *Client) Calculate(ctx context.Context, req calc.Request) (calc.Response, error) {
	var out calc.Response
	if err := c.do(ctx, http.MethodPost, calc.PathCalculations, req, &out); err != nil {
		return calc.Response{}, err
	}
	if out.ModelVersion == "" {
		return calc.Response{}, fmt.Errorf("%w: empty modelVersion", calc.ErrUnavailable)
	}
	return out, nil
}

// do performs one call; every failure is wrapped in calc.ErrUnavailable.
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
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %s %s: %w", calc.ErrUnavailable, method, path, err)
	}
	defer resp.Body.Close() //nolint:errcheck // the body is fully read below
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponse))
	if err != nil {
		return fmt.Errorf("%w: %s %s: read: %w", calc.ErrUnavailable, method, path, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("%w: %s %s: status %d: %s", calc.ErrUnavailable, method, path, resp.StatusCode, snippet(data))
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("%w: %s %s: decode: %w", calc.ErrUnavailable, method, path, err)
	}
	return nil
}

func snippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 300 {
		s = s[:300] + "…"
	}
	return s
}
