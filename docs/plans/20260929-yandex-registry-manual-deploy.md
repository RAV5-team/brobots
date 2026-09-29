# Yandex Container Registry and Manual COI Deployment

## Overview

Replace the GHCR-based release path for your local checkout with a repeatable local release and manual deployment process. Build and validate the images locally, push them to Yandex Container Registry using an immutable commit SHA, and update the existing COI VM with `yc`. Preserve SHA-based rollback.

The plan fixes the two build failures from the latest release run: the web TypeScript errors and the Keycloak Docker build-context mismatch.

## Context

- **Plan file:** `docs/plans/20260929-yandex-registry-manual-deploy.md`
- **Files involved:** `apps/web/src/components/ui/ProgressPanel.tsx`, `infra/keycloak/Dockerfile`, `docker-compose.coi.yml`, `infra/deploy/`, `.gitignore`, `docs/deployment/yandex-cloud.md`
- **Related patterns:** the existing COI Compose spec, deployment runbook, and service checks in `release-images.yml`.
- **Registry format:** `cr.yandex/<registry-id>/<image>:<commit-sha>`.
- **Access:** your Yandex identity pushes images; the VM’s attached service account pulls them. Yandex documents the `container-registry.images.pusher` and `container-registry.images.puller` roles for these operations. [Yandex Container Registry roles](https://yandex.cloud/en/docs/container-registry/security/)
- **GitHub boundary:** leave GitHub workflows unchanged. Without repository access, local edits to those files cannot change the remote workflows or publish your local commits.

## Development Approach

Use a clean local commit as the release source. First restore local OrbStack/Docker access and install Buildx; the current Mac is `arm64`, while the existing CI builds on Linux runners, so verify the VM’s target platform before building. Run local quality checks before publishing. Push every runtime image with the same full commit SHA, then deploy that SHA to the COI VM.

Do not store a long-lived registry password on the VM. Use the local `yc` Docker credential helper for publishing and the VM service account for pulling. Keep prior image tags for rollback. Put registry setup, role assignment, VM deployment, and other cloud-side actions in the post-completion checklist, separate from automated task checkboxes.

## Implementation Steps

### Task 1: Fix the web and Keycloak image build failures

**Files:**
- Modify: `apps/web/src/components/ui/ProgressPanel.tsx`
- Modify: `apps/web/src/pages/locations/new/locationCheck.ts`
- Modify: `infra/keycloak/Dockerfile`

- [x] Omit the `label` prop when `logLabel` is undefined, or adjust the prop type to explicitly accept `undefined`.
- [x] Align Keycloak’s Dockerfile paths with a repository-root build context, including the realm import file under `infra/keycloak/`.
- [ ] Run web lint, typecheck, tests, and production build.
- [ ] Build the Keycloak image with the repository root as context.

**Verification note:** Web lint and typecheck passed after installing
dependencies. `npm test` ran 2,324 tests and reported 18 failures, 2,302
passes, and 4 skips. A separate `locationCheck.ts` type error was corrected;
`npm run typecheck` then passed. The image build did not run because the
release gate stopped at the failing web tests. The Keycloak Docker build was
not reached.

### Task 2: Point the COI Compose spec at Yandex Container Registry

**Files:**
- Modify: `docker-compose.coi.yml`

- [x] Replace GHCR image references with `cr.yandex/${YC_REGISTRY_ID}/brobots-<service>:${IMAGE_TAG}`.
- [x] Keep the same SHA tag for application, migration, and infrastructure images.
- [x] Preserve existing runtime env-file paths, networks, volumes, health checks, and ports.
- [x] Validate a rendered Compose spec with placeholder env files and confirm it has no unresolved variables or GHCR references.

### Task 3: Add a local release command

**Files:**
- Create: `infra/deploy/release-yandex-images.sh`
- Create: `infra/deploy/tests/` for release-command checks

- [x] Fail unless the checkout is clean and the release tag is the full current commit SHA.
- [x] Require working Docker, Buildx, an authenticated `yc` profile, registry ID, and a verified target platform.
- [x] Run the Go, economics, simulation, and web checks before pushing images.
- [x] Build and push all seven images for the same SHA, using the correct Dockerfile and context for each image.
- [x] Preserve existing web build arguments, defaulting demo mode to disabled unless explicitly configured.
- [x] Add checks for missing configuration, dirty checkouts, failed tests, and failed image builds.
- [x] Validate script syntax and test the release checks with stubbed Docker/`yc` commands.

**Verification note:** Shell syntax and focused tests passed with Docker and
`yc` command stubs in isolated temporary Git repositories. The tests cover
missing configuration, a dirty checkout, a failed Go test, failed image builds,
test ordering, seven full-SHA image tags, Dockerfile contexts, and web build
arguments, including separate pytest executables for the economics and
simulation environments. A real release attempt passed Go formatting, vet,
race, and integration checks; economics Ruff and 119 tests; simulation's 679
tests; web lint and typecheck. The web suite reported 18 failures, 2,302
passes, and 4 skips, so the release stopped before any image build or push.
OrbStack, Buildx, authenticated registry read access, and the VM target platform
were verified. The VM uses `standard-v3`, an Intel platform mapped to
`linux/amd64` by [Yandex's platform documentation](
https://yandex.cloud/en/docs/compute/concepts/vm-platforms).
The documented SSH key is absent; registry push permission and Compute
operation polling access remain unverified.

### Task 4: Add a manual COI deploy and rollback command

**Files:**
- Create: `infra/deploy/deploy-yandex-images.sh`
- Create: `infra/deploy/tests/` for deployment-command checks

- [x] Require an explicit full SHA and Yandex instance, folder, cloud,
      registry, and public URL configuration.
- [x] Render and validate the Compose spec for that SHA.
- [x] Run `yc compute instance update-container` and treat
      operation-polling errors as deployment failures.
- [x] Run public health checks for the gateway, web app, and Keycloak
      discovery endpoint.
- [ ] Verify through the existing VM access path that all running images use
      the requested SHA.
- [x] Support rollback by invoking the same command with a retained prior SHA.
- [x] Test rendering, invalid inputs, command failures, and success paths with
      stubbed commands.

**Verification note:** Shell syntax and stubbed deployment-command tests passed.
The real standalone `docker-compose config --no-env-resolution` render produced
nine images tagged with the requested SHA and preserved all eight
`/etc/brobots` env-file paths. The script checks running image tags over SSH,
and the SSH stub passed; live VM verification remains unchecked because
deployment and cloud access were explicitly excluded from this task.

### Task 5: Update deployment documentation and prepare the operator comment

**Files:**
- Modify: `docs/deployment/yandex-cloud.md`
- Modify: `.gitignore` only if a local Yandex configuration file is added

- [x] Replace GHCR and GitHub Actions deployment instructions with the local release and manual COI process.
- [x] Document registry discovery/reuse or creation, local publisher access, VM puller access, operation polling checks, and Docker/Buildx setup.
- [x] Add ordered copy-ready operator commands with required values, expected success signals, verification steps, and rollback command.
- [x] Create and verify the actual registry, then record its ID in the operator commands. Do not include tokens or private keys.

**Verification note:** The runbook follows the local release and manual COI
deployment scripts and documents the known instance, folder, cloud, public
URL, and script environment variables. Registry `brobots`
(`crprb9kftitj4diu2jru`) was created in the deployment folder and verified
`ACTIVE`; authenticated registry read access, Docker, and Buildx now work.
Registry push/pull IAM bindings and Compute operation polling permissions
remain to be verified.

### Task 6: Verify acceptance criteria

- [ ] Run the full local service checks and all seven `linux/amd64` image
      builds.
- [ ] Confirm each image is present in Yandex Container Registry under the
      same SHA.
- [x] Confirm the rendered COI Compose spec references only the confirmed
      registry ID and requested full SHA.
- [x] Run script syntax checks and `git diff --check`.
- [x] Confirm the runbook and operator commands match the scripts.

**Verification note:** `bash -n` passed for both deployment scripts and their
focused test scripts. Both focused stub suites passed. `git diff --check`
passed. The runbook and operator commands match the script environment
variables and behavior; registry `brobots` (`crprb9kftitj4diu2jru`) was
created and verified `ACTIVE`. A standalone Docker Compose render using that
registry ID and the full current SHA produced nine Yandex image references
sharing that SHA, with no GHCR references or unresolved deployment variables,
and restored all eight `/etc/brobots` env-file paths. Registry image presence
and live VM SHA verification were not performed; no images were published and
no deployment was attempted. Go, economics, and simulation checks passed. Web
lint and typecheck passed, but 18 of 2,324 web tests failed (2,302 passed, 4
skipped), so the release gate stopped before all seven `linux/amd64` builds.
The registry's push permission remains unverified.

## Post-Completion Manual Checklist

- [x] Repair OrbStack/Docker socket access and install Buildx on the Mac.
- [x] Use the active `brobots` registry (`crprb9kftitj4diu2jru`) in the
      deployment folder.
- Grant your Yandex identity `container-registry.images.pusher` on the registry.
- Grant the VM’s attached service account `container-registry.images.puller` on the registry.
- Confirm your deployment identity can update the instance and read the resulting Compute operation.
- Run the operator comment’s publish, deploy, verification, and—if needed—rollback commands.

## Alternatives

- **ALT-001:** Keep GHCR and GitHub Actions. Not selected because you no longer have repository access.
- **ALT-002:** Switch to SSH-managed Docker Compose on the VM. Not selected because it changes the existing COI runtime model.
- **ALT-003:** Build on a temporary Yandex VM. Not selected because you chose to repair local Docker and Buildx.

## Dependencies

- A working local Docker engine and Buildx installation.
- `yc` authenticated to the Yandex Cloud folder containing the VM and registry.
- Registry push permission for your account; registry pull permission for the VM’s attached service account.
- SSH access to inspect running image tags after deployment.

## Risks & Assumptions

- **RISK-001:** The web suite has 18 failures, so the release gate stops before
  image builds or publication.
- **RISK-002:** The Mac is `arm64`; the VM uses Intel `standard-v3`, so builds
  must target `linux/amd64`.
- **RISK-003:** The current GitHub deploy identity cannot poll the update operation. Manual deployment must verify operation-read permissions for the identity used with `yc`.
- **ASSUMPTION-001:** The existing COI VM and its root-only runtime env files remain the target environment.
- **ASSUMPTION-002:** Local commits are sufficient release provenance; no source push to GitHub is part of this workflow.

## Related Specifications / Further Reading

- [Yandex Container Registry authentication](https://yandex.cloud/en/docs/container-registry/operations/authentication)
- [Pushing images to Yandex Container Registry](https://yandex.cloud/en/docs/container-registry/operations/docker-image/docker-image-push)
- [Running registry images on a COI VM](https://yandex.cloud/en/docs/cos/quickstart)
- [Current Yandex deployment runbook](docs/deployment/yandex-cloud.md)
<<<RALPHEX:END>>>
