#!/usr/bin/env bash
# Append a changelog entry for a planning session.
# Add session hash + summary + relative plan link to docs/en/change-log/0.0.0.md. sddsa89612jk4hbwas678
#
# Usage:
#   bash .codex/skills/planning-with-files/scripts/append-changelog.sh "<session-hash>" "<one-line-summary>"
#
# Output:
# - Updates docs/en/change-log/0.0.0.md (current version) with a markdown bullet linking to the plan.

set -euo pipefail

SESSION_HASH="${1:-}"
SUMMARY="${2:-}"

if [ -z "${SESSION_HASH}" ] || [ -z "${SUMMARY}" ]; then
    echo "ERROR: missing arguments"
    echo "Usage:"
    echo "  bash .codex/skills/planning-with-files/scripts/append-changelog.sh \"<session-hash>\" \"<one-line-summary>\""
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CHANGELOG_FILE="${REPO_ROOT}/docs/en/change-log/0.0.0.md"

if [ ! -f "${CHANGELOG_FILE}" ]; then
    echo "ERROR: changelog not found: ${CHANGELOG_FILE}"
    exit 1
fi

PLAN_REL_LINK="../developer/plans/${SESSION_HASH}/task_plan.md"
ENTRY="- ${SUMMARY} ([${SESSION_HASH}](${PLAN_REL_LINK}))"

if rg -n --fixed-strings "${SESSION_HASH}" "${CHANGELOG_FILE}" >/dev/null 2>&1; then
    echo "Changelog already contains session hash: ${SESSION_HASH}"
    exit 0
fi

if ! rg -n --fixed-strings "## Changes" "${CHANGELOG_FILE}" >/dev/null 2>&1; then
    printf "\n## Changes\n" >> "${CHANGELOG_FILE}"
fi

printf "\n%s\n" "${ENTRY}" >> "${CHANGELOG_FILE}"
echo "Appended changelog entry to: ${CHANGELOG_FILE}"
