import { FC, Fragment, useMemo } from 'react';
import type { DiffToken } from './calculateDiff';
import { calculateUnifiedDiff } from './calculateDiff';

export interface DiffViewProps {
  oldText: string;
  newText: string;
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

export const DiffView: FC<DiffViewProps> = ({
  oldText,
  newText,
  contextLines = 3,
  showLineNumbers = true,
  showPlusMinusSymbols = true,
  wrapLines = true,
  className
}) => {
  const { hunks } = useMemo(() => calculateUnifiedDiff(oldText, newText, contextLines), [contextLines, newText, oldText]);

  return (
    <div className={`hc-diff ${wrapLines ? 'hc-diff--wrap' : 'hc-diff--nowrap'} ${className ?? ''}`.trim()}>
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
  );
};
