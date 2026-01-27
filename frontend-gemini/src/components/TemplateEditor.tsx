import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { Button, Input, Space, Tag, Typography } from '@/ui';
import { useT } from '../i18n';
import { ResponsiveDialog } from './dialogs/ResponsiveDialog';
import type { TemplateVariableGroup } from './templateEditorVariables';
import { TEMPLATE_VARIABLE_GROUPS_ALL } from './templateEditorVariables';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * TemplateEditor:
 * - Business context: editing prompt templates used by robots and automation rules.
 * - Purpose: provide a basic textarea with an "insert variable" picker.
 *
 * Notes:
 * - This component does NOT validate template correctness; validation happens server-side during task execution.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to support RepoDetail robot + automation editors.
 */

interface Props {
  value?: string;
  onChange?: (next: string) => void;
  rows?: number;
  placeholder?: string;
  variables?: TemplateVariableGroup[];
  extraHint?: string;
}

export const TemplateEditor: FC<Props> = ({
  value,
  onChange,
  rows = 8,
  placeholder,
  variables = TEMPLATE_VARIABLE_GROUPS_ALL,
  extraHint
}) => {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const captureSelection = useCallback(() => {
    const current = value ?? '';
    const el = textareaRef.current;
    if (!el) {
      selectionRef.current = null;
      return;
    }
    selectionRef.current = {
      start: el.selectionStart ?? current.length,
      end: el.selectionEnd ?? current.length
    };
  }, [value]);

  const openPicker = useCallback(() => {
    captureSelection();
    setSearch('');
    setPickerOpen(true);
  }, [captureSelection]);

  const insertVariable = useCallback(
    (path: string, opts?: { close?: boolean }) => {
      const token = `{{${path}}}`;
      const current = value ?? '';
      const el = textareaRef.current;
      const start = selectionRef.current?.start ?? el?.selectionStart ?? current.length;
      const end = selectionRef.current?.end ?? el?.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      onChange?.(next);

      requestAnimationFrame(() => {
        try {
          const target = textareaRef.current;
          if (!target) return;
          target.focus();
          const pos = start + token.length;
          target.setSelectionRange(pos, pos);
          selectionRef.current = { start: pos, end: pos };
        } catch {
          // ignore
        }
      });

      if (opts?.close) {
        setPickerOpen(false);
      }
    },
    [onChange, value]
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables
      .map((g) => ({
        ...g,
        options: g.options.filter((v) => {
          const label = String(v.label ?? '').toLowerCase();
          const path = String(v.path ?? '').toLowerCase();
          return label.includes(q) || path.includes(q);
        })
      }))
      .filter((g) => g.options.length > 0);
  }, [search, variables]);

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Input.TextArea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      <Space wrap size={8} align="center">
        <Button
          size="small"
          onMouseDown={(e) => {
            // Preserve the textarea selection; prevent click from stealing focus/selection.
            e.preventDefault();
            captureSelection();
          }}
          onClick={openPicker}
        >
          {t('templateEditor.insertButton')}
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('templateEditor.openHint')}
          {extraHint ? t('templateEditor.hint.extra', { extraHint }) : ''}
        </Typography.Text>
      </Space>

      <ResponsiveDialog
        variant="large"
        open={pickerOpen}
        title={t('templateEditor.modalTitle')}
        onCancel={() => setPickerOpen(false)}
        footer={null}
        drawerWidth="min(820px, 92vw)"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} allowClear placeholder={t('templateEditor.searchPlaceholder')} />

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('templateEditor.hint.base')}
            {extraHint ? t('templateEditor.hint.extra', { extraHint }) : ''}
          </Typography.Text>

          {filteredGroups.length === 0 ? (
            <Typography.Text type="secondary">{t('templateEditor.noResults')}</Typography.Text>
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {filteredGroups.map((group) => (
                <div key={group.labelKey}>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    {t(group.labelKey)}
                  </Typography.Text>
                  <div style={{ marginTop: 6 }}>
                    <Space wrap size={[8, 8]}>
                      {group.options.map((v) => (
                        <Tag
                          key={`${group.labelKey}:${v.path}`}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onMouseDown={(e) => {
                            // Prevent focus flicker on click; insertion position depends on `selectionRef`.
                            e.preventDefault();
                          }}
                          onClick={() => insertVariable(v.path, { close: true })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              insertVariable(v.path, { close: true });
                            }
                          }}
                          title={v.description || v.label}
                        >
                          {v.label}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              ))}
            </Space>
          )}
        </Space>
      </ResponsiveDialog>
    </Space>
  );
};
