import { createHash } from 'crypto';
// Use cross-platform spawn for git on Windows. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
import { xSpawn } from './crossPlatformSpawn';
import { access, readFile } from 'fs/promises';
import path from 'path';

type TaskWorkspaceChangeKind = 'create' | 'update' | 'delete' | (string & {});
type TaskWorkspaceFileSection = 'staged' | 'unstaged' | 'untracked';
type TaskWorkspaceOperation = 'snapshot' | 'stage' | 'unstage' | 'discard' | 'delete_untracked' | 'commit';

type TaskWorkspaceFile = {
  path: string;
  kind?: TaskWorkspaceChangeKind;
  sections: TaskWorkspaceFileSection[];
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
  diffHash: string;
  updatedAt: string;
};

type TaskWorkspaceSummary = {
  total: number;
  staged: number;
  unstaged: number;
  untracked: number;
  additions: number;
  deletions: number;
  hasChanges: boolean;
};

type TaskWorkspaceState = {
  source: 'worker';
  live: true;
  readOnly: false;
  capturedAt: string;
  branch?: string;
  headSha?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  workingTree: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };
  summary: TaskWorkspaceSummary;
  files: TaskWorkspaceFile[];
  canCommit: boolean;
};

type TaskWorkspaceCommit = {
  sha: string;
  message: string;
  committedAt: string;
};

export type TaskWorkspaceOperationResult = {
  workspace: TaskWorkspaceState;
  commit?: TaskWorkspaceCommit;
};

export class TaskWorkspaceError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'TaskWorkspaceError';
  }
}

type GitResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type ChangedPath = {
  path: string;
  kind: TaskWorkspaceChangeKind;
};

const MAX_DIFF_CHARS = 200_000;
const MAX_TEXT_CHARS = 200_000;

const splitNulls = (raw: string): string[] =>
  String(raw ?? '')
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);

const truncate = (value: string | undefined, maxChars: number): string | undefined => {
  if (!value) return undefined;
  return value.length > maxChars ? value.slice(0, maxChars) : value;
};

const toDiffHash = (unifiedDiff: string, oldText?: string, newText?: string): string =>
  createHash('sha1').update(unifiedDiff).update('\n--old--\n').update(oldText ?? '').update('\n--new--\n').update(newText ?? '').digest('hex');

const parseAheadBehind = (raw: string): { ahead: number; behind: number } | null => {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 2) return null;
  const ahead = Number(parts[0]);
  const behind = Number(parts[1]);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;
  return { ahead, behind };
};

const countDiffStats = (unifiedDiff: string): { additions: number; deletions: number } => {
  const lines = String(unifiedDiff ?? '').split(/\r?\n/);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (!line || line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) additions += 1;
    if (line.startsWith('-')) deletions += 1;
  }
  return { additions, deletions };
};

const normalizeRepoRelativePath = (value: string): string => {
  const normalized = String(value ?? '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
  if (!normalized || normalized === '.' || path.posix.isAbsolute(normalized)) {
    throw new TaskWorkspaceError('INVALID_PATH', 'Invalid workspace path');
  }
  const collapsed = path.posix.normalize(normalized);
  if (!collapsed || collapsed === '.' || collapsed.startsWith('../') || collapsed.includes('/../')) {
    throw new TaskWorkspaceError('INVALID_PATH', 'Invalid workspace path');
  }
  return collapsed;
};

const ensureWorkspaceExists = async (repoDir: string): Promise<void> => {
  try {
    await access(repoDir);
  } catch {
    throw new TaskWorkspaceError('WORKSPACE_MISSING', 'Task workspace is missing');
  }
  const gitDir = path.join(repoDir, '.git');
  try {
    await access(gitDir);
  } catch {
    throw new TaskWorkspaceError('WORKSPACE_NOT_GIT', 'Task workspace is not a git repository');
  }
};

const runGit = async (repoDir: string, args: string[], options?: { env?: Record<string, string> }): Promise<GitResult> =>
  await new Promise((resolve) => {
    const child = xSpawn('git', args, {
      cwd: repoDir,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        ...(options?.env ?? {})
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_DIFF_CHARS) stdout = stdout.slice(0, MAX_DIFF_CHARS);
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 32_000) stderr = stderr.slice(0, 32_000);
    });
    child.on('error', () => resolve({ code: 1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: typeof code === 'number' ? code : 1, stdout, stderr }));
  });

const readHeadText = async (repoDir: string, filePath: string): Promise<string | undefined> => {
  const result = await runGit(repoDir, ['show', `HEAD:${filePath}`]);
  if (result.code !== 0 || !result.stdout) return undefined;
  return truncate(result.stdout, MAX_TEXT_CHARS);
};

const readWorkingText = async (targetPath: string): Promise<string | undefined> => {
  try {
    const buffer = await readFile(targetPath);
    if (buffer.includes(0)) return undefined;
    return truncate(buffer.toString('utf8'), MAX_TEXT_CHARS);
  } catch {
    return undefined;
  }
};

const collectSectionSets = async (repoDir: string): Promise<{
  staged: Set<string>;
  unstaged: Set<string>;
  untracked: Set<string>;
}> => {
  const [stagedRes, unstagedRes, untrackedRes] = await Promise.all([
    runGit(repoDir, ['diff', '--name-only', '--cached', '-z', '--']),
    runGit(repoDir, ['diff', '--name-only', '-z', '--']),
    runGit(repoDir, ['ls-files', '--others', '--exclude-standard', '-z'])
  ]);

  return {
    staged: new Set(splitNulls(stagedRes.stdout).map(normalizeRepoRelativePath)),
    unstaged: new Set(splitNulls(unstagedRes.stdout).map(normalizeRepoRelativePath)),
    untracked: new Set(splitNulls(untrackedRes.stdout).map(normalizeRepoRelativePath))
  };
};

const collectChangedPaths = async (repoDir: string): Promise<ChangedPath[]> => {
  const [tracked, untracked] = await Promise.all([
    runGit(repoDir, ['diff', '--name-status', '-z', 'HEAD', '--']),
    runGit(repoDir, ['ls-files', '--others', '--exclude-standard', '-z'])
  ]);

  const merged = new Map<string, TaskWorkspaceChangeKind>();
  const trackedEntries = splitNulls(tracked.stdout);
  for (let index = 0; index < trackedEntries.length; index += 1) {
    const statusRaw = trackedEntries[index] ?? '';
    if (!statusRaw) continue;
    const code = statusRaw[0] ?? 'M';
    if (code === 'R' || code === 'C') {
      const nextPath = String(trackedEntries[index + 2] ?? '').replace(/\\/g, '/').trim();
      index += 2;
      if (nextPath) merged.set(normalizeRepoRelativePath(nextPath), 'update');
      continue;
    }
    const nextPath = String(trackedEntries[index + 1] ?? '').replace(/\\/g, '/').trim();
    index += 1;
    if (!nextPath) continue;
    merged.set(normalizeRepoRelativePath(nextPath), code === 'A' ? 'create' : code === 'D' ? 'delete' : 'update');
  }

  for (const nextPath of splitNulls(untracked.stdout)) {
    merged.set(normalizeRepoRelativePath(nextPath), 'create');
  }

  return Array.from(merged.entries())
    .map(([filePath, kind]) => ({ path: filePath, kind }))
    .sort((left, right) => left.path.localeCompare(right.path));
};

const collectWorkspaceState = async (repoDir: string): Promise<TaskWorkspaceState> => {
  await ensureWorkspaceExists(repoDir);

  const capturedAt = new Date().toISOString();
  const [branchRes, headRes, upstreamRes, sectionSets, changedPaths] = await Promise.all([
    runGit(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(repoDir, ['rev-parse', 'HEAD']),
    runGit(repoDir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    collectSectionSets(repoDir),
    collectChangedPaths(repoDir)
  ]);

  let ahead: number | undefined;
  let behind: number | undefined;
  const upstream = upstreamRes.code === 0 ? upstreamRes.stdout.trim() : '';
  if (upstream) {
    const aheadBehindRes = await runGit(repoDir, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
    const parsed = aheadBehindRes.code === 0 ? parseAheadBehind(aheadBehindRes.stdout) : null;
    ahead = parsed?.ahead;
    behind = parsed?.behind;
  }

  const files: TaskWorkspaceFile[] = [];
  let additions = 0;
  let deletions = 0;

  for (const changedPath of changedPaths) {
    const absolutePath = path.join(repoDir, changedPath.path);
    const [diffRes, oldText, newText] = await Promise.all([
      runGit(repoDir, ['diff', '--no-color', '--unified=3', 'HEAD', '--', changedPath.path]),
      changedPath.kind === 'create' ? Promise.resolve(undefined) : readHeadText(repoDir, changedPath.path),
      changedPath.kind === 'delete' ? Promise.resolve(undefined) : readWorkingText(absolutePath)
    ]);

    const unifiedDiff = truncate(diffRes.stdout, MAX_DIFF_CHARS) ?? '';
    const stats = countDiffStats(unifiedDiff);
    additions += stats.additions;
    deletions += stats.deletions;

    const sections: TaskWorkspaceFileSection[] = [];
    if (sectionSets.staged.has(changedPath.path)) sections.push('staged');
    if (sectionSets.unstaged.has(changedPath.path)) sections.push('unstaged');
    if (sectionSets.untracked.has(changedPath.path)) sections.push('untracked');

    files.push({
      path: changedPath.path,
      kind: changedPath.kind,
      sections,
      unifiedDiff,
      oldText,
      newText,
      diffHash: toDiffHash(unifiedDiff, oldText, newText),
      updatedAt: capturedAt
    });
  }

  const workingTree = {
    staged: Array.from(sectionSets.staged).sort((left, right) => left.localeCompare(right)),
    unstaged: Array.from(sectionSets.unstaged).sort((left, right) => left.localeCompare(right)),
    untracked: Array.from(sectionSets.untracked).sort((left, right) => left.localeCompare(right))
  };
  const summary = {
    total: files.length,
    staged: workingTree.staged.length,
    unstaged: workingTree.unstaged.length,
    untracked: workingTree.untracked.length,
    additions,
    deletions,
    hasChanges: files.length > 0
  };

  return {
    source: 'worker',
    live: true,
    readOnly: false,
    capturedAt,
    branch: branchRes.code === 0 ? branchRes.stdout.trim() || undefined : undefined,
    headSha: headRes.code === 0 ? headRes.stdout.trim() || undefined : undefined,
    upstream: upstream || undefined,
    ahead,
    behind,
    workingTree,
    summary,
    files,
    canCommit: workingTree.staged.length > 0
  };
};

const resolveTargetPaths = (workspace: TaskWorkspaceState, action: Exclude<TaskWorkspaceOperation, 'snapshot' | 'commit'>, rawPaths?: string[]): string[] => {
  const requested = Array.isArray(rawPaths) ? rawPaths.map(normalizeRepoRelativePath) : [];
  const fileMap = new Map(workspace.files.map((file) => [file.path, file]));
  const candidates =
    requested.length > 0
      ? requested.map((nextPath) => fileMap.get(nextPath)).filter((entry): entry is TaskWorkspaceFile => Boolean(entry))
      : workspace.files;

  if (action === 'stage') {
    return candidates
      .filter((file) => file.sections.includes('unstaged') || file.sections.includes('untracked'))
      .map((file) => file.path);
  }
  if (action === 'unstage') {
    return candidates.filter((file) => file.sections.includes('staged')).map((file) => file.path);
  }
  if (action === 'discard') {
    return candidates
      .filter((file) => file.sections.includes('staged') || file.sections.includes('unstaged'))
      .filter((file) => !file.sections.includes('untracked'))
      .map((file) => file.path);
  }
  return candidates.filter((file) => file.sections.includes('untracked')).map((file) => file.path);
};

const requireGitSuccess = (result: GitResult, message: string): void => {
  if (result.code === 0) return;
  throw new TaskWorkspaceError('GIT_COMMAND_FAILED', `${message}: ${result.stderr.trim() || result.stdout.trim() || 'command failed'}`);
};

const commitWorkspace = async (repoDir: string, message: string): Promise<TaskWorkspaceCommit> => {
  const trimmed = String(message ?? '').trim();
  if (!trimmed) {
    throw new TaskWorkspaceError('COMMIT_MESSAGE_REQUIRED', 'Commit message is required');
  }

  const commitRes = await runGit(
    repoDir,
    ['commit', '-m', trimmed],
    {
      env: {
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'HookCode',
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'hookcode@local',
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'HookCode',
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'hookcode@local'
      }
    }
  );
  requireGitSuccess(commitRes, 'Failed to create commit');

  const shaRes = await runGit(repoDir, ['rev-parse', 'HEAD']);
  requireGitSuccess(shaRes, 'Failed to resolve commit SHA');
  return {
    sha: shaRes.stdout.trim(),
    message: trimmed,
    committedAt: new Date().toISOString()
  };
};

export const executeTaskWorkspaceOperation = async (params: {
  repoDir: string;
  action: TaskWorkspaceOperation;
  paths?: string[];
  message?: string;
}): Promise<TaskWorkspaceOperationResult> => {
  const workspace = await collectWorkspaceState(params.repoDir);
  if (params.action === 'snapshot') {
    return { workspace };
  }

  if (params.action === 'commit') {
    if (!workspace.canCommit) {
      throw new TaskWorkspaceError('NO_STAGED_CHANGES', 'There are no staged changes to commit');
    }
    const commit = await commitWorkspace(params.repoDir, params.message ?? '');
    return {
      commit,
      workspace: await collectWorkspaceState(params.repoDir)
    };
  }

  const targetPaths = resolveTargetPaths(workspace, params.action, params.paths);
  if (!targetPaths.length) {
    return { workspace };
  }

  if (params.action === 'stage') {
    requireGitSuccess(
      await runGit(params.repoDir, targetPaths.length ? ['add', '--', ...targetPaths] : ['add', '-A', '--', '.']),
      'Failed to stage changes'
    );
  }

  if (params.action === 'unstage') {
    requireGitSuccess(
      await runGit(params.repoDir, ['reset', 'HEAD', '--', ...(targetPaths.length ? targetPaths : ['.'])]),
      'Failed to unstage changes'
    );
  }

  if (params.action === 'discard') {
    requireGitSuccess(
      await runGit(params.repoDir, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...(targetPaths.length ? targetPaths : ['.'])]),
      'Failed to discard changes'
    );
  }

  if (params.action === 'delete_untracked') {
    requireGitSuccess(
      await runGit(params.repoDir, ['clean', '-fd', '--', ...(targetPaths.length ? targetPaths : ['.'])]),
      'Failed to delete untracked files'
    );
  }

  return { workspace: await collectWorkspaceState(params.repoDir) };
};
