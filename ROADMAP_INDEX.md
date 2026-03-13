<!-- Create a root-level roadmap index so future feature plans are easy to navigate. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# HookCode 功能路线图索引

## 说明

这组计划文件用于梳理当前 `hookcode` 项目最值得继续投入的产品能力，重点覆盖：

- 多 Provider 调度与故障降级
- Robot 调试与低风险验证
- 高风险执行的审批与策略控制
- Webhook / Task 的可重放与可诊断能力
- 成本、预算、配额治理

这些计划都基于当前仓库已经具备的能力来设计：

- `repo / robot / task-group / worker` 执行主链路
- `codex / claude_code / gemini_cli` Provider 支持
- 本机优先 + `用户 / 仓库 / robot` 多层凭据
- 预览、执行日志、通知、成员权限、worker 注册

## 文件列表

1. `ROADMAP_01_PROVIDER_ROUTING_AND_FAILOVER.md`
   - 多 Provider 智能路由 / 自动降级 / 容灾执行
2. `ROADMAP_02_ROBOT_DRY_RUN_AND_PLAYGROUND.md`
   - Robot Dry Run / Prompt Playground / 执行预演
3. `ROADMAP_03_APPROVAL_GATES_AND_POLICY_ENGINE.md`
   - 审批闸门 / 风险策略 / 目录与命令级限制
4. `ROADMAP_04_WEBHOOK_REPLAY_AND_DEBUG_CENTER.md`
   - Webhook 回放 / 失败重试 / 调试中心
5. `ROADMAP_05_BUDGET_QUOTA_AND_COST_GOVERNANCE.md`
   - 预算 / 配额 / 成本控制 / 模型降级策略

## 推荐优先级

### P0：建议最先做

- `ROADMAP_01_PROVIDER_ROUTING_AND_FAILOVER.md`
- `ROADMAP_02_ROBOT_DRY_RUN_AND_PLAYGROUND.md`

原因：

- 可以立刻提升实际可用性
- 与当前 Provider 迁移结果强相关
- 改动收益明显，且可复用现有执行链路

### P1：强烈建议紧随其后

- `ROADMAP_03_APPROVAL_GATES_AND_POLICY_ENGINE.md`
- `ROADMAP_04_WEBHOOK_REPLAY_AND_DEBUG_CENTER.md`

原因：

- 能显著降低误操作与排障成本
- 适合有真实团队/生产使用时引入

### P2：平台化能力补强

- `ROADMAP_05_BUDGET_QUOTA_AND_COST_GOVERNANCE.md`

原因：

- 更偏运营与平台治理
- 价值很高，但通常在任务量上来后更能体现收益

## 推荐落地顺序

### 阶段一：把执行变聪明

- 先做多 Provider 路由和自动降级
- 再做 Dry Run / Playground

目标：

- 降低任务失败率
- 降低 Robot 配置试错成本

### 阶段二：把高风险动作管起来

- 引入审批闸门
- 引入策略引擎

目标：

- 让 `workspace-write` 能更安全地用于真实仓库

### 阶段三：把调试与运营补全

- 引入 Webhook Replay / 调试中心
- 引入预算/配额/成本治理

目标：

- 让 HookCode 从“能跑”变成“好维护、可持续运营”

## 交付建议

如果只准备启动一个功能，建议优先从：

- **Provider 智能路由 + 自动降级**

开始。

如果准备同时启动一组组合功能，建议选择：

- **Provider 路由 + Dry Run + 审批闸门**

这组组合最能体现平台价值，也最容易和现有架构形成闭环。
