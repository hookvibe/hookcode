import { createHash } from 'crypto';
// Use cross-platform spawn for git on Windows. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
import { xSpawn } from './crossPlatformSpawn';
import { readFile } from 'fs/promises';
import path from 'path';

type WorkspaceChangeKind = 'create' | 'update' | 'delete' | (string & {});

type WorkspaceChange = {
  path: string;
  kind?: WorkspaceChangeKind;
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
  diffHash: string;
  updatedAt: string;
};

export type WorkspaceChangesSnapshot = {
  capturedAt: string;
  files: WorkspaceChange[];
};

const WORKSPACE_SNAPSHOT_EVENT_TYPE = 'hookcode.workspace.snapshot';
const MAX_DIFF_CHARS = 200_000;
const MAX_TEXT_CHARS = 200_000;

type GitResult = {
  code: number;
  stdout: string;
};

type ChangedPath = {
  path: string;
  kind: WorkspaceChangeKind;
};

const truncate = (value: string | undefined, maxChars: number): string | undefined => {
  if (!value) return undefined;
  return value.length > maxChars ? value.slice(0, maxChars) : value;
};

const diffHash = (unifiedDiff: string, oldText?: string, newText?: string): string =>
  createHash('sha1')
    // Hash diff payloads so the worker only patches backend state when repo file content actually changes. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    .update(unifiedDiff)
    .update('\n--old--\n')
    .update(oldText ?? '')
    .update('\n--new--\n')
    .update(newText ?? '')
    .digest('hex');

const runGit = async (repoDir: string, args: string[]): Promise<GitResult> =>
  await new Promise((resolve) => {
    const child = xSpawn('git', args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_DIFF_CHARS) stdout = stdout.slice(0, MAX_DIFF_CHARS);
    });
    child.on('error', () => resolve({ code: 1, stdout }));
    child.on('close', (code) => resolve({ code: typeof code === 'number' ? code : 1, stdout }));
  });

const splitNulls = (raw: string): string[] =>
  String(raw ?? '')
    .split('\0')
    .filter((entry) => entry.length > 0);

const collectChangedPaths = async (repoDir: string): Promise<ChangedPath[]> => {
  const [tracked, untracked] = await Promise.all([
    runGit(repoDir, ['diff', '--name-status', '-z', 'HEAD', '--']),
    runGit(repoDir, ['ls-files', '--others', '--exclude-standard', '-z'])
  ]);

  const merged = new Map<string, WorkspaceChangeKind>();
  const trackedEntries = splitNulls(tracked.stdout);
  for (let index = 0; index < trackedEntries.length; index += 1) {
    const statusRaw = trackedEntries[index] ?? '';
    if (!statusRaw) continue;
    const code = statusRaw[0] ?? 'M';
    if (code === 'R' || code === 'C') {
      const nextPath = String(trackedEntries[index + 2] ?? '').replace(/\\/g, '/').trim();
      index += 2;
      if (nextPath) merged.set(nextPath, 'update');
      continue;
    }
    const nextPath = String(trackedEntries[index + 1] ?? '').replace(/\\/g, '/').trim();
    index += 1;
    if (!nextPath) continue;
    merged.set(nextPath, code === 'A' ? 'create' : code === 'D' ? 'delete' : 'update');
  }

  for (const nextPath of splitNulls(untracked.stdout).map((entry) => entry.replace(/\\/g, '/').trim()).filter(Boolean)) {
    merged.set(nextPath, 'create');
  }

  return Array.from(merged.entries())
    .map(([filePath, kind]) => ({ path: filePath, kind }))
    .sort((fileA, fileB) => fileA.path.localeCompare(fileB.path));
};

const readHeadText = async (repoDir: string, filePath: string): Promise<string | undefined> => {
  const result = await runGit(repoDir, ['show', `HEAD:${filePath}`]);
  return result.code === 0 ? truncate(result.stdout, MAX_TEXT_CHARS) : undefined;
};

const readWorkingText = async (targetPath: string): Promise<string | undefined> => {
  try {
    const text = await readFile(targetPath, 'utf8');
    return truncate(text, MAX_TEXT_CHARS);
  } catch {
    return undefined;
  }
};

const collectSnapshot = async (repoDir: string): Promise<WorkspaceChangesSnapshot | null> => {
  const changed = await collectChangedPaths(repoDir);
  if (!changed.length) return null;

  const files: WorkspaceChange[] = [];
  for (const file of changed) {
    const absPath = path.join(repoDir, file.path);
    const diffArgs =
      file.kind === 'create'
        // Diff new files from the repo root so streamed patches keep repo-relative headers for the frontend. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
        ? ['diff', '--no-color', '--unified=3', '--no-index', '--', '/dev/null', file.path]
        : file.kind === 'delete'
          // Reuse `git diff HEAD -- <path>` for deletes because the working-tree file no longer exists. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
          ? ['diff', '--no-color', '--unified=3', 'HEAD', '--', file.path]
          : ['diff', '--no-color', '--unified=3', 'HEAD', '--', file.path];
    const [diffRes, oldText, newText] = await Promise.all([
      runGit(repoDir, diffArgs),
      file.kind === 'create' ? Promise.resolve(undefined) : readHeadText(repoDir, file.path),
      file.kind === 'delete' ? Promise.resolve(undefined) : readWorkingText(absPath)
    ]);

    const unifiedDiff = truncate(diffRes.stdout, MAX_DIFF_CHARS) ?? '';
    files.push({
      path: file.path,
      kind: file.kind,
      unifiedDiff,
      oldText,
      newText,
      diffHash: diffHash(unifiedDiff, oldText, newText),
      updatedAt: new Date().toISOString()
    });
  }

  return { capturedAt: new Date().toISOString(), files };
};

const filterAgainstBaseline = (
  snapshot: WorkspaceChangesSnapshot | null,
  baseline: WorkspaceChangesSnapshot | null
): WorkspaceChangesSnapshot | null => {
  const baselineMap = new Map((baseline?.files ?? []).map((file) => [file.path, file.diffHash]));
  const files = (snapshot?.files ?? []).filter((file) => baselineMap.get(file.path) !== file.diffHash);
  if (!files.length) return null;
  return { capturedAt: snapshot?.capturedAt ?? new Date().toISOString(), files };
};

export class RepoChangeTracker {
  private readonly pollIntervalMs: number;
  private baseline: WorkspaceChangesSnapshot | null = null;
  private lastSnapshot: WorkspaceChangesSnapshot | null | undefined = undefined;
  private timer: NodeJS.Timeout | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly params: {
      repoDir: string;
      emitLine: (line: string) => void;
      patchSnapshot: (snapshot: WorkspaceChangesSnapshot | null) => Promise<void>;
      pollIntervalMs?: number;
    }
  ) {
    this.pollIntervalMs = params.pollIntervalMs ?? 1200;
  }

  async start(): Promise<void> {
    this.baseline = await collectSnapshot(this.params.repoDir);
    this.lastSnapshot = filterAgainstBaseline(this.baseline, this.baseline);
    this.timer = setInterval(() => {
      void this.sync();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.sync();
  }

  private async sync(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const nextSnapshot = filterAgainstBaseline(await collectSnapshot(this.params.repoDir), this.baseline);
      if (!this.changed(nextSnapshot)) return;
      this.lastSnapshot = nextSnapshot;
      await this.params.patchSnapshot(nextSnapshot);
      this.params.emitLine(
        JSON.stringify({
          // Stream workspace change snapshots through task logs so the frontend can update file panels during worker runs. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
          type: WORKSPACE_SNAPSHOT_EVENT_TYPE,
          snapshot: nextSnapshot
        })
      );
    }).catch(() => undefined);

    await this.queue;
  }

  private changed(nextSnapshot: WorkspaceChangesSnapshot | null): boolean {
    if (this.lastSnapshot === undefined) return true;
    const prevFiles = this.lastSnapshot?.files ?? [];
    const nextFiles = nextSnapshot?.files ?? [];
    if (prevFiles.length !== nextFiles.length) return true;
    for (let index = 0; index < nextFiles.length; index += 1) {
      const prev = prevFiles[index];
      const next = nextFiles[index];
      if (!prev || prev.path !== next.path || prev.diffHash !== next.diffHash || prev.kind !== next.kind) {
        return true;
      }
    }
    return false;
  }
}
