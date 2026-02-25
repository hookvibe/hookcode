import { describe, expect, test } from 'vitest';
import { extractTaskResultSuggestions, extractTaskResultText, extractTaskUserText, isTerminalStatus } from '../utils/task';

describe('task utils', () => {
  test('isTerminalStatus covers terminal task states', () => {
    expect(isTerminalStatus('queued' as any)).toBe(false);
    expect(isTerminalStatus('processing' as any)).toBe(false);
    expect(isTerminalStatus('succeeded' as any)).toBe(true);
    expect(isTerminalStatus('failed' as any)).toBe(true);
    expect(isTerminalStatus('commented' as any)).toBe(true);
  });

  test('extractTaskUserText prefers chat payload over provider comments', () => {
    expect(
      extractTaskUserText({
        id: 't',
        eventType: 'chat',
        status: 'queued',
        retries: 0,
        createdAt: '',
        updatedAt: '',
        payload: { __chat: { text: '  hi  ' } },
        title: 'Title fallback'
      } as any)
    ).toBe('hi');

    expect(
      extractTaskUserText({
        id: 't',
        eventType: 'issue_comment',
        status: 'queued',
        retries: 0,
        createdAt: '',
        updatedAt: '',
        payload: { object_attributes: { note: ' gitlab note ' } },
        title: 'Title fallback'
      } as any)
    ).toBe('gitlab note');

    expect(
      extractTaskUserText({
        id: 't',
        eventType: 'issue_comment',
        status: 'queued',
        retries: 0,
        createdAt: '',
        updatedAt: '',
        payload: { comment: { body: ' github comment ' } },
        title: 'Title fallback'
      } as any)
    ).toBe('github comment');

    expect(
      extractTaskUserText({
        id: 't',
        eventType: 'issue',
        status: 'queued',
        retries: 0,
        createdAt: '',
        updatedAt: '',
        payload: {},
        title: ' Title fallback '
      } as any)
    ).toBe('Title fallback');
  });

  test('extractTaskResultText prefers outputText/summary/message/logs in that order', () => {
    expect(extractTaskResultText(null)).toBe('');

    expect(extractTaskResultText({ result: { outputText: '  output  ' } } as any)).toBe('output');
    expect(extractTaskResultText({ result: { summary: '  summary  ' } } as any)).toBe('summary');
    expect(extractTaskResultText({ result: { message: '  message  ' } } as any)).toBe('message');
    expect(extractTaskResultText({ result: { logs: ['a', 'b'] } } as any)).toBe('a\nb');
    expect(extractTaskResultText({ result: {} } as any)).toBe('');
  });

  test('extractTaskResultText pulls structured output and suggestions from JSON outputText', () => {
    // Validate structured Codex outputs for result rendering + suggestion buttons. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const outputText = JSON.stringify({
      output: 'Hello world',
      next_actions: ['Action 1', 'Action 2', 'Action 3', 'Action 4']
    });

    expect(extractTaskResultText({ result: { outputText } } as any)).toBe('Hello world');
    expect(extractTaskResultSuggestions({ result: { outputText } } as any)).toEqual(['Action 1', 'Action 2', 'Action 3']);
  });
});
