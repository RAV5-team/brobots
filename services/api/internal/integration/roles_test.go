//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/brobots/api/internal/auth"
)

// TestAdminDataAccess: the source registry and hidden reference records are admin data (roles model §4); a process
// the admin creates stays the admin's own; a token without the user role does not write.
func TestAdminDataAccess(t *testing.T) {
	e := setup(t)
	user := e.as(e.iss.User(t, "alice", auth.RoleUser))
	admin := e.as(e.iss.User(t, "root", auth.RoleUser, auth.RoleAdmin))
	guest := e.as("")
	noRole := e.as(e.iss.User(t, "nobody"))

	guest.do(t, http.MethodGet, "/api/v1/data-sources", nil, 401, nil)
	user.do(t, http.MethodGet, "/api/v1/data-sources", nil, 403, nil)
	var sources struct{ Items []named }
	admin.do(t, http.MethodGet, "/api/v1/data-sources", nil, 200, &sources)
	if len(sources.Items) == 0 {
		t.Fatal("seed must give data sources")
	}
	user.do(t, http.MethodGet, "/api/v1/data-sources/"+sources.Items[0].ID, nil, 403, nil)

	// A hidden operation class: the admin sees it with includeHidden, the others neither in the list nor by id.
	var wt named
	admin.do(t, http.MethodPost, "/api/v1/work-types", map[string]any{
		"name": "Скрытый класс", "unitLabel": "шт", "description": "проверка ролей",
	}, 201, &wt)
	admin.do(t, http.MethodDelete, "/api/v1/work-types/"+wt.ID, nil, 204, nil)
	has := func(c *env) bool {
		var list struct{ Items []named }
		c.do(t, http.MethodGet, "/api/v1/work-types?includeHidden=true", nil, 200, &list)
		for _, w := range list.Items {
			if w.ID == wt.ID {
				return true
			}
		}
		return false
	}
	if !has(admin) || has(user) || has(guest) {
		t.Errorf("hidden class seen: admin %v, user %v, guest %v", has(admin), has(user), has(guest))
	}
	admin.do(t, http.MethodGet, "/api/v1/work-types/"+wt.ID, nil, 200, nil)
	user.do(t, http.MethodGet, "/api/v1/work-types/"+wt.ID, nil, 404, nil)
	guest.do(t, http.MethodGet, "/api/v1/work-types/"+wt.ID, nil, 404, nil)

	// A copy the admin makes is the admin's own: nobody else sees it.
	var procs struct{ Items []named }
	admin.do(t, http.MethodGet, "/api/v1/processes", nil, 200, &procs)
	var copied named
	admin.do(t, http.MethodPost, "/api/v1/processes/"+procs.Items[0].ID+"/duplicate", nil, 201, &copied)
	admin.do(t, http.MethodGet, "/api/v1/processes/"+copied.ID, nil, 200, nil)
	user.do(t, http.MethodGet, "/api/v1/processes/"+copied.ID, nil, 404, nil)
	guest.do(t, http.MethodGet, "/api/v1/processes/"+copied.ID, nil, 404, nil)

	noRole.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Без роли", "facilityTypeCode": "warehouse", "city": "Москва",
	}, 403, nil)
}
