<!-- Detail the webhook replay and debug-center roadmap as a root-level planning document. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->
# 计划 04：Webhook Replay 与调试中心

## 一、目标

为 HookCode 增加一套系统化调试能力，让 webhook、任务与机器人执行问题可以被快速定位、回放、重试、对比。

## 二、为什么值得做

当前项目已经有：

- webhook 接收能力
- task / task-group / log
- 通知与日志能力

但如果线上问题出现，仍然可能很难回答：

- 为什么这个 webhook 没有触发
- 为什么触发了但没生成任务
- 为什么任务失败
- 为什么这次和上次行为不同

## 三、目标能力

### 1. Webhook 事件中心

查看：

- 原始 webhook payload
- 签名校验结果
- 匹配到的 repo / rule / robot
- 生成的 task / task-group

### 2. Replay

支持：

- 重新投递同一 webhook
- 使用历史 payload 重新创建任务
- 使用不同 robot / rule 进行重放

### 3. Debug Timeline

在一条时间轴上显示：

- webhook 接收
- 解析
- 规则匹配
- robot 选择
- provider 路由
- worker 执行
- 最终结果

## 四、产品设计

### 1. Debug Center 页面

建议包含：

- Webhook 列表
- 事件详情
- Replay 面板
- 关联任务列表
- 错误诊断面板

### 2. Replay 选项

- replay same payload
- replay with another robot
- replay with current config
- replay as dry-run

### 3. 错误分层展示

把失败分类为：

- webhook 验签失败
- repo 未识别
- 规则未命中
- robot 配置无效
- provider 调用失败
- worker 失败
- git / shell 失败

## 五、后端设计

### 1. 数据记录增强

新增或增强字段：

- `webhook_event`
- `payload_hash`
- `matched_rule_id`
- `matched_robot_id`
- `replay_of_event_id`
- `debug_trace`

### 2. API 建议

- `GET /api/webhooks/events`
- `GET /api/webhooks/events/:id`
- `POST /api/webhooks/events/:id/replay`
- `POST /api/webhooks/events/:id/replay-dry-run`

### 3. Replay 原则

必须支持：

- 安全隔离
- 明确 replay 来源
- 可记录 replay 结果

## 六、前端设计

### 1. Repo 维度入口

在 Repo Detail 中增加：

- Webhook Events
- Replay History

### 2. 全局运维入口

Admin 可以查看：

- 所有 webhook 失败情况
- 最近失败分布
- 高频错误类型

## 七、实施阶段

### Phase A：Webhook 事件记录

- 存 webhook payload 元数据
- 显示关联任务

### Phase B：Replay

- 支持 replay same payload
- 支持 replay dry-run

### Phase C：诊断中心

- 错误分类
- 调试时间轴
- 问题统计面板

## 八、验收标准

- 历史 webhook 可以查询
- 某条 webhook 可以 replay
- replay 结果与原任务建立关联
- 可以快速知道失败发生在哪一层

## 九、推荐优先级

- **优先级：P1**
- **建议实现顺序：第四名**
