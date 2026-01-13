#!/usr/bin/env bash
# Initialize planning files for a new session (Codex-compatible).
# Usage: bash .codex/skills/planning-with-files/scripts/init-session.sh [project-name]

set -euo pipefail

PROJECT_NAME="${1:-project}"
DATE="$(date +%Y-%m-%d)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(cd "${SCRIPT_DIR}/../templates" && pwd)"

echo "Initializing planning files for: ${PROJECT_NAME}"
echo "Using templates from: ${TEMPLATE_DIR}"

copy_if_missing() {
    local src_file="$1"
    local dest_file="$2"

    if [ -f "${dest_file}" ]; then
        echo "${dest_file} already exists, skipping"
        return 0
    fi

    if [ ! -f "${src_file}" ]; then
        echo "ERROR: Template not found: ${src_file}"
        exit 1
    fi

    cp "${src_file}" "${dest_file}"
    echo "Created ${dest_file}"
}

# Create planning files in the current working directory (project root).
copy_if_missing "${TEMPLATE_DIR}/task_plan.md" "task_plan.md"
copy_if_missing "${TEMPLATE_DIR}/findings.md" "findings.md"
copy_if_missing "${TEMPLATE_DIR}/progress.md" "progress.md"

echo ""
echo "Planning files initialized!"
echo "Files: task_plan.md, findings.md, progress.md"
echo "Tip: Replace placeholders like [DATE] with ${DATE} as needed."
