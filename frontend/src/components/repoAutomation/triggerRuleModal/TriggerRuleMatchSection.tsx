// Split the trigger rule match fields into a focused subcomponent. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Divider, Select, Space, Typography } from 'antd';
import type { AutomationEventKey } from '../../../api';
import type { TFunction } from '../../../i18n';

export type TriggerRuleMatchSectionProps = {
  t: TFunction;
  eventKey: AutomationEventKey;
  readOnly: boolean;
  subTypes: string[];
  setSubTypes: (next: string[]) => void;
  branches: string[];
  setBranches: (next: string[]) => void;
  includeKeywords: string[];
  setIncludeKeywords: (next: string[]) => void;
  excludeKeywords: string[];
  setExcludeKeywords: (next: string[]) => void;
  assignees: string[];
  setAssignees: (next: string[]) => void;
  mentionRobotIds: string[];
  setMentionRobotIds: (next: string[]) => void;
  mentionLegacyHandles: string[];
  subTypeOptions: Array<{ value: string; label: string }>;
  branchOptions: Array<{ value: string; label: string }>;
  mentionRobotOptions: Array<{ value: string; label: string }>;
};

export const TriggerRuleMatchSection = ({
  t,
  eventKey,
  readOnly,
  subTypes,
  setSubTypes,
  branches,
  setBranches,
  includeKeywords,
  setIncludeKeywords,
  excludeKeywords,
  setExcludeKeywords,
  assignees,
  setAssignees,
  mentionRobotIds,
  setMentionRobotIds,
  mentionLegacyHandles,
  subTypeOptions,
  branchOptions,
  mentionRobotOptions
}: TriggerRuleMatchSectionProps) => (
  <>
    <Divider plain style={{ marginTop: 6, marginBottom: 6 }}>
      <Typography.Text strong style={{ fontSize: 14 }}>
        {t('repoAutomation.rule.section.match')}
      </Typography.Text>
    </Divider>

    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div>
        <Typography.Text>{t('repoAutomation.rule.match.subTypes')}</Typography.Text>
        <Select
          mode="multiple"
          style={{ width: '100%', marginTop: 6 }}
          disabled={readOnly}
          value={subTypes}
          onChange={(v) => setSubTypes(Array.isArray(v) ? (v as any) : [])}
          options={subTypeOptions}
          placeholder={t('repoAutomation.rule.match.subTypesPlaceholder')}
        />
      </div>

      {eventKey !== 'issue' ? (
        <div>
          {/* Hide branch filters for Issue rules because Issue webhooks have no branch/ref context. b7x1k3m9p2r5t8n0q6s4 */}
          <Typography.Text>{t('repoAutomation.rule.match.branches')}</Typography.Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 6 }}
            disabled={readOnly}
            value={branches}
            onChange={(v) => setBranches(Array.isArray(v) ? (v as any) : [])}
            options={branchOptions}
            placeholder={t('repoAutomation.rule.match.branchesPlaceholder')}
          />
        </div>
      ) : null}

      <div>
        <Typography.Text>{t('repoAutomation.rule.match.includeKeywords')}</Typography.Text>
        <Select
          mode="tags"
          style={{ width: '100%', marginTop: 6 }}
          disabled={readOnly}
          value={includeKeywords}
          onChange={(v) => setIncludeKeywords(Array.isArray(v) ? (v as any) : [])}
          placeholder={t('repoAutomation.rule.match.includeKeywordsPlaceholder')}
        />
      </div>

      <div>
        <Typography.Text>{t('repoAutomation.rule.match.excludeKeywords')}</Typography.Text>
        <Select
          mode="tags"
          style={{ width: '100%', marginTop: 6 }}
          disabled={readOnly}
          value={excludeKeywords}
          onChange={(v) => setExcludeKeywords(Array.isArray(v) ? (v as any) : [])}
          placeholder={t('repoAutomation.rule.match.excludeKeywordsPlaceholder')}
        />
      </div>

      {eventKey === 'issue' ? (
        <div>
          <Typography.Text>{t('repoAutomation.rule.match.assignees')}</Typography.Text>
          <Select
            mode="tags"
            style={{ width: '100%', marginTop: 6 }}
            disabled={readOnly}
            value={assignees}
            onChange={(v) => setAssignees(Array.isArray(v) ? (v as any) : [])}
            placeholder={t('repoAutomation.rule.match.assigneesPlaceholder')}
          />
        </div>
      ) : null}

      <div>
        <Typography.Text>{t('repoAutomation.rule.match.mentions')}</Typography.Text>
        <Select
          mode="multiple"
          style={{ width: '100%', marginTop: 6 }}
          disabled={readOnly}
          value={mentionRobotIds}
          onChange={(v) => setMentionRobotIds(Array.isArray(v) ? (v as any) : [])}
          options={mentionRobotOptions}
          placeholder={t('repoAutomation.rule.match.mentionsPlaceholder')}
        />
      </div>

      {mentionLegacyHandles.length ? (
        <Alert type="warning" showIcon message={t('repoAutomation.rule.match.mentionsLegacyWarning')} />
      ) : null}
    </Space>
  </>
);
