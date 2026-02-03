import { FC, useEffect, useMemo, useState } from 'react';
import { Alert, Input, Space, Switch, Typography } from 'antd';
import type { AutomationClause, AutomationEventKey, AutomationRule, RepoRobot, Repository, TimeWindow } from '../../api';
import { useT } from '../../i18n';
import { getTemplateVariableGroups } from '../templateEditorVariables';
import { ResponsiveDialog } from '../dialogs/ResponsiveDialog';
import { extractInValues, findClause, normalizeMentionHandle, toLowerTrim, uuid } from './utils';
import { TriggerRuleActionsSection, type TriggerRuleActionState } from './triggerRuleModal/TriggerRuleActionsSection';
import { TriggerRuleMatchSection } from './triggerRuleModal/TriggerRuleMatchSection';
import { TriggerRuleScheduleSection } from './triggerRuleModal/TriggerRuleScheduleSection';

/**
 * TriggerRuleModal:
 * - Business context: edit a single automation rule (match clauses + robot actions).
 * - Module: Repo automation editor (RepoDetail -> Automation tab).
 *
 * Notes:
 * - This UI intentionally keeps the rule model "opinionated" to avoid exposing raw JSON editing.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to `frontend-chat`.
 */

interface Props {
  open: boolean;
  eventKey: AutomationEventKey;
  robots: RepoRobot[];
  repo?: Repository;
  value?: AutomationRule | null;
  readOnly?: boolean;
  onCancel: () => void;
  onOk: (rule: AutomationRule) => void;
}

export const TriggerRuleModal: FC<Props> = ({ open, eventKey, robots, repo, value, readOnly = false, onCancel, onOk }) => {
  const t = useT();

  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [subTypes, setSubTypes] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [includeKeywords, setIncludeKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [mentionRobotIds, setMentionRobotIds] = useState<string[]>([]);
  const [mentionLegacyHandles, setMentionLegacyHandles] = useState<string[]>([]);
  // Track trigger-level time windows for scheduled execution. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null);

  const [robotIds, setRobotIds] = useState<string[]>([]);
  const [robotIdsTouched, setRobotIdsTouched] = useState(false);
  const [activeRobotId, setActiveRobotId] = useState<string>('');
  const [actionsByRobot, setActionsByRobot] = useState<Record<string, TriggerRuleActionState>>({});

  useEffect(() => {
    if (!open) return;
    setNameTouched(false);
    setRobotIdsTouched(false);
    setEnabled(value?.enabled ?? true);
    setName(value?.name ?? '');

    const sub = value ? findClause(value, (c) => c.field === 'event.subType') : undefined;
    setSubTypes(value ? extractInValues(sub) : []);

    const br = value ? findClause(value, (c) => c.field === 'branch.name') : undefined;
    const foundBranches = value ? extractInValues(br) : [];
    setBranches(foundBranches);

    const include = value ? findClause(value, (c) => c.field === 'text.all' && c.op === 'textContainsAny' && !c.negate) : undefined;
    setIncludeKeywords(value ? extractInValues(include) : []);

    const exclude = value ? findClause(value, (c) => c.field === 'text.all' && c.op === 'textContainsAny' && Boolean(c.negate)) : undefined;
    setExcludeKeywords(value ? extractInValues(exclude) : []);

    const assigneeClause = value ? findClause(value, (c) => c.field === 'issue.assignees' && c.op === 'containsAny') : undefined;
    setAssignees(value ? extractInValues(assigneeClause) : []);

    const mentionRobotClause = value ? findClause(value, (c) => c.field === 'comment.mentionRobotIds' && c.op === 'containsAny' && !c.negate) : undefined;
    const mentionLegacyClause = value ? findClause(value, (c) => c.field === 'comment.mentions' && c.op === 'containsAny' && !c.negate) : undefined;

    const mentionRobotIdsFromClause = value ? extractInValues(mentionRobotClause) : [];
    const legacyHandles = value ? extractInValues(mentionLegacyClause) : [];

    const handleToRobotIds = new Map<string, string[]>();
    for (const r of robots) {
      const handles = [r.name, r.repoTokenUsername, r.repoTokenUserName].map(normalizeMentionHandle).filter(Boolean);
      for (const h of handles) {
        const list = handleToRobotIds.get(h) ?? [];
        if (!list.includes(r.id)) list.push(r.id);
        handleToRobotIds.set(h, list);
      }
    }

    const resolvedRobotIds: string[] = [];
    const unresolved: string[] = [];
    for (const v of legacyHandles) {
      const h = normalizeMentionHandle(v);
      if (!h) continue;
      const ids = handleToRobotIds.get(h) ?? [];
      if (!ids.length) {
        unresolved.push(v);
        continue;
      }
      resolvedRobotIds.push(...ids);
    }

    const uniqMentionRobotIds = [...new Set([...mentionRobotIdsFromClause, ...resolvedRobotIds])];
    setMentionRobotIds(uniqMentionRobotIds);
    setMentionLegacyHandles(unresolved.length ? unresolved : []);

    const ids = (value?.actions ?? []).map((a) => a.robotId);
    setRobotIds(ids);

    // Sync trigger-level scheduling window from the rule. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    setTimeWindow(value?.timeWindow ?? null);

    const map: Record<string, { id: string; promptPatch?: string; promptOverride?: string; enabled: boolean }> = {};
    for (const a of value?.actions ?? []) {
      map[a.robotId] = {
        id: a.id ?? uuid(),
        enabled: a.enabled ?? true,
        promptPatch: a.promptPatch,
        promptOverride: a.promptOverride
      };
    }
    setActionsByRobot(map);
  }, [open, robots, value]);

  useEffect(() => {
    if (!open) return;
    if (!robotIds.length) {
      setActiveRobotId('');
      return;
    }
    setActiveRobotId((prev) => (prev && robotIds.includes(prev) ? prev : robotIds[0]));
  }, [open, robotIds]);

  const subTypeOptions = useMemo(() => {
    const all = eventKey === 'merge_request' ? (['created', 'updated', 'commented'] as const) : (['created', 'commented'] as const);
    return all.map((v) => ({ value: v, label: t(`repoAutomation.subType.${v}` as any) }));
  }, [eventKey, t]);

  const branchOptions = useMemo(() => {
    const list = (repo?.branches ?? []).filter((b) => (b.name ?? '').trim());
    const sorted = [...list].sort((a, b) => {
      if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    return sorted.map((b) => ({ value: b.name, label: b.note ? `${b.name}（${b.note}）` : b.name }));
  }, [repo?.branches]);

  const templateVariables = useMemo(() => getTemplateVariableGroups(eventKey), [eventKey]);

  const mentionRobotOptions = useMemo(() => {
    const labelForRobot = (r: RepoRobot): string => {
      const rawName = String(r.name ?? '').trim();
      const rawUsername = String(r.repoTokenUsername ?? '').trim();

      const nameMention = rawName ? (rawName.startsWith('@') ? rawName : `@${rawName}`) : '';
      const usernameMention = rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : '';

      if (usernameMention && nameMention && normalizeMentionHandle(usernameMention) !== normalizeMentionHandle(nameMention)) {
        return `${usernameMention} (${nameMention})`;
      }
      return usernameMention || nameMention || `@${r.id}`;
    };

    const base = robots
      .map((r) => ({ value: r.id, label: labelForRobot(r) }))
      .filter((o) => String(o.label ?? '').trim());

    const known = new Set(base.map((o) => o.value));
    for (const id of mentionRobotIds) {
      if (!id || known.has(id)) continue;
      known.add(id);
      base.push({ value: id, label: `@${id}` });
    }
    return base;
  }, [mentionRobotIds, robots]);

  const updateAction = (robotId: string, patch: Partial<{ promptPatch?: string; promptOverride?: string; enabled: boolean }>) => {
    if (readOnly) return;
    setActionsByRobot((prev) => ({
      ...prev,
      [robotId]: {
        id: prev[robotId]?.id ?? uuid(),
        enabled: prev[robotId]?.enabled ?? true,
        ...prev[robotId],
        ...patch
      }
    }));
  };

  const buildRule = (): AutomationRule => {
    const clauses: AutomationClause[] = [];

    const normalizedSubTypes = subTypes.map((v) => v.trim()).filter(Boolean);
    if (normalizedSubTypes.length) {
      clauses.push({ field: 'event.subType', op: 'in', values: normalizedSubTypes });
    }

    const normalizedBranches = branches.map((v) => v.trim()).filter(Boolean);
    // Hide branch filters for Issue rules because Issue webhooks have no branch/ref context. b7x1k3m9p2r5t8n0q6s4
    if (normalizedBranches.length && eventKey !== 'issue') {
      clauses.push({ field: 'branch.name', op: 'matchesAny', values: normalizedBranches });
    }

    const normalizedIncludeKeywords = includeKeywords.map((v) => v.trim()).filter(Boolean);
    if (normalizedIncludeKeywords.length) {
      clauses.push({ field: 'text.all', op: 'textContainsAny', values: normalizedIncludeKeywords });
    }

    const normalizedExcludeKeywords = excludeKeywords.map((v) => v.trim()).filter(Boolean);
    if (normalizedExcludeKeywords.length) {
      clauses.push({ field: 'text.all', op: 'textContainsAny', values: normalizedExcludeKeywords, negate: true });
    }

    const normalizedAssignees = assignees.map((v) => toLowerTrim(v)).filter(Boolean);
    if (normalizedAssignees.length) {
      clauses.push({ field: 'issue.assignees', op: 'containsAny', values: normalizedAssignees });
    }

    const normalizedMentionRobotIds = mentionRobotIds.map((v) => v.trim()).filter(Boolean);
    if (normalizedMentionRobotIds.length) {
      clauses.push({ field: 'comment.mentionRobotIds', op: 'containsAny', values: normalizedMentionRobotIds });
    }

    const normalizedLegacyMentions = mentionLegacyHandles.map((v) => v.trim()).filter(Boolean);
    if (normalizedLegacyMentions.length) {
      clauses.push({ field: 'comment.mentions', op: 'containsAny', values: normalizedLegacyMentions });
    }

    const normalizedRobotIds = robotIds.map((v) => v.trim()).filter(Boolean);
    const actions = normalizedRobotIds.map((rid) => ({
      id: actionsByRobot[rid]?.id ?? uuid(),
      robotId: rid,
      enabled: actionsByRobot[rid]?.enabled ?? true,
      promptPatch: actionsByRobot[rid]?.promptPatch?.trim() ? actionsByRobot[rid]?.promptPatch?.trim() : undefined,
      promptOverride: actionsByRobot[rid]?.promptOverride?.trim() ? actionsByRobot[rid]?.promptOverride?.trim() : undefined
    }));

    return {
      id: value?.id ?? uuid(),
      enabled: Boolean(enabled),
      name: name.trim() || t('repoAutomation.rule.untitled'),
      match: clauses.length ? { all: clauses } : undefined,
      actions,
      // Persist trigger-level time window settings in the rule payload. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      timeWindow: timeWindow ?? undefined
    };
  };

  const canSubmit = Boolean(!readOnly);

  const title = value
    ? t('repoAutomation.ruleModal.titleEdit', { name: value?.name || t('repoAutomation.rule.untitled') })
    : t('repoAutomation.ruleModal.titleCreate');

  return (
    <ResponsiveDialog
      variant="large"
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={
        canSubmit
          ? () => {
              setNameTouched(true);
              setRobotIdsTouched(true);
              const next = buildRule();
              if (!next.name.trim()) return;
              if (!next.actions.length) return;
              onOk(next);
            }
          : undefined
      }
      okText={t('common.save')}
      cancelText={readOnly ? t('common.close') : t('common.cancel')}
      drawerWidth="min(980px, 92vw)"
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {readOnly ? <Alert type="info" showIcon message={t('repoAutomation.readOnly')} /> : null}

        <Space wrap size={16} style={{ width: '100%' }}>
          <Space size={8}>
            <Typography.Text>{t('repoAutomation.rule.enabled')}</Typography.Text>
            <Switch checked={enabled} disabled={readOnly} onChange={(v) => setEnabled(v)} />
          </Space>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Typography.Text>{t('repoAutomation.rule.name')}</Typography.Text>
            <Input
              value={name}
              disabled={readOnly}
              status={nameTouched && !name.trim() ? 'error' : undefined}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('repoAutomation.rule.namePlaceholder')}
              style={{ marginTop: 6 }}
            />
          </div>
        </Space>

        {/* Split rule sections into focused components to reduce the modal size. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203 */}
        <TriggerRuleMatchSection
          t={t}
          eventKey={eventKey}
          readOnly={readOnly}
          subTypes={subTypes}
          setSubTypes={setSubTypes}
          branches={branches}
          setBranches={setBranches}
          includeKeywords={includeKeywords}
          setIncludeKeywords={setIncludeKeywords}
          excludeKeywords={excludeKeywords}
          setExcludeKeywords={setExcludeKeywords}
          assignees={assignees}
          setAssignees={setAssignees}
          mentionRobotIds={mentionRobotIds}
          setMentionRobotIds={setMentionRobotIds}
          mentionLegacyHandles={mentionLegacyHandles}
          subTypeOptions={subTypeOptions}
          branchOptions={branchOptions}
          mentionRobotOptions={mentionRobotOptions}
        />

        <TriggerRuleScheduleSection t={t} readOnly={readOnly} timeWindow={timeWindow} setTimeWindow={setTimeWindow} />

        <TriggerRuleActionsSection
          t={t}
          eventKey={eventKey}
          readOnly={readOnly}
          robots={robots}
          robotIds={robotIds}
          robotIdsTouched={robotIdsTouched}
          setRobotIdsTouched={setRobotIdsTouched}
          setRobotIds={setRobotIds}
          activeRobotId={activeRobotId}
          setActiveRobotId={setActiveRobotId}
          actionsByRobot={actionsByRobot}
          updateAction={updateAction}
          templateVariables={templateVariables}
        />
      </Space>
    </ResponsiveDialog>
  );
};
