---
title: User Docs
---

{/* Normalize internal links for Mintlify routing. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Add Mintlify landing cards for the user docs section. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

User-facing documentation for HookCode (deployment, configuration, and day-to-day usage).

<CardGroup>
  <Card title="Quickstart" href="/en/user-docs/quickstart">
    Deploy the stack and connect your first repository.
  </Card>
  <Card title="Configuration" href="/en/user-docs/config/repositories">
    Set up repos, robots, triggers, and .hookcode.yml.
  </Card>
  <Card title="TaskGroup Preview" href="/en/user-docs/preview">
    Run previews and debug dev servers from tasks.
  </Card>
  <Card title="Workers" href="/en/user-docs/workers">
    Connect remote executors and choose where tasks run.
  </Card>
  {/* Add a landing-card entry for the split-host deployment guide so operators can discover the backend+remote-worker runbook from the user-docs homepage. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
  <Card title="Split-Host Deployment" href="/en/user-docs/split-host-deployment">
    Run backend and dedicated remote workers on separate machines.
  </Card>
</CardGroup>

## Getting started

- [Quickstart](./quickstart)
- [Repository configuration](./config/repositories)
- [Robot configuration](./config/robots)
- [Automation triggers](./config/triggers)
{/* Update .hookcode.yml doc label to reflect preview config. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
- [.hookcode.yml configuration](./config/hookcode-yml)
{/* Add TaskGroup preview guide link for user docs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
- [TaskGroup preview](./preview)
- [Workers](./workers)
{/* Link the split-host deployment guide from the getting-started list so Docker operators can jump directly into the multi-host setup steps. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
- [Split-host deployment](./split-host-deployment)

## Reference

- [Environment variables & config](./environment)
{/* Add custom Docker image guidance for multi-language runtimes. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
- [Custom Docker images for runtimes](./custom-dockerfile)
- [Features](./features)
- [Troubleshooting](./troubleshooting)