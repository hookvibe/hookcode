import { App, Alert, Button, Card, Col, Divider, Empty, Form, Input, InputNumber, Progress, Row, Select, Skeleton, Space, Switch, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { BudgetOverageAction, BudgetPolicy, BudgetScopeType, CostBreakdownResponse, CostSummaryResponse, ModelProvider, QuotaEvent, UpdateBudgetPolicyRequest, UsageBreakdownItem } from '../../api';
import { fetchBudgetPolicies, fetchCostBreakdownByRepo, fetchCostBreakdownByRobot, fetchCostSummary, patchBudgetPolicy } from '../../api';
import { useLocale, useT } from '../../i18n';

type BudgetPolicyFormValues = {
  enabled: boolean;
  overageAction: BudgetOverageAction;
  dailyTaskCountLimit?: number | null;
  monthlyTaskCountLimit?: number | null;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  dailyEstimatedCostUsdLimit?: number | null;
  monthlyEstimatedCostUsdLimit?: number | null;
  maxRuntimeSeconds?: number | null;
  maxStepCount?: number | null;
  degradeProvider?: ModelProvider | null;
  degradeModel?: string | null;
  forceReadOnlyOnOverage: boolean;
};

type UserCostDashboardProps = {
  mode: 'user';
  currentUserId: string;
  isAdmin?: boolean;
  reloadToken?: number;
};

type RepoCostDashboardProps = {
  mode: 'repo';
  repoId: string;
  readOnly?: boolean;
  reloadToken?: number;
};

export type CostGovernanceDashboardProps = UserCostDashboardProps | RepoCostDashboardProps;

const WINDOW_DAYS = 30;

const boxStyle: CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 12,
  background: 'var(--surface-hover)'
};

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const buildBudgetFormValues = (policy: BudgetPolicy | null): BudgetPolicyFormValues => ({
  enabled: policy?.enabled ?? false,
  overageAction: policy?.overageAction ?? 'hard_limit',
  dailyTaskCountLimit: policy?.dailyTaskCountLimit,
  monthlyTaskCountLimit: policy?.monthlyTaskCountLimit,
  dailyTokenLimit: policy?.dailyTokenLimit,
  monthlyTokenLimit: policy?.monthlyTokenLimit,
  dailyEstimatedCostUsdLimit: policy?.dailyEstimatedCostUsdLimit,
  monthlyEstimatedCostUsdLimit: policy?.monthlyEstimatedCostUsdLimit,
  maxRuntimeSeconds: policy?.maxRuntimeSeconds,
  maxStepCount: policy?.maxStepCount,
  degradeProvider: policy?.degradeProvider,
  degradeModel: policy?.degradeModel,
  forceReadOnlyOnOverage: policy?.forceReadOnlyOnOverage ?? false
});

const getQuotaEventColor = (eventType: QuotaEvent['eventType']): string => {
  if (eventType === 'blocked') return 'red';
  if (eventType === 'approval_required') return 'gold';
  if (eventType === 'degrade_applied') return 'blue';
  return 'default';
};

const getDecisionColor = (decision: QuotaEvent['decision']): string => {
  if (decision === 'deny') return 'red';
  if (decision === 'require_approval') return 'gold';
  if (decision === 'degrade') return 'blue';
  if (decision === 'allow_with_warning') return 'orange';
  return 'green';
};

const SummaryMetrics = ({
  summary,
  locale,
  t
}: {
  summary: CostSummaryResponse['summary'];
  locale: string;
  t: ReturnType<typeof useT>;
}) => {
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    [locale]
  );
  const integer = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const avgCost = summary.taskCount > 0 ? summary.estimatedCostUsd / summary.taskCount : 0;

  const items = [
    { key: 'cost', label: t('costs.summary.totalCost'), value: currency.format(summary.estimatedCostUsd) },
    { key: 'tasks', label: t('costs.summary.taskCount'), value: integer.format(summary.taskCount) },
    { key: 'tokens', label: t('costs.summary.totalTokens'), value: integer.format(summary.totalTokens) },
    { key: 'blocked', label: t('costs.summary.blockedTaskCount'), value: integer.format(summary.blockedTaskCount) },
    { key: 'failed', label: t('costs.summary.failedTaskCount'), value: integer.format(summary.failedTaskCount) },
    { key: 'avg', label: t('costs.summary.avgCostPerTask'), value: currency.format(avgCost) }
  ];

  return (
    <Row gutter={[12, 12]}>
      {items.map((item) => (
        <Col xs={24} sm={12} xl={8} key={item.key}>
          <div style={boxStyle}>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {item.label}
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '8px 0 0', fontSize: 22 }}>
              {item.value}
            </Typography.Title>
          </div>
        </Col>
      ))}
    </Row>
  );
};

const BreakdownCard = ({
  title,
  subtitle,
  items,
  loading,
  error,
  t,
  locale
}: {
  title: string;
  subtitle?: string;
  items: UsageBreakdownItem[];
  loading: boolean;
  error?: string | null;
  t: ReturnType<typeof useT>;
  locale: string;
}) => {
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    [locale]
  );
  const integer = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const totalCost = items.reduce((sum, item) => sum + item.estimatedCostUsd, 0);

  return (
    <Card size="small" className="hc-card" title={title} extra={subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : undefined}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : error ? (
        <Alert type="error" showIcon message={error} />
      ) : items.length ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {items.map((item) => {
            const percent = totalCost > 0 ? Math.max(0, Math.min(100, (item.estimatedCostUsd / totalCost) * 100)) : 0;
            return (
              <div key={item.key} style={boxStyle}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Typography.Text strong>{item.label || item.key}</Typography.Text>
                    <Typography.Text>{currency.format(item.estimatedCostUsd)}</Typography.Text>
                  </Space>
                  <Progress percent={Number(percent.toFixed(1))} showInfo={false} strokeColor="var(--ant-color-primary)" />
                  <Space size={8} wrap>
                    <Tag>{t('costs.breakdown.taskCount')}: {integer.format(item.taskCount)}</Tag>
                    <Tag>{t('costs.breakdown.failedCount')}: {integer.format(item.failedTaskCount)}</Tag>
                    <Tag>{t('costs.breakdown.totalTokens')}: {integer.format(item.totalTokens)}</Tag>
                  </Space>
                </Space>
              </div>
            );
          })}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('costs.breakdown.empty')} />
      )}
    </Card>
  );
};

const QuotaEventsCard = ({
  events,
  loading,
  error,
  locale,
  t
}: {
  events: QuotaEvent[];
  loading: boolean;
  error?: string | null;
  locale: string;
  t: ReturnType<typeof useT>;
}) => {
  const formatDateTime = useCallback(
    (value?: string | null) => {
      if (!value) return '-';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '-';
      return parsed.toLocaleString(locale);
    },
    [locale]
  );

  const resolveScopeText = useCallback(
    (event: QuotaEvent) => {
      const scopeType = event.scopeType ?? 'user';
      const scopeKey = ['user', 'repo', 'robot'].includes(scopeType) ? scopeType : 'unknown';
      return `${t(`costs.quotaEvents.scope.${scopeKey}` as const)}${event.scopeId ? ` · ${event.scopeId}` : ''}`;
    },
    [t]
  );

  return (
    <Card size="small" className="hc-card" title={t('costs.quotaEvents.title')}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : error ? (
        <Alert type="error" showIcon message={error} />
      ) : events.length ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {events.map((event) => (
            <div key={event.id} style={boxStyle}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <Space wrap>
                    <Tag color={getQuotaEventColor(event.eventType)}>{t(`costs.quotaEvents.eventType.${event.eventType}` as const)}</Tag>
                    <Tag color={getDecisionColor(event.decision)}>{t(`costs.quotaEvents.decision.${event.decision}` as const)}</Tag>
                    <Tag>{resolveScopeText(event)}</Tag>
                  </Space>
                  <Typography.Text type="secondary">{formatDateTime(event.createdAt)}</Typography.Text>
                </Space>
                <Typography.Text>{event.message}</Typography.Text>
                <Space size={8} wrap>
                  {event.taskId ? <Tag>{t('costs.quotaEvents.entity.task')} · {event.taskId}</Tag> : null}
                  {event.repoId ? <Tag>{t('costs.quotaEvents.entity.repo')} · {event.repoId}</Tag> : null}
                  {event.robotId ? <Tag>{t('costs.quotaEvents.entity.robot')} · {event.robotId}</Tag> : null}
                </Space>
              </Space>
            </div>
          ))}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('costs.quotaEvents.empty')} />
      )}
    </Card>
  );
};

const BudgetPolicyCard = ({
  mode,
  scopeType,
  scopeId,
  policy,
  loading,
  error,
  readOnly,
  onSaved
}: {
  mode: 'user' | 'repo';
  scopeType: BudgetScopeType;
  scopeId: string;
  policy: BudgetPolicy | null;
  loading: boolean;
  error?: string | null;
  readOnly?: boolean;
  onSaved: (policy: BudgetPolicy) => void;
}) => {
  const { message } = App.useApp();
  const t = useT();
  const locale = useLocale();
  const [form] = Form.useForm<BudgetPolicyFormValues>();
  const [saving, setSaving] = useState(false);
  const overageAction = Form.useWatch('overageAction', form);

  const formatDateTime = useCallback(
    (value?: string | null) => {
      if (!value) return '-';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '-';
      return parsed.toLocaleString(locale);
    },
    [locale]
  );

  useEffect(() => {
    form.setFieldsValue(buildBudgetFormValues(policy));
  }, [form, policy]);

  const providerOptions = useMemo(
    () => [
      { value: 'codex', label: t('panel.credentials.codexTitle') },
      { value: 'claude_code', label: t('panel.credentials.claudeCodeTitle') },
      { value: 'gemini_cli', label: t('panel.credentials.geminiCliTitle') }
    ],
    [t]
  );

  const saveBudget = useCallback(async () => {
    if (readOnly) return;
    const values = await form.validateFields();
    const payload: UpdateBudgetPolicyRequest = {
      scopeType,
      scopeId,
      name: policy?.name ?? null,
      enabled: values.enabled,
      overageAction: values.overageAction,
      dailyTaskCountLimit: normalizeOptionalNumber(values.dailyTaskCountLimit),
      monthlyTaskCountLimit: normalizeOptionalNumber(values.monthlyTaskCountLimit),
      dailyTokenLimit: normalizeOptionalNumber(values.dailyTokenLimit),
      monthlyTokenLimit: normalizeOptionalNumber(values.monthlyTokenLimit),
      dailyEstimatedCostUsdLimit: normalizeOptionalNumber(values.dailyEstimatedCostUsdLimit),
      monthlyEstimatedCostUsdLimit: normalizeOptionalNumber(values.monthlyEstimatedCostUsdLimit),
      maxRuntimeSeconds: normalizeOptionalNumber(values.maxRuntimeSeconds),
      maxStepCount: normalizeOptionalNumber(values.maxStepCount),
      degradeProvider: normalizeOptionalString(values.degradeProvider) as ModelProvider | null,
      degradeModel: normalizeOptionalString(values.degradeModel),
      forceReadOnlyOnOverage: values.forceReadOnlyOnOverage
    };

    setSaving(true);
    try {
      const result = await patchBudgetPolicy(payload);
      onSaved(result.policy);
      message.success(t('toast.budgets.saved'));
    } catch (err) {
      console.error(err);
      message.error(t('toast.budgets.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, message, onSaved, policy?.name, readOnly, scopeId, scopeType, t]);

  return (
    <Card
      size="small"
      className="hc-card"
      title={t(mode === 'user' ? 'costs.budget.title.user' : 'costs.budget.title.repo')}
      extra={policy?.updatedAt ? <Typography.Text type="secondary">{t('costs.budget.updatedAt', { time: formatDateTime(policy.updatedAt) })}</Typography.Text> : undefined}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : error ? (
        <Alert type="error" showIcon message={error} />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {!policy ? <Alert type="info" showIcon message={t('costs.budget.noPolicy')} /> : null}
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(mode === 'user' ? 'costs.budget.subtitle.user' : 'costs.budget.subtitle.repo')}
          </Typography.Paragraph>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={buildBudgetFormValues(policy)}
            disabled={readOnly || saving}
          >
            <div style={boxStyle}>
              <Typography.Text strong>{t('costs.budget.section.enforcement')}</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.enabled')} name="enabled" valuePropName="checked">
                    <Switch checkedChildren={t('common.enabled')} unCheckedChildren={t('common.disabled')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.overageAction')} name="overageAction">
                    <Select
                      options={[
                        { value: 'hard_limit', label: t('costs.budget.overageAction.hard_limit') },
                        { value: 'soft_limit', label: t('costs.budget.overageAction.soft_limit') },
                        { value: 'degrade', label: t('costs.budget.overageAction.degrade') },
                        { value: 'manual_approval', label: t('costs.budget.overageAction.manual_approval') }
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label={t('costs.budget.field.forceReadOnlyOnOverage')} name="forceReadOnlyOnOverage" valuePropName="checked">
                    <Switch checkedChildren={t('common.enabled')} unCheckedChildren={t('common.disabled')} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Divider />

            <div style={boxStyle}>
              <Typography.Text strong>{t('costs.budget.section.usage')}</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 12 }}>
                {t('costs.budget.help.blankMeansUnlimited')}
              </Typography.Paragraph>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.dailyTaskCountLimit')} name="dailyTaskCountLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.monthlyTaskCountLimit')} name="monthlyTaskCountLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.dailyTokenLimit')} name="dailyTokenLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.monthlyTokenLimit')} name="monthlyTokenLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.dailyEstimatedCostUsdLimit')} name="dailyEstimatedCostUsdLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.monthlyEstimatedCostUsdLimit')} name="monthlyEstimatedCostUsdLimit">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Divider />

            <div style={boxStyle}>
              <Typography.Text strong>{t('costs.budget.section.runtime')}</Typography.Text>
              <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.maxRuntimeSeconds')} name="maxRuntimeSeconds">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.maxStepCount')} name="maxStepCount">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder={t('costs.budget.placeholder.optionalNumber')} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Divider />

            <div style={boxStyle}>
              <Typography.Text strong>{t('costs.budget.section.degrade')}</Typography.Text>
              {overageAction === 'degrade' ? (
                <Alert type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }} message={t('costs.budget.help.degrade')} />
              ) : null}
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.degradeProvider')} name="degradeProvider">
                    <Select allowClear options={providerOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={t('costs.budget.field.degradeModel')} name="degradeModel">
                    <Input placeholder={t('costs.budget.placeholder.degradeModel')} />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </Form>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => void saveBudget()} loading={saving} disabled={readOnly}>
              {t('common.save')}
            </Button>
          </div>
        </Space>
      )}
    </Card>
  );
};

export const CostGovernanceDashboard = (props: CostGovernanceDashboardProps) => {
  const t = useT();
  const locale = useLocale();
  const currentUserId = props.mode === 'user' ? props.currentUserId : '';
  const isAdmin = props.mode === 'user' ? Boolean(props.isAdmin) : false;
  const repoId = props.mode === 'repo' ? props.repoId : '';
  const readOnly = props.mode === 'repo' ? Boolean(props.readOnly) : false;

  const [primarySummary, setPrimarySummary] = useState<CostSummaryResponse | null>(null);
  const [primarySummaryLoading, setPrimarySummaryLoading] = useState(false);
  const [primarySummaryError, setPrimarySummaryError] = useState<string | null>(null);

  const [secondaryBreakdown, setSecondaryBreakdown] = useState<CostBreakdownResponse | null>(null);
  const [secondaryBreakdownLoading, setSecondaryBreakdownLoading] = useState(false);
  const [secondaryBreakdownError, setSecondaryBreakdownError] = useState<string | null>(null);

  const [budgetPolicy, setBudgetPolicy] = useState<BudgetPolicy | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [adminSummary, setAdminSummary] = useState<CostSummaryResponse | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadUserDashboard = useCallback(async () => {
    setPrimarySummaryLoading(true);
    setSecondaryBreakdownLoading(true);
    setBudgetLoading(true);
    if (isAdmin) setAdminLoading(true);

    const [summaryResult, repoBreakdownResult, budgetResult, adminSummaryResult] = await Promise.allSettled([
      fetchCostSummary({ scope: 'me', days: WINDOW_DAYS }),
      fetchCostBreakdownByRepo({ scope: 'me', days: WINDOW_DAYS }),
      fetchBudgetPolicies({ scopeType: 'user', scopeId: currentUserId }),
      isAdmin ? fetchCostSummary({ scope: 'global', days: WINDOW_DAYS }) : Promise.resolve(null)
    ]);

    if (summaryResult.status === 'fulfilled') {
      setPrimarySummary(summaryResult.value);
      setPrimarySummaryError(null);
    } else {
      console.error(summaryResult.reason);
      setPrimarySummary(null);
      setPrimarySummaryError(t('costs.state.summaryLoadFailed'));
    }
    setPrimarySummaryLoading(false);

    if (repoBreakdownResult.status === 'fulfilled') {
      setSecondaryBreakdown(repoBreakdownResult.value);
      setSecondaryBreakdownError(null);
    } else {
      console.error(repoBreakdownResult.reason);
      setSecondaryBreakdown(null);
      setSecondaryBreakdownError(t('costs.state.breakdownLoadFailed'));
    }
    setSecondaryBreakdownLoading(false);

    if (budgetResult.status === 'fulfilled') {
      setBudgetPolicy(budgetResult.value.policies[0] ?? null);
      setBudgetError(null);
    } else {
      console.error(budgetResult.reason);
      setBudgetPolicy(null);
      setBudgetError(t('costs.state.budgetLoadFailed'));
    }
    setBudgetLoading(false);

    if (isAdmin) {
      if (adminSummaryResult.status === 'fulfilled') {
        setAdminSummary(adminSummaryResult.value);
        setAdminError(null);
      } else {
        console.error(adminSummaryResult.reason);
        setAdminSummary(null);
        setAdminError(t('costs.state.adminLoadFailed'));
      }
      setAdminLoading(false);
    } else {
      setAdminSummary(null);
      setAdminError(null);
      setAdminLoading(false);
    }
  }, [currentUserId, isAdmin, t]);

  const loadRepoDashboard = useCallback(async () => {
    setPrimarySummaryLoading(true);
    setSecondaryBreakdownLoading(true);
    setBudgetLoading(true);

    const [summaryResult, robotBreakdownResult, budgetResult] = await Promise.allSettled([
      fetchCostSummary({ scope: 'repo', repoId, days: WINDOW_DAYS }),
      fetchCostBreakdownByRobot({ scope: 'repo', repoId, days: WINDOW_DAYS }),
      fetchBudgetPolicies({ scopeType: 'repo', scopeId: repoId })
    ]);

    if (summaryResult.status === 'fulfilled') {
      setPrimarySummary(summaryResult.value);
      setPrimarySummaryError(null);
    } else {
      console.error(summaryResult.reason);
      setPrimarySummary(null);
      setPrimarySummaryError(t('costs.state.summaryLoadFailed'));
    }
    setPrimarySummaryLoading(false);

    if (robotBreakdownResult.status === 'fulfilled') {
      setSecondaryBreakdown(robotBreakdownResult.value);
      setSecondaryBreakdownError(null);
    } else {
      console.error(robotBreakdownResult.reason);
      setSecondaryBreakdown(null);
      setSecondaryBreakdownError(t('costs.state.breakdownLoadFailed'));
    }
    setSecondaryBreakdownLoading(false);

    if (budgetResult.status === 'fulfilled') {
      setBudgetPolicy(budgetResult.value.policies[0] ?? null);
      setBudgetError(null);
    } else {
      console.error(budgetResult.reason);
      setBudgetPolicy(null);
      setBudgetError(t('costs.state.budgetLoadFailed'));
    }
    setBudgetLoading(false);
  }, [repoId, t]);

  useEffect(() => {
    if (props.mode === 'user') {
      if (!currentUserId) {
        setPrimarySummary(null);
        setSecondaryBreakdown(null);
        setBudgetPolicy(null);
        setPrimarySummaryError(t('costs.state.noAccess'));
        setSecondaryBreakdownError(null);
        setBudgetError(t('costs.state.noAccess'));
        setPrimarySummaryLoading(false);
        setSecondaryBreakdownLoading(false);
        setBudgetLoading(false);
        setAdminLoading(false);
        return;
      }
      void loadUserDashboard();
      return;
    }

    if (!repoId) {
      setPrimarySummary(null);
      setSecondaryBreakdown(null);
      setBudgetPolicy(null);
      setPrimarySummaryError(t('costs.state.noAccess'));
      setSecondaryBreakdownError(null);
      setBudgetError(t('costs.state.noAccess'));
      setPrimarySummaryLoading(false);
      setSecondaryBreakdownLoading(false);
      setBudgetLoading(false);
      return;
    }
    void loadRepoDashboard();
  }, [currentUserId, loadRepoDashboard, loadUserDashboard, props.mode, props.reloadToken, repoId, t]);

  const windowLabel = useMemo(() => t('costs.window.lastDays', { days: WINDOW_DAYS }), [t]);

  if (props.mode === 'user') {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small" className="hc-card" title={t('panel.costs.personalTitle')} extra={<Typography.Text type="secondary">{windowLabel}</Typography.Text>}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('panel.costs.personalDesc')}
          </Typography.Paragraph>
          {primarySummaryLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : primarySummaryError ? (
            <Alert type="error" showIcon message={primarySummaryError} />
          ) : primarySummary ? (
            <SummaryMetrics summary={primarySummary.summary} locale={locale} t={t} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('costs.summary.empty')} />
          )}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <BreakdownCard
              title={t('costs.breakdown.providers')}
              subtitle={windowLabel}
              items={primarySummary?.providers ?? []}
              loading={primarySummaryLoading}
              error={primarySummaryError}
              t={t}
              locale={locale}
            />
          </Col>
          <Col xs={24} xl={12}>
            <BreakdownCard
              title={t('costs.breakdown.repositories')}
              subtitle={windowLabel}
              items={secondaryBreakdown?.items ?? []}
              loading={secondaryBreakdownLoading}
              error={secondaryBreakdownError}
              t={t}
              locale={locale}
            />
          </Col>
        </Row>

        <BudgetPolicyCard
          mode="user"
          scopeType="user"
          scopeId={currentUserId}
          policy={budgetPolicy}
          loading={budgetLoading}
          error={budgetError}
          onSaved={setBudgetPolicy}
        />

        {isAdmin ? (
          <>
            <Divider style={{ margin: '8px 0 0' }} />
            <Card size="small" className="hc-card" title={t('panel.costs.adminTitle')} extra={<Typography.Text type="secondary">{windowLabel}</Typography.Text>}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {t('panel.costs.adminDesc')}
              </Typography.Paragraph>
              {adminLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : adminError ? (
                <Alert type="error" showIcon message={adminError} />
              ) : adminSummary ? (
                <SummaryMetrics summary={adminSummary.summary} locale={locale} t={t} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('costs.summary.empty')} />
              )}
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={8}>
                <BreakdownCard
                  title={t('costs.breakdown.providers')}
                  subtitle={windowLabel}
                  items={adminSummary?.providers ?? []}
                  loading={adminLoading}
                  error={adminError}
                  t={t}
                  locale={locale}
                />
              </Col>
              <Col xs={24} xl={8}>
                <BreakdownCard
                  title={t('costs.breakdown.topRepos')}
                  subtitle={windowLabel}
                  items={adminSummary?.topRepos ?? []}
                  loading={adminLoading}
                  error={adminError}
                  t={t}
                  locale={locale}
                />
              </Col>
              <Col xs={24} xl={8}>
                <BreakdownCard
                  title={t('costs.breakdown.topUsers')}
                  subtitle={windowLabel}
                  items={adminSummary?.topUsers ?? []}
                  loading={adminLoading}
                  error={adminError}
                  t={t}
                  locale={locale}
                />
              </Col>
            </Row>
          </>
        ) : null}
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" className="hc-card" title={t('repos.costs.summaryTitle')} extra={<Typography.Text type="secondary">{windowLabel}</Typography.Text>}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t('repos.costs.summaryDesc')}
        </Typography.Paragraph>
        {primarySummaryLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : primarySummaryError ? (
          <Alert type="error" showIcon message={primarySummaryError} />
        ) : primarySummary ? (
          <SummaryMetrics summary={primarySummary.summary} locale={locale} t={t} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('costs.summary.empty')} />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <BreakdownCard
            title={t('repos.costs.robotRankingTitle')}
            subtitle={windowLabel}
            items={secondaryBreakdown?.items ?? []}
            loading={secondaryBreakdownLoading}
            error={secondaryBreakdownError}
            t={t}
            locale={locale}
          />
        </Col>
        <Col xs={24} xl={12}>
          <BreakdownCard
            title={t('costs.breakdown.providers')}
            subtitle={windowLabel}
            items={primarySummary?.providers ?? []}
            loading={primarySummaryLoading}
            error={primarySummaryError}
            t={t}
            locale={locale}
          />
        </Col>
      </Row>

      <BudgetPolicyCard
        mode="repo"
        scopeType="repo"
        scopeId={repoId}
        policy={budgetPolicy}
        loading={budgetLoading}
        error={budgetError}
        readOnly={readOnly}
        onSaved={setBudgetPolicy}
      />

      <QuotaEventsCard
        events={primarySummary?.recentQuotaEvents ?? []}
        loading={primarySummaryLoading}
        error={primarySummaryError}
        locale={locale}
        t={t}
      />
    </Space>
  );
};
