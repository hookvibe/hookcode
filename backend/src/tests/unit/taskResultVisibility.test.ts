import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';

describe('taskResultVisibility.sanitizeTaskForViewer', () => {
  test('removes logs for non-log viewers but keeps outputText when enabled', () => {
    const task = {
      id: 't1',
      result: { logs: ['l1'], outputText: 'OUT', providerCommentUrl: 'u' }
    };

    const next = sanitizeTaskForViewer(task, { canViewLogs: false, includeOutputText: true });

    expect(next.result).toEqual({ outputText: 'OUT', providerCommentUrl: 'u' });
  });

  test('removes outputText when disabled', () => {
    const task = {
      id: 't1',
      result: { logs: ['l1'], outputText: 'OUT', providerCommentUrl: 'u' }
    };

    const next = sanitizeTaskForViewer(task, { canViewLogs: true, includeOutputText: false });

    expect(next.result).toEqual({ logs: ['l1'], providerCommentUrl: 'u', summary: 'OUT' });
  });
});
