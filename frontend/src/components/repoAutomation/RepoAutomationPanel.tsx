import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Switch, Tabs, Tag, Typography, message } from 'antd';
import type { AutomationClause, AutomationEventKey, AutomationRule, RepoAutomationConfig, RepoAutomationConfigV2, RepoRobot, Repository } from '../../api';
import { useT } from '../../i18n';
import { ScrollableTable } from '../ScrollableTable';
import { TriggerRuleModal } from './TriggerRuleModal';
import { findClause, getEventConfig, normalizeAutomationConfig, removeRule, setEventConfig, upsertRule } from './utils';

/**
 * RepoAutomationPanel:
 * - Business context: configure repository automation (webhook triggers -> robot actions).
 * - Module: RepoDetail -> Automation tab.
 *
 * Key behaviors:
 * - Normalize v1 config into v2 shape for editing.
 * - Auto-save with debounce-like coalescing (pendingRef) to avoid spamming backend.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to `frontend-chat`.
 */

interface Props {
  repo?: Repository;
  robots: RepoRobot[];
  value: RepoAutomationConfig;
  onChange: (next: RepoAutomationConfig) => void;
  onSave: (next: RepoAutomationConfig) => Promise<void>;
  readOnly?: boolean;
}

const renderClauseValues = (values: string[] | undefined) => (values ?? []).filter(Boolean);

const findValues = (rule: AutomationRule, pred: (c: AutomationClause) => boolean): string[] => {
  const c = findClause(rule, pred);
  if (!c) return [];
  if (Array.isArray(c.values)) return renderClauseValues(c.values);
  if (typeof c.value === 'string' && c.value.trim()) return [c.value.trim()];
  return [];
};

export const RepoAutomationPanel: FC<Props> = ({ repo, robots, value, onChange, onSave, readOnly = false }) => {
  const t = useT();
  const [messageApi, messageContextHolder] = message.useMessage();
  const config = useMemo(() => normalizeAutomationConfig(value), [value]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const pendingRef = useRef<{ config: RepoAutomationConfigV2; serialized: string } | null>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const lastRepoIdRef = useRef<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalEventKey, setModalEventKey] = useState<AutomationEventKey>('issue');
  const [modalValue, setModalValue] = useState<AutomationRule | null>(null);

  const robotsById = useMemo(() => new Map(robots.map((r) => [r.id, r])), [robots]);
  const branchNoteByName = useMemo(
    () => new Map((repo?.branches ?? []).filter((b) => (b.name ?? '').trim()).map((b) => [b.name.trim(), (b.note ?? '').trim()])),
    [repo?.branches]
  );

  const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // On repo switch / first load: treat current value as the "saved baseline" to avoid triggering auto-save on initial render.
    const repoId = repo?.id;
    if (repoId !== lastRepoIdRef.current) {
      lastRepoIdRef.current = repoId;
      lastSavedSerializedRef.current = serializedConfig;
      pendingRef.current = null;
      setAutoSaveStatus('idle');
    }
  }, [repo?.id, serializedConfig]);

  const runSave = useCallback(
    async (nextConfig: RepoAutomationConfigV2, serialized: string) => {
      if (readOnly) return;
      if (serialized === lastSavedSerializedRef.current && !savingRef.current) {
        if (mountedRef.current) setAutoSaveStatus('saved');
        return;
      }
      if (savingRef.current) {
        pendingRef.current = { config: nextConfig, serialized };
        return;
      }

      savingRef.current = true;
      if (mountedRef.current) setAutoSaveStatus('saving');
      try {
        await onSave(nextConfig);
        lastSavedSerializedRef.current = serialized;
        if (mountedRef.current) setAutoSaveStatus('saved');
      } catch (err: any) {
        console.error(err);
        if (mountedRef.current) {
          setAutoSaveStatus('failed');
          messageApi.error(err?.response?.data?.error || t('repoAutomation.saveFailed'));
        }
      } finally {
        savingRef.current = false;
        const pending = pendingRef.current;
        if (pending && pending.serialized !== lastSavedSerializedRef.current) {
          pendingRef.current = null;
          void runSave(pending.config, pending.serialized);
          return;
        }
        pendingRef.current = null;
      }
    },
    [messageApi, onSave, readOnly, t]
  );

  const retrySaveNow = useCallback(() => {
    pendingRef.current = null;
    void runSave(config, serializedConfig);
  }, [config, runSave, serializedConfig]);

  const openAddRule = useCallback(
    (eventKey: AutomationEventKey) => {
      if (readOnly) return;
      setModalEventKey(eventKey);
      setModalValue(null);
      setModalOpen(true);
    },
    [readOnly]
  );

  const openEditRule = useCallback((eventKey: AutomationEventKey, rule: AutomationRule) => {
    setModalEventKey(eventKey);
    setModalValue(rule);
    setModalOpen(true);
  }, []);

  const saveRule = useCallback(
    (rule: AutomationRule) => {
      if (readOnly) return;
      const event = getEventConfig(config, modalEventKey);
      const next = setEventConfig(config, modalEventKey, { ...event, rules: upsertRule(event.rules ?? [], rule) });
      onChange(next);
      void runSave(next, JSON.stringify(next));
      setModalOpen(false);
    },
    [config, modalEventKey, onChange, readOnly, runSave]
  );

  const deleteRule = useCallback(
    (eventKey: AutomationEventKey, ruleId: string) => {
      if (readOnly) return;
      const event = getEventConfig(config, eventKey);
      const next = setEventConfig(config, eventKey, { ...event, rules: removeRule(event.rules ?? [], ruleId) });
      onChange(next);
      void runSave(next, JSON.stringify(next));
    },
    [config, onChange, readOnly, runSave]
  );

  const setEventEnabled = useCallback(
    (eventKey: AutomationEventKey, enabled: boolean) => {
      if (readOnly) return;
      const event = getEventConfig(config, eventKey);
      const next = setEventConfig(config, eventKey, { ...event, enabled });
      onChange(next);
      void runSave(next, JSON.stringify(next));
    },
    [config, onChange, readOnly, runSave]
  );

  const summarizeRule = (rule: AutomationRule) => {
    const subTypes = findValues(rule, (c) => c.field === 'event.subType');
    const branchNames = findValues(rule, (c) => c.field === 'branch.name');
    const include = findValues(rule, (c) => c.field === 'text.all' && c.op === 'textContainsAny' && !c.negate);
    const exclude = findValues(rule, (c) => c.field === 'text.all' && c.op === 'textContainsAny' && Boolean(c.negate));
    const assignees = findValues(rule, (c) => c.field === 'issue.assignees' && c.op === 'containsAny');
    const mentionRobotIds = findValues(rule, (c) => c.field === 'comment.mentionRobotIds' && c.op === 'containsAny' && !c.negate);
    const mentionLegacy = findValues(rule, (c) => c.field === 'comment.mentions' && c.op === 'containsAny' && !c.negate);

    const mentionLabelForRobotId = (id: string): string => {
      const r = robotsById.get(id);
      if (!r) return `@${id}`;
      const rawName = String(r.name ?? '').trim();
      const rawUsername = String(r.repoTokenUsername ?? '').trim();
      const nameMention = rawName ? (rawName.startsWith('@') ? rawName : `@${rawName}`) : '';
      const usernameMention = rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : '';
      if (usernameMention && nameMention && usernameMention.toLowerCase() !== nameMention.toLowerCase()) {
        return `${usernameMention} (${nameMention})`;
      }
      return usernameMention || nameMention || `@${id}`;
    };

    return (
      <Space wrap size={6}>
        {subTypes.map((v) => (
          <Tag key={`st:${v}`}>{t(`repoAutomation.subType.${v}` as any)}</Tag>
        ))}
        {branchNames.map((v) => {
          const note = branchNoteByName.get(v) ?? '';
          const label = note ? `${v}（${note}）` : v;
          return (
            <Tag key={`br:${v}`} color="geekblue">
              {label}
            </Tag>
          );
        })}
        {include.map((v) => (
          <Tag key={`in:${v}`} color="green">
            {t('repoAutomation.ruleSummary.include', { keyword: v })}
          </Tag>
        ))}
        {exclude.map((v) => (
          <Tag key={`ex:${v}`} color="red">
            {t('repoAutomation.ruleSummary.exclude', { keyword: v })}
          </Tag>
        ))}
        {assignees.map((v) => (
          <Tag key={`a:${v}`} color="orange">
            {t('repoAutomation.ruleSummary.assignee', { keyword: v })}
          </Tag>
        ))}
        {mentionRobotIds.map((id) => (
          <Tag key={`mr:${id}`} color="purple">
            {t('repoAutomation.ruleSummary.mention', { keyword: mentionLabelForRobotId(id) })}
          </Tag>
        ))}
        {mentionLegacy.map((v) => (
          <Tag key={`m:${v}`} color="purple">
            {t('repoAutomation.ruleSummary.mention', { keyword: v })}
          </Tag>
        ))}
        {!rule.match && <Typography.Text type="secondary">{t('repoAutomation.ruleSummary.noCondition')}</Typography.Text>}
      </Space>
    );
  };

  const ruleTable = (eventKey: AutomationEventKey) => {
    const event = getEventConfig(config, eventKey);
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap size={16} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={16}>
            <Space>
              <Typography.Text>{t('repoAutomation.event.enable')}</Typography.Text>
              <Switch checked={event.enabled} disabled={readOnly} onChange={(v) => setEventEnabled(eventKey, v)} />
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t(`repoAutomation.event.tip.${eventKey}` as any)}
            </Typography.Text>
          </Space>
          <Button type="primary" disabled={readOnly} onClick={() => openAddRule(eventKey)}>
            {t('repoAutomation.addRule')}
          </Button>
        </Space>

        <ScrollableTable<AutomationRule>
          // Paginate automation rules so the board layout stays dense even when a repo has many triggers. u55e45ffi8jng44erdzp
          size="small"
          rowKey="id"
          dataSource={event.rules ?? []}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ['8', '16', '32'], hideOnSinglePage: true }}
          columns={[
            {
              title: t('common.rule'),
              dataIndex: 'name',
              render: (_: any, r: AutomationRule) => (
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Typography.Text strong className="table-cell-ellipsis" title={r.name}>
                    {r.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {summarizeRule(r)}
                  </Typography.Text>
                </Space>
              )
            },
            {
              title: t('common.status'),
              dataIndex: 'enabled',
              width: 120,
              render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('common.enabled') : t('common.disabled')}</Tag>
            },
            {
              title: t('common.actions'),
              key: 'actions',
              width: 170,
              render: (_: any, r: AutomationRule) => (
                <Space size={8} wrap>
                  <Button size="small" onClick={() => openEditRule(eventKey, r)}>
                    {t('common.edit')}
                  </Button>
                  <Button size="small" danger disabled={readOnly} onClick={() => deleteRule(eventKey, r.id)}>
                    {t('common.delete')}
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Space>
    );
  };

  const statusText =
    autoSaveStatus === 'saving'
      ? t('repoAutomation.autoSave.saving')
      : autoSaveStatus === 'saved'
        ? t('repoAutomation.autoSave.saved')
        : autoSaveStatus === 'failed'
          ? t('repoAutomation.autoSave.failed')
          : t('repoAutomation.autoSave.idle');

  const statusColor =
    autoSaveStatus === 'saving'
      ? 'gold'
      : autoSaveStatus === 'saved'
        ? 'green'
        : autoSaveStatus === 'failed'
          ? 'red'
          : 'default';

  return (
    <>
      {messageContextHolder}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap size={10} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">{t('repoAutomation.tip')}</Typography.Text>
          <Space size={10} wrap>
            {autoSaveStatus === 'failed' ? (
              <Button size="small" onClick={retrySaveNow} disabled={readOnly}>
                {t('repoAutomation.autoSave.retry')}
              </Button>
            ) : null}
            <Tag color={statusColor}>{statusText}</Tag>
          </Space>
        </Space>

        <Tabs
          items={[
            { key: 'issue', label: t('repoAutomation.tab.issue'), children: ruleTable('issue') },
            { key: 'merge_request', label: t('repoAutomation.tab.merge_request'), children: ruleTable('merge_request') },
            { key: 'commit', label: t('repoAutomation.tab.commit'), children: ruleTable('commit') }
          ]}
        />

        <TriggerRuleModal
          open={modalOpen}
          eventKey={modalEventKey}
          robots={robots}
          repo={repo}
          value={modalValue}
          readOnly={readOnly}
          onCancel={() => setModalOpen(false)}
          onOk={saveRule}
        />
      </Space>
    </>
  );
};
