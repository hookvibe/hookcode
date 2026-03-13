# Findings & Decisions: Implement provider routing and failover MVP
<!-- Capture the implementation scope and architecture decisions for the provider-routing MVP. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313 -->

## Session Metadata
- **Session Hash:** providerroutingimpl20260313
- **Created:** 2026-03-13

## Requirements
- Implement the first roadmap plan in the current HookCode repository.
- Keep the implementation practical and aligned with the current architecture.
- Preserve the existing local-first credential resolution behavior.
- Add configuration, execution behavior, and validation for the new routing MVP.

## Discovery Log
- Robots currently persist provider-specific config inside `repo_robots.model_provider_config_json`.
- `backend/src/agent/agent.ts` is the central execution entrypoint for provider invocation.
- Provider-specific config is normalized and redacted through `codex.ts`, `claudeCode.ts`, and `geminiCli.ts` plus `repo-robot.service.ts`.
- The repo robot editor in `frontend/src/pages/RepoDetailPage.tsx` already owns provider selection and provider-config editing.
- The current codebase has no dedicated routing config or fallback-provider execution flow yet.

## MVP Scope
- Add a common routing config section to robot model-provider config.
- Support one optional fallback provider per robot.
- Support one automatic failover attempt when the primary provider execution throws.
- Log the routing decision and failover result in task execution logs.
- Expose the routing config in the repo robot editor.

## Non-Goals For This Round
- No task-type routing.
- No provider health endpoint.
- No budget-aware routing.
- No multi-provider chains longer than one fallback step.
- No task detail dashboard/card redesign beyond existing logs and form hints.

## Implementation Strategy
- Introduce a shared provider-routing config type used by all three provider config normalizers.
- Persist that config inside `modelProviderConfig` so existing robot CRUD APIs continue to work.
- Create a backend routing helper that returns primary + fallback execution plans.
- Update the agent execution path to try the selected primary provider first, then fallback once if configured and the primary throws.
- Keep each selected provider's credential resolution delegated to the existing resolver.

## Finalized MVP Decisions
- The MVP keeps using `repo_robots.model_provider_config_json`; no schema migration or new `RepoRobot.routingConfig` column is introduced.
- `routingConfig` is stored inside each provider-specific `modelProviderConfig` payload.
- Fallback config is derived from the primary provider context: sandbox is preserved, network access is inferred from the primary config, and robot-embedded credentials are never reused across providers.
- `availability_first` may select the fallback provider before execution when the primary has no executable credential.
- `failoverTriggered` is reserved for the runtime path where the primary provider actually ran and then failed before the fallback was attempted.

## Risks
- Different providers may produce noticeably different output styles after failover.
- Some errors should not trigger failover (for example prompt/data bugs), so the first iteration may still be conservative.
- Frontend robot editing already carries a lot of complexity; the new controls should stay minimal.

## Resources
- Roadmap source: `ROADMAP_01_PROVIDER_ROUTING_AND_FAILOVER.md`
- Execution entrypoint: `backend/src/agent/agent.ts`
- Robot storage service: `backend/src/modules/repositories/repo-robot.service.ts`
- Robot editor UI: `frontend/src/pages/RepoDetailPage.tsx`
