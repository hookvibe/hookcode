import { FC, useCallback, useMemo, useState } from 'react';
import { App, Button, Card, Divider, Form, Input, Select, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { login } from '../api';
import { consumeLoginNext, setStoredUser, setToken } from '../auth';
import { buildHomeHash } from '../router';
import { setLocale, useLocale, useT } from '../i18n';

/**
 * LoginPage:
 * - Business context: authenticate users for backend-connected pages in `frontend-chat`.
 * - Compatibility: uses the same storage keys as the legacy frontend, so existing sessions keep working.
 *
 * Change record:
 * - 2026-01-11: Added minimal login page to support the Home/Tasks migration.
 */

export const LoginPage: FC = () => {
  const t = useT();
  const locale = useLocale();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(() => ({ username: '', password: '' }), []);

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
