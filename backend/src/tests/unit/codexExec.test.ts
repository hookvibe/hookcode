import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { runCodexExecWithSdk } from '../../modelProviders/codex';

describe('codex exec', () => {
  const makeTempDir = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'hookcode-codex-'));

  test('runCodexExecWithSdk 会消费 runStreamed events 并写入 output 文件', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      async function* events() {
        yield { type: 'thread.started', thread_id: 't_123' } as any;
        yield { type: 'item.completed', item: { type: 'agent_message', text: 'hi' } } as any;
        yield { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } } as any;
      }

      const thread = {
        id: 't_fallback',
        runStreamed: jest.fn(async () => ({ events: events() }))
      };

      class FakeCodex {
        constructor(_options: any) {}
        startThread() {
          return thread as any;
        }
        resumeThread() {
          return thread as any;
        }
      }

      const logged: string[] = [];

      const res = await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        modelReasoningEffort: 'medium',
        networkAccess: false,
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });

      expect(thread.runStreamed).toHaveBeenCalledTimes(1);
      expect(res.threadId).toBe('t_123');
      expect(res.finalResponse).toBe('hi');

      const output = await fs.readFile(path.join(repoDir, 'codex-output.txt'), 'utf8');
      expect(output).toBe('hi');

      expect(logged.some((line) => line.includes('"type":"thread.started"'))).toBe(true);
      expect(logged.some((line) => line.includes('"type":"turn.completed"'))).toBe(true);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test('runCodexExecWithSdk 在 logLine 卡住时也不会卡住执行流程', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      async function* events() {
        yield { type: 'thread.started', thread_id: 't_123' } as any;
        yield { type: 'item.completed', item: { type: 'agent_message', text: 'hi' } } as any;
        yield { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } } as any;
      }

      const thread = {
        id: 't_fallback',
        runStreamed: jest.fn(async () => ({ events: events() }))
      };

      class FakeCodex {
        constructor(_options: any) {}
        startThread() {
          return thread as any;
        }
        resumeThread() {
          return thread as any;
        }
      }

      const never = async () => await new Promise<void>(() => {});

      let timeoutId: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), 2000);
      });
      const run = runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        modelReasoningEffort: 'medium',
        networkAccess: false,
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        logLine: never,
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });
      const result = await Promise.race([run, timeout]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

      expect(result.threadId).toBe('t_123');
      expect(result.finalResponse).toBe('hi');
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });
});
