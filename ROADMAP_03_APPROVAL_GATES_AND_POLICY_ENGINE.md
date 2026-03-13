<!-- Detail the approval-gate and policy-engine roadmap as a root-level planning document. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# 计划 03：审批闸门与策略引擎

## 一、目标

给 HookCode 增加一层正式的“风险控制”能力，让高风险执行不再直接落库/落仓库，而是先经过策略判断与人工审批。

## 二、为什么必须做

当前项目已经支持：

- `workspace-write`
- 自动执行任务
- 机器人操作真实仓库
- 多 worker / 多 Provider

这意味着 HookCode 已经具备“真实改代码”的能力，下一步必须补：

- 风险边界
- 批准流程
- 执行策略

## 三、目标能力

### 1. 审批闸门

支持：

- 某些任务必须审批后才能继续
- 某些动作必须审批后才能真正提交

### 2. 策略引擎

支持：

- 按路径限制
- 按命令限制
- 按 Provider 限制
- 按仓库级别限制
- 按任务来源限制

### 3. 风险分级

将任务打上：

- low
- medium
- high
- critical

## 四、适用场景

- 修改 `package.json` / lockfile
- 修改 `infra/` / `docker/` / `deployment/`
- 执行 shell 命令
- 使用 `workspace-write`
- 需要联网抓取外部信息
- 需要创建 PR/MR / push branch

## 五、产品设计

### 1. 审批节点

任务执行流程变成：

- 接收事件
- 解析规则
- 生成执行计划
- 策略判断
- 如需审批则进入 `waiting_approval`
- 用户批准后继续执行

### 2. 审批信息展示

审批卡片应显示：

- 为什么需要审批
- 将修改哪些路径
- 将使用哪个 Provider
- 将执行哪些命令
- 风险级别

### 3. 审批操作

支持：

- approve
- reject
- request changes
- approve once
- approve always for this robot/rule

## 六、后端设计

### 1. 新增 Policy Engine

建议模块：

- `backend/src/policyEngine/`

包含：

- `policyEngine.service.ts`
- `riskClassifier.ts`
- `approvalQueue.service.ts`

### 2. 策略输入

- repo
- robot
- task source
- provider
- sandbox
- commands
- target files
- network access

### 3. 策略输出

- `allow`
- `allow_with_warning`
- `require_approval`
- `deny`

## 七、前端设计

### 1. 新增 Approval Inbox

可以放在：

- 全局 Settings / Admin
- Repo Detail
- TaskGroup 页面

### 2. Task 详情页增强

展示：

- 当前卡在哪个审批点
- 等待谁审批
- 批准历史
- 拒绝原因

## 八、数据与 API

### 1. 数据结构建议

新增实体：

- `approval_request`
- `approval_action`
- `policy_rule`

### 2. API 建议

- `GET /api/approvals`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/policies`
- `PATCH /api/policies`

## 九、实施阶段

### Phase A：最小审批闸门

- `workspace-write` 强制审批
- 前端可审批
- 任务可暂停等待

### Phase B：策略引擎

- 按路径/命令/风险分类判断
- 支持 repo / robot 级策略

### Phase C：长期治理

- 批量审批
- 模板化策略
- 审批审计报表

## 十、验收标准

- 高风险任务可以进入等待审批状态
- 批准后任务可继续执行
- 拒绝后任务可终止并记录理由
- 策略规则能按 repo / robot 生效

## 十一、推荐优先级

- **优先级：P1**
- **建议实现顺序：第三名**
