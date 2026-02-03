// Render the final onboarding step confirmation call-to-action. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Button, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { TFunction } from '../../../i18n';

export type RepoOnboardingDoneStepProps = {
  t: TFunction;
  onFinish: () => void;
};

export const RepoOnboardingDoneStep = ({ t, onFinish }: RepoOnboardingDoneStepProps) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert type="success" showIcon message={t('repos.onboarding.done.title')} description={t('repos.onboarding.done.desc')} />
    <Button type="primary" icon={<CheckOutlined />} onClick={onFinish}>
      {t('repos.onboarding.done.enter')}
    </Button>
  </Space>
);
