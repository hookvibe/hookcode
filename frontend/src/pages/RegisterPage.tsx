import { FC, useCallback, useMemo, useState } from 'react';
import { App, Alert, Button, Card, Divider, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { register } from '../api';
import { saveVerifyEmailAddress, setStoredUser, setToken } from '../auth';
import { buildHomeHash, buildLoginHash, buildVerifyEmailHash } from '../router';
import { useT } from '../i18n';

export interface RegisterPageProps {
  registerEnabled?: boolean | null;
  registerRequireEmailVerify?: boolean | null;
}

export const RegisterPage: FC<RegisterPageProps> = ({ registerEnabled, registerRequireEmailVerify }) => {
  const t = useT();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(() => ({ username: '', email: '', password: '', displayName: '' }), []);
  const isRegisterEnabled = registerEnabled !== false;
  const requiresVerify = registerRequireEmailVerify === true;

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (submitting) return;
    if (!isRegisterEnabled) {
      message.error(t('register.disabled'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        username: values.username,
        email: values.email,
        password: values.password,
        displayName: values.displayName ? String(values.displayName).trim() : undefined
      });

      if (res.status === 'ok' && res.token && res.user) {
        // Auto-login on successful registration when no verification is required. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        setToken(res.token);
        setStoredUser(res.user);
        message.success(t('toast.register.success'));
        window.location.hash = buildHomeHash();
        return;
      }

      // Default to email verification flow for pending status. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      const email = res.email || values.email;
      saveVerifyEmailAddress(email);
      message.success(t('toast.register.verifySent'));
      window.location.hash = buildVerifyEmailHash({ email });
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data?.error ? String(err.response.data.error) : '';
      message.error(apiError || t('toast.register.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [form, isRegisterEnabled, message, submitting, t]);

  return (
    <div className="hc-login">
      <Card className="hc-login__card">
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {t('register.title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('register.subtitle')}</Typography.Text>
        </Space>

        {!isRegisterEnabled ? (
          <Alert type="warning" showIcon message={t('register.disabled')} style={{ marginTop: 16 }} />
        ) : requiresVerify ? (
          <Alert type="info" showIcon message={t('register.verifyRequired')} style={{ marginTop: 16 }} />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          style={{ marginTop: 16 }}
          disabled={submitting || !isRegisterEnabled}
        >
          <Form.Item
            name="username"
            label={t('register.username')}
            rules={[{ required: true, message: t('register.validation.usernameRequired') }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('register.email')}
            rules={[
              { required: true, message: t('register.validation.emailRequired') },
              { type: 'email', message: t('register.validation.emailInvalid') }
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="email" />
          </Form.Item>
          <Form.Item name="displayName" label={t('register.displayName')}>
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('register.password')}
            rules={[{ required: true, message: t('register.validation.passwordRequired') }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" block loading={submitting} onClick={() => void handleSubmit()}>
            {t('register.submit')}
          </Button>
        </Form>

        <Divider style={{ margin: '16px 0 12px' }} />
        <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">{t('register.loginHint')}</Typography.Text>
          <Button type="link" onClick={() => (window.location.hash = buildLoginHash())}>
            {t('register.loginAction')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};
