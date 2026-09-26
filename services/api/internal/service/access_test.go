package service

import (
	"context"
	"errors"
	"testing"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

func TestAccessRules(t *testing.T) {
	alice, bob := uuid.New(), uuid.New()
	ctxOf := map[string]context.Context{
		"guest":  context.Background(),
		"alice":  WithActor(context.Background(), Actor{UserID: alice}),
		"bob":    WithActor(context.Background(), Actor{UserID: bob}),
		"admin":  WithActor(context.Background(), Actor{UserID: uuid.New(), Admin: true}),
		"system": AsSystem(context.Background()),
	}
	own := domain.Location{ID: uuid.New(), OwnerID: &alice}
	demo := domain.Location{ID: uuid.New(), IsDemo: true}
	legacy := domain.Location{ID: uuid.New()} // no owner, not demo: created before ownership
	// want: "" — allowed, "404" — not found, "403" — forbidden.
	cases := []struct {
		who   string
		l     domain.Location
		write bool
		want  string
	}{
		{"alice", own, false, ""}, {"alice", own, true, ""},
		{"bob", own, false, "404"}, {"bob", own, true, "404"},
		{"admin", own, false, "404"}, {"guest", own, false, "404"},
		{"guest", demo, false, ""}, {"bob", demo, false, ""}, {"bob", demo, true, "403"}, {"admin", demo, true, "403"},
		{"alice", legacy, false, "404"}, {"system", own, true, ""}, {"system", demo, true, ""},
	}
	for _, c := range cases {
		if got := verdict(accessOf(ctxOf[c.who]).location(c.l, c.write)); got != c.want {
			t.Errorf("%s write=%v demo=%v: %q, want %q", c.who, c.write, c.l.IsDemo, got, c.want)
		}
	}

	ref := domain.Process{ID: uuid.New()}
	mine := domain.Process{ID: uuid.New(), OwnerID: &alice}
	processCases := []struct {
		who   string
		p     domain.Process
		write bool
		want  string
	}{
		{"guest", ref, false, ""}, {"bob", ref, true, "403"}, {"admin", ref, true, ""}, {"system", ref, true, ""},
		{"alice", mine, true, ""}, {"bob", mine, false, "404"}, {"admin", mine, false, "404"},
	}
	for _, c := range processCases {
		if got := verdict(accessOf(ctxOf[c.who]).process(c.p, c.write)); got != c.want {
			t.Errorf("process %s write=%v: %q, want %q", c.who, c.write, got, c.want)
		}
	}

	if o := accessOf(ctxOf["alice"]).owner(); o == nil || *o != alice {
		t.Errorf("new record owner = %v, want alice", o)
	}
	if accessOf(ctxOf["system"]).owner() != nil || accessOf(ctxOf["admin"]).newProcessOwner() != nil {
		t.Error("seed data and admin processes must have no owner")
	}
}

func verdict(err error) string {
	var nf *domain.NotFoundError
	var fe *domain.ForbiddenError
	switch {
	case err == nil:
		return ""
	case errors.As(err, &nf):
		return "404"
	case errors.As(err, &fe):
		return "403"
	}
	return err.Error()
}
