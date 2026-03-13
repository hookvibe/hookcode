<!-- Detail the dry-run and playground roadmap as a root-level planning document. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# 计划 02：Robot Dry Run 与 Prompt Playground

## 一、目标

为 HookCode 增加一个低风险验证环境，让用户在不真正写仓库、不发评论、不提交 PR/MR 的情况下，预演 Robot 会怎么执行。

核心能力：

- Dry Run
- Prompt Playground
- 输入模拟
- 输出预览
- 参数对比

## 二、为什么这个功能很重要

当前 HookCode 的 Robot 配置已经越来越复杂：

- Provider
- 凭据来源
- 模型
- 沙箱模式
- Prompt template
- workflow mode
- worker
- 依赖安装策略

没有一个“预演环境”，配置错误的成本非常高。

## 三、用户场景

### 1. 新建 Robot 时

用户想知道：

- 这个 Prompt 到底会渲染成什么
- 变量是否正确注入
- 用当前 Provider 是否能跑通

### 2. 修改 Prompt 时

用户想对比：

- 改前 / 改后 Prompt
- 改前 / 改后输出差异

### 3. 调整权限时

用户想验证：

- `read-only` 下能不能完成任务
- `workspace-write` 是否真的需要

## 四、范围

### In Scope

- 手动选择模拟输入
- 渲染最终 Prompt
- 查看最终执行参数
- 非持久化 Dry Run 执行
- 输出与 diff 预览

### Out of Scope

- 完整沙箱快照回放
- 全量 Git 虚拟文件系统
- 真正替代正式执行

## 五、产品设计

### 1. Playground 页面组成

建议包含 4 个面板：

- 输入面板
- Prompt 预览面板
- Provider / 参数面板
- 执行结果面板

### 2. 输入模拟类型

支持模拟：

- issue
- PR / MR
- commit push
- manual chat
- 自定义 payload

### 3. Dry Run 结果展示

展示：

- 最终 Prompt
- 解析后的变量
- 路由后的 Provider / model / credential source
- 预计执行命令
- 模型输出
- 预计 diff / comment / action

### 4. 安全边界

Dry Run 必须：

- 不推代码
- 不发评论
- 不创建 MR/PR
- 不改数据库中的正式任务状态

## 六、后端设计

### 1. 新增 Dry Run 执行入口

建议新增 API：

- `POST /api/repos/:id/robots/:robotId/dry-run`
- `POST /api/providers/preview-prompt`

### 2. 返回数据

至少包含：

- `renderedPrompt`
- `resolvedProvider`
- `resolvedCredentialSummary`
- `executionPlan`
- `simulatedActions`
- `modelOutput`
- `warnings[]`

### 3. 执行策略

初版建议两种模式：

- `render_only`
- `execute_no_side_effect`

## 七、前端设计

### 1. Repo Robot 编辑弹窗内加入口

在 Robot 配置区域增加：

- `Preview Prompt`
- `Dry Run`

### 2. 对比能力

增加：

- 旧 Prompt vs 新 Prompt
- 旧配置 vs 新配置
- 上次 Dry Run vs 本次 Dry Run

### 3. 结果导出

支持：

- 复制 Prompt
- 下载 Dry Run 报告
- 复制模型返回

## 八、实施阶段

### Phase A：Prompt Playground

- 输入模拟
- Prompt 渲染
- Provider / 凭据解析展示

### Phase B：Dry Run 执行

- 实际跑模型
- 不产生副作用
- 展示输出与风险

### Phase C：差异对比

- Prompt diff
- 参数 diff
- 输出 diff

## 九、验收标准

- 用户可以在 Robot 页面直接预览最终 Prompt
- 用户可以执行 Dry Run 且不会写仓库
- 可以看见最终会用哪个 Provider 和哪层凭据
- 可以看见潜在风险提示

## 十、风险

- Dry Run 与正式执行结果不完全一致
- 有些 Provider 工具调用天然带副作用，需要额外隔离
- 上下文模拟不完整时，预演结果可能误导用户

## 十一、推荐优先级

- **优先级：P0**
- **建议实现顺序：第二名**
