#!/usr/bin/env bash
# Generate a filesystem-safe session hash for async planning_recorder startup. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320

set -euo pipefail

python3 - <<'PY'
import secrets
import string

alphabet = string.ascii_lowercase + string.digits
print("".join(secrets.choice(alphabet) for _ in range(20)))
PY
