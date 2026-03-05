// Update imports after per-page nested folder migration. docs/en/developer/plans/frontend-page-folder-refactor-20260305/task_plan.md frontend-page-folder-refactor-20260305
import { FC, useCallback, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Divider, Form, Input, Select, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { login } from '../../../api';
import { consumeLoginNext, saveVerifyEmailAddress, setStoredUser, setToken } from '../../../auth';
import { buildHomeHash, buildRegisterHash, buildVerifyEmailHash } from '../../../router';
import { setLocale, useLocale, useT } from '../../../i18n';

/**
 * LoginPage:
 * - Business context: authenticate users for backend-connected pages in `frontend-chat`.
 * - Compatibility: uses the same storage keys as the legacy frontend, so existing sessions keep working.
 *
 * Change record:
 * - 2026-01-11: Added minimal login page to support the Home/Tasks migration.
 */

// Surface registration flags for login UX. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export interface LoginPageProps {
  registerEnabled?: boolean | null;
  registerRequireEmailVerify?: boolean | null;
}

export const LoginPage: FC<LoginPageProps> = ({ registerEnabled, registerRequireEmailVerify }) => {
  const t = useT();
  const locale = useLocale();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(() => ({ username: '', password: '' }), []);
  const canRegister = registerEnabled !== false;
  const requiresVerify = registerRequireEmailVerify === true;

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await login({ username: values.username, password: values.password });
      setToken(res.token);
      setStoredUser(res.user);
      message.success(t('toast.login.success'));

      const next = consumeLoginNext();
      window.location.hash = next ?? buildHomeHash();
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data?.error ? String(err.response.data.error) : '';
      const apiCode = err?.response?.data?.code ? String(err.response.data.code) : '';
      if (apiCode === 'EMAIL_NOT_VERIFIED') {
        // Guide users to the email verification screen when login is blocked. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        const rawLogin = String(values?.username ?? '').trim();
        if (rawLogin) saveVerifyEmailAddress(rawLogin);
        message.error(t('login.verifyRequired'));
        window.location.hash = buildVerifyEmailHash({ email: rawLogin || undefined });
        return;
      }
      message.error(apiError || t('toast.login.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [form, message, submitting, t]);

  return (
    <div className="hc-login">
      <Card className="hc-login__card">
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {t('login.title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('login.subtitle')}</Typography.Text>
        </Space>

        {requiresVerify ? (
          <Alert type="info" showIcon message={t('login.verifyRequiredTip')} style={{ marginTop: 16 }} />
        ) : null}

        <Form form={form} layout="vertical" initialValues={initialValues} style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label={t('login.username')}
            rules={[{ required: true, message: t('login.validation.usernameRequired') }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('login.password')}
            rules={[{ required: true, message: t('login.validation.passwordRequired') }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" block loading={submitting} onClick={() => void handleSubmit()}>
            {t('login.submit')}
          </Button>
        </Form>

        <Divider style={{ margin: '16px 0 12px' }} />
        {/* Add register + verify shortcuts for auth flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
        <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">
            {canRegister ? t('login.registerHint') : t('login.registerDisabled')}
          </Typography.Text>
          <Space size={6}>
            {canRegister ? (
              <Button type="link" onClick={() => (window.location.hash = buildRegisterHash())}>
                {t('login.registerAction')}
              </Button>
            ) : null}
            <Button type="link" onClick={() => (window.location.hash = buildVerifyEmailHash())}>
              {t('login.verifyAction')}
            </Button>
          </Space>
        </Space>

        <Divider style={{ margin: '16px 0 12px' }} />
        <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">{t('login.language')}</Typography.Text>
          <Select
            value={locale}
            style={{ width: 160 }}
            options={[
              { value: 'zh-CN', label: t('panel.settings.lang.zhCN') },
              { value: 'en-US', label: t('panel.settings.lang.enUS') }
            ]}
            onChange={(value) => setLocale(value)}
          />
        </Space>
      </Card>
    </div>
  );
};
