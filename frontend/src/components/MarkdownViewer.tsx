import { FC, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * MarkdownViewer (Frontend Chat):
 * - Business context: render task output text in a readable, copy-friendly way.
 * - Notes: keeps links safe (`target="_blank"` + rel attrs).
 *
 * Change record:
 * - 2026-01-11: Migrated from the legacy frontend for task/group chat views.
 */

interface Props {
  markdown: string;
  className?: string;
}

export const MarkdownViewer: FC<Props> = ({ markdown, className }) => {
  const content = useMemo(() => String(markdown ?? '').trimEnd(), [markdown]);
  const classes = ['markdown-result', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node: _node, children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

