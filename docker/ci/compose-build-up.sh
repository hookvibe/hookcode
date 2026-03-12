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
# Keep CI deployments on backend/frontend/db only so no Docker worker is started implicitly. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
services=(db backend frontend)
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" down --remove-orphans
docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" up -d --build "${services[@]}"

# Wait for backend to be running/healthy so CI fails fast on startup crashes. docs/en/developer/plans/ci-backend-start-20260310/task_plan.md ci-backend-start-20260310
backend_container="$(docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" ps -q backend)"
if [[ -z "${backend_container}" ]]; then
  echo "[ci] ERROR: backend container not found after compose up"
  docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" ps
  docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" logs backend || true
  exit 1
fi

health_deadline=$((SECONDS + 120))
while true; do
  status="$(docker inspect -f '{{.State.Status}}' "${backend_container}" 2>/dev/null || true)"
  if [[ "${status}" != "running" ]]; then
    exit_code="$(docker inspect -f '{{.State.ExitCode}}' "${backend_container}" 2>/dev/null || echo 'unknown')"
    echo "[ci] ERROR: backend container status=${status} exit=${exit_code}"
    docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" logs backend || true
    exit 1
  fi

  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${backend_container}" 2>/dev/null || true)"
  if [[ -z "${health}" || "${health}" == "healthy" ]]; then
    echo "[ci] backend container is healthy"
    break
  fi

  if [[ "${SECONDS}" -ge "${health_deadline}" ]]; then
    echo "[ci] ERROR: backend healthcheck timed out (status=${health})"
    docker compose -p "${project_name}" -f "${docker_dir}/docker-compose.yml" logs backend || true
    exit 1
  fi

  sleep 2
done

echo "[ci] docker compose stack is up (${services[*]})"
