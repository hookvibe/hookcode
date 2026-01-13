import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { runGeminiCliExecWithCli } from '../../modelProviders/geminiCli';

describe('gemini_cli exec', () => {
  const makeTempDir = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'hookcode-gemini-cli-'));

  const createSpawnStub = () => {
    return jest.fn((_cmd: string, _args: string[], _opts: any) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();

      const child = new EventEmitter() as any;
      child.stdout = stdout;
      child.stderr = stderr;
      child.stdin = stdin;
      child.killed = false;
      child.kill = jest.fn(() => {
        child.killed = true;
        return true;
      });

      stdin.on('finish', () => {
        stdout.write(`${JSON.stringify({ type: 'init', session_id: 'sess_123', model: 'gemini-2.5-pro' })}\n`);
        stdout.write(
          `${JSON.stringify({
            type: 'result',
            result: { output: 'hi' },
            stats: { input_tokens: 1, output_tokens: 2, total_tokens: 3 }
          })}\n`
        );
        stdout.end();
        stderr.end();
        child.emit('close', 0, null);
      });

      return child;
    });
  };

  test('runGeminiCliExecWithCli 会消费 stream-json 输出并写入 output 文件', async () => {
    const repoDir = await makeTempDir();
    const geminiHomeDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      const spawnStub = createSpawnStub();
      const logged: string[] = [];

      const res = await runGeminiCliExecWithCli({
        repoDir,
        promptFile,
        model: 'gemini-2.5-pro',
        sandbox: 'read-only',
        networkAccess: false,
        apiKey: 'AIza-test',
        outputLastMessageFile: 'gemini-output.txt',
        geminiHomeDir,
        logLine: async (line) => {
          logged.push(line);
        },
        __internal: {
          resolveGeminiCliEntrypoint: async () => 'fake-gemini-entry.js',
          spawn: spawnStub as any
        }
      });

      expect(spawnStub).toHaveBeenCalledTimes(1);
      expect(res.threadId).toBe('sess_123');
      expect(res.finalResponse).toBe('hi');

      const output = await fs.readFile(path.join(repoDir, 'gemini-output.txt'), 'utf8');
      expect(output).toBe('hi');

      expect(logged.some((line) => line.includes('"type":"init"') && line.includes('"session_id":"sess_123"'))).toBe(true);
      expect(logged.some((line) => line.includes('"type":"result"') && line.includes('"input_tokens"'))).toBe(true);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
      await fs.rm(geminiHomeDir, { recursive: true, force: true });
    }
  });

  test('runGeminiCliExecWithCli 在 logLine 卡住时也不会卡住执行流程', async () => {
    const repoDir = await makeTempDir();
    const geminiHomeDir = await makeTempDir();
    try {
      const promptFile = path.join(repoDir, 'prompt.txt');
      await fs.writeFile(promptFile, 'hello', 'utf8');

      const spawnStub = createSpawnStub();
      const never = async () => await new Promise<void>(() => {});

      let timeoutId: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), 2000);
      });

      const run = runGeminiCliExecWithCli({
        repoDir,
        promptFile,
        model: 'gemini-2.5-pro',
        sandbox: 'read-only',
        networkAccess: false,
        apiKey: 'AIza-test',
        outputLastMessageFile: 'gemini-output.txt',
        geminiHomeDir,
        logLine: never,
        __internal: {
          resolveGeminiCliEntrypoint: async () => 'fake-gemini-entry.js',
          spawn: spawnStub as any
        }
      });

      const result = await Promise.race([run, timeout]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

      expect(result.threadId).toBe('sess_123');
      expect(result.finalResponse).toBe('hi');
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
      await fs.rm(geminiHomeDir, { recursive: true, force: true });
    }
  });
});

