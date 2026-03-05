import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Divider, Form, Input, Space, Typography } from 'antd';
import { MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { verifyEmail } from '../api';
import { clearVerifyEmailAddress, getVerifyEmailAddress } from '../auth';
import { buildLoginHash } from '../router';
import { useT } from '../i18n';

export interface VerifyEmailPageProps {
  email?: string;
  token?: string;
}

export const VerifyEmailPage: FC<VerifyEmailPageProps> = ({ email, token }) => {
  const t = useT();
  const { message } = App.useApp();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(
    () => ({
      email: email || getVerifyEmailAddress() || '',
      token: token || ''
    }),
    [email, token]
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (submitting) return;
    setSubmitting(true);
    try {
      await verifyEmail({ email: values.email, token: values.token });
      // Clear stored verification context after a successful confirmation. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      clearVerifyEmailAddress();
      message.success(t('toast.verifyEmail.success'));
      window.location.hash = buildLoginHash();
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data?.error ? String(err.response.data.error) : '';
      message.error(apiError || t('toast.verifyEmail.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [form, message, submitting, t]);

  return (
    <div className="hc-login">
      <Card className="hc-login__card">
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            {t('verifyEmail.title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('verifyEmail.subtitle')}</Typography.Text>
        </Space>

        <Form form={form} layout="vertical" initialValues={initialValues} style={{ marginTop: 16 }}>
          <Form.Item
            name="email"
            label={t('verifyEmail.email')}
            rules={[
              { required: true, message: t('verifyEmail.validation.emailRequired') },
              { type: 'email', message: t('verifyEmail.validation.emailInvalid') }
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="token"
            label={t('verifyEmail.token')}
            rules={[{ required: true, message: t('verifyEmail.validation.tokenRequired') }]}
          >
            <Input prefix={<SafetyCertificateOutlined />} autoComplete="one-time-code" />
          </Form.Item>

          <Button type="primary" block loading={submitting} onClick={() => void handleSubmit()}>
            {t('verifyEmail.submit')}
          </Button>
        </Form>

        <Divider style={{ margin: '16px 0 12px' }} />
        <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">{t('verifyEmail.loginHint')}</Typography.Text>
          <Button type="link" onClick={() => (window.location.hash = buildLoginHash())}>
            {t('verifyEmail.loginAction')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};
