# Yandex Container Registry and Manual COI Deployment

## Overview

Replace the GHCR-based release path for your local checkout with a repeatable local release and manual deployment process. Build and validate the images locally, push them to Yandex Container Registry using an immutable commit SHA, and update the existing COI VM with `yc`. Preserve SHA-based rollback.

The implementation fixes the earlier web TypeScript and Keycloak Docker
build-context failures and adds the local Yandex release and manual deployment
workflow.

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
- [x] Run web lint, typecheck, tests, and production build.
- [x] Build the Keycloak image with the repository root as context.

**Verification note:** The first full web run found 18 failures. One test
looked for a missing-value navigation control while its containing process
status popover was closed; after opening the popover, the test also needed to
wait for the deferred row reveal and `scrollIntoView` call. Two location page
assertions expected stale fixture values. The other 15 failures correctly
flagged user-facing Russian strings outside the shared translation catalog;
those strings were centralized, while two documented internal matching tokens
were explicitly exempted. Web lint, typecheck, production build, and the full
suite now pass: 2,321 passed, 4 skipped.

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
simulation environments. The complete release run passed Go formatting, vet,
race, and integration checks; economics Ruff and 119 tests; simulation's 679
tests; and web lint, typecheck, production build, and 2,321 tests (4 skipped).
OrbStack, Buildx, authenticated registry access, and the VM target platform
were verified. The VM uses `standard-v3`, an Intel platform mapped to
`linux/amd64` by [Yandex's platform documentation](
https://yandex.cloud/en/docs/compute/concepts/vm-platforms).
All seven images were pushed successfully, confirming publisher access. The
documented SSH key is absent; VM pull access and Compute operation polling
access remain unverified.

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
- [x] Verify through the existing VM access path that all running images use
      the requested SHA.
- [x] Support rollback by invoking the same command with a retained prior SHA.
- [x] Test rendering, invalid inputs, command failures, and success paths with
      stubbed commands.

**Verification note:** Shell syntax and stubbed deployment-command tests passed.
The first live attempt exposed a compatibility issue: Compose v2 normalized
`env_file` strings into mapping objects, which the COI daemon rejects. The
script now uses Compose to validate local placeholder paths, then sends the
canonical spec with the registry ID and SHA substituted. The corrected spec
was accepted and deployed to `brobots-demo` (`fhmig77p6hrqum1j7hg0`). SSH
verification confirmed all seven running images use the requested SHA. After
the script fix, the complete deploy command also returned its success signal.

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
Image publication confirmed publisher access. VM pull access is granted to
the attached `brobots-vm-puller` service account. The deployment identity
successfully polled the update operation.

### Task 6: Verify acceptance criteria

- [x] Run the full local service checks and all seven `linux/amd64` image
      builds.
- [x] Confirm each image is present in Yandex Container Registry under the
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
was verified for all seven repositories: `brobots-api`, `brobots-simulation`,
`brobots-economics`, `brobots-web`, `brobots-keycloak`, `brobots-gateway`, and
`brobots-postgres`. Each carries tag
`ada1b300f5931747f63630e2e05dd28add3bfdf1`. Full service checks passed and all
seven `linux/amd64` images were built and pushed. Deployment to `brobots-demo`
(`fhmig77p6hrqum1j7hg0`) was verified over SSH: all seven app containers run
tag `ada1b300f5931747f63630e2e05dd28add3bfdf1` and report healthy. Both
migration containers exited with code 0. The `/healthz`, web, and OIDC
endpoints each returned HTTP 200. The VM pulls through attached service account
`brobots-vm-puller`, which has the registry puller role. The web production
bundle's main JavaScript chunk is 323.67 KB gzip, above the documented 300 KB
target, and needs separate performance follow-up.

## Post-Completion Manual Checklist

- [x] Repair OrbStack/Docker socket access and install Buildx on the Mac.
- [x] Use the active `brobots` registry (`crprb9kftitj4diu2jru`) in the
      deployment folder.
- [x] Verify publisher access by pushing all seven release images.
- [x] Grant the VM’s attached service account
      `container-registry.images.puller` on the registry.
- [x] Confirm the deployment identity can update the instance and read the
      resulting Compute operation.
- [x] Publish, deploy, and verify the new SHA. Keep rollback available if
      needed.

## Alternatives

- **ALT-001:** Keep GHCR and GitHub Actions. Not selected because you no longer have repository access.
- **ALT-002:** Switch to SSH-managed Docker Compose on the VM. Not selected because it changes the existing COI runtime model.
- **ALT-003:** Build on a temporary Yandex VM. Not selected because you chose to repair local Docker and Buildx.

## Dependencies

- A working local Docker engine and Buildx installation.
- `yc` authenticated to the Yandex Cloud folder containing the VM and registry.
- Registry push permission for your account and pull permission for the VM’s
  attached service account.
- SSH access to inspect running image tags after deployment.

## Risks & Assumptions

- **RISK-001:** The production web bundle's main JavaScript chunk is 323.67 KB
  gzip, above the documented 300 KB target.
- **RISK-002:** The Mac is `arm64`; the VM uses Intel `standard-v3`, so builds
  must target `linux/amd64`.
- **ASSUMPTION-001:** The existing COI VM and its root-only runtime env files remain the target environment.
- **ASSUMPTION-002:** Local commits are sufficient release provenance; no source push to GitHub is part of this workflow.

## Related Specifications / Further Reading

- [Yandex Container Registry authentication](https://yandex.cloud/en/docs/container-registry/operations/authentication)
- [Pushing images to Yandex Container Registry](https://yandex.cloud/en/docs/container-registry/operations/docker-image/docker-image-push)
- [Running registry images on a COI VM](https://yandex.cloud/en/docs/cos/quickstart)
- [Current Yandex deployment runbook](docs/deployment/yandex-cloud.md)
<<<RALPHEX:END>>>
