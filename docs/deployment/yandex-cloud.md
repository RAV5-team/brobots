# Yandex Cloud Deployment

This runbook deploys the Brobots public demo to one Yandex Compute Cloud
Container Optimized Image (COI) virtual machine. Docker Compose defines the
runtime services. Local scripts build and publish images to Yandex Container
Registry, then manually update the VM while retaining SHA-based rollback.

[TOC]

## Deployment status

The demo VM, static IP, firewall group, snapshot schedule, deployment service
account, and GitHub workload identity federation are provisioned. The local
manual release path does not use GitHub repository variables or federation.

## Architecture

The demo runs on one COI VM with one persistent `pgdata` Docker volume. Nginx
is the only public application entry point and handles HTTPS and ACME
challenges. On this demo VM, the Keycloak admin routes allow all IPv4 addresses;
use a narrow CIDR for any deployment that should restrict console access.
PostgreSQL, API, simulation, economics, Keycloak, and the web app have no
host-published ports. The demo database is disposable and contains
synthetic/demo data only.

The local operator's authenticated `yc` profile publishes images using
`container-registry.images.pusher`. The VM's attached service account pulls
images using `container-registry.images.puller`; no registry password is
stored on the VM. Secrets live in root-only files under `/etc/brobots`. The
non-secret Keycloak admin CIDR policy is set in the COI Compose specification.

## Provisioned Yandex Cloud resources

The low-cost demo resources are in cloud `my-cloud-alewkinr`, folder `basic`,
zone `ru-central1-a`.

| Resource | Name or ID | Configuration |
| --- | --- | --- |
| Compute instance | `brobots-demo` (`fhmig77p6hrqum1j7hg0`) | COI, 2 vCPU at 20% core fraction, 8 GiB RAM, 60 GiB network HDD |
| Public IPv4 | `93.77.188.244` (`e9bh0pq9684seme242r3`) | Reserved and attached to the instance |
| Security group | `brobots-coi` (`enpr7dj462i48lkh07ih`) | TCP 22 from `136.152.214.145/32`; TCP 80 and 443 from `0.0.0.0/0` |
| Network and subnet | `enp3dtos894gk9ghbv4m`, `e9b9bsgsdksc15u9c9t3` | Existing network and subnet reused |
| Snapshot schedule | `brobots-daily-7d` (`fd837bgckei9e4l5i3p1`) | Daily boot-disk snapshots, seven-day retention |
| Deployment service account | `brobots-github-deploy` (`ajeucl63c33umdud1tv5`) | Provisioned with `compute.editor` on this instance; not used by the local manual process |
| GitHub federation | `brobots-github` (`ajes12h0pr61dm6tel1p`) | Provisioned WIF pool; unused by the local manual process |
| Federated credential | `ajeboii3b7evc90h3u5i` | Provisioned for `repo:RAV5-team/brobots:environment:production`; unused by the local manual process |
| Container Registry | `brobots` (`crprb9kftitj4diu2jru`) | Active in folder `b1gralifrlhh1ata3enc`; publisher/puller bindings remain to be verified |

The VM accepts key-only SSH from the operator's current public IPv4 CIDR. The
generated private key is in the ignored repository path
`.deployment/keys/yc-brobots-ed25519`; keep it private and back it up securely.
If the operator's public IP changes, update the SSH ingress rule before the
next connection. The instance update operation used by deployment is
`yc compute instance update-container --docker-compose-file`. The operator
identity must also be able to read and wait for the resulting Compute
operation. The minimum role for operation polling has not been verified; test
`yc operation get` and `yc operation wait` with the deployment identity before
relying on it. The known `compute.editor` instance binding does not prove
operation polling access.

Certbot 5.8.0 is installed, the short-lived IP certificate is active, and the
renewal timer is enabled. A dry-run renewal succeeded. The VM currently runs
only the COI bootstrap placeholder; the application Compose stack has not been
deployed.

## Prepare local publishing and deployment

Use a local Docker engine on macOS, such as OrbStack or Docker Desktop. Start
the engine and confirm that the active Docker context reaches it with
`docker info`. Install or enable Docker Buildx and confirm `docker buildx
version` succeeds. The release script also runs `docker buildx inspect
--bootstrap` and requires the builder to advertise the verified VM platform.
OrbStack's Docker socket must be accessible to the current user.

Install Python 3.12 and `jq`. On macOS with Homebrew, install `jq` if needed
with `brew install jq`, then confirm `jq --version` succeeds. Create separate
virtual environments from the repository's development requirements so the
economics Ruff version and simulation pytest version both remain available:

```bash
mkdir -p "$HOME/.venvs"
python3.12 -m venv "$HOME/.venvs/brobots-economics"
python3.12 -m venv "$HOME/.venvs/brobots-simulation"
"$HOME/.venvs/brobots-economics/bin/python" -m pip install \
  -r services/economics/requirements-dev.txt
"$HOME/.venvs/brobots-simulation/bin/python" -m pip install \
  -r services/simulation/requirements-dev.txt
export PATH="$HOME/.venvs/brobots-simulation/bin:$HOME/.venvs/brobots-economics/bin:$PATH"
export ECONOMICS_PYTEST="$HOME/.venvs/brobots-economics/bin/pytest"
export SIMULATION_PYTEST="$HOME/.venvs/brobots-simulation/bin/pytest"
ruff --version
"$ECONOMICS_PYTEST" --version
"$SIMULATION_PYTEST" --version
```

Keep the simulation venv first in `PATH`: its `requirements-dev.txt` installs
`pytest>=9.1`, while economics uses `pytest>=8.3,<9.0`. Ruff is installed by
the economics development requirements and is invoked from `PATH`. The release
script uses `ECONOMICS_PYTEST` and `SIMULATION_PYTEST` to run each service's
pytest version.

Install the Yandex Cloud CLI and authenticate the `yc` profile used to update
the instance. Run `yc init` if the CLI profile is not configured. Confirm
`yc iam create-token >/dev/null` and `yc container registry list` work in that
profile.
Find the intended registry in the deployment folder:

```bash
yc container registry list --folder-id b1gralifrlhh1ata3enc
yc container registry get <registry-id>
```

Use the active `brobots` registry (`crprb9kftitj4diu2jru`) in that folder. It
was created on 2026-09-29 and verified `ACTIVE`. Grant the local operator
identity `container-registry.images.pusher` on the registry and the VM's
attached service account `container-registry.images.puller` on the registry.
Check the Compute update and operation-read permissions with the same identity
that will run the local deployment. See [Yandex Container Registry roles](https://yandex.cloud/en/docs/container-registry/security/),
[Compute IAM roles](https://yandex.cloud/en/docs/compute/security/), and
[Yandex CLI operation wait](https://yandex.cloud/en/docs/cli/cli-ref/operation/cli-ref/wait).

`yc container registry configure-docker` configures local Docker
authentication for Yandex Container Registry. The release script invokes this
command after checking the selected registry. Do not copy local credentials to
the VM; the attached service account supplies its registry pull identity.

Before publishing, verify the instance's target platform and test operation
polling with the deployment identity. `yc compute instance update-container`
returns a Compute operation; `yc operation get <operation-id>` inspects it and
`yc operation wait <operation-id>` waits for completion. The update command
and operation polling are separate permission checks. The known `compute.editor`
binding is scoped to the VM; no minimum operation-poll role is asserted here.
If either read or wait fails, resolve the identity's access before deploying.

The existing GitHub federation pool, credential, and deployment service
account remain provisioned resources. The local release and deploy commands do
not use GitHub Actions, GitHub repository variables, WIF, or the provisioned
GitHub federated identity.

## Prepare the VM

Use SSH key authentication only. Keep password authentication and root SSH
login disabled. Create the runtime directory and private environment files:

```bash
sudo install -d -m 700 -o root -g root /etc/brobots
sudo install -d -m 755 -o root -g root /var/lib/brobots/acme
```

Create the following files as root with mode `0600`. Values below describe the
required keys; passwords and secrets must be generated uniquely for this
deployment. Avoid shell history and command-line arguments when entering
secret values.

`/etc/brobots/postgres.env`:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<unique-long-random-value>
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=<unique-long-random-value>
API_DB_USERNAME=api
API_DB_PASSWORD=<unique-long-random-value>
SIM_DB_USERNAME=simulation
SIM_DB_PASSWORD=<unique-long-random-value>
ECON_DB_USERNAME=economics
ECON_DB_PASSWORD=<unique-long-random-value>
```

`/etc/brobots/keycloak.env`:

```dotenv
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=<same-keycloak-database-password>
KC_HOSTNAME=https://<public-ip>/auth
KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true
KC_HTTP_ENABLED=true
KC_PROXY_HEADERS=xforwarded
KC_BOOTSTRAP_ADMIN_USERNAME=<unique-admin-name>
KC_BOOTSTRAP_ADMIN_PASSWORD=<unique-long-random-value>
PUBLIC_URL=https://<public-ip>
KC_API_INTERNAL_SECRET=<unique-long-random-value>
DEMO_USER_PASSWORD=<unique-long-random-value>
DEMO_ADMIN_PASSWORD=<unique-long-random-value>
```

`/etc/brobots/gateway.env`:

```dotenv
PUBLIC_HOST=<public-ip>
```

The COI Compose spec sets `ADMIN_ALLOW_CIDR=0.0.0.0/0` directly. This makes
Keycloak's admin routes publicly reachable over IPv4. Changing this value in
an existing deployment requires recreating `rav5-gateway` so Nginx renders the
updated setting. For a restricted deployment, set the administrator's public
IPv4 CIDR in `docker-compose.coi.yml`, such as `<administrator-ip>/32`.

`/etc/brobots/api.env`:

```dotenv
APP_ENV=production
LOG_LEVEL=info
HTTP_ADDR=:8000
DATABASE_URL=postgres://api:<url-encoded-password>@postgres:5432/api?sslmode=disable
MIGRATE_ON_START=true
SEED_DEMO=true
SWAGGER_ENABLED=false
SIMULATION_URL=http://simulation:8765
ECONOMICS_URL=http://economics:8002
ECONOMICS_TIMEOUT=10s
OIDC_ISSUER=https://<public-ip>/auth/realms/rav5
OIDC_JWKS_URL=http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/certs
OIDC_AUDIENCE=rav5-api
AUTH_DEV_MODE=false
```

`/etc/brobots/simulation.env`:

```dotenv
DATABASE_URL=postgresql://simulation:<url-encoded-password>@postgres:5432/simulation
PORT=8765
SIM_WORKERS=1
OIDC_ISSUER=https://<public-ip>/auth/realms/rav5
OIDC_JWKS_URL=http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/certs
OIDC_AUDIENCE=rav5-sim
INTERNAL_CALLER_AZP=rav5-api-internal
APP_ENV=production
AUTH_DEV_MODE=false
```

`/etc/brobots/economics.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://economics:<url-encoded-password>@postgres:5432/economics
ECONOMIC_SERVICE_ENV=production
OIDC_ISSUER=https://<public-ip>/auth/realms/rav5
OIDC_JWKS_URL=http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/certs
OIDC_AUDIENCE=rav5-economics
INTERNAL_CALLER_AZP=rav5-api-internal
```

URL-encode reserved characters in database passwords used inside URLs. Apply
`chown root:root` and `chmod 0600` to every file after creation.

## Obtain the initial TLS certificate

Before starting the Compose stack, install Certbot 5.4 or later on the COI host
and request the initial IP-address certificate while port 80 is free. IP
certificates use Let’s Encrypt’s `shortlived` profile and expire after about
six days, so automatic renewal is required. The static public IP must already
be attached to the VM and reachable on port 80.

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv libaugeas-dev gcc
sudo python3 -m venv /opt/certbot
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install 'certbot>=5.4'
sudo ln -s /opt/certbot/bin/certbot /usr/local/bin/certbot
certbot --version
sudo certbot certonly --standalone --preferred-profile shortlived \
  --ip-address <public-ip> --agree-tos --no-eff-email \
  --email <operations-email>
```

After the first stack deployment, renewal uses the Nginx webroot challenge.
Install `infra/deploy/brobots-certbot.service` and
`infra/deploy/brobots-certbot.timer` as systemd units, install
`infra/deploy/renew-certificates.sh` as `/usr/local/sbin/brobots-renewed`,
then enable the timer with `systemctl daemon-reload` and
`systemctl enable --now brobots-certbot.timer`. Reconfigure the certificate to
use the Nginx webroot challenge and keep its IP and short-lived profile:

```bash
sudo certbot reconfigure --cert-name <public-ip> \
  --preferred-profile shortlived --webroot \
  --webroot-path /var/lib/brobots/acme --ip-address <public-ip> \
  --deploy-hook /usr/local/sbin/brobots-renewed
sudo certbot renew --dry-run
```

The systemd service runs `certbot renew` twice a day. The deploy hook reloads
Nginx only after a successful renewal. Confirm the certificate is renewed
automatically before relying on it for public access.

## Release, deploy, verify, and roll back

Run these commands from a clean checkout on the Mac with Docker/Buildx and an
authenticated `yc` profile. The release script requires test database URLs
and a verified target platform. Its web build defaults `WEB_DEMO_MODE` to
`false`; configure optional `VITE_*` values only when using disposable demo
accounts. Demo credentials are embedded in browser-delivered JavaScript when
demo mode is enabled, so do not use real credentials.

Use registry ID `crprb9kftitj4diu2jru`. Keep the full commit SHA used for
publication; rollback deploys a previously published full SHA using the same
deploy command.

### Ordered operator commands

1. Configure deployment values and test database URLs. `TARGET_PLATFORM` must
   match the VM platform verified by the operator. Do not set
   `TARGET_PLATFORM_VERIFIED=true` until that check is complete.

   ```bash
   export YC_REGISTRY_ID='crprb9kftitj4diu2jru'
   export YC_INSTANCE_ID='fhmig77p6hrqum1j7hg0'
   export YC_FOLDER_ID='b1gralifrlhh1ata3enc'
   export YC_CLOUD_ID='b1g5n0nr3hp6dagcl2cv'
   export PUBLIC_URL='https://93.77.188.244'
   export TARGET_PLATFORM='<verified-linux-platform>'
   export TARGET_PLATFORM_VERIFIED='false'
   export TEST_DATABASE_URL='<api-test-postgres-url>'
   export POSTGRES_TEST_DATABASE_URL='<economics-test-postgres-url>'
   export SIMULATION_TEST_DATABASE_URL='<simulation-test-postgres-url>'
   export WEB_DEMO_MODE='false'
   ```

   The release script builds the web image for the API service and configures
   Keycloak OIDC from `PUBLIC_URL` with client ID `rav5-web`.

   For demo mode, set `WEB_DEMO_MODE=true` and provide any needed
   `VITE_DEMO_USER_EMAIL`, `VITE_DEMO_USER_PASSWORD`,
   `VITE_DEMO_ADMIN_EMAIL`, `VITE_DEMO_ADMIN_PASSWORD`, and
   `VITE_PUBLIC_SITE_URL`. These build arguments are included in browser code;
   use disposable demo accounts only.

2. Check local prerequisites, registry access, and the instance platform. The
   registry ID must resolve, and the release script checks registry access,
   Docker, Buildx, and platform support before running service checks.

   ```bash
   docker info
   docker buildx version
   jq --version
   yc iam create-token >/dev/null
   yc container registry list --folder-id "$YC_FOLDER_ID"
   yc container registry get "$YC_REGISTRY_ID"
   yc container registry configure-docker
   yc compute instance get "$YC_INSTANCE_ID" --folder-id "$YC_FOLDER_ID"
   ```

   Read the VM guest architecture over the same SSH path used for deployment
   and map it to the Buildx platform:

   ```bash
   VM_ARCH=$(ssh -i .deployment/keys/yc-brobots-ed25519 \
     yc-user@93.77.188.244 uname -m)
   case "$VM_ARCH" in
     x86_64) export TARGET_PLATFORM='linux/amd64' ;;
     aarch64) export TARGET_PLATFORM='linux/arm64' ;;
     *) printf 'Unsupported VM architecture: %s\n' "$VM_ARCH" >&2; exit 1 ;;
   esac
   ```

   The command maps `x86_64` to `linux/amd64` and `aarch64` to `linux/arm64`.
   For any other output, stop and resolve the platform before release. If SSH
   uses `YC_SSH_USER` or `YC_SSH_KEY` overrides, use those same values for
   this check. Confirm the selected Buildx builder advertises the mapped
   platform:

   ```bash
   docker buildx inspect --bootstrap
   ```

   ```bash
   export TARGET_PLATFORM_VERIFIED='true'
   ```

   To verify operation access in advance, use an operation ID created by this
   identity:

   ```bash
   yc operation get <operation-id>
   yc operation wait <operation-id>
   ```

   The minimum operation polling role is unknown; verify both commands.
   `compute.editor` is the known instance update binding and does not prove
   operation polling access.

3. Release all seven images from a clean current commit. The script refuses a
   dirty checkout or any SHA other than the current commit SHA.

   ```bash
   RELEASE_SHA=$(git rev-parse HEAD)
   infra/deploy/release-yandex-images.sh "$RELEASE_SHA"
   ```

   Success ends with `Published all seven images for <sha> to cr.yandex/<id>`.
   The script runs service checks, then builds and pushes each image with the
   same full SHA. Do not report publication as successful unless it exits zero.

4. Deploy that SHA to the COI VM. The command renders and validates the COI
   Compose file, starts `yc compute instance update-container` asynchronously,
   waits for its operation, then checks public health and SSH-visible running
   image tags.

   ```bash
   infra/deploy/deploy-yandex-images.sh "$RELEASE_SHA"
   ```

   A successful command prints `Deployment verified for SHA <sha>`. It fails
   if operation polling fails, public health endpoints fail, or running image
   tags do not match the requested registry and SHA.

5. Verify the public application endpoints and keep private service ports
   unreachable from outside the VM:

   ```bash
   curl --fail "$PUBLIC_URL/healthz"
   curl --fail "$PUBLIC_URL/"
   curl --fail "$PUBLIC_URL/auth/realms/rav5/.well-known/openid-configuration"
   ```

   The deploy script also verifies seven running images over SSH. Useful
   operator checks on the VM:

   ```bash
   sudo docker ps
   sudo docker logs --tail 200 rav5-gateway
   sudo docker exec rav5-gateway nginx -t
   ```

6. Roll back by using the same deploy command with a retained SHA whose images
   remain in the registry:

   ```bash
   infra/deploy/deploy-yandex-images.sh '<previous-full-commit-sha>'
   ```

   Wait for `Deployment verified for SHA <previous-full-commit-sha>` and
   repeat the public health checks. Keep earlier image tags until the new
   release has been verified.

COI updates modify containers and leave unchanged containers running. A
one-VM rollout may briefly interrupt requests. Confirm that ports 8000, 8765,
5432, and 8002 are not reachable from outside the VM.

## Backups and restore

The daily Yandex boot-disk snapshot schedule protects against VM/disk loss and
keeps seven days of snapshots. The demo database remains disposable; it is not
a point-in-time recovery service. Test a restore before depending on the
snapshots.

To restore a snapshot, stop the affected VM, create a boot disk from the
selected snapshot, and start a replacement COI VM from that disk. Verify that
the `rav5-pgdata` volume is present and PostgreSQL starts before moving the
static IP to the replacement. If the demo data is disposable, a simpler
recovery is a fresh VM disk; PostgreSQL initialization creates roles, and
service migration containers recreate the schemas on first start.

## See also

- [Yandex Cloud VM update](https://yandex.cloud/en/docs/compute/tutorials/vm-update)
- [Yandex Container Registry roles](https://yandex.cloud/en/docs/container-registry/security/)
- [Yandex Compute IAM roles](https://yandex.cloud/en/docs/compute/security/)
- [Yandex CLI operation modes](https://yandex.cloud/en/docs/cli/concepts/mode)
- [Yandex CLI operation wait](https://yandex.cloud/en/docs/cli/cli-ref/operation/cli-ref/wait)
- [Yandex Compute instance update-container](https://yandex.cloud/en/docs/compute/cli-ref/instance/update-container)
