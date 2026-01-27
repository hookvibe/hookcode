import { describe, expect, test } from 'vitest';
import { applyExecutionLogLine, buildExecutionTimeline, createEmptyTimeline, parseExecutionLogLine } from '../utils/executionLog';

// Extend execution log parsing tests for Claude Code JSONL support. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123

describe('executionLog', () => {
  test('parseExecutionLogLine parses Codex command_execution items', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'item_1',
        type: 'command_execution',
        command: '/bin/zsh -lc ls',
        aggregated_output: 'hello',
        exit_code: 0,
        status: 'completed'
      }
    });

    const parsed = parseExecutionLogLine(line);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('item');
    if (parsed[0].kind !== 'item') return;
    expect(parsed[0].item.kind).toBe('command_execution');
    if (parsed[0].item.kind !== 'command_execution') return;
    expect(parsed[0].item.command).toContain('ls');
    expect(parsed[0].item.output).toBe('hello');
    expect(parsed[0].item.exitCode).toBe(0);
  });

  test('parseExecutionLogLine parses HookCode file diff events', () => {
    const line = JSON.stringify({
      type: 'hookcode.file.diff',
      item_id: 'item_file_1',
      path: 'README.md',
      kind: 'update',
      unified_diff: 'diff --git a/README.md b/README.md',
      old_text: 'a',
      new_text: 'b'
    });

    const parsed = parseExecutionLogLine(line);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('file_diff');
    if (parsed[0].kind !== 'file_diff') return;
    expect(parsed[0].itemId).toBe('item_file_1');
    expect(parsed[0].diff.path).toBe('README.md');
    expect(parsed[0].diff.oldText).toBe('a');
    expect(parsed[0].diff.newText).toBe('b');
  });

  test('parseExecutionLogLine parses Claude Code assistant text messages', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_1',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from Claude Code' }]
      }
    });

    const parsed = parseExecutionLogLine(line);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('item');
    if (parsed[0].kind !== 'item') return;
    expect(parsed[0].item.kind).toBe('agent_message');
    if (parsed[0].item.kind !== 'agent_message') return;
    expect(parsed[0].item.text).toContain('Claude Code');
  });

  test('buildExecutionTimeline merges Claude Code tool_use and tool_result entries', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg_2',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tooluse_1', name: 'Glob', input: { pattern: '*' } }]
        }
      }),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tooluse_1', content: 'matched.txt' }]
        }
      })
    ];

    const timeline = buildExecutionTimeline(lines);
    const tool = timeline.items.find((item) => item.id === 'tooluse_1');
    expect(tool?.kind).toBe('command_execution');
    if (tool?.kind !== 'command_execution') return;
    expect(tool.command).toContain('Glob');
    expect(tool.output).toContain('matched.txt');
    expect(tool.status).toBe('completed');
  });

  test('buildExecutionTimeline merges started/completed items and attaches diffs', () => {
    // Keep the reducer stable for real-time streaming updates. yjlphd6rbkrq521ny796
    const lines = [
      JSON.stringify({
        type: 'item.started',
        item: { id: 'cmd_1', type: 'command_execution', command: 'echo hi', aggregated_output: '', exit_code: null, status: 'in_progress' }
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'cmd_1', type: 'command_execution', command: 'echo hi', aggregated_output: 'hi', exit_code: 0, status: 'completed' }
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'fc_1', type: 'file_change', changes: [{ path: '/tmp/a.txt', kind: 'update' }], status: 'completed' }
      }),
      JSON.stringify({
        type: 'hookcode.file.diff',
        item_id: 'fc_1',
        path: 'a.txt',
        kind: 'update',
        unified_diff: 'diff --git a/a.txt b/a.txt',
        old_text: 'a',
        new_text: 'b'
      })
    ];

    const timeline = buildExecutionTimeline(lines);
    expect(timeline.items.length).toBe(2);

    const cmd = timeline.items.find((i) => i.id === 'cmd_1');
    expect(cmd?.kind).toBe('command_execution');
    if (cmd?.kind === 'command_execution') {
      expect(cmd.status).toBe('completed');
      expect(cmd.output).toBe('hi');
    }

    const fc = timeline.items.find((i) => i.id === 'fc_1');
    expect(fc?.kind).toBe('file_change');
    if (fc?.kind === 'file_change') {
      expect(fc.diffs.length).toBe(1);
      expect(fc.diffs[0].oldText).toBe('a');
    }

    const applied = applyExecutionLogLine(createEmptyTimeline(), lines[0]);
    expect(applied.items.length).toBe(1);
  });
});
