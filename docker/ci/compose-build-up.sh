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
services=(db backend frontend)
include_worker_norm="$(echo "${HOOKCODE_DOCKER_INCLUDE_WORKER:-false}" | tr '[:upper:]' '[:lower:]' | xargs)"
# Let CI/server deployments choose between a bundled Docker worker and an externally deployed worker without maintaining separate compose files. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
if [[ "${include_worker_norm}" == "1" || "${include_worker_norm}" == "true" || "${include_worker_norm}" == "yes" || "${include_worker_norm}" == "y" || "${include_worker_norm}" == "on" ]]; then
  services+=(worker)
fi
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" down --remove-orphans
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" up -d --build "${services[@]}"

echo "[ci] docker compose stack is up (${services[*]})"
