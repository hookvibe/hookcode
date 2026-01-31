// Define PAT scope groups/levels for API access enforcement. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export const PAT_SCOPE_GROUPS = ['account', 'repos', 'tasks', 'events', 'system'] as const;
export type PatScopeGroup = (typeof PAT_SCOPE_GROUPS)[number];

export const PAT_SCOPE_LEVELS = ['read', 'write'] as const;
export type PatScopeLevel = (typeof PAT_SCOPE_LEVELS)[number];

export type PatScopeEntry = { group: PatScopeGroup; level: PatScopeLevel };
export type PatScopeMap = Partial<Record<PatScopeGroup, PatScopeLevel>>;

const SCOPE_LEVEL_RANK: Record<PatScopeLevel, number> = { read: 1, write: 2 };

export const isPatScopeGroup = (value: unknown): value is PatScopeGroup =>
  typeof value === 'string' && (PAT_SCOPE_GROUPS as readonly string[]).includes(value);

export const isPatScopeLevel = (value: unknown): value is PatScopeLevel =>
  typeof value === 'string' && (PAT_SCOPE_LEVELS as readonly string[]).includes(value);

export const normalizePatScopeEntries = (value: unknown): PatScopeEntry[] => {
  if (!Array.isArray(value)) return [];
  const entries: PatScopeEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const group = (raw as any).group;
    const level = (raw as any).level;
    if (!isPatScopeGroup(group) || !isPatScopeLevel(level)) continue;
    entries.push({ group, level });
  }
  return entries;
};

export const buildPatScopeMap = (entries: PatScopeEntry[]): PatScopeMap => {
  const map: PatScopeMap = {};
  for (const entry of entries) {
    const current = map[entry.group];
    if (!current || SCOPE_LEVEL_RANK[entry.level] > SCOPE_LEVEL_RANK[current]) {
      map[entry.group] = entry.level;
    }
  }
  return map;
};

// Normalize stored scope maps to a safe subset of known groups/levels. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export const normalizePatScopeMap = (value: unknown): PatScopeMap => {
  if (!value || typeof value !== 'object') return {};
  const map: PatScopeMap = {};
  for (const [rawGroup, rawLevel] of Object.entries(value as Record<string, unknown>)) {
    if (!isPatScopeGroup(rawGroup) || !isPatScopeLevel(rawLevel)) continue;
    map[rawGroup] = rawLevel;
  }
  return map;
};

export const hasPatScope = (scopes: PatScopeMap, group: PatScopeGroup, required: PatScopeLevel): boolean => {
  const current = scopes[group];
  if (!current) return false;
  return SCOPE_LEVEL_RANK[current] >= SCOPE_LEVEL_RANK[required];
};
