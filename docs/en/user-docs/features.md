---
title: Features
---



This page summarizes key HookCode features from a user perspective.

## Repository integrations

- GitHub / GitLab Webhook receiver under `/api/webhook/*`
- Optional provider API base URL for self-hosted setups
- Webhook delivery inspection in the console

## Robots (execution profiles)

- Multiple robots per repository
- Per-robot prompt templates
- Multiple credential scopes:
  - robot-level secrets
  - user account-level profiles
  - repo-scoped profiles
- Model providers:
  - Codex
  - Claude Code
  - Gemini CLI

## Automation (triggers)

- Event-based triggers:
  - Issue / Commit / Merge Request
- Rule matching + multiple robot actions
- Prompt patch/override per action

## Tasks & monitoring

- Task list with filtering (repo/robot/status/event type)
- Task detail view with outputs and retry controls
- Optional task logs:
  - fetch logs via API
  - stream logs via SSE

## Chat (manual trigger)

- Run tasks manually from the console without Webhooks
- Chat-style timeline view for a task group

## Archive mode (read-only)

- Archive repositories/tasks to keep history while preventing new automation and edits

