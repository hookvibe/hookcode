import { ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Alert, Button, Input, List, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import type { ButtonProps } from 'antd';
import { FC, useCallback, useMemo, useState } from 'react';
import type { ModelProviderModelsResponse } from '../api';
import { useT } from '../i18n';

interface Props {
  disabled?: boolean;
  buttonProps?: ButtonProps;
  loadModels: (params: { forceRefresh: boolean }) => Promise<ModelProviderModelsResponse>;
  onPickModel?: (model: string) => void;
}

export const ModelProviderModelsButton: FC<Props> = ({ disabled = false, buttonProps, loadModels, onPickModel }) => {
  // Provide a reusable "browse models" modal so multiple credential forms don't hardcode model ids. b8fucnmey62u0muyn7i0
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<ModelProviderModelsResponse | null>(null);
  const [query, setQuery] = useState('');

  const filteredModels = useMemo(() => {
    const models = data?.models ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [data?.models, query]);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      setLoading(true);
      setError('');
      try {
        const res = await loadModels({ forceRefresh });
        setData(res);
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.error || t('modelCatalog.error'));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [loadModels, t]
  );

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery('');
    void load(false);
  }, [load]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery('');
    setError('');
  }, []);

  const sourceTag = useMemo(() => {
    const source = data?.source;
    if (!source) return null;
    return (
      <Tag color={source === 'remote' ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
        {t(`modelCatalog.source.${source}` as any)}
      </Tag>
    );
  }, [data?.source, t]);

  return (
    <>
      <Button
        icon={<UnorderedListOutlined />}
        onClick={openModal}
        disabled={disabled}
        {...buttonProps}
      >
        {t('modelCatalog.button')}
      </Button>

      <Modal
        title={
          <Space size={8}>
            <span>{t('modelCatalog.title')}</span>
            {sourceTag}
            {data?.models?.length ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('modelCatalog.count', { count: data.models.length })}
              </Typography.Text>
            ) : null}
          </Space>
        }
        open={open}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space size={8} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('modelCatalog.searchPlaceholder')}
              allowClear
              style={{ width: 260 }}
              disabled={loading}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load(true)} loading={loading} disabled={disabled}>
              {t('common.refresh')}
            </Button>
          </Space>

          {onPickModel ? <Typography.Text type="secondary">{t('modelCatalog.pickToApply')}</Typography.Text> : null}

          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : error ? (
            <Alert type="error" showIcon message={error} />
          ) : filteredModels.length ? (
            <List
              size="small"
              bordered
              dataSource={filteredModels}
              style={{ maxHeight: 360, overflow: 'auto' }}
              renderItem={(model) => (
                <List.Item>
                  {onPickModel ? (
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => {
                        onPickModel(model);
                        closeModal();
                      }}
                    >
                      <Typography.Text code>{model}</Typography.Text>
                    </Button>
                  ) : (
                    <Typography.Text code>{model}</Typography.Text>
                  )}
                </List.Item>
              )}
            />
          ) : (
            <Typography.Text type="secondary">{t('modelCatalog.empty')}</Typography.Text>
          )}
        </Space>
      </Modal>
    </>
  );
};

