import os from 'os';
import path from 'path';
import { buildTaskOutputFilePath, resolveTaskOutputRoot } from '../../utils/taskOutputPath';

// Verify task-scoped output paths stay outside repo by default and honor env overrides. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

describe('taskOutputPath', () => {
  const prevOutputDir = process.env.HOOKCODE_TASK_OUTPUT_DIR;

  afterEach(() => {
    setEnv('HOOKCODE_TASK_OUTPUT_DIR', prevOutputDir);
  });

  test('uses env output root when provided', () => {
    const envRoot = path.join(os.tmpdir(), 'hookcode-outputs');
    setEnv('HOOKCODE_TASK_OUTPUT_DIR', envRoot);
    const resolved = resolveTaskOutputRoot();
    expect(resolved.root).toBe(path.resolve(envRoot));
    expect(resolved.source).toBe('env');
  });

  test('falls back to default when env root points inside repo', () => {
    const repoDir = path.join(os.tmpdir(), 'hookcode-repo');
    setEnv('HOOKCODE_TASK_OUTPUT_DIR', path.join(repoDir, 'outputs'));
    const resolved = resolveTaskOutputRoot({ repoDir });
    expect(resolved.source).toBe('repo-conflict');
    expect(resolved.root).toBe(path.join(os.homedir(), '.hookcode', 'task-outputs'));
  });

  test('builds task-scoped output file path', () => {
    const envRoot = path.join(os.tmpdir(), 'hookcode-outputs');
    setEnv('HOOKCODE_TASK_OUTPUT_DIR', envRoot);
    const { dir, filePath } = buildTaskOutputFilePath({ taskId: 'task_123', fileName: 'codex-output.txt' });
    expect(dir).toBe(path.join(path.resolve(envRoot), 'task_123'));
    expect(filePath).toBe(path.join(path.resolve(envRoot), 'task_123', 'codex-output.txt'));
  });
});
