#!/usr/bin/env bash
# Verify that the moved completion helper still detects complete and incomplete session plans. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER="${SCRIPT_DIR}/check-complete.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${TMP_DIR}/complete/docs/en/developer/plans/done"
cat > "${TMP_DIR}/complete/docs/en/developer/plans/done/task_plan.md" <<'MD'
# Task Plan: Complete
- **Created:** 2026-03-20

### Phase 1: One
- **Status:** complete

### Phase 2: Two
- **Status:** complete
MD

(
  cd "${TMP_DIR}/complete"
  git init -q
  bash "${CHECKER}" done >/dev/null
)

mkdir -p "${TMP_DIR}/incomplete/docs/en/developer/plans/todo"
cat > "${TMP_DIR}/incomplete/docs/en/developer/plans/todo/task_plan.md" <<'MD'
# Task Plan: Incomplete
- **Created:** 2026-03-20

### Phase 1: One
- **Status:** complete

### Phase 2: Two
- **Status:** pending
MD

if (
  cd "${TMP_DIR}/incomplete"
  git init -q
  bash "${CHECKER}" todo >/dev/null
); then
  echo "FAIL: incomplete task plan should not pass"
  exit 1
fi

echo "PASS"
