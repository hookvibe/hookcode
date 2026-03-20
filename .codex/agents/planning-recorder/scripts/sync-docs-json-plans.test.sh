#!/usr/bin/env bash
# Smoke tests for sync-docs-json-plans.sh and init-session.sh integration. docsjsonindex20260121

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNCER="${SCRIPT_DIR}/sync-docs-json-plans.sh"
INIT_SESSION="${SCRIPT_DIR}/init-session.sh"

create_min_docs_json() {
  local target="$1"
  mkdir -p "$(dirname "${target}")"
  cat > "${target}" <<'JSON'
{
  "$schema": "https://mintlify.com/docs.json",
  "theme": "mint",
  "name": "Test Docs",
  "navigation": {
    "languages": [
      {
        "language": "en",
        "default": true,
        "tabs": [
          {
            "tab": "Developer Docs",
            "groups": [
              { "group": "Home", "pages": ["en/developer/index"] },
              { "group": "plans", "pages": ["en/developer/plans/stale"] }
            ]
          }
        ]
      }
    ]
  }
}
JSON
}

create_legacy_docs_json() {
  local target="$1"
  mkdir -p "$(dirname "${target}")"
  cat > "${target}" <<'JSON'
{
  "$schema": "https://mintlify.com/docs.json",
  "theme": "mint",
  "name": "Legacy Test Docs",
  "navigation": {
    "tabs": [
      {
        "tab": "developer",
        "groups": [
          { "group": "Developer", "pages": ["en/developer/index"] },
          { "group": "plans", "pages": ["en/developer/plans/stale"] }
        ]
      }
    ]
  }
}
JSON
}

assert_plans_group_entries() {
  local docs_json="$1"
  local expected_json="$2"
  python3 - "${docs_json}" "${expected_json}" <<'PY'
import json
import sys

docs_json_path = sys.argv[1]
expected = json.loads(sys.argv[2])

data = json.loads(open(docs_json_path, encoding="utf-8").read())
nav = data["navigation"]

languages = nav.get("languages")
if isinstance(languages, list) and languages:
    tabs = languages[0]["tabs"]
else:
    tabs = nav["tabs"]

dev_tab = next(
    t for t in tabs if isinstance(t, dict) and str(t.get("tab", "")).strip().lower() in {"developer docs", "developer"}
)
plans_group = next(
    g for g in dev_tab["groups"] if isinstance(g, dict) and str(g.get("group", "")).strip().lower() == "plans"
)
pages = plans_group["pages"]

if pages != expected:
    raise SystemExit(
        "FAIL: pages mismatch\n"
        f"Expected: {expected}\n"
        f"Actual:   {pages}\n"
    )
PY
}

assert_migrated_to_languages() {
  local docs_json="$1"
  python3 - "${docs_json}" <<'PY'
import json
import sys

data = json.loads(open(sys.argv[1], encoding="utf-8").read())
nav = data["navigation"]
languages = nav.get("languages")
if not isinstance(languages, list) or not languages:
    raise SystemExit("FAIL: navigation.languages[] missing after sync")
if "tabs" in nav:
    raise SystemExit("FAIL: legacy navigation.tabs[] should be removed after sync")
PY
}

TMP_DIR_1="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR_1}" "${TMP_DIR_2:-}"' EXIT

cd "${TMP_DIR_1}"
git init -q

mkdir -p docs/en/developer/plans
create_min_docs_json "docs/docs.json"

mkdir -p docs/en/developer/plans/aaaa
touch docs/en/developer/plans/aaaa/task_plan.md
touch docs/en/developer/plans/aaaa/findings.md
touch docs/en/developer/plans/aaaa/progress.md

mkdir -p docs/en/developer/plans/bbbb
touch docs/en/developer/plans/bbbb/task_plan.md

bash "${SYNCER}" >/dev/null

assert_plans_group_entries \
  "docs/docs.json" \
  '[{"group":"bbbb (bbbb)","pages":["en/developer/plans/bbbb/task_plan"],"expanded":false},{"group":"aaaa (aaaa)","pages":["en/developer/plans/aaaa/task_plan","en/developer/plans/aaaa/findings","en/developer/plans/aaaa/progress"],"expanded":false}]'

TMP_DIR_2="$(mktemp -d)"
cd "${TMP_DIR_2}"
git init -q

mkdir -p docs/en/developer/plans
create_legacy_docs_json "docs/docs.json"

SESSION_HASH="testsessionhash00000001"
SESSION_TITLE="Test session"

bash "${INIT_SESSION}" "${SESSION_HASH}" "${SESSION_TITLE}" >/dev/null

assert_migrated_to_languages "docs/docs.json"
assert_plans_group_entries \
  "docs/docs.json" \
  "[{\"group\":\"${SESSION_TITLE} (${SESSION_HASH})\",\"pages\":[\"en/developer/plans/${SESSION_HASH}/task_plan\",\"en/developer/plans/${SESSION_HASH}/findings\",\"en/developer/plans/${SESSION_HASH}/progress\"],\"expanded\":false}]"

echo "PASS"
