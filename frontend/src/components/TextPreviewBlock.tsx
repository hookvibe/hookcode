import { FC, useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { buildTextPreview, RAW_TEXT_PREVIEW_LIMITS, type TextPreviewLimits } from '../utils/textPreview';

export type TextPreviewBlockProps = {
  text?: string | null;
  emptyText?: string;
  className?: string;
  codeClassName?: string;
  limits?: TextPreviewLimits;
};

export const TextPreviewBlock: FC<TextPreviewBlockProps> = ({
  text,
  emptyText,
  className,
  codeClassName = 'hc-task-code-block hc-task-code-block--expanded',
  limits = RAW_TEXT_PREVIEW_LIMITS
}) => {
  const t = useT();
  const normalizedText = String(text ?? '');
  const preview = useMemo(() => buildTextPreview(normalizedText, limits), [limits, normalizedText]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Reset preview state when the underlying artifact changes so newly selected files/outputs do not inherit stale expansion state. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    setExpanded(false);
  }, [normalizedText]);

  const displayText = expanded || !preview.truncated ? normalizedText : preview.text;

  return (
    <div className={`hc-preview-block ${className ?? ''}`.trim()}>
      <pre className={codeClassName}>{displayText || emptyText || ''}</pre>
      {preview.truncated ? (
        <div className="hc-preview-block__footer">
          <span className="hc-preview-block__meta">
            {t('viewer.preview.limited', {
              shownLines: preview.shownLines,
              totalLines: preview.totalLines,
              shownChars: preview.shownChars,
              totalChars: preview.totalChars
            })}
          </span>
          <button type="button" className="hc-preview-block__toggle" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
            {expanded ? t('viewer.preview.showLess') : t('viewer.preview.showFull')}
          </button>
        </div>
      ) : null}
    </div>
  );
};
