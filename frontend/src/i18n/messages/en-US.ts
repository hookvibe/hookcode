// Compose English messages from per-section modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { MessageKey } from './zh-CN';
import { enUSAutomation } from './en-US/automation';
import { enUSAuth } from './en-US/auth';
import { enUSChat } from './en-US/chat';
import { enUSCore } from './en-US/core';
import { enUSRepos } from './en-US/repos';
import { enUSUi } from './en-US/ui';

export const enUS: Record<MessageKey, string> = {
  ...enUSCore,
  ...enUSAuth,
  ...enUSRepos,
  ...enUSAutomation,
  ...enUSUi,
  ...enUSChat
};
