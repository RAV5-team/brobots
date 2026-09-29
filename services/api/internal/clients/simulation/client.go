// Package simulation is the HTTP client of services/simulation (services/simulation/README.md).
//
// The api orchestrator calls it for the «Симуляция» step on behalf of the user: the user's access token is
// passed through (its audience includes rav5-sim), so the simulation service applies its own ownership rules.
package simulation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// ErrUnavailable is a network failure, a 5xx or an unreadable answer.
var ErrUnavailable = errors.New("simulation service unavailable")

// ErrNotFound is a job or a run the service does not know (or does not show to this caller).
var ErrNotFound = errors.New("simulation not found")

// BusyError is a 429: the service runs as many guest jobs as it allows; Message is the service's text.
type BusyError struct{ Message string }

func (e *BusyError) Error() string { return "simulation is busy: " + e.Message }

// FieldError is one invalid field of the request, as the service reports it.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// RejectedError is a 422: the request does not satisfy the simulation contract.
type RejectedError struct {
	Message string
	Errors  []FieldError
}

func (e *RejectedError) Error() string { return "simulation rejected the request: " + e.Message }

// Job is the progress of a queued simulation.
type Job struct {
	JobID         string       `json:"job_id"`
	Status        string       `json:"status"`
	Log           []string     `json:"log"`
	Elapsed       float64      `json:"elapsed"`
	SimulationIDs []string     `json:"simulation_ids"`
	Error         *string      `json:"error"`
	Errors        []FieldError `json:"errors"`
}

// Client calls services/simulation.
type Client struct {
	base   string
	prefix string // /api/simulations for users, /internal/simulations for the guest runs of api
	http   *http.Client
}

const (
	userPrefix     = "/api/simulations"
	internalPrefix = "/internal/simulations"
)

// New builds a client of the user paths: every call passes the caller's token; timeout bounds every call.
func New(baseURL string, timeout time.Duration) *Client {
	return &Client{base: baseURL, prefix: userPrefix, http: &http.Client{Timeout: timeout, Transport: plainTransport()}}
}

// NewInternal builds a client of the internal paths for guest runs: api calls as itself, the token argument of the
// calls is ignored and auth adds the service token (it wraps the transport it is given).
func NewInternal(baseURL string, timeout time.Duration, auth func(http.RoundTripper) http.RoundTripper) *Client {
	return &Client{base: baseURL, prefix: internalPrefix, http: &http.Client{Timeout: timeout, Transport: auth(plainTransport())}}
}

// plainTransport passes traces through gzipped: it must not decompress them.
func plainTransport() http.RoundTripper {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableCompression = true
	return transport
}

func (c *Client) do(ctx context.Context, token, method, path string, body any, header http.Header) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal simulation request: %w", err)
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, reader)
	if err != nil {
		return nil, err
	}
	for k, v := range header {
		req.Header[k] = v
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" && c.prefix == userPrefix {
		req.Header.Set("Authorization", token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	return resp, nil
}

// check turns an error answer into a client error; the body of a success is left to the caller.
func check(resp *http.Response) error {
	if resp.StatusCode < 300 {
		return nil
	}
	defer func() { _ = resp.Body.Close() }()
	var problem struct {
		Error  string       `json:"error"`
		Errors []FieldError `json:"errors"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&problem)
	switch resp.StatusCode {
	case http.StatusNotFound:
		return ErrNotFound
	case http.StatusTooManyRequests:
		return &BusyError{Message: problem.Error}
	case http.StatusUnprocessableEntity:
		return &RejectedError{Message: problem.Error, Errors: problem.Errors}
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("%w: access denied (%d): %s", ErrUnavailable, resp.StatusCode, problem.Error)
	}
	return fmt.Errorf("%w: status %d: %s", ErrUnavailable, resp.StatusCode, problem.Error)
}

func decode(resp *http.Response, dst any) error {
	defer func() { _ = resp.Body.Close() }()
	if err := check(resp); err != nil {
		return err
	}
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		return fmt.Errorf("%w: unreadable answer: %w", ErrUnavailable, err)
	}
	return nil
}

// Submit queues a simulation (POST /api/simulations); the request follows the simulation contract.
func (c *Client) Submit(ctx context.Context, token string, request any) (string, error) {
	resp, err := c.do(ctx, token, http.MethodPost, c.prefix, request, nil)
	if err != nil {
		return "", err
	}
	var accepted struct {
		JobID string `json:"job_id"`
	}
	if err := decode(resp, &accepted); err != nil {
		return "", err
	}
	if accepted.JobID == "" {
		return "", fmt.Errorf("%w: no job_id in the answer", ErrUnavailable)
	}
	return accepted.JobID, nil
}

// Job returns the progress of a job.
func (c *Client) Job(ctx context.Context, token, jobID string) (Job, error) {
	var job Job
	resp, err := c.do(ctx, token, http.MethodGet, c.prefix+"/jobs/"+url.PathEscape(jobID), nil, nil)
	if err != nil {
		return job, err
	}
	return job, decode(resp, &job)
}

// Run returns a finished run as the service stores it (SimulationRun of services/simulation/docs/openapi.json).
func (c *Client) Run(ctx context.Context, token, simulationID string) (json.RawMessage, error) {
	var run json.RawMessage
	resp, err := c.do(ctx, token, http.MethodGet, c.prefix+"/"+url.PathEscape(simulationID), nil, nil)
	if err != nil {
		return nil, err
	}
	return run, decode(resp, &run)
}

// Traces opens the 2D traces of a run; gzip asks for the compressed body. The caller closes the body.
func (c *Client) Traces(ctx context.Context, token, simulationID string, gzip bool) (*http.Response, error) {
	header := http.Header{}
	if gzip {
		header.Set("Accept-Encoding", "gzip")
	}
	resp, err := c.do(ctx, token, http.MethodGet, c.prefix+"/"+url.PathEscape(simulationID)+"/traces", nil, header)
	if err != nil {
		return nil, err
	}
	if err := check(resp); err != nil {
		return nil, err
	}
	return resp, nil
}
