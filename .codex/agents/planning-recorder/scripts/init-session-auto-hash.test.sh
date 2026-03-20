#!/usr/bin/env bash
# Verify that init-session.sh can create a valid session directory without a parent-supplied hash. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SESSION="${SCRIPT_DIR}/init-session.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

cd "${TMP_DIR}"
git init -q

mkdir -p docs/en/developer/plans

HC_SKIP_DOCS_JSON_SYNC=1 bash "${INIT_SESSION}" >/dev/null

SESSION_HASH_LIST="$(find docs/en/developer/plans -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)"
SESSION_COUNT="$(printf '%s\n' "${SESSION_HASH_LIST}" | sed '/^$/d' | wc -l | tr -d ' ')"

if [ "${SESSION_COUNT}" -ne 1 ]; then
  echo "FAIL: expected exactly one generated session directory, found ${SESSION_COUNT}"
  exit 1
fi

SESSION_HASH="$(printf '%s\n' "${SESSION_HASH_LIST}" | sed -n '1p')"

if ! [[ "${SESSION_HASH}" =~ ^[a-z0-9]{20}$ ]]; then
  echo "FAIL: generated session hash is not 20 lowercase alphanumeric characters: ${SESSION_HASH}"
  exit 1
fi

for page in task_plan.md findings.md progress.md; do
  if [ ! -f "docs/en/developer/plans/${SESSION_HASH}/${page}" ]; then
    echo "FAIL: missing generated planning file docs/en/developer/plans/${SESSION_HASH}/${page}"
    exit 1
  fi
done

echo "PASS"
