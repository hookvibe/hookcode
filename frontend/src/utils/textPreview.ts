export type TextPreviewLimits = {
  maxLines: number;
  maxChars: number;
};

export type TextPreviewResult = {
  text: string;
  truncated: boolean;
  truncatedByLines: boolean;
  truncatedByChars: boolean;
  totalLines: number;
  shownLines: number;
  hiddenLines: number;
  totalChars: number;
  shownChars: number;
  hiddenChars: number;
};

// Centralize large text preview limits so command output, raw logs, and diff fallbacks can stay responsive under worker-sized payloads. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
export const COMMAND_OUTPUT_PREVIEW_LIMITS: TextPreviewLimits = { maxLines: 180, maxChars: 32_000 };
export const RAW_TEXT_PREVIEW_LIMITS: TextPreviewLimits = { maxLines: 320, maxChars: 72_000 };
export const UNIFIED_DIFF_PREVIEW_LIMITS: TextPreviewLimits = { maxLines: 1_500, maxChars: 200_000 };
export const INLINE_DIFF_PREVIEW_LIMITS: TextPreviewLimits = { maxLines: 900, maxChars: 120_000 };
export const INLINE_DIFF_HARD_LIMITS: TextPreviewLimits = { maxLines: 2_400, maxChars: 320_000 };

const countLines = (value: string): number => {
  if (!value) return 0;
  let lines = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\n') lines += 1;
  }
  return lines;
};

export const exceedsTextPreviewLimits = (value: string, limits: TextPreviewLimits): boolean => {
  const normalized = String(value ?? '');
  if (!normalized) return false;
  if (limits.maxChars > 0 && normalized.length > limits.maxChars) return true;
  if (limits.maxLines <= 0) return false;

  let lines = 1;
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] !== '\n') continue;
    lines += 1;
    if (lines > limits.maxLines) return true;
  }
  return false;
};

export const buildTextPreview = (value: string, limits: TextPreviewLimits): TextPreviewResult => {
  const normalized = String(value ?? '');
  const totalChars = normalized.length;
  const totalLines = countLines(normalized);

  if (!normalized) {
    return {
      text: '',
      truncated: false,
      truncatedByLines: false,
      truncatedByChars: false,
      totalLines: 0,
      shownLines: 0,
      hiddenLines: 0,
      totalChars: 0,
      shownChars: 0,
      hiddenChars: 0
    };
  }

  let previewText = normalized;
  let truncatedByChars = false;
  let truncatedByLines = false;

  if (limits.maxChars > 0 && previewText.length > limits.maxChars) {
    previewText = previewText.slice(0, limits.maxChars);
    truncatedByChars = true;
  }

  if (limits.maxLines > 0) {
    const previewLines = previewText.split('\n');
    if (previewLines.length > limits.maxLines) {
      previewText = previewLines.slice(0, limits.maxLines).join('\n');
      truncatedByLines = true;
    }
  }

  const shownChars = previewText.length;
  const shownLines = countLines(previewText);

  return {
    text: previewText,
    truncated: truncatedByChars || truncatedByLines,
    truncatedByLines,
    truncatedByChars,
    totalLines,
    shownLines,
    hiddenLines: Math.max(totalLines - shownLines, 0),
    totalChars,
    shownChars,
    hiddenChars: Math.max(totalChars - shownChars, 0)
  };
};
