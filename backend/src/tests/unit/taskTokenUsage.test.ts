import {
  addTaskTokenUsage,
  extractClaudeCodeExecThreadIdFromLine,
  extractClaudeCodeExecTokenUsageDeltaFromLine,
  extractCodexExecThreadIdFromLine,
  extractCodexExecTokenUsageDeltaFromLine,
  extractGeminiCliExecThreadIdFromLine,
  extractGeminiCliExecTokenUsageDeltaFromLine
} from '../../services/taskTokenUsage';

describe('taskTokenUsage', () => {
  test('extractCodexExecTokenUsageDeltaFromLine: parses turn.completed usage', () => {
    const line = JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 10, cached_input_tokens: 3, output_tokens: 5 }
    });
    expect(extractCodexExecTokenUsageDeltaFromLine(line)).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  test('extractClaudeCodeExecTokenUsageDeltaFromLine: parses result usage', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 7, output_tokens: 9 }
    });
    expect(extractClaudeCodeExecTokenUsageDeltaFromLine(line)).toEqual({ inputTokens: 7, outputTokens: 9, totalTokens: 16 });
  });

  test('extractGeminiCliExecTokenUsageDeltaFromLine: parses result stats usage', () => {
    const line = JSON.stringify({
      type: 'result',
      result: { output: 'hi' },
      stats: { input_tokens: 3, output_tokens: 4, total_tokens: 7 }
    });
    expect(extractGeminiCliExecTokenUsageDeltaFromLine(line)).toEqual({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });
  });

  test('extractCodexExecTokenUsageDeltaFromLine: ignores invalid json', () => {
    expect(extractCodexExecTokenUsageDeltaFromLine('{oops')).toBeNull();
  });

  test('extractCodexExecTokenUsageDeltaFromLine: ignores json without usage', () => {
    expect(extractCodexExecTokenUsageDeltaFromLine(JSON.stringify({ type: 'turn.started' }))).toBeNull();
  });

  test('extractClaudeCodeExecTokenUsageDeltaFromLine: ignores non-result messages', () => {
    expect(extractClaudeCodeExecTokenUsageDeltaFromLine(JSON.stringify({ type: 'system', subtype: 'init' }))).toBeNull();
  });

  test('extractGeminiCliExecTokenUsageDeltaFromLine: ignores non-result messages', () => {
    expect(extractGeminiCliExecTokenUsageDeltaFromLine(JSON.stringify({ type: 'init', session_id: 'sess_1' }))).toBeNull();
  });

  test('addTaskTokenUsage: accumulates totals', () => {
    const a = addTaskTokenUsage(undefined, { inputTokens: 2, outputTokens: 3, totalTokens: 5 });
    expect(a).toEqual({ inputTokens: 2, outputTokens: 3, totalTokens: 5 });

    const b = addTaskTokenUsage(a, { inputTokens: 10, outputTokens: 1, totalTokens: 11 });
    expect(b).toEqual({ inputTokens: 12, outputTokens: 4, totalTokens: 16 });
  });

  test('extractCodexExecThreadIdFromLine: parses thread.started', () => {
    const line = JSON.stringify({ type: 'thread.started', thread_id: 't_123' });
    expect(extractCodexExecThreadIdFromLine(line)).toBe('t_123');
  });

  test('extractClaudeCodeExecThreadIdFromLine: parses system:init session_id', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess_1' });
    expect(extractClaudeCodeExecThreadIdFromLine(line)).toBe('sess_1');
  });

  test('extractGeminiCliExecThreadIdFromLine: parses init session_id', () => {
    const line = JSON.stringify({ type: 'init', session_id: 'sess_1', model: 'gemini-2.5-pro' });
    expect(extractGeminiCliExecThreadIdFromLine(line)).toBe('sess_1');
  });

  test('extractCodexExecThreadIdFromLine: ignores non thread.started events', () => {
    const line = JSON.stringify({ type: 'turn.started' });
    expect(extractCodexExecThreadIdFromLine(line)).toBeNull();
  });

  test('extractClaudeCodeExecThreadIdFromLine: ignores non init messages', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'other', session_id: 'sess_1' });
    expect(extractClaudeCodeExecThreadIdFromLine(line)).toBeNull();
  });

  test('extractGeminiCliExecThreadIdFromLine: ignores non init messages', () => {
    const line = JSON.stringify({ type: 'result', session_id: 'sess_1' });
    expect(extractGeminiCliExecThreadIdFromLine(line)).toBeNull();
  });

  test('extractCodexExecThreadIdFromLine: ignores invalid json', () => {
    expect(extractCodexExecThreadIdFromLine('{oops')).toBeNull();
  });
});
