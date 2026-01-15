#!/usr/bin/env bash
set -euo pipefail

# CI helper: build and start the Docker Compose stack.
# Business context: CI/CD - Docker image build pipeline.
#
# Purpose:
# - Centralize docker-compose build logic under `docker/`.
# - Ensure `docker/.env` exists (generated from CI env/secrets) before `docker compose` runs.
#
# Change record:
# - 2026-01-14: Initial version (workflow calls this script instead of embedding compose logic).

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
docker_dir="${repo_root}/docker"
project_name="${HOOKCODE_COMPOSE_PROJECT_NAME:-hookcode}"

bash "${docker_dir}/ci/write-ci-env.sh" "${docker_dir}/.env"

# Important:
# - The Compose project name must be stable across runs; otherwise multiple stacks can coexist and occupy the same ports.
# - We enforce `-p hookcode` so migrating the compose file path (root -> docker/) won't change the project name.
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" down --remove-orphans
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" up -d --build

echo "[ci] docker compose stack is up"
