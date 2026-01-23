import { describe, expect, test } from 'vitest';
import { applyExecutionLogLine, buildExecutionTimeline, createEmptyTimeline, parseExecutionLogLine } from '../utils/executionLog';

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
    expect(parsed.kind).toBe('item');
    if (parsed.kind !== 'item') return;
    expect(parsed.item.kind).toBe('command_execution');
    if (parsed.item.kind !== 'command_execution') return;
    expect(parsed.item.command).toContain('ls');
    expect(parsed.item.output).toBe('hello');
    expect(parsed.item.exitCode).toBe(0);
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
    expect(parsed.kind).toBe('file_diff');
    if (parsed.kind !== 'file_diff') return;
    expect(parsed.itemId).toBe('item_file_1');
    expect(parsed.diff.path).toBe('README.md');
    expect(parsed.diff.oldText).toBe('a');
    expect(parsed.diff.newText).toBe('b');
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

