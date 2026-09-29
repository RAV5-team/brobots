# syntax=docker/dockerfile:1
FROM postgres:17-alpine

# COI deployments do not use repository bind mounts. Keep first-boot role and
# database initialization inside the versioned image.
COPY init/ /docker-entrypoint-initdb.d/
