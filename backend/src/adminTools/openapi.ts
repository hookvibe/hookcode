import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEFAULT_ADMIN_TOOLS_LOCALE, type AdminToolsLocale } from './i18n';

const s = (locale: AdminToolsLocale, zh: string, en: string): string => (locale === 'en-US' ? en : zh);

const ZH_SUMMARY_BY_OPERATION_ID: Record<string, string> = {
  health_get: '健康检查',
  auth_login: '登录',
  auth_me: '获取当前登录用户',

  users_patch_me: '更新我的账号信息',
  users_change_password: '修改我的密码',
  users_get_model_credentials: '获取我的模型/平台凭证（脱敏）',
  users_patch_model_credentials: '更新我的模型/平台凭证',

  tools_meta: '系统工具元信息',

  repos_list: '仓库列表',
  repos_create: '创建仓库',
  repos_get: '仓库详情（含 robots 与 automation）',
  repos_patch: '更新仓库',
  repos_list_webhook_deliveries: 'Webhook 投递记录列表',
  repos_get_webhook_delivery: 'Webhook 投递记录详情',
  repos_list_robots: '机器人列表',
  repos_create_robot: '创建机器人',
  repos_patch_robot: '更新机器人',
  repos_delete_robot: '删除机器人',
  repos_test_robot: '测试机器人 Token（激活）',
  repos_get_automation: '获取自动化配置',
  repos_put_automation: '保存自动化配置',

  tasks_list: '任务列表',
  tasks_stats: '任务统计',
  tasks_get: '任务详情',
  tasks_delete: '删除任务',
  tasks_retry: '重试任务',
  tasks_logs_get: '获取任务日志',
  tasks_logs_clear: '清空任务日志',
  tasks_logs_stream: 'SSE：实时日志流',

  task_groups_list: '任务分组列表',
  task_groups_get: '任务分组详情',
  task_groups_tasks: '任务分组下的任务列表',

  webhook_gitlab: 'GitLab Webhook',
  webhook_github: 'GitHub Webhook'
};

const applyZhSummaries = (doc: any) => {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;

  for (const pathKey of Object.keys(paths)) {
    const pathItem = (paths as any)[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of Object.keys(pathItem)) {
      const op = (pathItem as any)[method];
      if (!op || typeof op !== 'object') continue;
      const operationId = typeof op.operationId === 'string' ? op.operationId : '';
      if (!operationId) continue;
      const zh = ZH_SUMMARY_BY_OPERATION_ID[operationId];
      if (zh) {
        op.summary = zh;
      }
    }
  }
};

export const createOpenApiSpec = (params: {
  apiBaseUrl: string;
  app: INestApplication;
  locale?: AdminToolsLocale;
}) => {
  const locale = params.locale ?? DEFAULT_ADMIN_TOOLS_LOCALE;

  const builder = new DocumentBuilder()
    .setTitle(s(locale, 'HookCode 后端 API', 'HookCode Backend API'))
    .setDescription(
      s(locale, 'HookCode 后端 API（用于 Swagger 调试）。', 'HookCode backend API (for Swagger debugging).')
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearerAuth')
    .addTag('Health', s(locale, '健康检查', 'Health checks'))
    .addTag('Auth', s(locale, '登录与身份信息', 'Login & identity'))
    .addTag('Users', s(locale, '用户个人信息与凭证', 'User profile & credentials'))
    .addTag('Tools', s(locale, '系统工具元信息', 'System tools meta'))
    .addTag('Repos', s(locale, '仓库与机器人配置', 'Repositories & robots'))
    .addTag('Tasks', s(locale, '任务队列与日志', 'Tasks & logs'))
    .addTag('Task Groups', s(locale, '任务分组', 'Task groups'))
    .addTag('Webhook', s(locale, 'Webhook 入口（GitLab/GitHub）', 'Webhook endpoints (GitLab/GitHub)'));

  const config = builder.build();

  const doc = SwaggerModule.createDocument(params.app, config, {
    ignoreGlobalPrefix: true
  });

  doc.servers = [{ url: params.apiBaseUrl }];

  if (locale === 'zh-CN') {
    applyZhSummaries(doc);
  }

  return doc;
};

