// Extract the trigger rule schedule/time window section for clarity. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Divider, Space, Typography } from 'antd';
import type { TimeWindow } from '../../../api';
import type { TFunction } from '../../../i18n';
import { TimeWindowPicker } from '../../TimeWindowPicker';

export type TriggerRuleScheduleSectionProps = {
  t: TFunction;
  readOnly: boolean;
  timeWindow: TimeWindow | null;
  setTimeWindow: (next: TimeWindow | null) => void;
};

export const TriggerRuleScheduleSection = ({ t, readOnly, timeWindow, setTimeWindow }: TriggerRuleScheduleSectionProps) => (
  <>
    <Divider plain style={{ marginTop: 6, marginBottom: 6 }}>
      <Typography.Text strong style={{ fontSize: 14 }}>
        {t('repoAutomation.rule.section.schedule')}
      </Typography.Text>
    </Divider>

    {/* Provide trigger-level time window configuration for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 */}
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Typography.Text>{t('repoAutomation.rule.timeWindow')}</Typography.Text>
      <TimeWindowPicker value={timeWindow} onChange={setTimeWindow} disabled={readOnly} size="middle" />
    </Space>
  </>
);
