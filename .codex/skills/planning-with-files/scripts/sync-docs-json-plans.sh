#!/usr/bin/env bash
# Sync docs/docs.json navigation entries for planning session files. docsjsonindex20260121
#
# Usage:
#   bash .codex/skills/planning-with-files/scripts/sync-docs-json-plans.sh
#
# Behavior:
# - Scans: docs/en/developer/plans/<session-hash>/{task_plan,findings,progress}.md
# - Updates: docs/docs.json -> Developer Docs -> group "plans" -> pages[]
# - Skips missing files to avoid broken navigation links.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DOCS_JSON="${REPO_ROOT}/docs/docs.json"
PLANS_DIR="${REPO_ROOT}/docs/en/developer/plans"

if [ ! -f "${DOCS_JSON}" ]; then
  echo "ERROR: docs.json not found: ${DOCS_JSON}" >&2
  exit 1
fi

if [ ! -d "${PLANS_DIR}" ]; then
  echo "ERROR: plans directory not found: ${PLANS_DIR}" >&2
  exit 1
fi

python3 - "${DOCS_JSON}" "${PLANS_DIR}" <<'PY'
import json
import sys
from pathlib import Path

docs_json_path = Path(sys.argv[1])
plans_dir = Path(sys.argv[2])

data = json.loads(docs_json_path.read_text(encoding="utf-8"))

nav = data.get("navigation") or {}
languages = nav.get("languages")
if not isinstance(languages, list) or not languages:
    raise SystemExit("ERROR: docs.json missing navigation.languages[]")

lang = next((l for l in languages if isinstance(l, dict) and l.get("language") == "en"), None)
if lang is None:
    lang = next((l for l in languages if isinstance(l, dict) and l.get("default") is True), None) or languages[0]

tabs = lang.get("tabs")
if not isinstance(tabs, list):
    raise SystemExit("ERROR: docs.json missing navigation.languages[].tabs[]")

dev_tab = next((t for t in tabs if isinstance(t, dict) and t.get("tab") == "Developer Docs"), None)
if dev_tab is None:
    dev_tab = {"tab": "Developer Docs", "groups": []}
    tabs.append(dev_tab)

groups = dev_tab.get("groups")
if not isinstance(groups, list):
    dev_tab["groups"] = []
    groups = dev_tab["groups"]

plans_group = next((g for g in groups if isinstance(g, dict) and g.get("group") == "plans"), None)
if plans_group is None:
    plans_group = {"group": "plans", "pages": []}
    groups.append(plans_group)

expected_stems = ["task_plan", "findings", "progress"]
pages = []

for session_dir in sorted([p for p in plans_dir.iterdir() if p.is_dir()], key=lambda p: p.name):
    session = session_dir.name
    found_any = False

    for stem in expected_stems:
        md_path = session_dir / f"{stem}.md"
        if not md_path.exists():
            continue
        found_any = True
        pages.append(f"en/developer/plans/{session}/{stem}")

    if found_any:
        missing = [stem for stem in expected_stems if not (session_dir / f"{stem}.md").exists()]
        if missing:
            sys.stderr.write(
                f"WARNING: session '{session}' is missing files: {', '.join(missing)} (skipping missing pages)\n"
            )

plans_group["pages"] = pages

docs_json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Synced {len(pages)} plan pages into: {docs_json_path}")
PY
