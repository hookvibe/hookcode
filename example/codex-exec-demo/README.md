<!-- Minimal Codex SDK demo instructions for outputSchema testing. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
# Codex SDK JSON Output Demo

This demo runs the Codex SDK with an `outputSchema` and prints the final response.

## Prerequisites

- Node.js 18+
- `@openai/codex-sdk` available in the repo `node_modules` (already installed for this monorepo)
- An API key in `CODEX_API_KEY` or `OPENAI_API_KEY`

## Run

From the repo root:

```bash
CODEX_API_KEY=... node example/codex-exec-demo/demo.mjs
```

Optional overrides:

```bash
CODEX_API_KEY=... \
CODEX_MODEL=gpt-5.2 \
CODEX_BASE_URL=https://api.openai.com/v1 \
CODEX_PROMPT='Return ONLY valid JSON that matches the schema.' \
node example/codex-exec-demo/demo.mjs
```

The script prints the raw `finalResponse` and a `parsed_ok=true|false` line.
