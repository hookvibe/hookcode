import { FC, useEffect, useMemo, useState } from 'react';
import { Button, Collapse, Descriptions, Empty, Input, Select, Space, Tag, Timeline, Typography } from 'antd';
import type {
  ReplayWebhookEventRequest,
  RepoWebhookDeliveryResult,
  WebhookEventDetail,
  WebhookReplayMode,
  WebhookTraceStepStatus
} from '../../api';
import { buildTaskGroupHash, buildTaskHash } from '../../router';
import { useT } from '../../i18n';
import { JsonViewer } from '../JsonViewer';

const traceStatusColor = (status: WebhookTraceStepStatus): string => {
  if (status === 'success') return 'green';
  if (status === 'skipped') return 'gold';
  return 'red';
};

const resultTagColor = (result: RepoWebhookDeliveryResult): string => {
  if (result === 'accepted') return 'green';
  if (result === 'skipped') return 'default';
  if (result === 'rejected') return 'orange';
  return 'red';
};

const defaultReplayMode = (event: WebhookEventDetail): WebhookReplayMode =>
  event.matchedRobotIds.length > 0 ? 'stored_actions' : 'current_config';

const navigateHash = (hash: string) => {
  if (typeof window === 'undefined') return;
  window.location.hash = hash;
};

const renderJsonBlock = (value: unknown) =>
  value === undefined ? <Typography.Text type="secondary">-</Typography.Text> : <JsonViewer value={value} />;

const formatIso = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

// Reuse one webhook detail renderer so repo detail and admin settings show the same replay/debug evidence. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const renderWebhookResultTag = (
  t: ReturnType<typeof useT>,
  result: RepoWebhookDeliveryResult
) => <Tag color={resultTagColor(result)}>{t(`repos.webhookDeliveries.result.${result}` as const)}</Tag>;

export interface WebhookEventDetailViewProps {
  event: WebhookEventDetail;
  canReplay?: boolean;
  replayLoading?: boolean;
  dryRunLoading?: boolean;
  onReplay?: (input: ReplayWebhookEventRequest, options: { dryRun: boolean }) => void | Promise<void>;
  onOpenEvent?: (eventId: string) => void;
}

export const WebhookEventDetailView: FC<WebhookEventDetailViewProps> = ({
  event,
  canReplay = false,
  replayLoading = false,
  dryRunLoading = false,
  onReplay,
  onOpenEvent
}) => {
  const t = useT();
  const [mode, setMode] = useState<WebhookReplayMode>(() => defaultReplayMode(event));
  const [robotId, setRobotId] = useState('');
  const [ruleId, setRuleId] = useState('');

  useEffect(() => {
    setMode(defaultReplayMode(event));
    setRobotId('');
    setRuleId('');
  }, [event.id]);

  const replayInput = useMemo<ReplayWebhookEventRequest>(
    () => ({
      mode,
      ...(mode === 'override_robot' && robotId.trim() ? { robotId: robotId.trim() } : {}),
      ...(mode === 'override_rule' && ruleId.trim() ? { ruleId: ruleId.trim() } : {})
    }),
    [mode, robotId, ruleId]
  );

  const signatureText = useMemo(() => {
    if (event.signatureVerified === true) return t('repos.webhookDeliveries.signature.verified');
    if (event.signatureVerified === false) return t('repos.webhookDeliveries.signature.failed');
    return t('repos.webhookDeliveries.signature.unknown');
  }, [event.signatureVerified, t]);

  const detailPanels = [
    {
      key: 'payload',
      label: t('repos.webhookDeliveries.detailPayload'),
      children: renderJsonBlock(event.payload)
    },
    {
      key: 'response',
      label: t('repos.webhookDeliveries.detailResponse'),
      children: renderJsonBlock(event.response)
    },
    {
      key: 'resolvedActions',
      label: t('repos.webhookDeliveries.detailResolvedActions'),
      children: event.debugTrace?.resolvedActions?.length ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {event.debugTrace.resolvedActions.map((action, index) => (
            <div
              key={`${action.ruleId}-${action.robotId}-${index}`}
              style={{ border: '1px solid rgba(5,5,5,0.06)', borderRadius: 8, padding: 12 }}
            >
              <Space wrap>
                <Tag>{t('repos.webhookDeliveries.detailRules')}</Tag>
                <Typography.Text code>{action.ruleId}</Typography.Text>
                <Tag>{t('repos.webhookDeliveries.detailRobots')}</Tag>
                <Typography.Text code>{action.robotId}</Typography.Text>
                <Tag color="blue">{t(`repos.webhookDeliveries.replay.mode.${action.source}` as const)}</Tag>
              </Space>
              {action.promptCustom ? (
                <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  <Typography.Text strong>{t('repos.webhookDeliveries.detailPromptOverride')}:</Typography.Text>{' '}
                  <Typography.Text>{action.promptCustom}</Typography.Text>
                </Typography.Paragraph>
              ) : null}
              {action.timeWindow ? (
                <div style={{ marginTop: 8 }}>{renderJsonBlock(action.timeWindow)}</div>
              ) : null}
            </div>
          ))}
        </Space>
      ) : (
        <Typography.Text type="secondary">{t('repos.webhookDeliveries.detailResolvedActionsEmpty')}</Typography.Text>
      )
    },
    {
      key: 'dryRun',
      label: t('repos.webhookDeliveries.detailDryRun'),
      children: event.dryRunResult ? (
        renderJsonBlock(event.dryRunResult)
      ) : (
        <Typography.Text type="secondary">{t('repos.webhookDeliveries.detailDryRunEmpty')}</Typography.Text>
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space size={12} wrap>
        <Typography.Text code>{event.createdAt}</Typography.Text>
        {renderWebhookResultTag(t, event.result)}
        <Typography.Text type="secondary">
          {event.provider === 'github' ? 'GitHub' : 'GitLab'}
          {event.eventName ? ` · ${event.eventName}` : ''}
          {event.mappedEventType ? ` · ${event.mappedEventType}` : ''}
        </Typography.Text>
        <Typography.Text type="secondary">HTTP {event.httpStatus}</Typography.Text>
      </Space>

      <Descriptions
        size="small"
        column={2}
        bordered
        items={[
          {
            key: 'deliveryId',
            label: t('repos.webhookDeliveries.detailDeliveryId'),
            children: event.deliveryId ? <Typography.Text code>{event.deliveryId}</Typography.Text> : '-'
          },
          {
            key: 'payloadHash',
            label: t('repos.webhookDeliveries.detailPayloadHash'),
            children: event.payloadHash ? <Typography.Text code>{event.payloadHash}</Typography.Text> : '-'
          },
          {
            key: 'signature',
            label: t('repos.webhookDeliveries.detailSignature'),
            children: signatureText
          },
          {
            key: 'errorLayer',
            label: t('repos.webhookDeliveries.detailErrorLayer'),
            children: event.errorLayer ? <Typography.Text code>{event.errorLayer}</Typography.Text> : '-'
          },
          {
            key: 'source',
            label: t('repos.webhookDeliveries.detailReplaySource'),
            children: t(`repos.webhookDeliveries.trace.source.${event.debugTrace?.source ?? 'ingress'}` as const)
          },
          {
            key: 'replayMode',
            label: t('repos.webhookDeliveries.detailReplayMode'),
            children: event.replayMode ? t(`repos.webhookDeliveries.replay.mode.${event.replayMode}` as const) : '-'
          },
          {
            key: 'message',
            label: t('repos.webhookDeliveries.detailMessage'),
            children: [event.code, event.message].filter(Boolean).join(' · ') || '-'
          },
          {
            key: 'diagnosis',
            label: t('repos.webhookDeliveries.detailMappedType'),
            children: event.mappedEventType || '-'
          }
        ]}
      />

      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Typography.Text strong>{t('repos.webhookDeliveries.detailRules')}：</Typography.Text>{' '}
        {event.matchedRuleIds.length ? (
          <Space wrap>
            {event.matchedRuleIds.map((id) => (
              <Tag key={id}>
                <Typography.Text code>{id}</Typography.Text>
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )}
      </Typography.Paragraph>

      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Typography.Text strong>{t('repos.webhookDeliveries.detailRobots')}：</Typography.Text>{' '}
        {event.matchedRobotIds.length ? (
          <Space wrap>
            {event.matchedRobotIds.map((id) => (
              <Tag key={id}>
                <Typography.Text code>{id}</Typography.Text>
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )}
      </Typography.Paragraph>

      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Typography.Text strong>{t('repos.webhookDeliveries.detailTasks')}：</Typography.Text>{' '}
        {event.taskIds.length ? (
          <Space wrap>
            {event.taskIds.map((id) => (
              <Button
                key={id}
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => navigateHash(buildTaskHash(id))}
              >
                {id}
              </Button>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )}
      </Typography.Paragraph>

      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Typography.Text strong>{t('repos.webhookDeliveries.detailTaskGroups')}：</Typography.Text>{' '}
        {event.taskGroupIds.length ? (
          <Space wrap>
            {event.taskGroupIds.map((id) => (
              <Button
                key={id}
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => navigateHash(buildTaskGroupHash(id))}
              >
                {id}
              </Button>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )}
      </Typography.Paragraph>

      {event.replayOfEventId ? (
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          <Typography.Text strong>{t('repos.webhookDeliveries.replay.sourceEvent')}：</Typography.Text>{' '}
          {onOpenEvent ? (
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenEvent(event.replayOfEventId!)}>
              {event.replayOfEventId}
            </Button>
          ) : (
            <Typography.Text code>{event.replayOfEventId}</Typography.Text>
          )}
        </Typography.Paragraph>
      ) : null}

      {event.replays?.length ? (
        <div>
          <Typography.Text strong>{t('repos.webhookDeliveries.detailReplays')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {event.replays.map((replay) => (
                <div
                  key={replay.id}
                  style={{ border: '1px solid rgba(5,5,5,0.06)', borderRadius: 8, padding: 12 }}
                >
                  <Space wrap>
                    {onOpenEvent ? (
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenEvent(replay.id)}>
                        {replay.id}
                      </Button>
                    ) : (
                      <Typography.Text code>{replay.id}</Typography.Text>
                    )}
                    {renderWebhookResultTag(t, replay.result)}
                    {replay.replayMode ? (
                      <Tag color="blue">{t(`repos.webhookDeliveries.replay.mode.${replay.replayMode}` as const)}</Tag>
                    ) : null}
                    <Typography.Text type="secondary">{formatIso(replay.createdAt)}</Typography.Text>
                  </Space>
                </div>
              ))}
            </Space>
          </div>
        </div>
      ) : null}

      {canReplay && onReplay ? (
        <div style={{ border: '1px solid rgba(5,5,5,0.06)', borderRadius: 8, padding: 16 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{t('repos.webhookDeliveries.replay.title')}</Typography.Text>
            <Space wrap style={{ width: '100%' }}>
              <Select<WebhookReplayMode>
                value={mode}
                style={{ minWidth: 220 }}
                onChange={(value) => setMode(value)}
                options={[
                  { value: 'stored_actions', label: t('repos.webhookDeliveries.replay.mode.stored_actions') },
                  { value: 'current_config', label: t('repos.webhookDeliveries.replay.mode.current_config') },
                  { value: 'override_robot', label: t('repos.webhookDeliveries.replay.mode.override_robot') },
                  { value: 'override_rule', label: t('repos.webhookDeliveries.replay.mode.override_rule') }
                ]}
              />
              {mode === 'override_robot' ? (
                <Input
                  value={robotId}
                  onChange={(event) => setRobotId(event.target.value)}
                  placeholder={t('repos.webhookDeliveries.replay.robotId')}
                  style={{ minWidth: 220 }}
                />
              ) : null}
              {mode === 'override_rule' ? (
                <Input
                  value={ruleId}
                  onChange={(event) => setRuleId(event.target.value)}
                  placeholder={t('repos.webhookDeliveries.replay.ruleId')}
                  style={{ minWidth: 220 }}
                />
              ) : null}
            </Space>
            <Space wrap>
              <Button
                type="primary"
                loading={replayLoading}
                onClick={() => void onReplay(replayInput, { dryRun: false })}
              >
                {t('repos.webhookDeliveries.replay.execute')}
              </Button>
              <Button
                loading={dryRunLoading}
                onClick={() => void onReplay(replayInput, { dryRun: true })}
              >
                {t('repos.webhookDeliveries.replay.executeDryRun')}
              </Button>
            </Space>
          </Space>
        </div>
      ) : null}

      <div>
        <Typography.Text strong>{t('repos.webhookDeliveries.detailTimeline')}</Typography.Text>
        <div style={{ marginTop: 12 }}>
          {event.debugTrace?.steps?.length ? (
            <Timeline
              items={event.debugTrace.steps.map((step, index) => ({
                key: `${step.key}-${index}`,
                color: traceStatusColor(step.status),
                content: (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space wrap>
                      <Typography.Text strong>{step.title}</Typography.Text>
                      <Tag color={traceStatusColor(step.status)}>
                        {t(`repos.webhookDeliveries.trace.status.${step.status}` as const)}
                      </Tag>
                      <Typography.Text type="secondary">{formatIso(step.at)}</Typography.Text>
                    </Space>
                    {step.code ? <Typography.Text code>{step.code}</Typography.Text> : null}
                    {step.message ? <Typography.Text>{step.message}</Typography.Text> : null}
                    {step.meta !== undefined ? renderJsonBlock(step.meta) : null}
                  </Space>
                )
              }))}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('repos.webhookDeliveries.detailTimelineEmpty')}
            />
          )}
        </div>
      </div>

      <Collapse
        items={detailPanels}
        defaultActiveKey={['payload', 'response']}
      />
    </Space>
  );
};
