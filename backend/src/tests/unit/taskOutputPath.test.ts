import os from 'os';
import path from 'path';
import { buildTaskOutputFilePath } from '../../utils/taskOutputPath';

// Verify provider outputs resolve to the task-group root directory. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124

describe('taskOutputPath', () => {
  test('builds output file path under task-group root', () => {
    const taskGroupDir = path.join(os.tmpdir(), 'hookcode-task-group');
    const { dir, filePath } = buildTaskOutputFilePath({ taskGroupDir, fileName: 'codex-output.txt' });
    expect(dir).toBe(path.resolve(taskGroupDir));
    expect(filePath).toBe(path.join(path.resolve(taskGroupDir), 'codex-output.txt'));
  });
});
