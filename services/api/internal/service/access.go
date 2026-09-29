package service

import (
	"context"
	"errors"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

// Actor is the signed-in caller of a request.
type Actor struct {
	UserID uuid.UUID // Keycloak sub
	Admin  bool      // realm role admin: manages reference processes
}

type actorKey struct{}

type systemKey struct{}

// WithActor marks the context as a request of a signed-in user. Without it the caller is a guest.
func WithActor(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, actorKey{}, a)
}

// AsSystem marks the context as the service itself (seed data): no ownership checks, no owner.
func AsSystem(ctx context.Context) context.Context {
	return context.WithValue(ctx, systemKey{}, true)
}

// access is who acts in a request.
//
// User data (locations with their tasks, projects, user processes) belongs to its author. A user
// sees own data and demo data; a guest sees only demo data. Only the author changes own data, demo
// data is read only (403), and data of others is indistinguishable from missing (404). Reference
// processes are shared: everyone sees them, only the admin changes them. The admin role does not
// open other users' data.
type access struct {
	user   *uuid.UUID
	admin  bool
	system bool
}

func accessOf(ctx context.Context) access {
	if sys, _ := ctx.Value(systemKey{}).(bool); sys {
		return access{system: true}
	}
	a, ok := ctx.Value(actorKey{}).(Actor)
	if !ok {
		return access{}
	}
	return access{user: &a.UserID, admin: a.Admin}
}

// owner is the owner of a record created now: the user, or nil for the system.
func (a access) owner() *uuid.UUID {
	if a.system || a.user == nil {
		return nil
	}
	id := *a.user
	return &id
}

func (a access) owns(owner *uuid.UUID) bool {
	return a.system || (a.user != nil && owner != nil && *owner == *a.user)
}

func (a access) sees(owner *uuid.UUID, demo bool) bool { return demo || a.owns(owner) }

// check returns nil when the caller may read (write=false) or change the record.
func (a access) check(entity string, id uuid.UUID, owner *uuid.UUID, demo, write bool) error {
	if !a.sees(owner, demo) {
		return domain.NotFound(entity, id.String())
	}
	if write && !a.owns(owner) {
		return domain.Forbidden("demo_read_only", demoReadOnly[entity])
	}
	return nil
}

var demoReadOnly = map[string]string{
	"location": "Демо-локация только для просмотра. Создайте свою из типового объекта, чтобы менять данные",
	"project":  "Демо-проект только для просмотра. Скопируйте его, чтобы менять условия и запускать подбор",
}

func (a access) location(l domain.Location, write bool) error {
	return a.check("location", l.ID, l.OwnerID, l.IsDemo, write)
}

func (a access) task(t domain.Task, write bool) error {
	if err := a.check("location", t.LocationID, t.LocationOwnerID, t.LocationIsDemo, write); err != nil {
		var nf *domain.NotFoundError
		if errors.As(err, &nf) {
			return domain.NotFound("task", t.ID.String())
		}
		return err
	}
	return nil
}

func (a access) project(id uuid.UUID, owner *uuid.UUID, demo, write bool) error {
	return a.check("project", id, owner, demo, write)
}

// process: a reference process (no owner) is shared, a user process belongs to its author.
func (a access) process(p domain.Process, write bool) error {
	if p.OwnerID != nil {
		return a.check("process", p.ID, p.OwnerID, false, write)
	}
	if write && !a.admin && !a.system {
		return domain.Forbidden("reference_process",
			"Справочный процесс меняет администратор. Создайте копию, чтобы изменить значения")
	}
	return nil
}

// seesHidden: hidden reference records (catalog positions, operation classes, reference processes) are admin data.
// Other callers get them only through the records that already reference them.
func (a access) seesHidden() bool { return a.admin || a.system }
