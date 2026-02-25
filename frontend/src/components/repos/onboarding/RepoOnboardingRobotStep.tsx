// Render the robot creation onboarding step separately from the main wizard. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Button, Space, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import type { TFunction } from '../../../i18n';

export type RepoOnboardingRobotStepProps = {
  t: TFunction;
  robotCount: number;
  onOpenCreateRobot: () => void;
};

export const RepoOnboardingRobotStep = ({ t, robotCount, onOpenCreateRobot }: RepoOnboardingRobotStepProps) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.bot.desc')}</Typography.Paragraph>
    <Alert type="info" showIcon message={t('repos.onboarding.bot.tip')} />
    <Space size={10} wrap>
      <Button type="primary" icon={<ArrowRightOutlined />} onClick={onOpenCreateRobot}>
        {t('repos.onboarding.bot.create')}
      </Button>
      <Typography.Text type="secondary">{t('repos.onboarding.bot.count', { count: robotCount })}</Typography.Text>
    </Space>
  </Space>
);
