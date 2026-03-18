import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  __test__isUnknownReasoningParamError,
  __test__isUnsupportedReasoningEffortError,
  runCodexExecWithSdk
} from '../../modelProviders/codex';

describe('codex exec', () => {
  const makeTempDir = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'hookcode-codex-'));

  test('runCodexExecWithSdk 会消费 runStreamed events 并写入 output 文件', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      async function* events() {
        yield { type: 'thread.started', thread_id: 't_123' } as any;
        // Ensure HookCode emits diff artifacts for Codex file_change events. yjlphd6rbkrq521ny796
        yield {
          type: 'item.completed',
          item: {
            id: 'item_file_1',
            type: 'file_change',
            changes: [{ path: path.join(repoDir, 'README.md'), kind: 'update' }],
            status: 'completed'
          }
        } as any;
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
      const captureCodexFileDiffEvents = jest.fn(async (_params: any) => [
        {
          type: 'hookcode.file.diff',
          item_id: 'item_file_1',
          path: 'README.md',
          kind: 'update',
          unified_diff: 'diff --git a/README.md b/README.md',
          old_text: 'a',
          new_text: 'b'
        }
      ]) as any;

      const res = await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        // Codex tests rely on default-on network access since config binding was removed. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
        modelReasoningEffort: 'medium',
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any),
          captureCodexFileDiffEvents
        }
      });

      expect(thread.runStreamed).toHaveBeenCalledTimes(1);
      expect(res.threadId).toBe('t_123');
      expect(res.finalResponse).toBe('hi');

      const output = await fs.readFile(path.join(repoDir, 'codex-output.txt'), 'utf8');
      expect(output).toBe('hi');

      expect(logged.some((line) => line.includes('"type":"thread.started"'))).toBe(true);
      expect(logged.some((line) => line.includes('"type":"turn.completed"'))).toBe(true);
      expect(logged.some((line) => line.includes('"type":"hookcode.file.diff"'))).toBe(true);
      expect(captureCodexFileDiffEvents).toHaveBeenCalledTimes(1);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test('runCodexExecWithSdk forwards outputSchema into turn options', async () => {
    // Ensure Codex structured output schemas are passed through to runStreamed. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
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

      const outputSchema = {
        type: 'object',
        properties: { output: { type: 'string' } },
        required: ['output'],
        additionalProperties: false
      };

      await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        modelReasoningEffort: 'medium',
        apiKey: 'test-key',
        outputSchema,
        outputLastMessageFile: 'codex-output.txt',
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });

      expect(thread.runStreamed).toHaveBeenCalledWith('hello', expect.objectContaining({ outputSchema }));
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
        // Codex tests rely on default-on network access since config binding was removed. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
        modelReasoningEffort: 'medium',
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

  test('runCodexExecWithSdk detects unknown reasoning parameter errors', () => {
    // Detect reasoning-param incompatibility text from OpenAI-compatible gateways for fallback retries. docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md worker-stuck-reasoning-20260304
    expect(
      __test__isUnknownReasoningParamError(
        "Error running remote compact task: {\"error\":{\"message\":\"Unknown parameter: 'reasoning'.\",\"param\":\"reasoning\"}}"
      )
    ).toBe(true);
    expect(__test__isUnknownReasoningParamError('network timeout')).toBe(false);
  });

  test('runCodexExecWithSdk detects unsupported reasoning-effort value errors', () => {
    // Detect gateway errors that reject a specific reasoning effort such as `xhigh`. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
    expect(__test__isUnsupportedReasoningEffortError('reasoning value xhigh is invalid; expected one of low, medium, high')).toBe(true);
    expect(__test__isUnsupportedReasoningEffortError('network timeout')).toBe(false);
  });

  test('runCodexExecWithSdk downgrades reasoning effort when the gateway rejects xhigh', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      async function* failingEvents() {
        yield { type: 'thread.started', thread_id: 't_fail' } as any;
        yield {
          type: 'error',
          message: 'remote API error: reasoning value xhigh is invalid; expected one of low, medium, high'
        } as any;
      }

      async function* successEvents() {
        yield { type: 'thread.started', thread_id: 't_ok' } as any;
        yield { type: 'item.completed', item: { type: 'agent_message', text: 'recovered-high' } } as any;
        yield { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } } as any;
      }

      const runStreamedFirst = jest.fn(async () => ({ events: failingEvents() }));
      const runStreamedSecond = jest.fn(async () => ({ events: successEvents() }));

      let startCall = 0;
      const startThreadMock = jest.fn((options: any) => {
        const callIndex = startCall++;
        if (callIndex === 0) return { id: 'thread-first', runStreamed: runStreamedFirst } as any;
        return { id: 'thread-second', runStreamed: runStreamedSecond } as any;
      });

      class FakeCodex {
        constructor(_options: any) {}
        startThread(options: any) {
          return startThreadMock(options);
        }
        resumeThread(_threadId: string, options: any) {
          return startThreadMock(options);
        }
      }

      const logged: string[] = [];
      const result = await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        modelReasoningEffort: 'xhigh',
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });

      expect(result.finalResponse).toBe('recovered-high');
      expect(startThreadMock).toHaveBeenCalledTimes(2);
      expect(startThreadMock.mock.calls[0][0].modelReasoningEffort).toBe('xhigh');
      expect(startThreadMock.mock.calls[1][0].modelReasoningEffort).toBe('high');
      expect(logged.some((line) => line.includes('retrying with high'))).toBe(true);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test('runCodexExecWithSdk retries without reasoning effort when gateway rejects reasoning parameter', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      async function* failingEvents() {
        yield { type: 'thread.started', thread_id: 't_fail' } as any;
        yield {
          type: 'error',
          message:
            "Error running remote compact task: {\"error\":{\"message\":\"Unknown parameter: 'reasoning'.\",\"param\":\"reasoning\"}}"
        } as any;
      }

      async function* successEvents() {
        yield { type: 'thread.started', thread_id: 't_ok' } as any;
        yield { type: 'item.completed', item: { type: 'agent_message', text: 'recovered' } } as any;
        yield { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } } as any;
      }

      const runStreamedFirst = jest.fn(async () => ({ events: failingEvents() }));
      const runStreamedSecond = jest.fn(async () => ({ events: successEvents() }));

      let startCall = 0;
      const startThreadMock = jest.fn((options: any) => {
        const callIndex = startCall++;
        if (callIndex === 0) {
          return { id: 'thread-first', runStreamed: runStreamedFirst } as any;
        }
        return { id: 'thread-second', runStreamed: runStreamedSecond } as any;
      });

      class FakeCodex {
        constructor(_options: any) {}
        startThread(options: any) {
          return startThreadMock(options);
        }
        resumeThread(_threadId: string, options: any) {
          return startThreadMock(options);
        }
      }

      const logged: string[] = [];
      const result = await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: 'gpt-5.2',
        sandbox: 'read-only',
        modelReasoningEffort: 'high',
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });

      expect(result.threadId).toBe('t_ok');
      expect(result.finalResponse).toBe('recovered');
      expect(startThreadMock).toHaveBeenCalledTimes(2);
      expect(startThreadMock.mock.calls[0][0].modelReasoningEffort).toBe('high');
      expect(startThreadMock.mock.calls[1][0].modelReasoningEffort).toBeUndefined();
      expect(logged.some((line) => line.includes('retrying without modelReasoningEffort'))).toBe(true);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test('runCodexExecWithSdk does not hang when stream emits error and iterator close stalls', async () => {
    const repoDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      const stalledEvents = {
        [Symbol.asyncIterator]() {
          let emitted = false;
          return {
            next: async () => {
              if (emitted) return await new Promise<never>(() => {});
              emitted = true;
              return {
                done: false,
                value: { type: 'error', message: 'Error running remote compact task: {"error":{"message":"Unknown parameter: \'reasoning\'."}}' }
              } as any;
            },
            return: async () => await new Promise<never>(() => {})
          };
        }
      };

      const thread = {
        id: 't_stalled',
        runStreamed: jest.fn(async () => ({ events: stalledEvents as any }))
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
        apiKey: 'test-key',
        outputLastMessageFile: 'codex-output.txt',
        __internal: {
          importCodexSdk: async () => ({ Codex: FakeCodex } as any)
        }
      });

      await expect(Promise.race([run, timeout])).rejects.toThrow(/Unknown parameter: 'reasoning'|reasoning parameter/i);
      if (timeoutId) clearTimeout(timeoutId);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });
});
