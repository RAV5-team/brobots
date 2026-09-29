package seed

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// readyDemoProjects brings every calculated demo project to a chosen variant on the last step: a guest opens the
// whole path of a demo evaluation, from the parameters to the result (roles model §5, §8). The projects stay drafts,
// so a guest may recalculate them in the preview. It also finishes demo projects of an older seed; repeated runs
// change nothing.
func readyDemoProjects(ctx context.Context, svc *service.Service, log *slog.Logger) (int, error) {
	page, err := svc.ListProjects(ctx, service.ProjectQuery{Limit: 500})
	if err != nil {
		return 0, err
	}
	last := domain.ProjectSteps[len(domain.ProjectSteps)-1]
	n := 0
	for _, p := range page.Items {
		selected := p.Selection != nil && p.Selection.CalcResultID != nil
		if !p.IsDemo || p.Status != domain.ProjectDraft || p.LatestEvaluation == nil || (selected && p.Step == last) {
			continue
		}
		if !selected {
			ev, err := svc.GetEvaluation(ctx, p.ID)
			if err != nil {
				return n, fmt.Errorf("demo project %s evaluation: %w", p.Name, err)
			}
			solutionID, model, ok := demoChoice(ev)
			if !ok {
				log.WarnContext(ctx, "demo project has no calculable variant", slog.String("project", p.Name))
				continue
			}
			if err := patch(ctx, svc.PutSelection, p.ID, map[string]any{"solutionId": solutionID, "acquisitionModel": model}); err != nil {
				return n, fmt.Errorf("demo project %s selection: %w", p.Name, err)
			}
		}
		if err := patch(ctx, svc.PatchProject, p.ID, map[string]any{"step": last}); err != nil {
			return n, fmt.Errorf("demo project %s step: %w", p.Name, err)
		}
		n++
	}
	return n, nil
}

// demoChoice is the variant a demo project shows: the recommended one, or the best calculable one without a ranking
// (the mock model does not rank).
func demoChoice(ev service.Evaluation) (uuid.UUID, string, bool) {
	var first *store.CalcResult
	for _, c := range ev.Candidates { // candidates come ordered by rank
		for i, r := range c.Results {
			if !r.Calculable {
				continue
			}
			if ev.RecommendedResultID != nil && r.ID == *ev.RecommendedResultID {
				return r.SolutionID, r.AcquisitionModel, true
			}
			if first == nil {
				first = &c.Results[i]
			}
		}
	}
	if first == nil {
		return uuid.Nil, "", false
	}
	return first.SolutionID, first.AcquisitionModel, true
}

func patch(ctx context.Context, call func(context.Context, uuid.UUID, []byte) (domain.Project, error), id uuid.UUID,
	body map[string]any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	_, err = call(ctx, id, b)
	return err
}
