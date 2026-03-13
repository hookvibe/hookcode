<!-- Detail the provider routing and failover roadmap as a root-level planning document. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# 计划 01：Provider 智能路由与自动降级

## 一、目标

把当前 HookCode 的 Provider 执行能力，从“手动选择一个 Provider 执行”，升级为：

- 可按任务类型自动选择最优 Provider
- 主 Provider 失败时自动降级
- 可按仓库 / Robot / 用户策略定制路由
- 可记录每次路由决策与失败原因

最终形成一个统一的 **Provider Routing Layer**。

## 二、为什么值得先做

当前项目已经有：

- 统一的 Provider resolver
- 多 Provider 运行入口
- 本机优先 + 用户/仓库/robot 多层凭据
- 完整 task / task-group / log 链路

这意味着：

- 路由逻辑已经有可插入的位置
- 不需要推翻现有架构
- 改完后能立刻提升成功率与稳定性

## 三、要解决的核心问题

### 1. 单 Provider 失败率高

目前一个 Robot 通常绑定一个 Provider：

- Provider 不可用就直接失败
- 某个模型临时异常也没有退路

### 2. 不同任务更适合不同模型

例如：

- 代码修改：更适合 Codex
- 长文总结/复杂说明：更适合 Claude
- 成本敏感的批量操作：更适合 Gemini

### 3. 当前“配置”与“实际执行决策”仍然耦合

需要引入一个显式的“路由决策层”，将：

- 任务输入
- Provider 可用性
- 凭据可用性
- 预算限制
- 风险等级

统一综合起来做决策。

## 四、范围

### In Scope

- 主 / 备 Provider 配置
- 自动失败切换
- 按任务类型路由
- 路由决策日志
- Provider 健康状态缓存
- 执行前可行性探测

### Out of Scope

- 复杂的机器学习评分模型
- 跨区域多机房流量调度
- Provider 账单自动对接

## 五、产品设计

### 1. Robot 级路由配置

新增字段建议：

- `primaryProvider`
- `fallbackProviders[]`
- `routingMode`
  - `fixed`
  - `task_type`
  - `budget_aware`
  - `availability_first`
- `failoverPolicy`
  - `disabled`
  - `same_prompt_retry`
  - `fallback_provider_once`
  - `fallback_provider_chain`

### 2. 任务类型识别

初版不需要智能分类器，可先用规则：

- patch / PR / MR / fix 类 → Codex 优先
- review / explain / summary 类 → Claude 优先
- scan / batch / low-cost 类 → Gemini 优先

后续再引入更智能的 task intent classification。

### 3. 路由结果可视化

在 task / task-group 日志中展示：

- 计划使用哪个 Provider
- 为什么选它
- 是否发生降级
- 降级到哪个 Provider
- 最终成功/失败 Provider

## 六、后端设计

### 1. 新增 Routing Service

建议新增模块：

- `backend/src/providerRouting/`

建议文件：

- `providerRouting.service.ts`
- `providerHealth.service.ts`
- `providerRouting.types.ts`
- `providerRoutingLogger.ts`

### 2. 路由输入

应至少包含：

- repo / robot / user 基本信息
- modelProviderConfig
- 任务类型 / 触发来源
- 是否需要写权限
- 是否需要联网
- 当前预算状态
- 各 Provider 凭据可用性
- 各 Provider 本机登录态可用性

### 3. 路由输出

统一返回：

- 选中的 Provider
- 选中的 model
- 选中的 credential source
- 备选链路
- 决策原因
- 风险标签

### 4. 执行失败后的重试策略

初版建议：

- Provider 参数不兼容 → 同 Provider 降级重试
- Provider 不可用 / 认证失败 → 切到 fallback provider
- Prompt 太长 / 上下文超限 → 模型或 Provider 切换

## 七、前端设计

### 1. Robot 编辑页

增加：

- 主 Provider
- 备用 Provider 列表
- 路由模式
- 降级策略
- 风险提示

### 2. Task Detail / TaskGroup

增加：

- 路由决策卡片
- 降级轨迹
- 最终执行 Provider
- 失败原因分类

## 八、数据与 API

### 1. 数据结构建议

在 Robot 配置中新增：

- `routingConfig`
  - `mode`
  - `primaryProvider`
  - `fallbackProviders`
  - `failoverPolicy`
  - `taskTypeRules`

### 2. API 建议

- `GET /api/providers/health`
- `POST /api/providers/route/preview`
- `PATCH /api/repos/:id/robots/:robotId/routing`

## 九、实施阶段

### Phase A：最小可用版本

- 单 Robot 主/备 Provider
- 主 Provider 失败后切换一次
- 任务日志显示路由与切换记录

### Phase B：规则路由

- 按任务类型自动选 Provider
- 增加 Provider 健康探测与简单熔断

### Phase C：预算感知路由

- 结合预算/成本策略选 Provider
- 增加组织级默认路由策略

## 十、验收标准

- 主 Provider 人为失败时，任务能自动切换备用 Provider
- 日志中能清楚看见路由决策与降级链路
- Robot 可以配置主/备 Provider
- 路由逻辑不会破坏现有本机优先凭据机制

## 十一、风险

- 多 Provider 输出风格差异带来的结果不稳定
- 降级后参数不完全兼容
- 同一任务重复执行可能增加成本

## 十二、推荐优先级

- **优先级：P0**
- **建议实现顺序：第一名**
