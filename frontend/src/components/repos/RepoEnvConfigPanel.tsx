import { FC, useEffect, useMemo, useState } from 'react';
import { App, Button, Form, Input, Row, Col, Space, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useT } from '../../i18n';
import type { RepoPreviewEnvConfigPublic } from '../../api';

interface RepoEnvEntryForm {
  key?: string;
  value?: string;
  hasValue?: boolean;
}

const RESERVED_ENV_KEYS = new Set([
  'PORT',
  'HOST',
  'BROWSER',
  'NODE_ENV',
  'PATH',
  'PWD',
  'HOME',
  'SHELL',
  'TMP',
  'TEMP',
  'TMPDIR'
]);
const RESERVED_ENV_PREFIXES = ['HOOKCODE_'];

const normalizeEnvKey = (value: string): string => value.trim().toUpperCase();

const isReservedEnvKey = (key: string): boolean =>
  RESERVED_ENV_KEYS.has(key) || RESERVED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));

export interface RepoEnvConfigPanelProps {
  config: RepoPreviewEnvConfigPublic | null;
  readOnly: boolean;
  saving: boolean;
  onSave: (payload: { entries: Array<{ key: string; value?: string; secret?: boolean }>; removeKeys: string[] }) => Promise<void>;
}

export const RepoEnvConfigPanel: FC<RepoEnvConfigPanelProps> = ({ config, readOnly, saving, onSave }) => {
  const t = useT();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ entries: RepoEnvEntryForm[] }>();
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());

  const initialEntries = useMemo(() => {
    const vars = config?.variables ?? [];
    return vars.map((entry) => ({
      key: entry.key,
      value: '',
      hasValue: entry.hasValue
    }));
  }, [config]);

  useEffect(() => {
    form.setFieldsValue({ entries: initialEntries });
    setRemovedKeys(new Set());
  }, [form, initialEntries]);

  const handleRemove = (index: number) => {
    const current = form.getFieldValue('entries') ?? [];
    const key = normalizeEnvKey(String(current[index]?.key ?? ''));
    if (key) {
      setRemovedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  };

  const handleSave = async () => {
    const values = await form.getFieldsValue();
    const entriesRaw = Array.isArray(values.entries) ? values.entries : [];
    const nextEntries: Array<{ key: string; value?: string; secret?: boolean }> = [];
    const seen = new Set<string>();

    for (const entry of entriesRaw) {
      const rawKey = String(entry?.key ?? '').trim();
      const key = normalizeEnvKey(rawKey);
      if (!key) {
        message.error(t('repos.detail.env.keyRequired'));
        return;
      }
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        message.error(t('repos.detail.env.keyInvalid'));
        return;
      }
      if (isReservedEnvKey(key)) {
        message.error(t('repos.detail.env.keyReserved'));
        return;
      }
      // Prevent duplicate env keys in the preview env editor. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
      if (seen.has(key)) {
        message.error(t('repos.detail.env.keyDuplicate', { name: key }));
        return;
      }
      seen.add(key);

      const hasValue = Boolean(entry?.hasValue);
      const rawValue = String(entry?.value ?? '').trim();
      const shouldRequireValue = !hasValue;
      if (!rawValue && shouldRequireValue) {
        message.error(t('repos.detail.env.valueRequired'));
        return;
      }

      const nextEntry: { key: string; value?: string; secret?: boolean } = {
        key,
        value: rawValue ? rawValue : undefined,
        // Always store preview env values as secrets. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
        secret: true
      };
      nextEntries.push(nextEntry);
    }

    const removeKeys = Array.from(removedKeys).filter((key) => !seen.has(key));
    await onSave({ entries: nextEntries, removeKeys });
  };

  return (
    <div className="hc-section-block">
      <div className="hc-section-block__header">
        <span className="hc-section-block__title">{t('repos.detail.env.title')}</span>
        <div className="hc-section-block__extra">
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => form.setFieldsValue({ entries: [...(form.getFieldValue('entries') ?? []), {}] })}
            disabled={readOnly}
          >
            {t('repos.detail.env.add')}
          </Button>
        </div>
      </div>
      <div className="hc-section-block__body">
        <Typography.Text type="secondary">{t('repos.detail.env.desc')}</Typography.Text>
        <Form form={form} layout="vertical" requiredMark={false} disabled={readOnly} style={{ marginTop: 12 }}>
          <Form.List name="entries">
            {(fields, { remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field) => {
                  const entry = form.getFieldValue(['entries', field.name]) ?? {};
                  const hasValue = Boolean(entry?.hasValue);
                  return (
                    <Row key={field.key} gutter={12} align="middle">
                      <Col xs={24} md={8}>
                        <Form.Item
                          label={t('repos.detail.env.key')}
                          name={[field.name, 'key']}
                          rules={[{ required: true, message: t('repos.detail.env.keyRequired') }]}
                        >
                          <Input placeholder={t('repos.detail.env.keyPlaceholder')} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={14}>
                        <Form.Item label={t('repos.detail.env.value')} name={[field.name, 'value']}>
                          {/* Always render password input because preview env values are secret-only. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
                          <Input.Password placeholder={hasValue ? t('repos.detail.env.secretPlaceholder') : t('repos.detail.env.valuePlaceholder')} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'hasValue']} hidden>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={2}>
                        <Button
                          danger
                          type="text"
                          icon={<MinusCircleOutlined />}
                          onClick={() => {
                            handleRemove(field.name);
                            remove(field.name);
                          }}
                          disabled={readOnly}
                        >
                          {t('repos.detail.env.remove')}
                        </Button>
                      </Col>
                    </Row>
                  );
                })}
              </Space>
            )}
          </Form.List>
        </Form>
        <div className="hc-section-block__actions">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => void handleSave()}
            loading={saving}
            disabled={readOnly}
          >
            {t('repos.detail.env.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
