import type { Task } from '../types/task';
import type { RepoRobot } from '../types/repoRobot';

/**
 * Robot/permission selection and text matching (multi-repo):
 * - Used when enqueuing via Webhook and when executing a task to determine which robot to use.
 * - Unlike the legacy version: we no longer hardcode hookcode-review/hookcode-build; we select from repo config (DB) or env fallback robots.
 */

export const detectRobotInText = <T extends Pick<RepoRobot, 'name' | 'repoTokenUsername' | 'repoTokenUserName'>>(
  text: string | undefined,
  robots: T[]
): T | undefined => {
  if (!text) return undefined;

  const normalizeMentionHandle = (value: unknown): string | null => {
    const raw = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const noAt = trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
    if (!noAt) return null;
    const lower = noAt.toLowerCase();
    const slug = lower
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '');
    return slug ? slug : null;
  };

  const mentions = (text.match(/@[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? [])
    .map((m) => normalizeMentionHandle(m))
    .filter((v): v is string => Boolean(v));
  if (!mentions.length) return undefined;

  const mentioned = new Set(mentions);
  return robots.find((r) => {
    const candidates = [
      normalizeMentionHandle(r.name),
      normalizeMentionHandle(r.repoTokenUsername),
      normalizeMentionHandle(r.repoTokenUserName)
    ].filter((v): v is string => Boolean(v));
    return candidates.some((c) => mentioned.has(c));
  });
};

const getDefaultRobot = <T extends Pick<RepoRobot, 'isDefault' | 'enabled'>>(
  robots: T[]
): T | undefined => robots.find((r) => Boolean(r.enabled) && Boolean((r as any).isDefault));

const pickFirstEnabled = <T extends Pick<RepoRobot, 'enabled'>>(robots: T[]): T | undefined =>
  robots.find((r) => Boolean(r.enabled));

export const pickRobotByPermission = <T extends RepoRobot>(
  robots: T[],
  permission: RepoRobot['permission']
): T | undefined => {
  const candidates = robots.filter((r) => r.permission === permission && r.enabled);
  return getDefaultRobot(candidates) ?? pickFirstEnabled(candidates);
};

export const extractIssueLabels = (payload: any): string[] => {
  const raw =
    payload?.labels ??
    payload?.object_attributes?.labels ??
    payload?.issue?.labels ??
    payload?.object_attributes?.issue?.labels ??
    [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((label: unknown) => {
      if (typeof label === 'string') return label;
      if (!label || typeof label !== 'object') return undefined;
      const anyLabel = label as any;
      return anyLabel.title ?? anyLabel.name ?? anyLabel.label ?? anyLabel.value;
    })
    .filter((v: unknown): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
};

const issueHasBuildLabel = (payload: any): boolean =>
  extractIssueLabels(payload).some((label) => {
    const lower = label.toLowerCase();
    return lower === 'bug' || lower === 'feature';
  });

export const selectRobotForTask = <T extends RepoRobot>(
  task: Pick<Task, 'eventType' | 'title'>,
  payload: any,
  robots: T[],
  options?: { noteText?: string }
): T | undefined => {
  if (!robots.length) return undefined;

  // Push/commit review: default to the read robot (avoid accidental @robot triggers in commit messages).
  if (task.eventType === 'push' || task.eventType === 'commit_review') {
    return pickRobotByPermission(robots, 'read') ?? pickFirstEnabled(robots);
  }

  // Note/IssueComment: select based on @robot mention in the comment.
  const mentionHit =
    detectRobotInText(options?.noteText, robots) ?? detectRobotInText(task.title, robots);
  if (mentionHit) return mentionHit;

  // New Issue: default to read; if it has bug/feature labels and a write robot exists, switch to write.
  if (task.eventType === 'issue' || task.eventType === 'issue_created') {
    if (issueHasBuildLabel(payload)) {
      return pickRobotByPermission(robots, 'write') ?? pickRobotByPermission(robots, 'read') ?? pickFirstEnabled(robots);
    }
    return pickRobotByPermission(robots, 'read') ?? pickFirstEnabled(robots);
  }

  return pickRobotByPermission(robots, 'read') ?? pickFirstEnabled(robots);
};

export const getBotUsernames = (
  robots: Array<Pick<RepoRobot, 'name' | 'repoTokenUsername' | 'repoTokenUserName' | 'repoTokenUserId'>> = []
) => {
  const fromRobots = robots.flatMap((r) => {
    const username = String(r.repoTokenUsername ?? '').trim().toLowerCase();
    const displayName = String(r.repoTokenUserName ?? '').trim().toLowerCase();
    const userId = String(r.repoTokenUserId ?? '').trim();
    const fallbackName = String(r.name ?? '').trim().toLowerCase();

    const out: string[] = [];
    if (username) out.push(username);
    if (displayName) out.push(displayName);
    if (userId) out.push(userId);
    if (!username && fallbackName) out.push(fallbackName.startsWith('@') ? fallbackName.slice(1) : fallbackName);
    return out;
  });
  return Array.from(new Set([...fromRobots]));
};
