#!/usr/bin/env bash
# Validate the planning_recorder agent contract and retired skill entrypoint. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
AGENT_TOML="${REPO_ROOT}/.codex/agents/planning_recorder.toml"
AGENTS_FILE="${REPO_ROOT}/AGENTS.md"

python3 - "${AGENT_TOML}" <<'PY'
import sys
import tomllib
from pathlib import Path

path = Path(sys.argv[1])
data = tomllib.loads(path.read_text(encoding="utf-8"))

expected_name = "planning_recorder"
if data.get("name") != expected_name:
    raise SystemExit(f"FAIL: expected name={expected_name!r}, got {data.get('name')!r}")

instructions = data.get("developer_instructions", "")
required_tokens = [
    "INIT_SESSION",
    "SYNC_FINDINGS",
    "SYNC_PROGRESS",
    "FINALIZE_SESSION",
    "docs/en/change-log/0.0.0.md",
    "Business code, tests, migrations, package manifests, or build config",
    ".codex/agents/planning-recorder/scripts/init-session.sh",
]
for token in required_tokens:
    if token not in instructions:
        raise SystemExit(f"FAIL: developer_instructions missing token: {token}")
PY

if [ -e "${REPO_ROOT}/.codex/skills/file-context-planning/SKILL.md" ]; then
    echo "FAIL: retired skill entrypoint still exists"
    exit 1
fi

if ! rg -n --fixed-strings 'planning_recorder' "${AGENTS_FILE}" >/dev/null; then
    echo "FAIL: AGENTS.md does not mention planning_recorder"
    exit 1
fi

if rg -n --fixed-strings '.codex/skills/file-context-planning/scripts/' "${AGENTS_FILE}" >/dev/null; then
    echo "FAIL: AGENTS.md still points at retired file-context-planning script paths"
    exit 1
fi

if rg -n --fixed-strings '.codex/skills/file-context-planning' \
  "${REPO_ROOT}/.codex/agents/planning-recorder/examples.md" \
  "${REPO_ROOT}/.codex/agents/planning-recorder/reference.md" \
  "${REPO_ROOT}/.codex/agents/planning-recorder/scripts/" \
  --glob '!agent-config.test.sh' >/dev/null; then
    echo "FAIL: planning-recorder assets still reference retired skill paths"
    exit 1
fi

echo "PASS"
