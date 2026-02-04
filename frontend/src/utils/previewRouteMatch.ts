// Centralize targetUrl matcher constants for preview navigation. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
const TARGET_URL_OR_SEPARATOR = '||';
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const IGNORED_QUERY_PARAMS = new Set(['token']);

interface ParsedUrlParts {
  origin: string;
  path: string;
  search: string;
  hash: string;
  hasExplicitOrigin: boolean;
}

const escapeRegex = (value: string): string =>
  // Escape regex characters before building route matcher expressions. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePath = (value: string): string => {
  // Normalize preview paths to a consistent slash format for route matching. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  let path = value.trim();
  if (!path) path = '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
  return path;
};

const splitUrlParts = (value: string): { path: string; search: string; hash: string } => {
  // Split URL-like strings without relying on URL parsing (supports wildcard patterns). docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const [beforeHash, hashPart = ''] = value.split('#', 2);
  const [pathPart, searchPart = ''] = beforeHash.split('?', 2);
  return {
    path: pathPart || '/',
    search: searchPart ? `?${searchPart}` : '',
    hash: hashPart ? `#${hashPart}` : ''
  };
};

const parseUrlParts = (raw: string, baseOrigin?: string): ParsedUrlParts | null => {
  // Parse targetUrl patterns into origin/path/query/hash components for matching. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasExplicitOrigin = ABSOLUTE_URL_REGEX.test(trimmed);

  if (hasExplicitOrigin) {
    try {
      const url = new URL(trimmed);
      return { origin: url.origin, path: url.pathname, search: url.search, hash: url.hash, hasExplicitOrigin: true };
    } catch {
      const match = trimmed.match(/^([a-zA-Z][a-zA-Z\d+.-]*:\/\/[^/]+)(.*)$/);
      if (match) {
        const origin = match[1];
        const rest = match[2] || '/';
        const parts = splitUrlParts(rest);
        return { origin, ...parts, hasExplicitOrigin: true };
      }
    }
  }

  if (baseOrigin) {
    try {
      const url = new URL(trimmed, baseOrigin);
      return { origin: url.origin, path: url.pathname, search: url.search, hash: url.hash, hasExplicitOrigin: false };
    } catch {
      // fall through
    }
  }

  const parts = splitUrlParts(trimmed);
  return { origin: '', ...parts, hasExplicitOrigin };
};

const buildPathRegex = (pattern: string): RegExp => {
  // Build a regex matcher for path patterns with params/wildcards. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const normalized = normalizePath(pattern);
  const hasTrailingGlob = normalized.endsWith('/**');
  const basePattern = hasTrailingGlob ? normalized.slice(0, -3) : normalized;
  let regexBody = '';
  let index = 0;
  while (index < basePattern.length) {
    const char = basePattern[index];
    if (char === '*') {
      if (basePattern[index + 1] === '*') {
        regexBody += '.*';
        index += 2;
        continue;
      }
      regexBody += '[^/]*';
      index += 1;
      continue;
    }
    if (char === ':') {
      let cursor = index + 1;
      while (cursor < basePattern.length && /[A-Za-z0-9_]/.test(basePattern[cursor])) cursor += 1;
      if (cursor > index + 1) {
        regexBody += '[^/]+';
        index = cursor;
        continue;
      }
    }
    regexBody += escapeRegex(char);
    index += 1;
  }
  const suffix = hasTrailingGlob ? '(?:/.*)?' : '';
  return new RegExp(`^${regexBody}${suffix}$`);
};

const matchPathPattern = (pattern: string, value: string): boolean => {
  // Match current paths against targetUrl path patterns. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const regex = buildPathRegex(pattern);
  return regex.test(normalizePath(value));
};

const buildValueRegex = (pattern: string): RegExp => {
  // Match query/hash value patterns with wildcards and params. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  let regexBody = '';
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === '*') {
      regexBody += '.*';
      index += 1;
      continue;
    }
    if (char === ':') {
      let cursor = index + 1;
      while (cursor < pattern.length && /[A-Za-z0-9_]/.test(pattern[cursor])) cursor += 1;
      if (cursor > index + 1) {
        regexBody += '.+';
        index = cursor;
        continue;
      }
    }
    regexBody += escapeRegex(char);
    index += 1;
  }
  return new RegExp(`^${regexBody}$`);
};

const normalizeSearch = (search: string): string => {
  const trimmed = search.trim();
  if (!trimmed) return '';
  if (trimmed === '*') return '?*';
  return trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
};

const stripIgnoredQueryParams = (search: string): string => {
  // Remove auth query params before comparing preview URLs. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const normalized = normalizeSearch(search);
  if (!normalized || normalized === '?*') return '';
  const params = new URLSearchParams(normalized.slice(1));
  IGNORED_QUERY_PARAMS.forEach((param) => params.delete(param));
  const next = params.toString();
  return next ? `?${next}` : '';
};

const matchQueryPattern = (targetSearch: string, currentSearch: string): boolean => {
  // Match query params in targetUrl patterns (ignore extra params in the current URL). docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const normalizedTarget = normalizeSearch(targetSearch);
  if (!normalizedTarget) return true;
  if (normalizedTarget === '?*') return true;
  const normalizedCurrent = normalizeSearch(currentSearch);
  const currentParams = new URLSearchParams(normalizedCurrent.slice(1));
  const targetParams = new URLSearchParams(normalizedTarget.slice(1));
  for (const [key, targetValue] of targetParams.entries()) {
    if (!currentParams.has(key)) return false;
    if (!targetValue) continue;
    const currentValues = currentParams.getAll(key);
    const matcher = buildValueRegex(targetValue);
    if (!currentValues.some((value) => matcher.test(value))) return false;
  }
  return true;
};

const normalizeHash = (hash: string): string => {
  const trimmed = hash.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
};

const matchHashPattern = (targetHash: string, currentHash: string): boolean => {
  // Match hash fragments when targetUrl specifies them. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const normalizedTarget = normalizeHash(targetHash);
  if (!normalizedTarget) return true;
  if (normalizedTarget === '*') return true;
  const matcher = buildValueRegex(normalizedTarget);
  return matcher.test(normalizeHash(currentHash));
};

export const splitPreviewTargetUrlCandidates = (rawTargetUrl: string): string[] => {
  // Support "||" to declare multiple acceptable targetUrl route patterns. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  if (!rawTargetUrl) return [];
  return rawTargetUrl
    .split(TARGET_URL_OR_SEPARATOR)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
};

// Preview route matching utility for auto-navigation decisions in the TaskGroup preview toolbar. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
// Key steps: parse current/target URLs, normalize paths, apply wildcard/param rules, and compare query/hash constraints. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
// Usage: TaskGroupChatPage uses this to decide whether to auto-navigate before sending highlight commands. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
// Change record: add || alternatives and wildcard/query/hash matching to reduce unnecessary navigation. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
// Pitfall: targetUrl patterns should still provide a concrete first candidate for navigation when needed. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
export const matchPreviewTargetUrl = (currentUrl: string, rawTargetUrl: string): boolean => {
  // Evaluate whether the current preview URL satisfies targetUrl route rules. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  if (!currentUrl || !rawTargetUrl) return false;
  const candidates = splitPreviewTargetUrlCandidates(rawTargetUrl);
  if (candidates.length === 0) return false;
  let currentParts: ParsedUrlParts | null = null;
  try {
    const url = new URL(currentUrl);
    currentParts = {
      origin: url.origin,
      path: url.pathname,
      search: stripIgnoredQueryParams(url.search),
      hash: url.hash,
      hasExplicitOrigin: true
    };
  } catch {
    currentParts = parseUrlParts(currentUrl);
    if (!currentParts) return false;
    currentParts.search = stripIgnoredQueryParams(currentParts.search);
  }

  const baseOrigin = currentParts.origin;
  const currentPath = normalizePath(currentParts.path);
  const currentSearch = currentParts.search;
  const currentHash = currentParts.hash;

  return candidates.some((candidate) => {
    const targetParts = parseUrlParts(candidate, baseOrigin);
    if (!targetParts) return false;
    if (targetParts.hasExplicitOrigin && baseOrigin && targetParts.origin.toLowerCase() !== baseOrigin.toLowerCase()) {
      return false;
    }
    if (!matchPathPattern(targetParts.path, currentPath)) return false;
    if (!matchQueryPattern(targetParts.search, currentSearch)) return false;
    if (!matchHashPattern(targetParts.hash, currentHash)) return false;
    return true;
  });
};
