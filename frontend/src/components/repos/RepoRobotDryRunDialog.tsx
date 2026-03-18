import { App, Alert, Button, Card, Col, Descriptions, Form, Input, Row, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  RepoRobotDryRunDraftRequest,
  RepoRobotDryRunMode,
  RepoRobotDryRunResponse,
  RepoRobotDryRunSimulationType
} from '../../api';
import { dryRunRepoRobot } from '../../api';
import { useT } from '../../i18n';
import { ResponsiveDialog } from '../dialogs/ResponsiveDialog';

type DryRunSimulationForm = {
  type: RepoRobotDryRunSimulationType;
  title?: string;
  body?: string;
  number?: string;
  branch?: string;
  sha?: string;
  sourceBranch?: string;
  targetBranch?: string;
  customPayload?: string;
  customEventType?: string;
};

interface RepoRobotDryRunDialogProps {
  open: boolean;
  repoId: string;
  robotId?: string | null;
  defaultMode: RepoRobotDryRunMode;
  onCancel: () => void;
  buildDraft: () => RepoRobotDryRunDraftRequest;
}

const DEFAULT_FORM_VALUES: DryRunSimulationForm = {
  type: 'manual_chat',
  title: '',
  body: '',
  number: '1',
  branch: 'main',
  sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  sourceBranch: 'feature/dry-run',
  targetBranch: 'main',
  customPayload: '{\n  "hello": "world"\n}',
  customEventType: 'unknown'
};

// Keep the robot playground UI isolated from the already-large repo detail page while previewing unsaved form drafts. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
export function RepoRobotDryRunDialog({
  open,
  repoId,
  robotId,
  defaultMode,
  onCancel,
  buildDraft
}: RepoRobotDryRunDialogProps) {
  const t = useT();
  const { message } = App.useApp();
  const [mode, setMode] = useState<RepoRobotDryRunMode>(defaultMode);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RepoRobotDryRunResponse | null>(null);
  const [form] = Form.useForm<DryRunSimulationForm>();
  const simulationType = Form.useWatch('type', form) ?? 'manual_chat';

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setResult(null);
  }, [defaultMode, form, open]);

  const handleCopy = async (text: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(t(successKey));
    } catch (error) {
      console.error(error);
      message.error(t('repos.robotDryRun.copyFailed'));
    }
  };

  const handleRun = async () => {
    const values = form.getFieldsValue();
    const nextDraft = buildDraft();
    const payload =
      values.type === 'custom'
        ? (() => {
            const raw = String(values.customPayload ?? '').trim();
            if (!raw) return {};
            try {
              return JSON.parse(raw);
            } catch {
              throw new Error(t('repos.robotDryRun.customPayloadInvalid'));
            }
          })()
        : undefined;

    setRunning(true);
    try {
      const nextResult = await dryRunRepoRobot(
        repoId,
        {
          mode,
          draft: nextDraft,
          simulation: {
            type: values.type,
            title: values.title?.trim() || null,
            body: values.body?.trim() || null,
            number: values.number?.trim() || null,
            branch: values.branch?.trim() || null,
            sha: values.sha?.trim() || null,
            sourceBranch: values.sourceBranch?.trim() || null,
            targetBranch: values.targetBranch?.trim() || null,
            payload,
            eventType: values.customEventType?.trim() || null
          }
        },
        robotId
      );
      setResult(nextResult);
    } catch (error: any) {
      console.error(error);
      message.error(error?.message || error?.response?.data?.error || t('repos.robotDryRun.runFailed'));
    } finally {
      setRunning(false);
    }
  };

  const routingAttempts = result?.resolvedProvider.routing.attempts ?? [];
  const sideEffectProtection = result?.executionPlan.sideEffectProtection ?? [];

  const providerMetaItems = useMemo(
    () =>
      result
        ? [
            { key: 'provider', label: t('repos.robotDryRun.provider.provider'), value: result.resolvedProvider.provider },
            { key: 'model', label: t('repos.robotDryRun.provider.model'), value: result.resolvedProvider.model || '-' },
            { key: 'sandbox', label: t('repos.robotDryRun.provider.sandbox'), value: result.resolvedProvider.sandbox },
            {
              key: 'network',
              label: t('repos.robotDryRun.provider.network'),
              value: result.resolvedProvider.networkAccess ? t('common.enabled') : t('common.disabled')
            },
            {
              key: 'resolvedLayer',
              label: t('repos.robotDryRun.provider.credentialLayer'),
              value: result.resolvedCredentialSummary.resolvedLayer
            },
            {
              key: 'resolvedMethod',
              label: t('repos.robotDryRun.provider.credentialMethod'),
              value: result.resolvedCredentialSummary.resolvedMethod
            }
          ]
        : [],
    [result, t]
  );

  return (
    <ResponsiveDialog
      variant="large"
      open={open}
      title={t('repos.robotDryRun.title')}
      onCancel={onCancel}
      drawerWidth="min(1180px, 96vw)"
      footer={
        <Space>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="primary" loading={running} onClick={() => void handleRun()}>
            {mode === 'execute_no_side_effect' ? t('repos.robotDryRun.runExecute') : t('repos.robotDryRun.runRender')}
          </Button>
        </Space>
      }
    >
      <div className="hc-robot-dry-run">
        <div className="hc-robot-dry-run__controls">
          <Card size="small" title={t('repos.robotDryRun.controlsTitle')}>
            <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES}>
              <Form.Item label={t('repos.robotDryRun.mode')}>
                <Select
                  value={mode}
                  onChange={(next) => setMode(next)}
                  options={[
                    { value: 'render_only', label: t('repos.robotDryRun.mode.renderOnly') },
                    { value: 'execute_no_side_effect', label: t('repos.robotDryRun.mode.executeNoSideEffect') }
                  ]}
                />
              </Form.Item>

              <Form.Item label={t('repos.robotDryRun.simulation')} name="type">
                <Select
                  options={[
                    { value: 'manual_chat', label: t('repos.robotDryRun.simulation.manual_chat') },
                    { value: 'issue', label: t('repos.robotDryRun.simulation.issue') },
                    { value: 'merge_request', label: t('repos.robotDryRun.simulation.merge_request') },
                    { value: 'push', label: t('repos.robotDryRun.simulation.push') },
                    { value: 'custom', label: t('repos.robotDryRun.simulation.custom') }
                  ]}
                />
              </Form.Item>

              {simulationType === 'manual_chat' ? (
                <>
                  <Form.Item label={t('repos.robotDryRun.field.title')} name="title">
                    <Input placeholder={t('repos.robotDryRun.field.titlePlaceholder')} />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.body')} name="body">
                    <Input.TextArea rows={5} placeholder={t('repos.robotDryRun.field.bodyPlaceholder')} />
                  </Form.Item>
                </>
              ) : null}

              {simulationType === 'issue' ? (
                <>
                  <Form.Item label={t('repos.robotDryRun.field.number')} name="number">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.title')} name="title">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.body')} name="body">
                    <Input.TextArea rows={5} />
                  </Form.Item>
                </>
              ) : null}

              {simulationType === 'merge_request' ? (
                <>
                  <Form.Item label={t('repos.robotDryRun.field.number')} name="number">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.title')} name="title">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.body')} name="body">
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label={t('repos.robotDryRun.field.sourceBranch')} name="sourceBranch">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={t('repos.robotDryRun.field.targetBranch')} name="targetBranch">
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : null}

              {simulationType === 'push' ? (
                <>
                  <Form.Item label={t('repos.robotDryRun.field.branch')} name="branch">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.sha')} name="sha">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.body')} name="body">
                    <Input.TextArea rows={4} placeholder={t('repos.robotDryRun.field.commitMessagePlaceholder')} />
                  </Form.Item>
                </>
              ) : null}

              {simulationType === 'custom' ? (
                <>
                  <Form.Item label={t('repos.robotDryRun.field.customEventType')} name="customEventType">
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('repos.robotDryRun.field.customPayload')} name="customPayload">
                    <Input.TextArea rows={10} />
                  </Form.Item>
                </>
              ) : null}

              <Alert
                type="info"
                showIcon
                message={t('repos.robotDryRun.hint')}
              />
            </Form>
          </Card>
        </div>

        <div className="hc-robot-dry-run__results">
          {running && !result ? <Skeleton active paragraph={{ rows: 12 }} /> : null}

          {!running && !result ? (
            <Card size="small">
              <Typography.Text type="secondary">{t('repos.robotDryRun.empty')}</Typography.Text>
            </Card>
          ) : null}

          {result ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {result.warnings.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message={t('repos.robotDryRun.warnings')}
                  description={
                    <ul className="hc-robot-dry-run__warning-list">
                      {result.warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  }
                />
              ) : null}

              <Card
                size="small"
                title={t('repos.robotDryRun.promptTitle')}
                extra={<Button size="small" onClick={() => void handleCopy(result.renderedPrompt, 'repos.robotDryRun.promptCopied')}>{t('repos.robotDryRun.copyPrompt')}</Button>}
              >
                <Input.TextArea readOnly value={result.renderedPrompt} autoSize={{ minRows: 10, maxRows: 22 }} />
              </Card>

              <Card size="small" title={t('repos.robotDryRun.providerTitle')}>
                <Descriptions size="small" column={2} items={providerMetaItems.map((item) => ({
                  key: item.key,
                  label: item.label,
                  children: item.value
                }))} />
                {routingAttempts.length ? (
                  <div className="hc-robot-dry-run__attempts">
                    {routingAttempts.map((attempt) => (
                      <div key={`${attempt.provider}-${attempt.role}`} className="hc-robot-dry-run__attempt">
                        <Space wrap>
                          <Tag color={attempt.status === 'failed' ? 'red' : attempt.status === 'succeeded' ? 'green' : 'blue'}>
                            {attempt.provider}
                          </Tag>
                          <Tag>{attempt.role}</Tag>
                          <Tag>{attempt.status}</Tag>
                        </Space>
                        <Typography.Text type="secondary">
                          {attempt.reason || attempt.error || '-'}
                        </Typography.Text>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card size="small" title={t('repos.robotDryRun.executionTitle')}>
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    { key: 'mode', label: t('repos.robotDryRun.execution.mode'), children: result.executionPlan.mode },
                    {
                      key: 'workspace',
                      label: t('repos.robotDryRun.execution.workspace'),
                      children: result.executionPlan.workspaceStrategy
                    },
                    {
                      key: 'outputFile',
                      label: t('repos.robotDryRun.execution.outputFile'),
                      children: result.executionPlan.outputFileName
                    }
                  ]}
                />
                <div className="hc-robot-dry-run__protection">
                  {sideEffectProtection.map((item) => (
                    <Tag key={item} color="processing">{item}</Tag>
                  ))}
                </div>
                <div className="hc-robot-dry-run__actions">
                  {result.simulatedActions.map((action) => (
                    <Alert key={`${action.type}-${action.summary}`} type="info" showIcon message={action.summary} />
                  ))}
                </div>
              </Card>

              <Card
                size="small"
                title={t('repos.robotDryRun.outputTitle')}
                extra={
                  result.modelOutput ? (
                    <Button size="small" onClick={() => void handleCopy(result.modelOutput ?? '', 'repos.robotDryRun.outputCopied')}>
                      {t('repos.robotDryRun.copyOutput')}
                    </Button>
                  ) : null
                }
              >
                {result.modelError ? <Alert type="error" showIcon message={result.modelError} /> : null}
                {result.modelOutput ? (
                  <Input.TextArea readOnly value={result.modelOutput} autoSize={{ minRows: 8, maxRows: 18 }} />
                ) : (
                  <Typography.Text type="secondary">{t('repos.robotDryRun.outputEmpty')}</Typography.Text>
                )}
              </Card>
            </Space>
          ) : null}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
