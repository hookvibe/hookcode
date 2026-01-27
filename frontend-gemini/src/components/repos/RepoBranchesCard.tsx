import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Radio, Space, Typography, message } from '@/ui';
import type { Repository, RepositoryBranch } from '../../api';
import { updateRepo } from '../../api';
import { useT } from '../../i18n';
import { ScrollableTable } from '../ScrollableTable';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * RepoBranchesCard:
 * - Business context: maintain a curated list of repository branches (used by automation + robot defaults).
 * - Module: RepoDetail -> Branches tab.
 *
 * Notes:
 * - The backend stores `branches` as an array with `isDefault` guard; this UI enforces exactly one default when non-empty.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to support `frontend-chat` RepoDetail migration.
 */

type BranchDraft = {
  id: string;
  name: string;
  note: string;
  isDefault: boolean;
};

const uuid = (): string => `b_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

const toDrafts = (branches: RepositoryBranch[] | undefined | null): BranchDraft[] => {
  if (!Array.isArray(branches)) return [];
  return branches.map((b) => ({
    id: uuid(),
    name: String(b?.name ?? ''),
    note: String(b?.note ?? ''),
    isDefault: Boolean(b?.isDefault)
  }));
};

export interface RepoBranchesCardProps {
  repo: Repository;
  onSaved: (repo: Repository) => void;
  readOnly?: boolean;
  variant?: 'card' | 'plain';
  actionsPlacement?: 'header' | 'footer';
}

export const RepoBranchesCard: FC<RepoBranchesCardProps> = ({
  repo,
  onSaved,
  readOnly = false,
  variant = 'card',
  actionsPlacement = 'header'
}) => {
  const t = useT();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<BranchDraft[]>([]);

  useEffect(() => {
    setDrafts(toDrafts(repo.branches));
  }, [repo.branches, repo.id]);

  const normalized = useMemo(() => drafts.map((d) => ({ ...d, name: d.name.trim(), note: d.note.trim() })), [drafts]);

  const setDefault = useCallback(
    (id: string) => {
      if (readOnly) return;
      setDrafts((prev) => prev.map((b) => ({ ...b, isDefault: b.id === id })));
    },
    [readOnly]
  );

  const updateDraft = useCallback(
    (id: string, patch: Partial<Pick<BranchDraft, 'name' | 'note'>>) => {
      if (readOnly) return;
      setDrafts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [readOnly]
  );

  const addBranch = useCallback(() => {
    if (readOnly) return;
    setDrafts((prev) => {
      const next = [...prev, { id: uuid(), name: '', note: '', isDefault: prev.length === 0 }];
      return next;
    });
  }, [readOnly]);

  const removeBranch = useCallback(
    (id: string) => {
      if (readOnly) return;
      setDrafts((prev) => {
        const next = prev.filter((b) => b.id !== id);
        const hasDefault = next.some((b) => b.isDefault);
        if (!hasDefault && next.length) {
          next[0] = { ...next[0], isDefault: true };
        }
        return next;
      });
    },
    [readOnly]
  );

  const save = useCallback(async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const branches: RepositoryBranch[] = [];
      const seen = new Set<string>();
      for (const b of normalized) {
        if (!b.name) {
          messageApi.error(t('repos.branches.validation.nameRequired'));
          return;
        }
        if (seen.has(b.name)) {
          messageApi.error(t('repos.branches.validation.duplicate', { name: b.name }));
          return;
        }
        seen.add(b.name);
        branches.push({ name: b.name, note: b.note || undefined, isDefault: b.isDefault });
      }

      if (branches.length && !branches.some((b) => b.isDefault)) {
        messageApi.error(t('repos.branches.validation.defaultRequired'));
        return;
      }

      const resp = await updateRepo(repo.id, { branches });
      onSaved(resp.repo);
      messageApi.success(t('toast.repos.saved'));
    } catch (err: any) {
      console.error(err);
      messageApi.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [messageApi, normalized, onSaved, readOnly, repo.id, t]);

  const actions = readOnly ? null : (
    <Space size={8} wrap>
      <Button onClick={addBranch}>{t('repos.branches.add')}</Button>
      <Button type="primary" loading={saving} onClick={save}>
        {t('repos.branches.save')}
      </Button>
    </Space>
  );

  const body = (
    <>
      {messageContextHolder}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t('repos.branches.tip')}
      </Typography.Paragraph>

      <ScrollableTable<BranchDraft>
        wrapperClassName="table-wrapper--branches"
        rowKey="id"
        dataSource={drafts}
        pagination={false}
        columns={[
          {
            title: t('repos.branches.column.default'),
            dataIndex: 'isDefault',
            width: 90,
            render: (_: any, r: BranchDraft) => <Radio checked={r.isDefault} disabled={readOnly} onChange={() => setDefault(r.id)} />
          },
          {
            title: t('repos.branches.column.name'),
            dataIndex: 'name',
            render: (_: any, r: BranchDraft) => (
              <Input value={r.name} disabled={readOnly} onChange={(e) => updateDraft(r.id, { name: e.target.value })} placeholder="main" />
            )
          },
          {
            title: t('repos.branches.column.note'),
            dataIndex: 'note',
            render: (_: any, r: BranchDraft) => (
              <Input
                value={r.note}
                disabled={readOnly}
                onChange={(e) => updateDraft(r.id, { note: e.target.value })}
                placeholder={t('repos.branches.placeholder.note')}
              />
            )
          },
          {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
            render: (_: any, r: BranchDraft) => (
              <Button danger size="small" disabled={readOnly} onClick={() => removeBranch(r.id)}>
                {t('common.delete')}
              </Button>
            )
          }
        ]}
      />

      {actionsPlacement === 'footer' && actions ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>{actions}</div> : null}
    </>
  );

  if (variant === 'plain') {
    return body;
  }

  return (
    <Card size="small" title={t('repos.branches.title')} extra={actionsPlacement === 'header' ? actions : null} className="hc-card">
      {body}
    </Card>
  );
};
