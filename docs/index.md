---
title: HookCode Documentation
description: Deployment, configuration, and API reference for the HookCode automation platform.
---

{/* Introduce the Mintlify landing page and section tiles. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

HookCode connects GitHub/GitLab events to your preferred coding assistant and automations. This documentation covers setup, configuration, day-to-day usage, and backend APIs.

<Callout type="tip" title="Start here">
  New to HookCode? Begin with the Quickstart guide to deploy the stack and connect your first repository.
</Callout>

<CardGroup>
  <Card title="Quickstart" href="/en/user-docs/quickstart">
    Deploy with Docker Compose and connect your first repo.
  </Card>
  <Card title="Configuration" href="/en/user-docs/index">
    Define repos, robots, triggers, and .hookcode.yml.
  </Card>
  <Card title="API Reference" href="/en/api-reference/index">
    Explore endpoints and OpenAPI-backed details.
  </Card>
  <Card title="Developer" href="/en/developer/index">
    Internal architecture notes and planning logs.
  </Card>
  <Card title="Changelog" href="/en/change-log/index">
    Track releases and unreleased changes.
  </Card>
</CardGroup>

## What HookCode Does

- Receives GitHub/GitLab webhooks to create tasks.
- Runs configured coding assistants via Robots (Codex, Claude Code, Gemini CLI).
- Automates actions based on rules and repo context.
- Streams logs and previews for task execution.

## Deployment Options

- **Docker Compose (recommended)**: Full stack, minimal setup.
- **Local source mode**: For contributors and advanced debugging.

See the Quickstart for detailed steps.