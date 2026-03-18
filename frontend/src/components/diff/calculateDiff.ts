import { diffLines, diffWordsWithSpace } from 'diff';

export interface DiffToken {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  tokens?: DiffToken[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  stats: { additions: number; deletions: number };
}

interface PendingRemoval {
  line: string;
  index: number;
}

const MAX_COMMON_SUBSTRING_LEN = 3;
const UNIFIED_DIFF_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const splitLines = (value: string): string[] => {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

/**
 * Calculate a unified diff (with inline tokens) between two full texts. yjlphd6rbkrq521ny796
 */
export function calculateUnifiedDiff(oldText: string, newText: string, contextLines: number = 3): DiffResult {
  const lineChanges = diffLines(oldText, newText);

  const allLines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;
  let additions = 0;
  let deletions = 0;

  let pendingRemovals: PendingRemoval[] = [];

  for (const change of lineChanges) {
    const lines = splitLines(change.value ?? '');

    for (const line of lines) {
      if (change.removed) {
        pendingRemovals.push({ line, index: allLines.length });
        allLines.push({ type: 'remove', content: line, oldLineNumber: oldLineNum++ });
        deletions += 1;
        continue;
      }

      if (change.added) {
        let paired = false;
        if (pendingRemovals.length > 0) {
          const bestIndex = findBestMatch(line, pendingRemovals.map((r) => r.line));
          if (bestIndex !== -1) {
            const removal = pendingRemovals[bestIndex];
            pendingRemovals.splice(bestIndex, 1);

            const tokens = calculateInlineDiff(removal.line, line);
            allLines[removal.index].tokens = tokens.filter((t) => !t.added);
            allLines.push({ type: 'add', content: line, newLineNumber: newLineNum++, tokens: tokens.filter((t) => !t.removed) });
            paired = true;
          }
        }

        if (!paired) {
          allLines.push({ type: 'add', content: line, newLineNumber: newLineNum++ });
        }
        additions += 1;
        continue;
      }

      allLines.push({ type: 'normal', content: line, oldLineNumber: oldLineNum++, newLineNumber: newLineNum++ });
    }
  }

  return { hunks: createHunks(allLines, contextLines), stats: { additions, deletions } };
}

export function calculateUnifiedDiffStats(unifiedDiff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of splitLines(unifiedDiff)) {
    if (!line || line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }
    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }
    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

export function parseUnifiedDiff(unifiedDiff: string): DiffResult | null {
  const rawLines = splitLines(unifiedDiff);
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let additions = 0;
  let deletions = 0;

  const flushHunk = () => {
    if (!currentHunk) return;
    decorateInlineTokens(currentHunk.lines);
    hunks.push(currentHunk);
    currentHunk = null;
  };

  for (const line of rawLines) {
    const headerMatch = line.match(UNIFIED_DIFF_HEADER);
    if (headerMatch) {
      flushHunk();
      currentHunk = {
        oldStart: Number.parseInt(headerMatch[1] ?? '1', 10),
        oldLines: Number.parseInt(headerMatch[2] ?? '1', 10),
        newStart: Number.parseInt(headerMatch[3] ?? '1', 10),
        newLines: Number.parseInt(headerMatch[4] ?? '1', 10),
        lines: []
      };
      oldLineNumber = currentHunk.oldStart;
      newLineNumber = currentHunk.newStart;
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({ type: 'add', content: line.slice(1), newLineNumber });
      newLineNumber += 1;
      additions += 1;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({ type: 'remove', content: line.slice(1), oldLineNumber });
      oldLineNumber += 1;
      deletions += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      currentHunk.lines.push({ type: 'normal', content: line.slice(1), oldLineNumber, newLineNumber });
      oldLineNumber += 1;
      newLineNumber += 1;
      continue;
    }

    currentHunk.lines.push({ type: 'normal', content: line });
  }

  flushHunk();

  if (!hunks.length) return null;
  return { hunks, stats: { additions, deletions } };
}

const calculateInlineDiff = (oldLine: string, newLine: string): DiffToken[] =>
  diffWordsWithSpace(oldLine, newLine).map((part) => ({
    value: part.value,
    added: part.added,
    removed: part.removed
  }));

const decorateInlineTokens = (lines: DiffLine[]): void => {
  let pendingRemovals: PendingRemoval[] = [];

  lines.forEach((line, index) => {
    if (line.type === 'remove') {
      pendingRemovals.push({ line: line.content, index });
      return;
    }

    if (line.type === 'add') {
      if (pendingRemovals.length > 0) {
        const bestIndex = findBestMatch(line.content, pendingRemovals.map((entry) => entry.line));
        if (bestIndex !== -1) {
          const removal = pendingRemovals[bestIndex];
          pendingRemovals.splice(bestIndex, 1);
          const tokens = calculateInlineDiff(removal.line, line.content);
          lines[removal.index] = { ...lines[removal.index], tokens: tokens.filter((token) => !token.added) };
          lines[index] = { ...line, tokens: tokens.filter((token) => !token.removed) };
        }
      }
      return;
    }

    pendingRemovals = [];
  });
};

const findBestMatch = (target: string, candidates: string[]): number => {
  if (candidates.length === 0) return -1;
  let bestIndex = -1;
  let bestScore = 0;
  const threshold = 0.3;

  candidates.forEach((candidate, index) => {
    const score = calculateSimilarity(target, candidate);
    if (score > bestScore && score > threshold) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const calculateSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i += 1) {
    if (a[i] === b[i]) matches += 1;
  }

  const substrings = findCommonSubstrings(a, b);
  const substringBonus = substrings.reduce((sum, sub) => sum + sub.length, 0) / maxLen;
  return (matches / maxLen + substringBonus) / 2;
};

const findCommonSubstrings = (a: string, b: string): string[] => {
  const minLength = MAX_COMMON_SUBSTRING_LEN;
  const substrings: string[] = [];

  for (let len = Math.min(a.length, b.length); len >= minLength; len -= 1) {
    for (let i = 0; i <= a.length - len; i += 1) {
      const sub = a.substring(i, i + len);
      if (b.includes(sub) && !substrings.some((s) => s.includes(sub))) {
        substrings.push(sub);
      }
    }
  }

  return substrings;
};

const createHunks = (lines: DiffLine[], contextLines: number): DiffHunk[] => {
  const hunks: DiffHunk[] = [];
  const changes = lines
    .map((line, index) => ({ ...line, index }))
    .filter((line) => line.type !== 'normal');

  if (changes.length === 0) {
    if (lines.length > 0) {
      hunks.push({
        oldStart: 1,
        oldLines: lines.filter((l) => l.oldLineNumber).length,
        newStart: 1,
        newLines: lines.filter((l) => l.newLineNumber).length,
        lines
      });
    }
    return hunks;
  }

  let currentHunk: DiffLine[] = [];
  let lastIncludedIndex = -1;

  changes.forEach((change, i) => {
    const startContext = Math.max(0, change.index - contextLines);
    const endContext = Math.min(lines.length - 1, change.index + contextLines);

    for (let j = Math.max(lastIncludedIndex + 1, startContext); j <= endContext; j += 1) {
      currentHunk.push(lines[j]);
    }
    lastIncludedIndex = endContext;

    const nextChange = changes[i + 1];
    if (nextChange && nextChange.index - endContext > contextLines * 2) {
      if (currentHunk.length > 0) {
        const firstLine = currentHunk[0];
        hunks.push({
          oldStart: firstLine.oldLineNumber || 1,
          oldLines: currentHunk.filter((l) => l.oldLineNumber).length,
          newStart: firstLine.newLineNumber || 1,
          newLines: currentHunk.filter((l) => l.newLineNumber).length,
          lines: currentHunk
        });
      }
      currentHunk = [];
    }
  });

  if (currentHunk.length > 0) {
    const firstLine = currentHunk[0];
    hunks.push({
      oldStart: firstLine.oldLineNumber || 1,
      oldLines: currentHunk.filter((l) => l.oldLineNumber).length,
      newStart: firstLine.newLineNumber || 1,
      newLines: currentHunk.filter((l) => l.newLineNumber).length,
      lines: currentHunk
    });
  }

  return hunks;
};
