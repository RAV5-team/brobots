# Yandex Cloud Deployment

This runbook deploys the Brobots public demo to one Yandex Compute Cloud
Container Optimized Image (COI) virtual machine. Docker Compose defines the
runtime services; GitHub Actions builds and publishes images to private GHCR,
then a manually started deployment workflow updates the VM.

[TOC]

## Deployment status

The demo VM, static IP, firewall group, snapshot schedule, deployment service
account, and GitHub workload identity federation are provisioned. Required
GitHub repository variables and VM runtime configuration are in place.

## Architecture

The demo runs on one COI VM with one persistent `pgdata` Docker volume. Nginx
is the only public application entry point and handles HTTPS, ACME challenges,
and the Keycloak admin CIDR restriction. PostgreSQL, API, simulation, economics,
Keycloak, and the web app have no host-published ports. The demo database is
disposable and contains synthetic/demo data only.

The deployment workflow uses GitHub OIDC workload identity federation (WIF)
to obtain a short-lived Yandex IAM token. The VM uses a root-owned Docker login
with a GHCR token that has only `read:packages`; workflow credentials are not
copied to the VM. Runtime values live in root-only files under `/etc/brobots`
and never in the Compose specification or VM metadata.

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
| Deployment service account | `brobots-github-deploy` (`ajeucl63c33umdud1tv5`) | `compute.editor` on this instance only |
| GitHub federation | `brobots-github` (`ajes12h0pr61dm6tel1p`) | GitHub Actions issuer, audience `https://github.com/RAV5-team` |
| Federated credential | `ajeboii3b7evc90h3u5i` | Subject `repo:RAV5-team/brobots:environment:production` |

The VM accepts key-only SSH from the operator's current public IPv4 CIDR. The
generated private key is in the ignored repository path
`.deployment/keys/yc-brobots-ed25519`; keep it private and back it up securely.
If the operator's public IP changes, update the SSH ingress rule before the
next connection. The instance update operation used by deployment is
`yc compute instance update-container --docker-compose-file`.

Certbot 5.8.0 is installed, the short-lived IP certificate is active, and the
renewal timer is enabled. A dry-run renewal succeeded. The VM currently runs
only the COI bootstrap placeholder; the application Compose stack has not been
deployed.

## Configure GitHub

Set these repository variables for the provisioned resources:

| Variable | Value |
| --- | --- |
| `YC_INSTANCE_ID` | `fhmig77p6hrqum1j7hg0` |
| `YC_SERVICE_ACCOUNT_ID` | `ajeucl63c33umdud1tv5` |
| `YC_FOLDER_ID` | `b1gralifrlhh1ata3enc` |
| `YC_CLOUD_ID` | `b1g5n0nr3hp6dagcl2cv` |
| `PUBLIC_URL` | `https://93.77.188.244` |
| `WEB_DEMO_MODE` | `false` until disposable demo credentials are configured |
| `WEB_DEMO_USER_EMAIL` | Public demo user's email when demo mode is enabled |
| `WEB_DEMO_USER_PASSWORD` | Public demo user's password when demo mode is enabled |
| `WEB_DEMO_ADMIN_EMAIL` | Public demo admin email when demo mode is enabled |
| `WEB_DEMO_ADMIN_PASSWORD` | Public demo admin password when demo mode is enabled |

Demo credentials are embedded in browser-delivered JavaScript when demo mode is
enabled, so use disposable accounts with synthetic data. Do not treat these
values as secrets.

Protect the GitHub `production` environment with required reviewers if the
repository plan supports it. Deployment is manual: start the `deploy.yml`
workflow from `main` and supply the full 40-character image commit SHA. The
workflow rejects other refs and refuses deployment until the integration
prerequisite variable is explicitly set to `true`.

Protect `main` with required status checks for the API, economics, and
`release-images` workflows. The release workflow runs the service checks,
verifies generated OpenAPI contracts, validates the COI Compose file, then
builds and publishes the complete image set. Do not let a merge bypass these
checks.

The `release-images.yml` workflow tests the services and, on `main`, publishes
all runtime images with the source commit SHA as the tag. Pull requests build
the images without publishing them.

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
ADMIN_ALLOW_CIDR=<administrator-ip>/32
```

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
```

URL-encode reserved characters in database passwords used inside URLs. Apply
`chown root:root` and `chmod 0600` to every file after creation.

Create a GitHub classic personal access token with `read:packages` for the
repository owner. Log in to GHCR on the VM as root; do not put this token into
the Compose file or instance metadata:

```bash
sudo docker login ghcr.io --username <github-user> --password-stdin
```

Paste the token to standard input when prompted. Docker stores credentials in
`/root/.docker/config.json`; keep that file readable by root only and rotate
the token when the operator account changes.

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

## Deploy and operate

Start the `deploy.yml` workflow from `main`, select the `production`
environment, and enter a commit SHA produced by `release-images.yml`. The
workflow verifies the SHA format, renders `docker-compose.coi.yml` with
immutable image references, authenticates to Yandex Cloud using GitHub OIDC,
and updates the selected VM.

COI updates modified containers and leaves unchanged containers running. A
one-VM rollout may briefly interrupt requests. Keep the previous working SHA
available for rollback. To roll back, run the deploy workflow with that SHA.

Useful operator checks on the VM:

```bash
sudo docker ps
sudo docker logs --tail 200 rav5-gateway
sudo docker exec rav5-gateway nginx -t
curl --fail https://<public-ip>/healthz
```

Confirm that `https://<public-ip>/` serves the web application and
`https://<public-ip>/auth/realms/rav5/.well-known/openid-configuration`
returns the Keycloak realm metadata. Confirm that ports 8000, 8765, 5432, and
8002 are not reachable from outside the VM.

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
- [Yandex Cloud workload identity federation](https://yandex.cloud/en/docs/iam/concepts/workload-identity)
- [GitHub Actions environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Container Registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
