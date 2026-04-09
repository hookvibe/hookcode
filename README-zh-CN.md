<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="logo/logo-dark-text-512.png">
  <img src="logo/logo-light-text-512.png" alt="HookCode Logo" width="200">
</picture>

# HookCode

[English](README.md) | [简体中文](README-zh-CN.md)

</div>

<br/>

## 简介

HookCode 是一个通过对话和 Webhook 优雅触发 CLI 编码助手的智能代码审查与自动化平台。支持独立部署，提供可视化控制台实时查看任务执行状态。

### 支持的 CLI 编码助手
- **Claude Code** - Anthropic 的代码助手
- **Codex** - OpenAi 的代码助手
- **Gemini** - Google 的代码助手

### 支持的代码仓库
- **GitHub** - 完整的 Webhook 与 API 集成
- **GitLab** - 完整的 Webhook 与 API 集成

## 使用场景

- 在 commit 提交代码之后使用自己配置的 cli 编码助手 review 代码提交的质量
- 提交构建需求之后，会执行构建任务，修复 bug / 实现功能，然后提交 pr 到仓库中
- 提交 issue 之后，使用自己配置的 cli 编码助手回复用户提出的问题或者直接提交代码
- 代码仓库中合并代码之后，可以在使用自己配置的 cli 编码助手判断合并的质量
- 多助手执行，gemini 生成设计方案， claude code 确认执行方案， codex 执行构建

## 界面预览

<div align="center">

### 任务详情视图
![任务详情](screenshots/task-detail.png)

*实时任务执行监控，展示详细日志和分析结果*

</div>

# 快速开始

> 需要有一个公网可访问的服务器来接收仓库 Webhook。

<!-- Reorganize command-first quick start workflows for Docker and local development clarity. docs/en/developer/plans/readmecmd20260227/task_plan.md readmecmd20260227 -->
## Docker 部署（推荐）

使用 Docker Compose 一次启动 **数据库 + backend + frontend**。生产 worker 在栈启动后单独绑定。

<!-- Document Docker work-root and named-volume behavior so deployment docs stay aligned with HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 -->

### 1）准备环境变量文件

```bash
cp docker/.env.example docker/.env
```

生产环境至少修改 `docker/.env` 中以下字段：
- `AUTH_TOKEN_SECRET`
- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_PASSWORD`
- 如需修改容器内工作根目录，再调整 `HOOKCODE_WORK_DIR`（必须保持绝对路径，例如 `/var/lib/hookcode`）
- 如需让 worker 固定通过某个公网地址回连 backend，请设置 `HOOKCODE_WORKER_CONNECT_API_BASE_URL`

### 2）构建并启动全部服务

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

栈启动后，请到 **Settings → Workers** 创建远程 worker，并在 Linux 服务器上把它作为独立 `systemd` 服务绑定启动。

### 3）查看运行状态和日志

```bash
docker compose -f docker/docker-compose.yml ps
```

```bash
docker compose -f docker/docker-compose.yml logs -f backend frontend
```

### 4）日常运维命令

重启全部服务：

```bash
docker compose -f docker/docker-compose.yml restart
```

后端代码变更后，只重建并重启 backend：

```bash
docker compose -f docker/docker-compose.yml up -d --build backend
```

前端代码变更后，只重建并重启 frontend：

```bash
docker compose -f docker/docker-compose.yml up -d --build frontend
```

停止并删除容器：

```bash
docker compose -f docker/docker-compose.yml down
```

停止并删除容器 + 数据库/工作目录卷：

```bash
docker compose -f docker/docker-compose.yml down -v
```

### 5）访问地址和默认信息

- 前端控制台：`http://localhost`（或 `http://localhost:<HOOKCODE_FRONTEND_PORT>`）
- 后端 API：`http://localhost:<HOOKCODE_BACKEND_PORT>`
- 默认管理员账号密码来自 `docker/.env` 的 `AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD`

### 6）Docker 模式的重要行为说明

- frontend/backend 在容器内运行的是构建产物。
- **宿主机源码变更不会自动热更新到容器。**
- 代码变更后请执行对应的 `up -d --build ...` 重建命令。

### Docker 配置说明

- Docker 相关资源在 `docker/` 目录：
  - 主栈 Compose 文件：`docker/docker-compose.yml`
  - Nginx 反向代理配置：`docker/nginx/frontend.conf`
  - 主栈环境变量文件：`docker/.env`
- 端口覆盖：`HOOKCODE_FRONTEND_PORT`、`HOOKCODE_BACKEND_PORT`、`HOOKCODE_DB_PORT`
- 数据库凭据：`DB_USER`、`DB_PASSWORD`、`DB_NAME`
- 运行时存储：`HOOKCODE_WORK_DIR`（Docker Compose 会把 backend 状态挂到这个容器内绝对路径；推荐的远程 worker 也应使用自己的绝对工作目录）
- 默认 Docker worker 模式：backend 以 `HOOKCODE_SYSTEM_WORKER_MODE=disabled` 启动，生产环境通过手动绑定的远程 worker 执行任务，而不是同 Compose 内置 worker
- 推荐生产 worker 托管方式：在当前 Linux 服务器上安装 `@hookvibe/hookcode-worker`，并使用 **Settings → Workers** 提供的 `systemd` 模板单独托管
- Cloudflare 单端口路由：
  - 保持 `VITE_API_BASE_URL=/api`
  - 通过 `https://<你的域名>/api/...` 访问 API（不要用 `:8000`）

## 本地开发

如果需要源码级调试和热更新，使用本地开发命令。

### 1）安装依赖

```bash
corepack enable
pnpm install
```

### 2）一键启动

```bash
pnpm dev
```

### 3）按模块启动（可选）

仅启动数据库：

```bash
pnpm dev:db
```

为源码模式后端/前端准备独立本地 Postgres：

```bash
pnpm dev:db:local
```

仅启动后端（默认 `4000`）：

```bash
pnpm dev:backend
```

仅启动前端（默认 `5173`）：

```bash
pnpm dev:frontend
```

### 4）本地开发使用独立数据库（推荐）

复制 `backend/.env.example` 为 `backend/.env`，本地开发建议始终使用独立本地数据库。`pnpm dev:db:local` 会启动与示例配置匹配的本地 Postgres（`127.0.0.1:55432`），而 `pnpm dev:backend` 现在默认拒绝非本机数据库。除非你明确设置 `HOOKCODE_ALLOW_REMOTE_DEV_DB=true`，否则不要让源码模式的本地 worker 连接共享/生产数据库执行任务。

### 5）登录与注册说明

- 默认启用登录。
- 默认管理员账号见 `backend/.env.example`（`AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD`）。
- 生产环境请设置强随机的 `AUTH_TOKEN_SECRET`。
- 若启用邮箱自助注册，需要配置后端邮件相关参数（`AUTH_REGISTER_ENABLED`、`EMAIL_PROVIDER`、`SMTP_*`、`HOOKCODE_CONSOLE_BASE_URL`）。


## 环境变量

- **后端**：`backend/.env.example`。复制为 `backend/.env` 用于本地开发或部署（勿提交真实密钥）。源码模式本地 worker 建议只连本地独立 DB；生产环境建议使用 `HOOKCODE_SYSTEM_WORKER_MODE=disabled` 并手动绑定远程 worker。
- **前端**：`frontend/.env.example`（Vite 的 `VITE_*` 变量在构建时注入；设置 `VITE_API_BASE_URL` 为后端 API Base，例如 `http://localhost:4000/api`）
- **仓库配置**：Robot/token 已支持通过控制台（数据库）管理；不再支持 env token 兜底，请在控制台按 Robot/账号/仓库维度配置 token


## License

MIT（见 `LICENSE`）。
