// Isolate Claude Code execution log parsing helpers. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { ExecutionItem } from './types';
import { asArray, asString, isRecord, toInlineText, toRawText, buildToolCommand } from './helpers';

// Normalize Claude Code SDK message payloads into ExecutionItem records for the timeline view. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
export const buildClaudeMessageItems = (payload: Record<string, unknown>): ExecutionItem[] => {
  const message = isRecord(payload.message) ? payload.message : null;
  if (!message) return [];
  const messageId = asString(message.id).trim() || asString(payload.uuid).trim();
  const role = asString(message.role).trim();
  const content = asArray(message.content);

  return content
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const entryType = asString(entry.type).trim();
      if (!entryType) return null;

      if (entryType === 'text') {
        const text = asString(entry.text);
        if (!text) return null;
        return {
          kind: 'agent_message',
          id: `${messageId || role || 'message'}_${index}`,
          status: 'completed',
          text
        } satisfies ExecutionItem;
      }

      if (entryType === 'tool_use') {
        const toolId = asString(entry.id).trim() || `${messageId || role || 'message'}_tool_${index}`;
        const command = buildToolCommand(asString(entry.name), entry.input);
        return {
          kind: 'command_execution',
          id: toolId,
          status: 'in_progress',
          command,
          output: undefined,
          exitCode: undefined
        } satisfies ExecutionItem;
      }

      if (entryType === 'tool_result') {
        const toolUseId = asString(entry.tool_use_id).trim();
        const output = toRawText(entry.content);
        const isError = entry.is_error === true;
        return {
          kind: 'command_execution',
          id: toolUseId || `${messageId || role || 'message'}_tool_result_${index}`,
          status: isError ? 'failed' : 'completed',
          command: '',
          output: output || undefined,
          exitCode: undefined
        } satisfies ExecutionItem;
      }

      return null;
    })
    .filter((item): item is ExecutionItem => Boolean(item));
};

export const buildClaudeSystemItem = (payload: Record<string, unknown>): ExecutionItem | null => {
  const subtype = asString(payload.subtype).trim();
  const model = asString(payload.model).trim();
  const version = asString(payload.claude_code_version).trim();
  const cwd = asString(payload.cwd).trim();
  const tools = asArray(payload.tools).map((tool) => asString(tool)).filter(Boolean);
  const parts = ['Claude Code system'];

  if (subtype) parts.push(`subtype=${subtype}`);
  if (model) parts.push(`model=${model}`);
  if (version) parts.push(`version=${version}`);
  if (cwd) parts.push(`cwd=${cwd}`);
  if (tools.length) parts.push(`tools=${tools.join(', ')}`);

  return {
    kind: 'agent_message',
    id: `system_${subtype || 'message'}_${asString(payload.uuid).trim() || asString(payload.session_id).trim() || 'system'}`,
    status: 'completed',
    text: parts.join(' | ')
  };
};

export const buildClaudeResultItem = (payload: Record<string, unknown>): ExecutionItem | null => {
  const subtype = asString(payload.subtype).trim();
  const resultText = asString(payload.result);
  const errors = Array.isArray(payload.errors) ? payload.errors.map((err) => String(err)) : [];
  const failed = Boolean(payload.is_error) || (subtype && subtype !== 'success') || errors.length > 0;
  const text = resultText || errors.join('\n') || toInlineText(payload, 500);

  if (!text) return null;
  return {
    kind: 'agent_message',
    id: `result_${asString(payload.uuid).trim() || asString(payload.session_id).trim() || 'result'}`,
    status: failed ? 'failed' : 'completed',
    text
  };
};
