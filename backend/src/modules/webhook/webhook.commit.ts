// Split commit parsing helpers into a focused module for webhook guards and titles. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const isGitlabZeroSha = (sha?: string): boolean =>
  typeof sha === 'string' && sha.length >= 40 && /^0+$/.test(sha);

export const hasNewCommits = (payload: any): boolean => {
  const count = Number(payload?.total_commits_count ?? 0);
  if (Number.isFinite(count) && count > 0) return true;
  if (Array.isArray(payload?.commits) && payload.commits.length > 0) return true;
  return false;
};

export const extractCommitTitle = (commit: any): string | undefined => {
  const raw = commit?.title ?? commit?.message;
  if (typeof raw !== 'string') return undefined;
  return raw.split('\n')[0].trim();
};

export const extractCommitMessage = (commit: any): string | undefined => {
  const raw = commit?.message;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
};

const isMergeCommitTitle = (title: string): boolean => {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (/^merge\b/i.test(trimmed)) return true;
  // Change record (2026-01-15): keep merge detection English-only to avoid mixed-language heuristics.
  return false;
};

const isCherryPickCommit = (commit: any): boolean => {
  const title = extractCommitTitle(commit);
  const message = extractCommitMessage(commit);
  const text = [title, message].filter(Boolean).join('\n');
  if (!text) return false;

  // `git cherry-pick -x` or GitLab UI cherry-pick often includes this kind of trailer.
  if (/cherry[- ]picked from commit\s+[0-9a-f]{7,40}/i.test(text)) return true;

  // Fallback: title/body contains the cherry-pick keyword (allow some false positives to avoid duplicate reviews).
  if (/\bcherry[- ]pick\b/i.test(text)) return true;
  // Change record (2026-01-15): keep cherry-pick detection English-only to avoid mixed-language heuristics.

  return false;
};

export const shouldIgnorePushByCherryPick = (payload: any): { ignored: boolean; reason?: string } => {
  const commits: any[] = Array.isArray(payload?.commits) ? payload.commits : [];
  if (!commits.length) return { ignored: false };

  // Skip only when *all* commits in this push are cherry-picks;
  // if mixed with normal commits, still trigger review (avoid missing reviews).
  const allCherryPick = commits.every((c) => isCherryPickCommit(c));
  if (!allCherryPick) return { ignored: false };

  const sampleTitle = extractCommitTitle(commits[commits.length - 1] ?? commits[0]);
  const sample = sampleTitle ? sampleTitle.slice(0, 80) : undefined;
  return { ignored: true, reason: sample ? `cherry-pick commit ignored (e.g. "${sample}")` : 'cherry-pick commit ignored' };
};

export const shouldIgnorePushByMergeCommit = (payload: any): { ignored: boolean; reason?: string } => {
  const headSha: string | undefined = payload?.checkout_sha ?? payload?.after;
  const commits: any[] = Array.isArray(payload?.commits) ? payload.commits : [];
  if (!headSha || !commits.length) return { ignored: false };

  const head = commits.find((c) => (c?.id ?? c?.sha) === headSha) ?? (commits.length === 1 ? commits[0] : undefined);
  const title = head ? extractCommitTitle(head) : undefined;
  if (!title) return { ignored: false };

  if (!isMergeCommitTitle(title)) return { ignored: false };

  const sample = title.slice(0, 80);
  return { ignored: true, reason: `merge commit ignored (e.g. "${sample}")` };
};
