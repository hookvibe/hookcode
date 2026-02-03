// Split trigger rule action editor into its own component to reduce modal size. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { useMemo } from 'react';
import { Alert, Badge, Divider, Select, Space, Switch, Tabs, Typography } from 'antd';
import type { AutomationEventKey, RepoRobot } from '../../../api';
import type { TFunction } from '../../../i18n';
import { TemplateEditor } from '../../TemplateEditor';
import type { TemplateVariableGroup } from '../../templateEditorVariables';
import { getRobotProviderLabel } from '../../../utils/robot';
import { uuid } from '../utils';

export type TriggerRuleActionState = { id: string; promptPatch?: string; promptOverride?: string; enabled: boolean };

export type TriggerRuleActionsSectionProps = {
  t: TFunction;
  eventKey: AutomationEventKey;
  readOnly: boolean;
  robots: RepoRobot[];
  robotIds: string[];
  robotIdsTouched: boolean;
  setRobotIdsTouched: (next: boolean) => void;
  setRobotIds: (next: string[]) => void;
  activeRobotId: string;
  setActiveRobotId: (next: string) => void;
  actionsByRobot: Record<string, TriggerRuleActionState>;
  updateAction: (robotId: string, next: Partial<TriggerRuleActionState>) => void;
  templateVariables: TemplateVariableGroup[];
};

export const TriggerRuleActionsSection = ({
  t,
  eventKey,
  readOnly,
  robots,
  robotIds,
  robotIdsTouched,
  setRobotIdsTouched,
  setRobotIds,
  activeRobotId,
  setActiveRobotId,
  actionsByRobot,
  updateAction,
  templateVariables
}: TriggerRuleActionsSectionProps) => {
  const getRobotStatus = (r: RepoRobot): { text: string; color: string; short?: string } => {
    if (r.enabled) return { text: t('common.enabled'), color: 'green' };
    if (r.activatedAt) return { text: t('common.disabled'), color: 'red', short: t('common.disabled') };
    return { text: t('repos.robots.status.pending'), color: 'gold', short: t('repos.robots.status.pending') };
  };

  const getRobotPermissionColor = (r: RepoRobot): string => (r.permission === 'write' ? 'volcano' : 'blue');

  const robotOptions = useMemo(
    () =>
      robots.map((r) => ({
        value: r.id,
        label: r.name,
        robot: r
      })),
    [robots]
  );

  const selectedRobots = useMemo(() => robots.filter((r) => robotIds.includes(r.id)), [robotIds, robots]);

  return (
    <>
      <Divider plain style={{ marginTop: 6, marginBottom: 6 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('repoAutomation.rule.section.actions')}
        </Typography.Text>
      </Divider>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Typography.Text>{t('repoAutomation.rule.actions.robots')}</Typography.Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 6 }}
            disabled={readOnly}
            value={robotIds}
            onChange={(v) => {
              setRobotIdsTouched(true);
              setRobotIds(Array.isArray(v) ? (v as any) : []);
            }}
            options={robotOptions.map((o) => {
              const r = o.robot;
              const status = getRobotStatus(r);
              // Surface bound AI provider alongside robot badges in automation selectors. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
              const providerLabel = getRobotProviderLabel(r.modelProvider);
              return {
                value: o.value,
                label: (
                  <Space size={8} wrap>
                    <Badge color={status.color} text={status.short ?? status.text} />
                    <Badge color={getRobotPermissionColor(r)} text={r.permission} />
                    <span>{o.label}</span>
                    {providerLabel ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {providerLabel}
                      </Typography.Text>
                    ) : null}
                  </Space>
                )
              } as any;
            })}
            placeholder={t('repoAutomation.rule.actions.robotsPlaceholder')}
            status={robotIdsTouched && !robotIds.length ? 'error' : undefined}
          />
          {robotIdsTouched && !robotIds.length ? (
            <Typography.Text type="danger" style={{ display: 'block', marginTop: 6 }}>
              {t('repoAutomation.rule.actions.robotsRequired')}
            </Typography.Text>
          ) : null}
        </div>

        {robotIds.length ? (
          <Tabs
            activeKey={activeRobotId}
            onChange={(key) => setActiveRobotId(key)}
            items={selectedRobots.map((r) => {
              const action = actionsByRobot[r.id] ?? { id: uuid(), enabled: true };
              const status = getRobotStatus(r);
              return {
                key: r.id,
                label: (
                  <Space size={8} wrap>
                    <Badge color={status.color} text={status.short ?? status.text} />
                    <span>{r.name}</span>
                    {/* Show bound AI provider in action tabs for quick identification. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128 */}
                    {(() => {
                      const providerLabel = getRobotProviderLabel(r.modelProvider);
                      return providerLabel ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {providerLabel}
                        </Typography.Text>
                      ) : null;
                    })()}
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space size={10} wrap>
                      <Typography.Text>{t('repoAutomation.rule.actions.robotEnabled')}</Typography.Text>
                      <Switch checked={action.enabled} disabled={readOnly} onChange={(v) => updateAction(r.id, { enabled: v })} />
                    </Space>

                    <div>
                      <Typography.Text>{t('repoAutomation.rule.actions.promptPatch')}</Typography.Text>
                      <TemplateEditor
                        value={action.promptPatch}
                        onChange={(next) => updateAction(r.id, { promptPatch: next })}
                        rows={6}
                        variables={templateVariables}
                        placeholder={t('repoAutomation.rule.actions.promptPatchPlaceholder')}
                      />
                    </div>

                    <div>
                      <Typography.Text>{t('repoAutomation.rule.actions.promptOverride')}</Typography.Text>
                      <TemplateEditor
                        value={action.promptOverride}
                        onChange={(next) => updateAction(r.id, { promptOverride: next })}
                        rows={6}
                        variables={templateVariables}
                        placeholder={t('repoAutomation.rule.actions.promptOverridePlaceholder')}
                      />
                    </div>
                  </Space>
                )
              };
            })}
          />
        ) : null}

        {robots.length === 0 ? <Alert type="warning" showIcon message={t('repoAutomation.noRobots')} /> : null}

        {!readOnly && robots.some((r) => !r.enabled) ? <Alert type="warning" showIcon message={t('repoAutomation.disabledRobotWarning')} /> : null}

        {!readOnly && eventKey === 'issue' && robots.some((r) => r.permission !== 'write') ? (
          <Alert type="info" showIcon message={t('repoAutomation.writePermissionHint')} />
        ) : null}
      </Space>
    </>
  );
};
