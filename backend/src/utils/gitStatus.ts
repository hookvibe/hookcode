import type {
  TaskGitStatusDelta,
  TaskGitStatusPushState,
  TaskGitStatusSnapshot,
  TaskGitStatusWorkingTree
} from '../types/task';

const splitNameOnly = (raw: string): string[] => {
  // Parse `git diff --name-only` output into a stable list for UI rendering. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line));
};

export const parseAheadBehind = (raw: string): { ahead: number; behind: number } | null => {
  // Decode `git rev-list --left-right --count` output safely. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 2) return null;
  const ahead = Number(parts[0]);
  const behind = Number(parts[1]);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;
  return { ahead, behind };
};

export const buildWorkingTree = (params: {
  stagedRaw: string;
  unstagedRaw: string;
  untrackedRaw: string;
}): TaskGitStatusWorkingTree => {
  // Capture staged/unstaged/untracked file lists so the UI can show local-only changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  return {
    staged: splitNameOnly(params.stagedRaw),
    unstaged: splitNameOnly(params.unstagedRaw),
    untracked: splitNameOnly(params.untrackedRaw)
  };
};

export const computeGitStatusDelta = (
  baseline?: TaskGitStatusSnapshot,
  final?: TaskGitStatusSnapshot
): TaskGitStatusDelta | null => {
  // Compare baseline vs final refs to detect branch/commit changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  if (!baseline || !final) return null;
  const branchChanged = Boolean(baseline.branch && final.branch && baseline.branch !== final.branch);
  const headChanged = Boolean(baseline.headSha && final.headSha && baseline.headSha !== final.headSha);
  return { branchChanged, headChanged };
};

export const computeGitPushState = (params: {
  delta: TaskGitStatusDelta | null;
  final?: TaskGitStatusSnapshot;
  pushTargetSha?: string;
  error?: string;
}): TaskGitStatusPushState => {
  // Determine whether new commits reached the push target (fork or upstream). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  if (params.error) return { status: 'error', reason: params.error };
  if (!params.delta || !params.final) return { status: 'unknown', reason: 'missing_final_snapshot' };
  if (!params.delta.headChanged) return { status: 'not_applicable', reason: 'no_local_commit' };
  if (!params.pushTargetSha) return { status: 'unpushed', reason: 'push_target_missing' };
  if (params.pushTargetSha === params.final.headSha) return { status: 'pushed' };
  return { status: 'unpushed', reason: 'push_target_behind' };
};

export const getWorkingTreeTotals = (workingTree?: TaskGitStatusWorkingTree): { total: number; staged: number; unstaged: number; untracked: number } => {
  // Provide a stable summary for UI tags without re-counting in multiple components. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const staged = workingTree?.staged?.length ?? 0;
  const unstaged = workingTree?.unstaged?.length ?? 0;
  const untracked = workingTree?.untracked?.length ?? 0;
  return { total: staged + unstaged + untracked, staged, unstaged, untracked };
};
