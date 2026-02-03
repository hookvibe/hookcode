// Extract the onboarding chat test UI into a dedicated step component. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Button, Card, Input, Select, Space, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { TFunction } from '../../../i18n';
import { buildTaskGroupHash } from '../../../router';
import { MarkdownViewer } from '../../MarkdownViewer';
import type { ChatMessage } from './useRepoOnboardingChat';

export type RepoOnboardingChatStepProps = {
  t: TFunction;
  robotOptions: Array<{ value: string; label: string }>;
  chatRobotId: string;
  setChatRobotId: (next: string) => void;
  chatDraft: string;
  setChatDraft: (next: string) => void;
  chatSending: boolean;
  chatMessages: ChatMessage[];
  onSendChat: () => void;
  lastAssistantText: string;
  lastTaskGroupId: string;
};

export const RepoOnboardingChatStep = ({
  t,
  robotOptions,
  chatRobotId,
  setChatRobotId,
  chatDraft,
  setChatDraft,
  chatSending,
  chatMessages,
  onSendChat,
  lastAssistantText,
  lastTaskGroupId
}: RepoOnboardingChatStepProps) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.chat.desc')}</Typography.Paragraph>

    {!robotOptions.length ? (
      <Alert type="warning" showIcon message={t('repos.onboarding.chat.noRobots')} />
    ) : (
      <Card size="small" className="hc-card" title={t('repos.onboarding.chat.cardTitle')}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Select
            value={chatRobotId || undefined}
            onChange={(value) => setChatRobotId(String(value ?? ''))}
            options={robotOptions}
            placeholder={t('repos.onboarding.chat.robotPlaceholder')}
          />

          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder={t('repos.onboarding.chat.inputPlaceholder')}
              onPressEnter={onSendChat}
              disabled={chatSending}
            />
            <Button type="primary" icon={<SendOutlined />} loading={chatSending} onClick={onSendChat} disabled={!chatRobotId}>
              {t('repos.onboarding.chat.send')}
            </Button>
          </Space.Compact>

          <div>
            {chatMessages.length ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {chatMessages.slice(-6).map((m) => (
                  <div key={m.id} className="hc-chat-item">
                    <div className={m.role === 'user' ? 'hc-chat-item__user' : 'hc-chat-item__assistant'}>
                      <div className={`hc-chat-bubble${m.role === 'user' ? ' hc-chat-bubble--user' : ''}`}>{m.text}</div>
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">{t('repos.onboarding.chat.empty')}</Typography.Text>
            )}
          </div>

          {lastAssistantText ? (
            <Card size="small" className="hc-card" title={t('repos.onboarding.chat.resultTitle')}>
              <MarkdownViewer markdown={lastAssistantText} />
            </Card>
          ) : null}

          {lastTaskGroupId ? (
            <Button
              type="link"
              onClick={() => {
                // Navigate to the full chat timeline for the last test run. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
                window.location.hash = buildTaskGroupHash(lastTaskGroupId);
              }}
            >
              {t('repos.onboarding.chat.openFullChat')}
            </Button>
          ) : null}
        </Space>
      </Card>
    )}
  </Space>
);
