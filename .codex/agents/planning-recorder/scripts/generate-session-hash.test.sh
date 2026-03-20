#!/usr/bin/env bash
# Verify that the shared session-hash helper emits a filesystem-safe value for async recorder startup. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATOR="${SCRIPT_DIR}/generate-session-hash.sh"

HASH_A="$(bash "${GENERATOR}")"
HASH_B="$(bash "${GENERATOR}")"

if ! [[ "${HASH_A}" =~ ^[a-z0-9]{20}$ ]]; then
  echo "FAIL: first generated hash is not 20 lowercase alphanumeric characters: ${HASH_A}"
  exit 1
fi

if ! [[ "${HASH_B}" =~ ^[a-z0-9]{20}$ ]]; then
  echo "FAIL: second generated hash is not 20 lowercase alphanumeric characters: ${HASH_B}"
  exit 1
fi

if [ "${HASH_A}" = "${HASH_B}" ]; then
  echo "FAIL: generated hashes should not be identical in consecutive calls"
  exit 1
fi

echo "PASS"
