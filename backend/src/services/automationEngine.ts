import type { RepoRobot } from '../types/repoRobot';
import type { RepoAutomationConfig, AutomationClause, AutomationEventConfig, AutomationRule } from '../types/automation';
import type { TaskEventType } from '../types/task';
import type { Repository } from '../types/repository';
import type { TimeWindow } from '../types/timeWindow';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getByPath = (obj: unknown, path: string): unknown => {
  if (!path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const key of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
};

const normalizeString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => normalizeString(v))
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toLowerCase());
};

const normalizeMentionHandle = (value: unknown): string | null => {
  const raw = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const noAt = trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
  if (!noAt) return null;
  const lower = noAt.toLowerCase();

  // Keep only mention-safe characters and make display-name-like inputs compatible:
  // - spaces/invalid chars -> '-'
  // - collapse repeated '-' to reduce false mismatches
  const slug = lower
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return slug ? slug : null;
};

const globToRegExp = (pattern: string): RegExp => {
  // Simple glob: only supports `*` and `?`, case-insensitive by default.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regex, 'i');
};

const clauseMatch = (clause: AutomationClause, ctx: unknown): boolean => {
  // Ignore branch-based filters for Issue events because Issue webhooks have no branch/ref context. b7x1k3m9p2r5t8n0q6s4
  const ctxEventType = normalizeString(getByPath(ctx, 'event.type'))?.toLowerCase();
  if (ctxEventType === 'issue' && (clause.field === 'push.branch' || clause.field === 'branch.name' || clause.field.startsWith('branch.'))) {
    return true;
  }

  const value = getByPath(ctx, clause.field);

  const op = clause.op;
  let ok = false;

  if (op === 'exists') {
    if (Array.isArray(value)) ok = value.length > 0;
    else ok = Boolean(normalizeString(value));
  } else if (op === 'equals') {
    const raw = normalizeString(value);
    ok = raw !== null && raw.toLowerCase() === String(clause.value ?? '').trim().toLowerCase();
  } else if (op === 'in') {
    const raw = normalizeString(value);
    const set = (clause.values ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
    ok = raw !== null && set.includes(raw.toLowerCase());
  } else if (op === 'containsAny') {
    const arr = Array.isArray(value) ? normalizeStringArray(value) : normalizeString(value) ? [String(value).toLowerCase()] : [];
    const set = (clause.values ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
    if (clause.field === 'comment.mentions') {
      const arrHandles = arr.map((v) => normalizeMentionHandle(v)).filter((v): v is string => Boolean(v));
      const setHandles = set.map((v) => normalizeMentionHandle(v)).filter((v): v is string => Boolean(v));
      ok = arrHandles.some((v) => setHandles.includes(v));
    } else {
      ok = arr.some((v) => set.includes(v));
    }
  } else if (op === 'matchesAny') {
    const raw = normalizeString(value);
    const patterns = (clause.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    ok = raw !== null && patterns.some((p) => globToRegExp(p).test(raw));
  } else if (op === 'textContainsAny') {
    const raw = normalizeString(Array.isArray(value) ? value.join(' ') : value);
    const keywords = (clause.values ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
    ok = raw !== null && keywords.some((k) => raw.toLowerCase().includes(k));
  }

  return clause.negate ? !ok : ok;
};

const ruleMatch = (rule: AutomationRule, ctx: unknown): boolean => {
  if (!rule.enabled) return false;
  const match = rule.match;
  if (!match) return true;

  const all = match.all ?? [];
  const any = match.any ?? [];

  const allOk = all.every((c) => clauseMatch(c, ctx));
  const anyOk = any.length ? any.some((c) => clauseMatch(c, ctx)) : true;

  return allOk && anyOk;
};

export interface ResolvedAutomationAction {
  robotId: string;
  promptCustom?: string | null;
  ruleId: string;
  // Carry trigger-level time windows forward so task creation can resolve scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
}

const buildPromptCustom = (robot: RepoRobot, action: { promptOverride?: string; promptPatch?: string }): string | null => {
  const override = (action.promptOverride ?? '').trim();
  if (override) return override;

  const base = (robot.promptDefault ?? '').trim();
  const patch = (action.promptPatch ?? '').trim();
  const combined = [base, patch].filter(Boolean).join('\n\n').trim();
  return combined ? combined : null;
};

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const resolveBranchRole = (
  branchName: string,
  repo?: Pick<Repository, 'branches'> | null
): 'main' | 'dev' | 'test' | 'other' | 'unknown' => {
  const branch = branchName.trim();
  if (!branch) return 'unknown';
  const branches = Array.isArray(repo?.branches) ? repo!.branches! : [];

  // Compatibility: legacy "main/dev/test" roles; prefer inferring from branches.isDefault / note.
  // Change record (2026-01-15): branch role notes use English labels ("Main branch", "Dev branch", "Test branch").
  const defaultBranch = branches.find((b) => b?.isDefault && safeTrim(b?.name))?.name;
  if (defaultBranch && branch === safeTrim(defaultBranch)) return 'main';

  const devBranch = branches.find((b) => safeTrim(b?.note) === 'Dev branch' && safeTrim(b?.name))?.name;
  if (devBranch && branch === safeTrim(devBranch)) return 'dev';

  const testBranch = branches.find((b) => safeTrim(b?.note) === 'Test branch' && safeTrim(b?.name))?.name;
  if (testBranch && branch === safeTrim(testBranch)) return 'test';

  const mainBranch = branches.find((b) => safeTrim(b?.note) === 'Main branch' && safeTrim(b?.name))?.name;
  if (mainBranch && branch === safeTrim(mainBranch)) return 'main';

  return 'other';
};

const extractEventSubType = (payload: any): string => {
  const raw = payload?.__subType;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return '';
};

const extractBranchName = (eventType: TaskEventType, payload: any): string => {
  // Commit (push): prefer ref.
  if (eventType === 'commit') {
    const rawRef: string | undefined = payload?.ref;
    if (typeof rawRef === 'string' && rawRef.startsWith('refs/heads/')) {
      return rawRef.replace(/^refs\/heads\//, '');
    }
    return typeof rawRef === 'string' ? rawRef : '';
  }

  // Merge Request: prefer target branch (useful for triggers configured by "target branch").
  if (eventType === 'merge_request') {
    const glTarget = payload?.object_attributes?.target_branch ?? payload?.merge_request?.target_branch;
    if (typeof glTarget === 'string') return glTarget.trim();
    const ghTarget = payload?.pull_request?.base?.ref;
    if (typeof ghTarget === 'string') return ghTarget.trim();
    return '';
  }

  return '';
};

const extractTextAll = (eventType: TaskEventType, payload: any): string => {
  const subType = extractEventSubType(payload);

  // Prefer comment body for the "commented" subtype.
  const commentBody =
    typeof payload?.object_attributes?.note === 'string'
      ? payload.object_attributes.note
      : typeof payload?.comment?.body === 'string'
        ? payload.comment.body
        : typeof payload?.comment?.body_text === 'string'
          ? payload.comment.body_text
          : '';
  if (subType === 'commented' && commentBody.trim()) return commentBody;

  if (eventType === 'issue') {
    const gl = payload?.object_attributes ?? payload?.issue;
    const gh = payload?.issue;
    const title = typeof gl?.title === 'string' ? gl.title : typeof gh?.title === 'string' ? gh.title : '';
    const body =
      typeof gl?.description === 'string'
        ? gl.description
        : typeof gh?.body === 'string'
          ? gh.body
          : '';
    return [title, body].filter(Boolean).join('\n\n').trim();
  }

  if (eventType === 'merge_request') {
    const gl = payload?.object_attributes ?? payload?.merge_request;
    const gh = payload?.pull_request;
    const title = typeof gl?.title === 'string' ? gl.title : typeof gh?.title === 'string' ? gh.title : '';
    const body =
      typeof gl?.description === 'string'
        ? gl.description
        : typeof gh?.body === 'string'
          ? gh.body
          : '';
    return [title, body].filter(Boolean).join('\n\n').trim();
  }

  if (eventType === 'commit') {
    const commits: any[] = Array.isArray(payload?.commits) ? payload.commits : [];
    const lines = commits
      .map((c) => {
        const msg: unknown = c?.title ?? c?.message;
        if (typeof msg !== 'string') return null;
        return msg.split('\n')[0].trim();
      })
      .filter((v): v is string => Boolean(v));
    return lines.join('\n').trim();
  }

  return '';
};

const buildContext = (
  eventType: TaskEventType,
  payload: any,
  repo?: Pick<Repository, 'branches'> | null,
  robots?: Array<Pick<RepoRobot, 'id' | 'name' | 'repoTokenUsername' | 'repoTokenUserName'>> | null
): Record<string, unknown> => {
  const branchName = extractBranchName(eventType, payload);
  const branchRole = resolveBranchRole(branchName, repo);

  const commentBody =
    typeof payload?.object_attributes?.note === 'string'
      ? payload.object_attributes.note
      : typeof payload?.comment?.body === 'string'
        ? payload.comment.body
        : '';

  // Comment mentions: two sources
  // 1) Parse @xxx via regex directly (works for both GitHub/GitLab)
  // 2) Also allow payload.__mentions (for future extension)
  const mentionsFromPayload = Array.isArray(payload?.__mentions) ? payload.__mentions : [];
  const mentionsFromText = commentBody.match(/@[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? [];
  const mentions = [...mentionsFromPayload, ...mentionsFromText]
    .map((m) => String(m).trim().toLowerCase())
    .filter(Boolean);
  const mentionRobotIds = (() => {
    const robotList = Array.isArray(robots) ? robots : [];
    if (!robotList.length || !mentions.length) return [];

    const handleToRobotIds = new Map<string, string[]>();
    for (const r of robotList) {
      const handles = [
        normalizeMentionHandle(r.name),
        normalizeMentionHandle(r.repoTokenUsername),
        normalizeMentionHandle(r.repoTokenUserName)
      ].filter((v): v is string => Boolean(v));
      if (!handles.length) continue;
      for (const h of handles) {
        const list = handleToRobotIds.get(h) ?? [];
        if (!list.includes(r.id)) list.push(r.id);
        handleToRobotIds.set(h, list);
      }
    }

    const hit = new Set<string>();
    for (const m of mentions) {
      const handle = normalizeMentionHandle(m);
      if (!handle) continue;
      const ids = handleToRobotIds.get(handle) ?? [];
      for (const id of ids) hit.add(id);
    }
    return Array.from(hit);
  })();

  const gitlabIssue = payload?.object_attributes ?? payload?.issue ?? payload?.object_attributes?.issue;
  const githubIssue = payload?.issue;

  const assigneesRaw =
    payload?.assignees ??
    gitlabIssue?.assignees ??
    githubIssue?.assignees ??
    [];

  const singleAssignee =
    gitlabIssue?.assignee ??
    githubIssue?.assignee ??
    payload?.assignee ??
    null;

  const assigneeList: any[] = [
    ...(Array.isArray(assigneesRaw) ? assigneesRaw : []),
    ...(singleAssignee ? [singleAssignee] : [])
  ];

  const assignees: string[] = assigneeList
    .map((a: any) => a?.username ?? a?.login ?? a?.name ?? a?.id)
    .filter((v: any) => typeof v === 'string' || typeof v === 'number')
    .map((v: any) => String(v).trim().toLowerCase())
    .filter(Boolean);

  const textAll = extractTextAll(eventType, payload);

  return {
    event: { type: eventType, subType: extractEventSubType(payload) },
    branch: { name: branchName, role: branchRole },
    push: { branch: branchName },
    issue: { assignees },
    comment: { mentions, mentionRobotIds, body: commentBody },
    text: { all: textAll }
  };
};

export const resolveAutomationActions = (input: {
  eventType: TaskEventType;
  payload: any;
  robots: RepoRobot[];
  config: RepoAutomationConfig;
  repo?: Pick<Repository, 'branches'> | null;
}): ResolvedAutomationAction[] => {
  const eventConfig: AutomationEventConfig | undefined = input.config.events[String(input.eventType)];
  if (!eventConfig?.enabled) return [];

  const ctx = buildContext(input.eventType, input.payload, input.repo, input.robots);
  const robotsById = new Map(input.robots.map((r) => [r.id, r]));

  const resolved: ResolvedAutomationAction[] = [];
  const seenRobotIds = new Set<string>();

  for (const rule of eventConfig.rules ?? []) {
    if (!ruleMatch(rule, ctx)) continue;

    for (const action of rule.actions ?? []) {
      if (!action.enabled) continue;
      if (seenRobotIds.has(action.robotId)) continue;

      const robot = robotsById.get(action.robotId);
      if (!robot || !robot.enabled) continue;

      seenRobotIds.add(action.robotId);
      resolved.push({
        robotId: action.robotId,
        ruleId: rule.id,
        promptCustom: buildPromptCustom(robot, action),
        // Preserve the matched rule's time window for downstream scheduling decisions. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindow: rule.timeWindow
      });
    }
  }

  return resolved;
};
