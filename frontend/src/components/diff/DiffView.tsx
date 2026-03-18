import { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { TextPreviewBlock } from '../TextPreviewBlock';
import type { DiffToken } from './calculateDiff';
import { calculateUnifiedDiff, parseUnifiedDiff } from './calculateDiff';
import '../../styles/execution-diff.css';
import {
  INLINE_DIFF_HARD_LIMITS,
  INLINE_DIFF_PREVIEW_LIMITS,
  UNIFIED_DIFF_PREVIEW_LIMITS,
  buildTextPreview,
  exceedsTextPreviewLimits
} from '../../utils/textPreview';

export interface DiffViewProps {
  oldText: string;
  newText: string;
  unifiedDiff?: string;
  contextLines?: number;
  showLineNumbers?: boolean;
  showPlusMinusSymbols?: boolean;
  wrapLines?: boolean;
  className?: string;
}

// Render a lightweight web diff view (line + inline highlights) for task execution artifacts. yjlphd6rbkrq521ny796
const normalizeLine = (value: string): string => String(value ?? '').replace(/\r$/, '').trimEnd();

const renderTokens = (params: { tokens?: DiffToken[]; baseClassName: string }) => {
  const tokens = params.tokens ?? [];
  if (tokens.length === 0) return null;

  let leadingProcessed = false;

  return tokens.map((token, idx) => {
    const raw = token?.value ?? '';
    if (!raw) return <Fragment key={idx} />;

    if (!leadingProcessed) {
      const match = raw.match(/^( +)/);
      if (match) {
        leadingProcessed = true;
        const dots = '\u00b7'.repeat(match[1].length);
        const rest = raw.slice(match[1].length);
        return (
          <span key={idx} className={params.baseClassName}>
            <span className="hc-diff__leading">{dots}</span>
            {rest ? (
              <span className={token.added ? 'hc-diff__inline-added' : token.removed ? 'hc-diff__inline-removed' : params.baseClassName}>
                {rest}
              </span>
            ) : null}
          </span>
        );
      }
      leadingProcessed = true;
    }

    const cls = token.added ? 'hc-diff__inline-added' : token.removed ? 'hc-diff__inline-removed' : params.baseClassName;
    return (
      <span key={idx} className={cls}>
        {raw}
      </span>
    );
  });
};

const EMPTY_PREVIEW = {
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
} as const;

export const DiffView: FC<DiffViewProps> = ({
  oldText,
  newText,
  unifiedDiff,
  contextLines = 3,
  showLineNumbers = true,
  showPlusMinusSymbols = true,
  wrapLines = true,
  className
}) => {
  const t = useT();
  const normalizedUnifiedDiff = String(unifiedDiff ?? '');
  const hasUnifiedDiff = normalizedUnifiedDiff.trim().length > 0;
  const unifiedDiffTooLarge = hasUnifiedDiff && exceedsTextPreviewLimits(normalizedUnifiedDiff, UNIFIED_DIFF_PREVIEW_LIMITS);
  const parsedUnifiedDiff = useMemo(
    () => (hasUnifiedDiff && !unifiedDiffTooLarge ? parseUnifiedDiff(normalizedUnifiedDiff) : null),
    [hasUnifiedDiff, normalizedUnifiedDiff, unifiedDiffTooLarge]
  );
  const hasInlineTexts = Boolean(String(oldText ?? '').length || String(newText ?? '').length);
  const useParsedUnifiedDiff = !hasInlineTexts && Boolean(parsedUnifiedDiff);
  const useInlineTexts = !useParsedUnifiedDiff;
  const [showFullInlineDiff, setShowFullInlineDiff] = useState(false);
  const oldPreview = useMemo(() => (useInlineTexts ? buildTextPreview(oldText, INLINE_DIFF_PREVIEW_LIMITS) : EMPTY_PREVIEW), [oldText, useInlineTexts]);
  const newPreview = useMemo(() => (useInlineTexts ? buildTextPreview(newText, INLINE_DIFF_PREVIEW_LIMITS) : EMPTY_PREVIEW), [newText, useInlineTexts]);
  const isPreviewLimited = oldPreview.truncated || newPreview.truncated;
  const isHardLimited =
    exceedsTextPreviewLimits(oldText, INLINE_DIFF_HARD_LIMITS) || exceedsTextPreviewLimits(newText, INLINE_DIFF_HARD_LIMITS);
  const useRawFallback = Boolean(hasUnifiedDiff && (unifiedDiffTooLarge || (!parsedUnifiedDiff && !hasInlineTexts)));

  useEffect(() => {
    // File switches should return to the bounded preview path first so giant worker diffs never auto-expand on live updates. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    setShowFullInlineDiff(false);
  }, [newText, oldText, unifiedDiff]);

  const renderedOldText = isPreviewLimited && !showFullInlineDiff ? oldPreview.text : oldText;
  const renderedNewText = isPreviewLimited && !showFullInlineDiff ? newPreview.text : newText;
  const inlineDiff = useMemo(
    () =>
      useParsedUnifiedDiff
        ? { hunks: [], stats: { additions: 0, deletions: 0 } }
        : calculateUnifiedDiff(renderedOldText, renderedNewText, contextLines),
    [contextLines, renderedNewText, renderedOldText, useParsedUnifiedDiff]
  );
  const hunks = useParsedUnifiedDiff ? parsedUnifiedDiff?.hunks ?? [] : inlineDiff.hunks;

  if (useRawFallback) {
    return (
      <div className={`hc-diff-viewer ${className ?? ''}`.trim()}>
        <div className="hc-diff__preview-banner">
          <span className="hc-diff__preview-copy">{t('tasks.workspaceChanges.preview.raw')}</span>
        </div>
        <TextPreviewBlock
          text={normalizedUnifiedDiff}
          limits={UNIFIED_DIFF_PREVIEW_LIMITS}
          className={`hc-diff__raw-preview ${wrapLines ? 'is-wrap' : 'is-nowrap'}`}
          codeClassName="hc-task-code-block hc-task-code-block--expanded"
        />
      </div>
    );
  }

  return (
    <div className={`hc-diff-viewer ${className ?? ''}`.trim()}>
      {useInlineTexts && isPreviewLimited ? (
        <div className="hc-diff__preview-banner">
          <span className="hc-diff__preview-copy">
            {isHardLimited
              ? t('tasks.workspaceChanges.preview.inlineLocked')
              : t('tasks.workspaceChanges.preview.inline')}
          </span>
          {!isHardLimited ? (
            <button type="button" className="hc-diff__preview-action" onClick={() => setShowFullInlineDiff((current) => !current)}>
              {showFullInlineDiff ? t('tasks.workspaceChanges.actions.showPreviewDiff') : t('tasks.workspaceChanges.actions.showFullDiff')}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={`hc-diff ${wrapLines ? 'hc-diff--wrap' : 'hc-diff--nowrap'}`.trim()}
        data-line-numbers={showLineNumbers ? 'true' : 'false'}
        data-plus-minus={showPlusMinusSymbols ? 'true' : 'false'}
      >
        {hunks.map((hunk, hunkIndex) => (
          <div key={`${hunkIndex}-${hunk.oldStart}-${hunk.newStart}`} className="hc-diff__hunk">
            {hunkIndex > 0 ? (
              <div className="hc-diff__hunk-header">{`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}</div>
            ) : null}

            {hunk.lines.map((line, lineIndex) => {
              const type = line.type;
              const baseClass =
                type === 'add' ? 'hc-diff__line hc-diff__line--add' : type === 'remove' ? 'hc-diff__line hc-diff__line--remove' : 'hc-diff__line';
              const sign = type === 'add' ? '+' : type === 'remove' ? '-' : ' ';
              const num =
                type === 'remove' ? line.oldLineNumber : type === 'add' ? line.newLineNumber : line.oldLineNumber ?? line.newLineNumber;

              const content = normalizeLine(line.content);
              const tokens = renderTokens({ tokens: line.tokens, baseClassName: 'hc-diff__text' });

              const leading = !tokens
                ? (() => {
                    const match = content.match(/^( +)/);
                    if (!match) return { dots: '', rest: content };
                    return { dots: '\u00b7'.repeat(match[1].length), rest: content.slice(match[1].length) };
                  })()
                : null;

              return (
                <div key={`${hunkIndex}-${lineIndex}`} className={baseClass}>
                  {showLineNumbers ? <span className="hc-diff__ln">{String(num ?? '').padStart(4, ' ')}</span> : null}
                  {showPlusMinusSymbols ? <span className="hc-diff__pm">{sign}</span> : null}
                  <span className="hc-diff__content">
                    {tokens ? (
                      tokens
                    ) : (
                      <span className="hc-diff__text">
                        {leading?.dots ? <span className="hc-diff__leading">{leading.dots}</span> : null}
                        {leading?.rest}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
