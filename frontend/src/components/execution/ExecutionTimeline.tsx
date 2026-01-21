import { FC, useMemo } from 'react';
import { Card, Collapse, Space, Tag, Typography } from 'antd';
import { CodeOutlined, FileTextOutlined, MessageOutlined, QuestionCircleOutlined } from '@ant-design/icons';
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

export const ExecutionTimeline: FC<ExecutionTimelineProps> = ({ items, showReasoning = false, wrapDiffLines = true, showLineNumbers = true }) => {
  const t = useT();

  const visibleItems = useMemo(() => (showReasoning ? items : items.filter((item) => item.kind !== 'reasoning')), [items, showReasoning]);

  if (!visibleItems.length) {
    return (
      <div className="hc-exec-empty">
        <Typography.Text type="secondary">{t('execViewer.empty.timeline')}</Typography.Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {visibleItems.map((item) => {
        if (item.kind === 'command_execution') {
          const hasError = typeof item.exitCode === 'number' && item.exitCode !== 0;
          const statusColor = item.status === 'in_progress' ? 'processing' : hasError ? 'red' : 'green';
          const statusLabel =
            item.status === 'in_progress'
              ? t('execViewer.status.running')
              : hasError
                ? t('execViewer.status.failed')
                : t('execViewer.status.completed');

          return (
            <Card
              key={item.id}
              size="small"
              className="hc-exec-item"
              styles={{ body: { padding: 12 } }}
              title={
                <Space size={8}>
                  <CodeOutlined />
                  <Typography.Text strong>{t('execViewer.item.command')}</Typography.Text>
                  <Tag color={statusColor} style={{ marginInlineStart: 6 }}>
                    {statusLabel}
                  </Tag>
                  {typeof item.exitCode === 'number' ? (
                    <Typography.Text type="secondary">{t('execViewer.exitCode', { code: item.exitCode })}</Typography.Text>
                  ) : null}
                </Space>
              }
            >
              <pre className="hc-exec-code">{item.command || '-'}</pre>
              {item.output ? <pre className="hc-exec-output">{item.output}</pre> : null}
            </Card>
          );
        }

        if (item.kind === 'file_change') {
          const diffs = item.diffs ?? [];

          return (
            <Card
              key={item.id}
              size="small"
              className="hc-exec-item"
              styles={{ body: { padding: 12 } }}
              title={
                <Space size={8}>
                  <FileTextOutlined />
                  <Typography.Text strong>{t('execViewer.item.files')}</Typography.Text>
                  <Typography.Text type="secondary">{t('execViewer.files.count', { count: item.changes.length })}</Typography.Text>
                </Space>
              }
            >
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

              {diffs.length ? (
                <div style={{ marginTop: 10 }}>
                  <Collapse
                    size="small"
                    items={diffs.map((diff) => ({
                      key: diffKey(diff),
                      label: (
                        <Space size={8}>
                          <Typography.Text className="hc-exec-diff__file" ellipsis={{ tooltip: diff.path }}>
                            {diff.path}
                          </Typography.Text>
                          {diff.kind ? <Tag color="default">{diff.kind}</Tag> : null}
                        </Space>
                      ),
                      children:
                        diff.oldText !== undefined && diff.newText !== undefined ? (
                          <DiffView
                            oldText={diff.oldText}
                            newText={diff.newText}
                            showLineNumbers={showLineNumbers}
                            showPlusMinusSymbols
                            wrapLines={wrapDiffLines}
                          />
                        ) : (
                          <pre className="hc-exec-output hc-exec-output--mono">{diff.unifiedDiff}</pre>
                        )
                    }))}
                  />
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <Typography.Text type="secondary">{t('execViewer.diff.pending')}</Typography.Text>
                </div>
              )}
            </Card>
          );
        }

        if (item.kind === 'agent_message') {
          return (
            <Card
              key={item.id}
              size="small"
              className="hc-exec-item"
              styles={{ body: { padding: 12 } }}
              title={
                <Space size={8}>
                  <MessageOutlined />
                  <Typography.Text strong>{t('execViewer.item.message')}</Typography.Text>
                </Space>
              }
            >
              {item.text ? <MarkdownViewer markdown={item.text} className="markdown-result--expanded" /> : <Typography.Text type="secondary">-</Typography.Text>}
            </Card>
          );
        }

        if (item.kind === 'reasoning') {
          return (
            <Card
              key={item.id}
              size="small"
              className="hc-exec-item"
              styles={{ body: { padding: 12 } }}
              title={
                <Space size={8}>
                  <QuestionCircleOutlined />
                  <Typography.Text strong>{t('execViewer.item.reasoning')}</Typography.Text>
                </Space>
              }
            >
              <pre className="hc-exec-output hc-exec-output--mono">{item.text || '-'}</pre>
            </Card>
          );
        }

        return (
          <Card
            key={item.id}
            size="small"
            className="hc-exec-item"
            styles={{ body: { padding: 12 } }}
            title={
              <Space size={8}>
                <QuestionCircleOutlined />
                <Typography.Text strong>{t('execViewer.item.unknown')}</Typography.Text>
                <Tag color="default">{item.kind}</Tag>
              </Space>
            }
          >
            <pre className="hc-exec-output hc-exec-output--mono">{JSON.stringify((item as any).raw ?? item, null, 2)}</pre>
          </Card>
        );
      })}
    </Space>
  );
};
