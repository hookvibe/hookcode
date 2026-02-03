// Compose Simplified Chinese messages from per-section modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { zhCNAutomation } from './zh-CN/automation';
import { zhCNAuth } from './zh-CN/auth';
import { zhCNChat } from './zh-CN/chat';
import { zhCNCore } from './zh-CN/core';
import { zhCNRepos } from './zh-CN/repos';
import { zhCNUi } from './zh-CN/ui';

export const zhCN = {
  ...zhCNCore,
  ...zhCNAuth,
  ...zhCNRepos,
  ...zhCNAutomation,
  ...zhCNUi,
  ...zhCNChat
} as const;

export type MessageKey = keyof typeof zhCN;
