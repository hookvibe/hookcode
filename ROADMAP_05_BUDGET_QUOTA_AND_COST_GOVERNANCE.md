<!-- Detail the budget and cost-governance roadmap as a root-level planning document. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# 计划 05：预算、配额与成本治理

## 一、目标

为 HookCode 增加统一的成本与使用治理能力，让多 Provider、多 Robot、多仓库的执行成本可控、可见、可限制。

## 二、为什么这个功能重要

当 HookCode 进入真实团队使用后，最容易出现的问题之一就是：

- 哪个仓库最花钱
- 哪个 Robot 消耗最高
- 哪些任务不值得用高成本模型
- 到底该在哪一层做限额

如果没有预算/配额治理，平台很难长期稳定运营。

## 三、目标能力

### 1. 预算管理

支持按以下维度设预算：

- 用户
- 仓库
- Robot
- 组织（后续）

### 2. 配额限制

支持限制：

- 每日 / 每月任务数
- token 上限
- 单任务最大运行时间
- 单任务最大步骤数

### 3. 成本感知执行

支持：

- 超预算后禁止执行
- 超预算后自动降级模型
- 超预算后只允许 dry-run / read-only

## 四、产品设计

### 1. 成本面板

展示：

- 最近 7 天 / 30 天成本
- 按 Provider 分布
- 按 repo / robot 分布
- 成本最高任务
- 失败但仍消耗成本的任务

### 2. 策略模式

- hard limit：超限直接阻止
- soft limit：允许但告警
- degrade：超限后自动降级模型
- manual approval：超限后需审批

## 五、后端设计

### 1. 成本数据来源

优先复用当前已有：

- provider usage
- task token usage
- task/task-group 执行元数据

### 2. 新增服务

建议模块：

- `backend/src/costGovernance/`

包含：

- `budget.service.ts`
- `usageAggregation.service.ts`
- `quotaEnforcer.service.ts`

### 3. 执行前检查

任务启动前增加：

- 是否超月预算
- 是否超日配额
- 是否超过该 Robot 上限

## 六、前端设计

### 1. 用户 Settings

新增：

- 我的 token 使用量
- 我的预算设置
- Provider 成本分布

### 2. Repo Detail

新增：

- 本仓库月度成本
- 各 Robot 成本排行
- 预算余量

### 3. Admin 视图

新增：

- 全局使用趋势
- Top 消耗仓库
- Top 消耗用户
- Provider 成本占比

## 七、API 与数据结构

### 1. API 建议

- `GET /api/costs/summary`
- `GET /api/costs/by-repo`
- `GET /api/costs/by-robot`
- `PATCH /api/budgets`
- `GET /api/budgets`

### 2. 数据结构建议

新增：

- `budget_policy`
- `usage_daily_rollup`
- `usage_monthly_rollup`
- `quota_event`

## 八、实施阶段

### Phase A：可见性

- 展示 usage / token / provider 消耗
- 提供 repo / robot 维度统计

### Phase B：预算与配额

- 支持设置 hard/soft limit
- 执行前拦截超额任务

### Phase C：成本感知路由

- 与 Provider Routing 联动
- 自动改用便宜模型或便宜 Provider

## 九、验收标准

- 用户能看到 repo / robot 的成本分布
- 超预算策略可以生效
- 可在执行前阻止明显越界任务
- 能和未来的 Provider Routing 联动

## 十、推荐优先级

- **优先级：P2**
- **建议实现顺序：第五名**
