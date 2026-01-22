import { FC, type ReactNode, useMemo, useState } from 'react';
import { Space, Tag, Typography } from 'antd';
import { CaretDownOutlined, CaretRightOutlined, CodeOutlined, FileTextOutlined, MessageOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Think, ThoughtChain, type ThoughtChainItemType } from '@ant-design/x';
import type { ExecutionFileDiff, ExecutionItem } from '../../utils/executionLog';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { DiffView } from '../diff/DiffView';

export interface ExecutionTimelineProps {
  items: ExecutionItem[];
  showReasoning?: boolean;
  wrapDiffLines?: boolean;
  showLineNumbers?: boolean;
}

// Render structured execution steps parsed from JSONL task logs (Codex + HookCode diff artifacts). yjlphd6rbkrq521ny796
const formatPath = (raw: string): string => {
  const value = String(raw ?? '').trim();
  if (!value) return value;
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.length <= 3 ? value : parts.slice(-3).join('/');
};

const diffKey = (diff: ExecutionFileDiff): string => `${diff.path}::${diff.kind ?? ''}`;

const clampText = (raw: string, maxLen: number): string => {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

const firstLine = (raw: string): string => {
  const text = String(raw ?? '');
  const line = text.split(/\r?\n/).find((v) => v.trim().length > 0);
  return (line ?? '').trim();
};

type ExecutionThinkProps = {
  title: ReactNode;
  icon?: ReactNode;
  hideIcon?: boolean;
  loading?: boolean;
  blink?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
};

const ExecutionThink: FC<ExecutionThinkProps> = ({ title, icon, hideIcon = false, loading, blink, defaultExpanded = false, children }) => {
  // Control Think expansion so we can use CaretRight/CaretDown icons and default-collapse details. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Think
      className={hideIcon ? 'hc-exec-think hc-exec-think--no-icon' : 'hc-exec-think'}
      icon={icon}
      loading={loading}
      blink={blink}
      expanded={expanded}
      onExpand={setExpanded}
      title={
        <span className="hc-exec-think-title">
          <span className="hc-exec-think-title__caret">{expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}</span>
          <span className="hc-exec-think-title__text">{title}</span>
        </span>
      }
    >
      {children}
    </Think>
  );
};

export const ExecutionTimeline: FC<ExecutionTimelineProps> = ({ items, showReasoning = false, wrapDiffLines = true, showLineNumbers = true }) => {
  const t = useT();

  const visibleItems = useMemo(() => (showReasoning ? items : items.filter((item) => item.kind !== 'reasoning')), [items, showReasoning]);

  const toThoughtStatus = (item: ExecutionItem): ThoughtChainItemType['status'] | undefined => {
    // Map HookCode/Codex execution statuses to Ant Design X thought chain status icons. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
    const status = String(item.status ?? '').trim().toLowerCase();
    const isRunning =
      status === 'in_progress' || status === 'started' || status === 'updated' || status === 'running' || status === 'processing';
    const isFailed = status === 'failed' || status === 'error';
    const isAbort = status === 'abort' || status === 'aborted' || status === 'cancelled' || status === 'canceled';

    if (isAbort) return 'abort';
    if (isRunning) return 'loading';

    if (item.kind === 'command_execution' && typeof item.exitCode === 'number') {
      return item.exitCode === 0 ? 'success' : 'error';
    }

    if (isFailed) return 'error';
    if (status === 'completed' || status === 'success' || status === 'done') return 'success';
    return undefined;
  };

  // Simplify item headers (no "Completed" tag / exit code text); rely on ThoughtChain status icons instead. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
  const buildTitle = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      return (
        <Space size={8} wrap>
          <CodeOutlined />
          <Typography.Text strong>{t('execViewer.item.command')}</Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'file_change') {
      return (
        <Space size={8} wrap>
          <FileTextOutlined />
          <Typography.Text strong>{t('execViewer.item.files')}</Typography.Text>
          <Typography.Text type="secondary">{t('execViewer.files.count', { count: item.changes.length })}</Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'agent_message') {
      const line = firstLine(item.text);
      const text = line ? clampText(line, 140) : t('execViewer.item.message');
      return (
        <Space size={8} style={{ minWidth: 0 }}>
          <MessageOutlined />
          <Typography.Text strong ellipsis={{ tooltip: line || undefined }} style={{ minWidth: 0 }}>
            {text}
          </Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'reasoning') {
      const line = firstLine(item.text);
      const text = line ? clampText(line, 140) : t('execViewer.item.reasoning');
      return (
        <Space size={8} style={{ minWidth: 0 }}>
          <QuestionCircleOutlined />
          <Typography.Text strong ellipsis={{ tooltip: line || undefined }} style={{ minWidth: 0 }}>
            {text}
          </Typography.Text>
        </Space>
      );
    }

    return (
      <Space size={8} wrap>
        <QuestionCircleOutlined />
        <Typography.Text strong>{t('execViewer.item.unknown')}</Typography.Text>
      </Space>
    );
  };

  const buildDescription = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      // Avoid repeating the same command in multiple places (title + description + content). docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    if (item.kind === 'file_change') {
      const sample = item.changes
        .slice(0, 3)
        .map((c) => formatPath(c.path))
        .filter(Boolean)
        .join(', ');
      if (!sample) return null;
      return (
        <Typography.Text type="secondary" className="hc-exec-thought__desc" ellipsis={{ tooltip: item.changes.map((c) => c.path).join('\n') }}>
          {clampText(sample, 160)}
        </Typography.Text>
      );
    }

    if (item.kind === 'agent_message') {
      // Move message snippets into ThoughtChain titles to keep the node scan-friendly without duplicate lines. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    if (item.kind === 'reasoning') {
      // Move reasoning snippets into ThoughtChain titles to keep the node scan-friendly without duplicate lines. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    return null;
  };

  const renderContent = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink
          title={<span className="hc-exec-think-title__mono">{clampText(item.command || '-', 180)}</span>}
          icon={<CodeOutlined />}
          hideIcon
          loading={running}
          blink={running}
          defaultExpanded={false}
        >
          {item.output ? <pre className="hc-exec-output">{item.output}</pre> : <Typography.Text type="secondary">-</Typography.Text>}
        </ExecutionThink>
      );
    }

    if (item.kind === 'file_change') {
      const running = toThoughtStatus(item) === 'loading';
      const diffs = item.diffs ?? [];
      return (
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <ExecutionThink title={t('execViewer.item.files')} icon={<FileTextOutlined />} loading={running} blink={running} defaultExpanded={false}>
            {item.changes.length ? (
              <div className="hc-exec-files">
                {item.changes.map((change, idx) => (
                  <div key={`${idx}-${change.path}`} className="hc-exec-file">
                    <Typography.Text className="hc-exec-file__path" ellipsis={{ tooltip: change.path }}>
                      {formatPath(change.path)}
                    </Typography.Text>
                    {change.kind ? (
                      <Tag color="default" style={{ marginInlineStart: 8 }}>
                        {change.kind}
                      </Tag>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">{t('execViewer.files.empty')}</Typography.Text>
            )}
          </ExecutionThink>

          {diffs.length ? (
            diffs.map((diff) => (
              <ExecutionThink key={diffKey(diff)} title={<span className="hc-exec-think-title__mono">{diff.path}</span>} icon={<FileTextOutlined />} defaultExpanded={false}>
                {diff.oldText !== undefined && diff.newText !== undefined ? (
                  <DiffView oldText={diff.oldText} newText={diff.newText} showLineNumbers={showLineNumbers} showPlusMinusSymbols wrapLines={wrapDiffLines} />
                ) : (
                  <pre className="hc-exec-output hc-exec-output--mono">{diff.unifiedDiff}</pre>
                )}
              </ExecutionThink>
            ))
          ) : (
            <Typography.Text type="secondary">{t('execViewer.diff.pending')}</Typography.Text>
          )}
        </Space>
      );
    }

    if (item.kind === 'agent_message') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink title={t('execViewer.item.message')} icon={<MessageOutlined />} loading={running} blink={running} defaultExpanded={false}>
          {item.text ? <MarkdownViewer markdown={item.text} className="markdown-result--expanded" /> : <Typography.Text type="secondary">-</Typography.Text>}
        </ExecutionThink>
      );
    }

    if (item.kind === 'reasoning') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink title={t('execViewer.item.reasoning')} icon={<QuestionCircleOutlined />} loading={running} blink={running} defaultExpanded={false}>
          <pre className="hc-exec-output hc-exec-output--mono">{item.text || '-'}</pre>
        </ExecutionThink>
      );
    }

    return (
      <ExecutionThink title={t('execViewer.item.unknown')} icon={<QuestionCircleOutlined />} defaultExpanded={false}>
        <pre className="hc-exec-output hc-exec-output--mono">{JSON.stringify((item as any).raw ?? item, null, 2)}</pre>
      </ExecutionThink>
    );
  };

  const chainItems = useMemo<ThoughtChainItemType[]>(
    () =>
      visibleItems.map((item) => ({
        key: item.id,
        title: buildTitle(item),
        description: buildDescription(item),
        content: renderContent(item),
        status: toThoughtStatus(item),
        blink: toThoughtStatus(item) === 'loading'
      })),
    [visibleItems, showLineNumbers, t, wrapDiffLines]
  );

  if (!chainItems.length) {
    // Avoid conditional hooks by rendering the empty state after all hooks have executed. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    return (
      <div className="hc-exec-empty">
        <Typography.Text type="secondary">{t('execViewer.empty.timeline')}</Typography.Text>
      </div>
    );
  }

  return (
    // Replace per-step Cards with Ant Design X ThoughtChain/Think to improve scanability of structured logs. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
    <ThoughtChain items={chainItems} rootClassName="hc-exec-thought-chain" line="solid" />
  );
};
