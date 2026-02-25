import { FC, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Input, Radio, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { SkillSelectionKey, SkillSelectionState, SkillSummary } from '../../api';
import { useT } from '../../i18n';
import { buildSkillSelectionKey, filterSkillsByQueryAndTags } from '../../utils/skills';

type SkillSelectionScope = 'repo' | 'task_group';

export interface SkillSelectionPanelProps {
  scope: SkillSelectionScope;
  skills: SkillSummary[];
  selection: SkillSelectionState | null;
  loading?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onChange: (nextSelection: SkillSelectionKey[] | null) => void;
  onRefresh?: () => void;
}

export const SkillSelectionPanel: FC<SkillSelectionPanelProps> = ({
  scope,
  skills,
  selection,
  loading = false,
  saving = false,
  disabled = false,
  onChange,
  onRefresh
}) => {
  const t = useT();
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const isCustom = selection?.selection !== null && selection !== null;
  const effectiveSelection = selection?.effective ?? [];
  const resolvedSelection = isCustom ? selection?.selection ?? [] : effectiveSelection;
  const resolvedSelectionSet = useMemo(
    () => new Set(resolvedSelection),
    [resolvedSelection]
  );
  const allKeys = useMemo(() => skills.map(buildSkillSelectionKey), [skills]);
  const isBusy = disabled || loading || saving || !selection;

  const tagOptions = useMemo(() => {
    // Collect tag options for skill filtering in the selection panel. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const map = new Map<string, string>();
    skills.forEach((skill) => {
      (skill.tags ?? []).forEach((tag) => {
        const key = tag.toLowerCase();
        if (!map.has(key)) map.set(key, tag);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const filteredBuiltIn = useMemo(
    () =>
      filterSkillsByQueryAndTags(
        skills.filter((skill) => skill.source === 'built_in'),
        query,
        activeTags
      ),
    [skills, query, activeTags]
  );

  const filteredExtra = useMemo(
    () =>
      filterSkillsByQueryAndTags(
        skills.filter((skill) => skill.source === 'extra'),
        query,
        activeTags
      ),
    [skills, query, activeTags]
  );

  const handleModeChange = (nextMode: 'default' | 'custom') => {
    // Switch between default inheritance and custom skill selection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    if (nextMode === 'default') {
      onChange(null);
      return;
    }
    if (selection?.selection !== null) return;
    onChange(effectiveSelection);
  };

  const toggleTag = (tag: string) => {
    // Toggle active tag filters for the skill selection list. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const clearTags = () => setActiveTags([]);

  const toggleSkill = (skill: SkillSummary, nextChecked: boolean) => {
    // Update selection keys, promoting default mode into custom when a toggle is used. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const base = selection?.selection ?? effectiveSelection;
    const next = new Set(base);
    const key = buildSkillSelectionKey(skill);
    if (nextChecked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    onChange(Array.from(next));
  };

  const selectAll = () => onChange(allKeys);
  const clearAll = () => onChange([]);

  const defaultLabel = scope === 'repo' ? t('skills.selection.mode.all') : t('skills.selection.mode.repoDefault');
  const defaultHint =
    scope === 'repo'
      ? t('skills.selection.mode.allHint')
      : selection?.mode === 'repo_default'
        ? t('skills.selection.mode.repoDefaultHint')
        : t('skills.selection.mode.allHint');

  const selectionSummary = t('skills.selection.summary', { count: selection?.effective.length ?? 0 });

  return (
    <section className="hc-skill-select">
      {/* Present scope-aware skill selection controls for repo/task-group overrides. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
      <div className="hc-skill-select__header">
        <div className="hc-skill-select__header-text">
          <Typography.Title level={5} className="hc-skill-select__title">
            {scope === 'repo' ? t('skills.selection.repo.title') : t('skills.selection.taskGroup.title')}
          </Typography.Title>
          <Typography.Text type="secondary" className="hc-skill-select__desc">
            {scope === 'repo' ? t('skills.selection.repo.desc') : t('skills.selection.taskGroup.desc')}
          </Typography.Text>
        </div>
        {onRefresh ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} disabled={loading || saving}>
            {t('common.refresh')}
          </Button>
        ) : null}
      </div>

      <div className="hc-skill-select__mode">
        <Radio.Group
          value={isCustom ? 'custom' : 'default'}
          onChange={(event) => handleModeChange(event.target.value)}
          optionType="button"
          buttonStyle="solid"
          disabled={isBusy}
          className="hc-skill-select__mode-toggle"
        >
          <Radio.Button value="default">{defaultLabel}</Radio.Button>
          <Radio.Button value="custom">{t('skills.selection.mode.custom')}</Radio.Button>
        </Radio.Group>
        <Typography.Text type="secondary" className="hc-skill-select__mode-hint">
          {isCustom ? t('skills.selection.mode.customHint') : defaultHint}
        </Typography.Text>
      </div>

      <div className="hc-skill-select__summary">
        <Tag className="hc-skill-select__summary-tag" color="blue">
          {selectionSummary}
        </Tag>
        {isCustom ? <Tag className="hc-skill-select__summary-tag">{t('skills.selection.mode.custom')}</Tag> : null}
        {!isCustom ? <Tag className="hc-skill-select__summary-tag">{defaultLabel}</Tag> : null}
      </div>

      <div className="hc-skill-select__toolbar">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('skills.selection.search')}
          prefix={<SearchOutlined />}
          allowClear
          disabled={isBusy}
          className="hc-skill-select__search"
        />
        {isCustom ? (
          <div className="hc-skill-select__toolbar-actions">
            <Button size="small" onClick={selectAll} disabled={isBusy || !skills.length}>
              {t('skills.selection.action.selectAll')}
            </Button>
            <Button size="small" onClick={clearAll} disabled={isBusy || !skills.length}>
              {t('skills.selection.action.clearAll')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="hc-skill-select__tags">
        <div className="hc-skill-select__tags-label">{t('skills.tags.filterLabel')}</div>
        <div className="hc-skill-select__tags-list">
          {tagOptions.length ? (
            tagOptions.map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`hc-skill-select__tag ${active ? 'is-active' : ''}`}
                  onClick={() => toggleTag(tag)}
                  disabled={isBusy}
                  aria-pressed={active}
                >
                  {tag}
                </button>
              );
            })
          ) : (
            <Typography.Text type="secondary" className="hc-skill-select__tags-empty">
              {t('skills.tags.emptyFilter')}
            </Typography.Text>
          )}
        </div>
        {activeTags.length ? (
          <button type="button" className="hc-skill-select__tags-clear" onClick={clearTags} disabled={isBusy}>
            {t('skills.tags.clear')}
          </button>
        ) : null}
      </div>

      <div className="hc-skill-select__list">
        {skills.length ? (
          <>
            <div className="hc-skill-select__section">
              <div className="hc-skill-select__section-header">
                <Typography.Text strong>{t('skills.section.builtIn')}</Typography.Text>
                <Typography.Text type="secondary">{filteredBuiltIn.length}</Typography.Text>
              </div>
              <div className="hc-skill-select__grid">
                {filteredBuiltIn.length ? (
                  filteredBuiltIn.map((skill) => {
                    const key = buildSkillSelectionKey(skill);
                    const checked = resolvedSelectionSet.has(key);
                    return (
                      <Checkbox
                        key={skill.id}
                        checked={checked}
                        onChange={(event) => toggleSkill(skill, event.target.checked)}
                        disabled={isBusy}
                        className="hc-skill-select__card"
                      >
                        <div className="hc-skill-select__card-body">
                          <div className="hc-skill-select__card-header">
                            <div className="hc-skill-select__card-title">
                              <Typography.Text className="hc-skill-select__card-name">{skill.name}</Typography.Text>
                              <Typography.Text type="secondary" className="hc-skill-select__card-slug">
                                {skill.slug}
                              </Typography.Text>
                            </div>
                            <div className="hc-skill-select__card-meta">
                              <Tag className="hc-skill-select__card-tag" color="blue">
                                {t('skills.source.builtIn')}
                              </Tag>
                              {skill.version ? (
                                <Tag className="hc-skill-select__card-tag">v{skill.version}</Tag>
                              ) : null}
                            </div>
                          </div>
                          <Typography.Paragraph className="hc-skill-select__card-desc">
                            {skill.description || t('skills.description.empty')}
                          </Typography.Paragraph>
                          {skill.tags.length ? (
                            <div className="hc-skill-select__card-tags">
                              {skill.tags.map((tag) => (
                                <Tag key={`${skill.id}-${tag}`} className="hc-skill-select__card-tag">
                                  {tag}
                                </Tag>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </Checkbox>
                    );
                  })
                ) : (
                  <Empty description={t('skills.section.emptyBuiltIn')} className="hc-skill-select__empty" />
                )}
              </div>
            </div>

            <div className="hc-skill-select__section">
              <div className="hc-skill-select__section-header">
                <Typography.Text strong>{t('skills.section.extra')}</Typography.Text>
                <Typography.Text type="secondary">{filteredExtra.length}</Typography.Text>
              </div>
              <div className="hc-skill-select__grid">
                {filteredExtra.length ? (
                  filteredExtra.map((skill) => {
                    const key = buildSkillSelectionKey(skill);
                    const checked = resolvedSelectionSet.has(key);
                    const disabledSkill = !skill.enabled;
                    return (
                      <Checkbox
                        key={skill.id}
                        checked={checked}
                        onChange={(event) => toggleSkill(skill, event.target.checked)}
                        disabled={isBusy || disabledSkill}
                        className={`hc-skill-select__card${disabledSkill ? ' is-disabled' : ''}`}
                      >
                        <div className="hc-skill-select__card-body">
                          <div className="hc-skill-select__card-header">
                            <div className="hc-skill-select__card-title">
                              <Typography.Text className="hc-skill-select__card-name">{skill.name}</Typography.Text>
                              <Typography.Text type="secondary" className="hc-skill-select__card-slug">
                                {skill.slug}
                              </Typography.Text>
                            </div>
                            <div className="hc-skill-select__card-meta">
                              <Tag className="hc-skill-select__card-tag" color="gold">
                                {t('skills.source.extra')}
                              </Tag>
                              {skill.version ? (
                                <Tag className="hc-skill-select__card-tag">v{skill.version}</Tag>
                              ) : null}
                              {!skill.enabled ? (
                                <Tag className="hc-skill-select__card-tag" color="red">
                                  {t('skills.selection.disabled')}
                                </Tag>
                              ) : null}
                            </div>
                          </div>
                          <Typography.Paragraph className="hc-skill-select__card-desc">
                            {skill.description || t('skills.description.empty')}
                          </Typography.Paragraph>
                          {skill.tags.length ? (
                            <div className="hc-skill-select__card-tags">
                              {skill.tags.map((tag) => (
                                <Tag key={`${skill.id}-${tag}`} className="hc-skill-select__card-tag">
                                  {tag}
                                </Tag>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </Checkbox>
                    );
                  })
                ) : (
                  <Empty description={t('skills.section.emptyExtra')} className="hc-skill-select__empty" />
                )}
              </div>
            </div>
          </>
        ) : (
          <Empty description={t('skills.selection.empty')} className="hc-skill-select__empty" />
        )}
      </div>
    </section>
  );
};
