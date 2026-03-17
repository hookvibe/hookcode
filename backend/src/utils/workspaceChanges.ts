import { createHash } from 'crypto';
// Use cross-platform spawn options to handle .cmd shims on Windows. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
import { spawn } from 'child_process';
import { xpSpawnOpts } from './crossPlatformSpawn';
import path from 'path';
import { readFile } from 'fs/promises';
import type { TaskWorkspaceChange, TaskWorkspaceChangeKind, TaskWorkspaceChanges } from '../types/task';

export const WORKSPACE_SNAPSHOT_EVENT_TYPE = 'hookcode.workspace.snapshot' as const;

const MAX_WORKSPACE_DIFF_CHARS = 200_000;
const MAX_WORKSPACE_TEXT_CHARS = 200_000;

type GitCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type GitChangedFile = {
  path: string;
  kind: TaskWorkspaceChangeKind;
};

type WorkspaceSnapshotLogLine = {
  type: typeof WORKSPACE_SNAPSHOT_EVENT_TYPE;
  snapshot: TaskWorkspaceChanges | null;
};

const normalizeRepoRelativePath = (rawPath: string): string => {
  const normalized = String(rawPath ?? '').replace(/\\/g, '/').replace(/^\.\/+/u, '').trim();
  return normalized;
};

const truncateText = (value: string | null | undefined, maxChars: number): string | undefined => {
  if (!value) return undefined;
  return value.length > maxChars ? value.slice(0, maxChars) : value;
};

const hashDiff = (unifiedDiff: string, oldText?: string, newText?: string): string =>
  createHash('sha1')
    // Hash diff/text payloads so trackers can cheaply detect file-level changes without comparing large strings. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    .update(unifiedDiff)
    .update('\n--old--\n')
    .update(oldText ?? '')
    .update('\n--new--\n')
    .update(newText ?? '')
    .digest('hex');

const readUtf8BestEffort = async (targetPath: string): Promise<string | undefined> => {
  try {
    const text = await readFile(targetPath, 'utf8');
    return truncateText(text, MAX_WORKSPACE_TEXT_CHARS);
  } catch {
    return undefined;
  }
};

const runGit = async (repoDir: string, args: string[]): Promise<GitCommandResult> =>
  await new Promise((resolve) => {
    const child = spawn('git', args, xpSpawnOpts({
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe']
    }));

    let stdout = '';
    let stderr = '';

    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_WORKSPACE_DIFF_CHARS) stdout = stdout.slice(0, MAX_WORKSPACE_DIFF_CHARS);
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 8000) stderr = stderr.slice(0, 8000);
    });
    child.on('error', () => resolve({ exitCode: 1, stdout, stderr }));
    child.on('close', (code) => resolve({ exitCode: typeof code === 'number' ? code : 1, stdout, stderr }));
  });

const splitNullSeparated = (raw: string): string[] =>
  String(raw ?? '')
    .split('\0')
    .filter((entry) => entry.length > 0);

const parseChangedFiles = (raw: string): GitChangedFile[] => {
  const entries = splitNullSeparated(raw);
  const files: GitChangedFile[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const statusRaw = entries[index] ?? '';
    if (!statusRaw) continue;

    const code = statusRaw[0] ?? 'M';
    if (code === 'R' || code === 'C') {
      const _fromPath = normalizeRepoRelativePath(entries[index + 1] ?? '');
      const toPath = normalizeRepoRelativePath(entries[index + 2] ?? '');
      index += 2;
      if (toPath) files.push({ path: toPath, kind: 'update' });
      continue;
    }

    const filePath = normalizeRepoRelativePath(entries[index + 1] ?? '');
    index += 1;
    if (!filePath) continue;
    files.push({
      path: filePath,
      kind: code === 'A' ? 'create' : code === 'D' ? 'delete' : 'update'
    });
  }

  return files;
};

const collectChangedFiles = async (repoDir: string): Promise<GitChangedFile[]> => {
  const [trackedDiffRes, untrackedRes] = await Promise.all([
    runGit(repoDir, ['diff', '--name-status', '-z', 'HEAD', '--']),
    runGit(repoDir, ['ls-files', '--others', '--exclude-standard', '-z'])
  ]);

  const merged = new Map<string, TaskWorkspaceChangeKind>();
  for (const file of parseChangedFiles(trackedDiffRes.stdout)) {
    merged.set(file.path, file.kind);
  }
  for (const filePath of splitNullSeparated(untrackedRes.stdout).map(normalizeRepoRelativePath).filter(Boolean)) {
    merged.set(filePath, 'create');
  }

  return Array.from(merged.entries())
    .map(([filePath, kind]) => ({ path: filePath, kind }))
    .sort((fileA, fileB) => fileA.path.localeCompare(fileB.path));
};

const buildDiffArgs = (repoDir: string, file: GitChangedFile): { command: string[]; readPath?: string } => {
  const absPath = path.join(repoDir, file.path);
  if (file.kind === 'create') {
    // Diff new files from the repo root so git prints repo-relative patch headers instead of absolute temp paths. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    return { command: ['diff', '--no-color', '--unified=3', '--no-index', '--', '/dev/null', file.path], readPath: absPath };
  }
  if (file.kind === 'delete') {
    // Reuse `git diff HEAD -- <path>` for deletes because no-index fails once the working-tree file is already gone. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    return { command: ['diff', '--no-color', '--unified=3', 'HEAD', '--', file.path] };
  }
  return { command: ['diff', '--no-color', '--unified=3', 'HEAD', '--', file.path], readPath: absPath };
};

const readHeadFile = async (repoDir: string, filePath: string): Promise<string | undefined> => {
  const result = await runGit(repoDir, ['show', `HEAD:${filePath}`]);
  if (result.exitCode !== 0) return undefined;
  return truncateText(result.stdout, MAX_WORKSPACE_TEXT_CHARS);
};

export const collectWorkspaceChanges = async (repoDir: string): Promise<TaskWorkspaceChanges | null> => {
  const changedFiles = await collectChangedFiles(repoDir);
  if (changedFiles.length === 0) return null;

  const files: TaskWorkspaceChange[] = [];
  for (const file of changedFiles) {
    const diffSpec = buildDiffArgs(repoDir, file);
    const [diffRes, oldText, newText] = await Promise.all([
      runGit(repoDir, diffSpec.command),
      file.kind === 'create' ? Promise.resolve(undefined) : readHeadFile(repoDir, file.path),
      file.kind === 'delete' ? Promise.resolve(undefined) : diffSpec.readPath ? readUtf8BestEffort(diffSpec.readPath) : Promise.resolve(undefined)
    ]);

    const unifiedDiff = truncateText(diffRes.stdout, MAX_WORKSPACE_DIFF_CHARS) ?? '';
    files.push({
      path: file.path,
      kind: file.kind,
      unifiedDiff,
      oldText,
      newText,
      diffHash: hashDiff(unifiedDiff, oldText, newText),
      updatedAt: new Date().toISOString()
    });
  }

  return {
    capturedAt: new Date().toISOString(),
    files
  };
};

export const filterWorkspaceChangesAgainstBaseline = (
  snapshot: TaskWorkspaceChanges | null,
  baseline: TaskWorkspaceChanges | null
): TaskWorkspaceChanges | null => {
  const baselineMap = new Map((baseline?.files ?? []).map((file) => [file.path, file.diffHash]));
  const nextFiles = (snapshot?.files ?? []).filter((file) => baselineMap.get(file.path) !== file.diffHash);
  if (nextFiles.length === 0) return null;
  return {
    capturedAt: snapshot?.capturedAt ?? new Date().toISOString(),
    files: nextFiles
  };
};

export const createWorkspaceSnapshotLogLine = (snapshot: TaskWorkspaceChanges | null): string =>
  JSON.stringify({
    // Stream the latest workspace diff snapshot alongside task logs so the frontend can update the file panel without refetching task detail. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    type: WORKSPACE_SNAPSHOT_EVENT_TYPE,
    snapshot
  } satisfies WorkspaceSnapshotLogLine);
