---
title: Automation Triggers
---



Automation triggers turn incoming Webhook events into HookCode Tasks by matching rules and executing Robot actions.

## Supported events

HookCode supports these top-level event types:

- **Issue**
- **Commit**
- **Merge Request / Pull Request**

Each event type can be enabled/disabled independently.

## Rules

A rule contains:

- **Name** (required)
- **Match conditions** (optional)
- **Actions** (required: at least 1 robot action)

The backend validates rules on save and rejects invalid configurations (for example: missing rule name or empty actions).

## Match conditions

Commonly used conditions include:

- **Event subtype**: `created` / `updated` / `commented`
- **Branch name** (for commit / merge request events)
- **Text keywords include/exclude** (keyword lists)
- **Issue assignees** (Issue events)
- **Mentions** (comment mentions, including robot mentions)

### Important: Issue events have no branch context

Issue webhooks do not contain branch/ref information. Branch-based filters are ignored/stripped for Issue rules.

## Actions

An action binds a rule to a Robot:

- Select one or more Robots.
- Enable/disable each action independently.
- Optionally adjust the prompt:
  - `promptPatch`: appended after the robot default template
  - `promptOverride`: full override

## Auto-save behavior

The console UI typically auto-saves automation edits.

Best practices:

- Keep rules small and specific.
- Prefer multiple small rules over one complex rule.
- Avoid placing secrets in prompts or patches.

