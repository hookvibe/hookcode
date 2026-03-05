// Update imports after per-page nested folder migration. docs/en/developer/plans/frontend-page-folder-refactor-20260305/task_plan.md frontend-page-folder-refactor-20260305
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Card, Divider, Form, Input, Space, Typography } from 'antd';
import { MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { acceptRepoInvite } from '../../../api';
import { saveLoginNext } from '../../../auth';
import { buildLoginHash, buildRepoHash } from '../../../router';
import { useT } from '../../../i18n';

export interface AcceptInvitePageProps {
  email?: string;
  token?: string;
  isAuthenticated: boolean;
}

export const AcceptInvitePage: FC<AcceptInvitePageProps> = ({ email, token, isAuthenticated }) => {
  const t = useT();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(
    () => ({
      email: email || '',
      token: token || ''
    }),
    [email, token]
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const handleLogin = useCallback(() => {
    const hash = typeof window === 'undefined' ? '' : String(window.location.hash ?? '');
    saveLoginNext(hash);
    window.location.hash = buildLoginHash();
  }, []);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await acceptRepoInvite({ email: values.email, token: values.token });
      // Route to the repo after accepting the invite. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      message.success(t('toast.invite.accepted'));
      window.location.hash = buildRepoHash(res.repoId);
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data?.error ? String(err.response.data.error) : '';
      message.error(apiError || t('toast.invite.acceptFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [form, message, submitting, t]);

  return (
    <div className="hc-login">
      <Card className="hc-login__card">
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {t('invite.title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('invite.subtitle')}</Typography.Text>
        </Space>

        {!isAuthenticated ? (
          <Alert
            type="warning"
            showIcon
            message={t('invite.loginRequired')}
            style={{ marginTop: 16 }}
            action={
              <Button size="small" type="primary" onClick={handleLogin}>
                {t('invite.loginAction')}
              </Button>
            }
          />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          style={{ marginTop: 16 }}
          disabled={!isAuthenticated}
        >
          <Form.Item
            name="email"
            label={t('invite.email')}
            rules={[
              { required: true, message: t('invite.validation.emailRequired') },
              { type: 'email', message: t('invite.validation.emailInvalid') }
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="token"
            label={t('invite.token')}
            rules={[{ required: true, message: t('invite.validation.tokenRequired') }]}
          >
            <Input prefix={<SafetyCertificateOutlined />} autoComplete="one-time-code" />
          </Form.Item>

          <Button type="primary" block loading={submitting} onClick={() => void handleSubmit()}>
            {t('invite.submit')}
          </Button>
        </Form>

        <Divider style={{ margin: '16px 0 12px' }} />
        <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">{t('invite.loginHint')}</Typography.Text>
          <Button type="link" onClick={handleLogin}>
            {t('invite.loginAction')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};
