//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/brobots/api/internal/auth"
)

type page struct {
	Items []struct {
		ID     string
		IsDemo bool
	}
	Total int
}

func ids(p page) map[string]bool {
	out := map[string]bool{}
	for _, it := range p.Items {
		out[it.ID] = true
	}
	return out
}

// TestOwnership checks data isolation: a user sees own and demo data, a guest only demo data,
// demo data is read only and data of others is not found (docs/keycloak/middleware.md).
func TestOwnership(t *testing.T) {
	e := setup(t)
	alice := e.as(e.iss.User(t, "alice", auth.RoleUser))
	bob := e.as(e.iss.User(t, "bob", auth.RoleUser))
	admin := e.as(e.iss.User(t, "admin", auth.RoleUser, auth.RoleAdmin))
	guest := e.as("")

	// Demo data is what a guest sees.
	var demoLocs, demoProjects page
	guest.do(t, http.MethodGet, "/api/v1/locations?limit=500", nil, 200, &demoLocs)
	guest.do(t, http.MethodGet, "/api/v1/projects?limit=500", nil, 200, &demoProjects)
	if len(demoLocs.Items) == 0 || len(demoProjects.Items) == 0 {
		t.Fatalf("seed must give demo data: %d locations, %d projects", len(demoLocs.Items), len(demoProjects.Items))
	}
	for _, l := range append(demoLocs.Items, demoProjects.Items...) {
		if !l.IsDemo {
			t.Fatalf("guest sees non-demo record %s", l.ID)
		}
	}
	demoLoc, demoProject := demoLocs.Items[0].ID, demoProjects.Items[0].ID

	// Alice builds a location, a task, a project and a run.
	var loc, task, project, run named
	alice.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Склад Алисы", "facilityTypeCode": "warehouse", "city": "Казань", "fillDefaults": true,
	}, 201, &loc)
	var procs struct{ Items []named }
	alice.do(t, http.MethodGet, "/api/v1/processes?facilityType=warehouse", nil, 200, &procs)
	var palletProc string
	for _, p := range procs.Items {
		if p.Code == "PR-0001" {
			palletProc = p.ID
		}
	}
	alice.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": palletProc}, 201, &task)
	alice.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 201, &project)
	alice.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/matching-runs", nil, 201, &run)

	t.Run("owner reads and changes own data", func(t *testing.T) {
		for _, path := range []string{"/locations/" + loc.ID, "/locations/" + loc.ID + "/tasks", "/tasks/" + task.ID,
			"/projects/" + project.ID, "/projects/" + project.ID + "/snapshot", "/matching-runs/" + run.ID} {
			alice.do(t, http.MethodGet, "/api/v1"+path, nil, 200, nil)
		}
		alice.do(t, http.MethodPatch, "/api/v1/locations/"+loc.ID, map[string]any{"city": "Самара"}, 200, nil)
	})

	t.Run("others and guests do not see it", func(t *testing.T) {
		reads := []string{"/locations/" + loc.ID, "/locations/" + loc.ID + "/parameters", "/locations/" + loc.ID + "/tasks",
			"/tasks/" + task.ID, "/tasks/" + task.ID + "/match-preview", "/projects/" + project.ID,
			"/projects/" + project.ID + "/snapshot", "/projects/" + project.ID + "/conditions",
			"/projects/" + project.ID + "/matching-runs/latest", "/projects/" + project.ID + "/evaluation-context",
			"/matching-runs/" + run.ID}
		for _, who := range []*env{bob, guest, admin} {
			for _, path := range reads {
				who.do(t, http.MethodGet, "/api/v1"+path, nil, 404, nil)
			}
		}
		bob.do(t, http.MethodPatch, "/api/v1/locations/"+loc.ID, map[string]any{"city": "Уфа"}, 404, nil)
		bob.do(t, http.MethodDelete, "/api/v1/tasks/"+task.ID, nil, 404, nil)
		bob.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/matching-runs", nil, 404, nil)
		bob.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/copy", nil, 404, nil)
		bob.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": palletProc}, 404, nil)
		bob.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 404, nil)

		var locs, projects page
		bob.do(t, http.MethodGet, "/api/v1/locations?limit=500", nil, 200, &locs)
		bob.do(t, http.MethodGet, "/api/v1/projects?limit=500", nil, 200, &projects)
		if ids(locs)[loc.ID] || ids(projects)[project.ID] {
			t.Error("bob's lists include alice's data")
		}
		if !ids(locs)[demoLoc] || !ids(projects)[demoProject] {
			t.Error("bob's lists miss demo data")
		}
		var dash struct{ Locations, Projects struct{ Total int } }
		bob.do(t, http.MethodGet, "/api/v1/dashboard/summary", nil, 200, &dash)
		if dash.Locations.Total != len(demoLocs.Items) || dash.Projects.Total != len(demoProjects.Items) {
			t.Errorf("bob's dashboard = %+v, want only demo data", dash)
		}
	})

	t.Run("demo data is read only", func(t *testing.T) {
		bob.do(t, http.MethodGet, "/api/v1/locations/"+demoLoc, nil, 200, nil)
		bob.do(t, http.MethodPatch, "/api/v1/locations/"+demoLoc, map[string]any{"city": "Уфа"}, 403, nil)
		bob.do(t, http.MethodDelete, "/api/v1/locations/"+demoLoc, nil, 403, nil)
		bob.do(t, http.MethodPost, "/api/v1/projects/"+demoProject+"/matching-runs", nil, 403, nil)
		admin.do(t, http.MethodPut, "/api/v1/projects/"+demoProject+"/conditions", map[string]any{"items": []any{}}, 403, nil)

		// A copy of a demo project is the user's own.
		var copied named
		bob.do(t, http.MethodPost, "/api/v1/projects/"+demoProject+"/copy", nil, 201, &copied)
		bob.do(t, http.MethodPost, "/api/v1/projects/"+copied.ID+"/matching-runs", nil, 201, nil)
		alice.do(t, http.MethodGet, "/api/v1/projects/"+copied.ID, nil, 404, nil)
		var fromTemplate named
		bob.do(t, http.MethodPost, "/api/v1/locations/from-template", map[string]any{"templateLocationId": demoLoc}, 201, &fromTemplate)
		bob.do(t, http.MethodPatch, "/api/v1/locations/"+fromTemplate.ID, map[string]any{"city": "Уфа"}, 200, nil)
		var tasks struct{ Items []named }
		bob.do(t, http.MethodGet, "/api/v1/locations/"+fromTemplate.ID+"/tasks", nil, 200, &tasks)
		if len(tasks.Items) == 0 {
			t.Fatal("a copied template must keep its tasks")
		}
		bob.do(t, http.MethodPatch, "/api/v1/tasks/"+tasks.Items[0].ID, map[string]any{"name": "Моя задача"}, 200, nil)
		alice.do(t, http.MethodGet, "/api/v1/tasks/"+tasks.Items[0].ID, nil, 404, nil)
	})

	t.Run("user processes are private, reference ones admin-managed", func(t *testing.T) {
		var mine struct {
			ID       string
			IsCustom bool
		}
		alice.do(t, http.MethodPost, "/api/v1/processes/"+palletProc+"/duplicate", nil, 201, &mine)
		if !mine.IsCustom {
			t.Error("a user copy must be a user process")
		}
		alice.do(t, http.MethodPatch, "/api/v1/processes/"+mine.ID, map[string]any{"name": "Мой процесс"}, 200, nil)
		bob.do(t, http.MethodGet, "/api/v1/processes/"+mine.ID, nil, 404, nil)
		bob.do(t, http.MethodPatch, "/api/v1/processes/"+mine.ID, map[string]any{"name": "Чужой"}, 404, nil)
		bob.do(t, http.MethodPost, "/api/v1/locations/"+demoLoc+"/tasks", map[string]any{"processId": mine.ID}, 403, nil)
		var bobProcs struct{ Items []named }
		bob.do(t, http.MethodGet, "/api/v1/processes", nil, 200, &bobProcs)
		for _, p := range bobProcs.Items {
			if p.ID == mine.ID {
				t.Error("bob's process list includes alice's process")
			}
		}

		alice.do(t, http.MethodPatch, "/api/v1/processes/"+palletProc, map[string]any{"name": "Чужое"}, 403, nil)
		alice.do(t, http.MethodDelete, "/api/v1/processes/"+palletProc, nil, 403, nil)
		// The admin manages the reference processes, but a copy the admin makes is the admin's own, not published.
		var adminCopy named
		admin.do(t, http.MethodPost, "/api/v1/processes/"+palletProc+"/duplicate", nil, 201, &adminCopy)
		bob.do(t, http.MethodGet, "/api/v1/processes/"+adminCopy.ID, nil, 404, nil)
		var ref named
		admin.do(t, http.MethodGet, "/api/v1/processes/"+palletProc, nil, 200, &ref)
		admin.do(t, http.MethodPatch, "/api/v1/processes/"+palletProc, map[string]any{"name": "Справочный"}, 200, nil)
		admin.do(t, http.MethodPatch, "/api/v1/processes/"+palletProc, map[string]any{"name": ref.Name}, 200, nil)
	})

	t.Run("owner deletes own data", func(t *testing.T) {
		bob.do(t, http.MethodDelete, "/api/v1/projects/"+project.ID, nil, 404, nil)
		alice.do(t, http.MethodDelete, "/api/v1/projects/"+project.ID, nil, 204, nil)
		alice.do(t, http.MethodDelete, "/api/v1/locations/"+loc.ID, nil, 204, nil)
	})
}
