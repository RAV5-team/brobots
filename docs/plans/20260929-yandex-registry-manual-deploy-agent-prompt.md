# Executor Prompt: Yandex Registry and Manual Deployment

Implement the approved plan in
[`20260929-yandex-registry-manual-deploy.md`](20260929-yandex-registry-manual-deploy.md).
Work only in the dedicated worktree for this task.

## Instructions

- Read the plan and repository guidance before changing code.
- Implement Tasks 1–5 and the locally verifiable parts of Task 6.
- Keep the existing Container-Optimized Image (COI) deployment model.
- Do not modify GitHub workflows or require GitHub repository access.
- Do not publish images to Yandex Container Registry, update cloud resources,
  deploy to the VM, commit, push, or merge. Those actions are outside this
  implementation handoff.
- Keep image publication and deployment rollback based on the same full commit
  SHA, as specified in the plan.
- Update the task checkboxes in the plan as work progresses. Leave any item
  unchecked when its acceptance criteria have not been verified, and explain
  why in the final report.
- Add focused tests for the scripts and behavior you introduce. Run the
  applicable repository checks before handing work back.
- Do not claim image builds or cloud verification passed unless you actually
  ran them. If OrbStack, Docker, Buildx, credentials, or another prerequisite
  blocks a check, report the exact blocker and the check that remains.
- Keep changes limited to the files and concerns described by the approved
  plan. Preserve unrelated user changes.

## Review Handoff

When implementation and verification are complete, stop and report that the
work is **READY FOR REVIEW**. Include:

- A concise summary of implementation changes.
- The plan tasks completed and any unchecked acceptance criteria.
- Exact test and validation commands, with results.
- Any environment blockers, limitations, or follow-up operator actions.
- The worktree path and branch name.

Do not begin deployment or merge the worktree. Wait for the reviewer.
