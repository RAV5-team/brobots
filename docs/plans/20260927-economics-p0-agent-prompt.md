# Economics P0 Implementation Agent Handoff

Read and implement the approved plan at
[`20260927-economics-p0-integration-gaps.md`](20260927-economics-p0-integration-gaps.md).
Use that plan as the source of truth and update its task checkboxes as work
progresses: check an item only when its change or verification is actually
complete. Keep the status current before reporting a checkpoint.

## Working agreement

- You are implementing in the existing shared checkout. Do not create a
  worktree, switch branches, commit, or merge.
- Keep all source and test changes inside `services/economics`. The only
  implementation-file exception is the generated
  `packages/contracts/openapi/economics.yaml` named in Task 5. The plan and
  this handoff document are the only allowed edits outside those implementation
  paths.
- Review the plan against the repository before coding. If a critical gap,
  conflict, or unclear behavior blocks safe implementation, stop and report the
  exact issue instead of silently broadening the scope.
- Follow the plan in order. Add focused regression tests for each behavior,
  run the listed checks, and update the corresponding checkboxes. Do not mark
  checks complete on the basis of intended changes.
- Preserve unrelated edits in the shared checkout. Inspect `git status` before
  starting and before each commit-sized group of edits; do not overwrite or
  revert changes you did not make.
- Stop at a failing verification or blocker, report the command and relevant
  output, and wait for reviewer direction. At the end of each task, report the
  implementation summary, tests and results, files changed, and any remaining
  concerns so the reviewer can respond before you continue.
- Do not implement the Go API orchestrator changes; they are explicitly out of
  scope.

Start by reading the plan and inspecting the current checkout, then proceed
with Task 1. The human reviewer will follow your work in this agterm session.
