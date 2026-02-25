import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { runClaudeCodeExecWithSdk } from '../../modelProviders/claudeCode';

describe('claude_code exec', () => {
  const makeTempDir = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'hookcode-claude-code-'));

  test('runClaudeCodeExecWithSdk 会消费 query messages 并写入 output 文件', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      const query = jest.fn(() =>
        (async function* () {
          // SDK shape: init message provides `session_id`, and the final `result:success` provides `result`.
          yield { type: 'system', subtype: 'init', session_id: 'sess_123' } as any;
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'sess_123',
            result: 'hi',
            usage: { input_tokens: 1, output_tokens: 2 }
          } as any;
        })()
      );

      const logged: string[] = [];
      const res = await runClaudeCodeExecWithSdk({
        repoDir,
        promptFile,
        model: 'claude-sonnet-4-5-20250929',
        sandbox: 'read-only',
        networkAccess: false,
        apiKey: 'sk-ant-test',
        outputLastMessageFile: 'claude-output.txt',
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          importClaudeSdk: async () => ({ query } as any)
        }
      });

      expect(query).toHaveBeenCalledTimes(1);
      expect(res.threadId).toBe('sess_123');
      expect(res.finalResponse).toBe('hi');

      const output = await fs.readFile(path.join(repoDir, 'claude-output.txt'), 'utf8');
      expect(output).toBe('hi');

      expect(logged.some((line) => line.includes('"type":"system"') && line.includes('"subtype":"init"'))).toBe(true);
      expect(logged.some((line) => line.includes('"type":"result"') && line.includes('"subtype":"success"'))).toBe(true);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test('runClaudeCodeExecWithSdk uses workspaceDir for cwd and tool boundaries', async () => {
    const repoDir = await makeTempDir();
    const workspaceDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      let capturedOptions: any;
      const query = jest.fn((params: any) => {
        capturedOptions = params.options;
        return (async function* () {
          yield { type: 'system', subtype: 'init', session_id: 'sess_456' } as any;
          yield { type: 'result', subtype: 'success', session_id: 'sess_456', result: 'ok' } as any;
        })();
      });

      await runClaudeCodeExecWithSdk({
        repoDir,
        workspaceDir,
        promptFile,
        model: 'claude-sonnet-4-5-20250929',
        sandbox: 'read-only',
        networkAccess: false,
        apiKey: 'sk-ant-test',
        outputLastMessageFile: 'claude-output.txt',
        __internal: {
          importClaudeSdk: async () => ({ query } as any)
        }
      });

      // Validate workspace-root execution for Claude Code tool access. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205
      expect(capturedOptions.cwd).toBe(workspaceDir);
      await expect(
        capturedOptions.canUseTool('Read', { file_path: path.join(workspaceDir, 'note.txt') })
      ).resolves.toMatchObject({ behavior: 'allow' });
      await expect(
        capturedOptions.canUseTool('Read', { file_path: 'note.txt' })
      ).resolves.toMatchObject({ behavior: 'allow' });
      await expect(
        capturedOptions.canUseTool('Read', { file_path: path.join(os.tmpdir(), 'outside.txt') })
      ).resolves.toMatchObject({ behavior: 'deny' });
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  test('runClaudeCodeExecWithSdk 在 logLine 卡住时也不会卡住执行流程', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      const query = jest.fn(() =>
        (async function* () {
          yield { type: 'system', subtype: 'init', session_id: 'sess_123' } as any;
          yield { type: 'result', subtype: 'success', session_id: 'sess_123', result: 'hi' } as any;
        })()
      );

      const never = async () => await new Promise<void>(() => {});

      let timeoutId: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), 2000);
      });
      const run = runClaudeCodeExecWithSdk({
        repoDir,
        promptFile,
        model: 'claude-sonnet-4-5-20250929',
        sandbox: 'read-only',
        networkAccess: false,
        apiKey: 'sk-ant-test',
        outputLastMessageFile: 'claude-output.txt',
        logLine: never,
        __internal: {
          importClaudeSdk: async () => ({ query } as any)
        }
      });
      const result = await Promise.race([run, timeout]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

      expect(result.threadId).toBe('sess_123');
      expect(result.finalResponse).toBe('hi');
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });
});
