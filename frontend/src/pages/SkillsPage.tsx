import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App, Button, Empty, Input, Modal, Switch, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import type { SkillSummary } from '../api';
import { fetchSkills, patchSkill, uploadExtraSkill } from '../api';
import { useT } from '../i18n';
import { PageNav, type PageNavMenuAction } from '../components/nav/PageNav';
import { filterSkillsByQueryAndTags } from '../utils/skills';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export interface SkillsPageProps {
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

const SKILLS_PAGE_SIZE = 24; // Keep skill registry pages small for infinite scroll. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b

const isPromptAvailable = (skill: SkillSummary): boolean =>
  // Determine when prompt text can be toggled for a skill. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  Boolean(skill.promptText && skill.promptText.trim());

const normalizeTagList = (raw: string): string[] =>
  // Normalize tag editor input into a clean array. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((value, idx, arr) => arr.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === idx);

const SkillCard: FC<{
  skill: SkillSummary;
  isExtra: boolean;
  expanded: boolean;
  updating: boolean;
  onToggleExpand: (id: string) => void;
  onToggleEnabled?: (skill: SkillSummary, next: boolean) => void;
  onTogglePrompt?: (skill: SkillSummary, next: boolean) => void;
  onUpdateTags?: (skill: SkillSummary, next: string[]) => void;
}> = ({ // Render the Skills page card UI and toggles. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  skill,
  isExtra,
  expanded,
  updating,
  onToggleExpand,
  onToggleEnabled,
  onTogglePrompt,
  onUpdateTags
}) => {
  const t = useT();
  const hasPrompt = isPromptAvailable(skill);
  const promptStatus = skill.promptEnabled ? t('skills.status.promptOn') : t('skills.status.promptOff');
  const toggleLabel = skill.enabled ? t('common.enabled') : t('common.disabled');
  // Map skill metadata to neutral tag styles aligned with the console theme. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const sourceTagClass = skill.source === 'built_in' ? 'hc-skills__tag--built-in' : 'hc-skills__tag--extra';
  const enabledTagClass = skill.enabled ? 'hc-skills__tag--enabled' : 'hc-skills__tag--disabled';
  const promptTagClass = skill.promptEnabled ? 'hc-skills__tag--prompt-on' : 'hc-skills__tag--prompt-off';
  const [tagDraft, setTagDraft] = useState(skill.tags.join(', '));

  useEffect(() => {
    // Keep local tag draft aligned with server updates. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setTagDraft(skill.tags.join(', '));
  }, [skill.tags.join('|')]);

  const saveTags = () => {
    // Persist tag changes for extra skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const normalized = normalizeTagList(tagDraft);
    const current = skill.tags.map((tag) => tag.toLowerCase());
    const next = normalized.map((tag) => tag.toLowerCase());
    const unchanged = current.length === next.length && current.every((tag) => next.includes(tag));
    if (unchanged) return;
    onUpdateTags?.(skill, normalized);
  };

  return (
    <article className="hc-skills__card">
      {/* Render skill metadata with a marketplace-style header layout. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
      <div className="hc-skills__card-header">
        <div className="hc-skills__card-title">
          <Typography.Text className="hc-skills__card-name">{skill.name}</Typography.Text>
          <Typography.Text type="secondary" className="hc-skills__card-slug">
            {skill.slug}
          </Typography.Text>
        </div>
        <div className="hc-skills__card-actions">
          <button
            type="button"
            className="hc-skills__prompt-toggle"
            onClick={() => onToggleExpand(skill.id)}
            aria-expanded={expanded}
          >
            {expanded ? t('skills.prompt.hide') : t('skills.prompt.show')}
          </button>
        </div>
      </div>

      <div className="hc-skills__card-meta">
        <Tag className={`hc-skills__tag ${sourceTagClass}`}>
          {skill.source === 'built_in' ? t('skills.source.builtIn') : t('skills.source.extra')}
        </Tag>
        {skill.version ? (
          <Tag className="hc-skills__tag hc-skills__tag--version">
            v{skill.version}
          </Tag>
        ) : null}
        <Tag className={`hc-skills__tag ${enabledTagClass}`}>
          {toggleLabel}
        </Tag>
        <Tag className={`hc-skills__tag ${promptTagClass}`}>
          {promptStatus}
        </Tag>
      </div>

      <Typography.Paragraph className="hc-skills__card-desc">
        {skill.description || t('skills.description.empty')}
      </Typography.Paragraph>

      {/* Show skill tags to support visual filtering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
      <div className="hc-skills__tag-row">
        <span className="hc-skills__tag-label">{t('skills.tags.label')}</span>
        {skill.tags.length ? (
          <div className="hc-skills__tag-list">
            {skill.tags.map((tag) => (
              <Tag key={`${skill.id}-${tag}`} className="hc-skills__tag-chip">
                {tag}
              </Tag>
            ))}
          </div>
        ) : (
          <span className="hc-skills__tag-empty">{t('skills.tags.empty')}</span>
        )}
      </div>

      <div className="hc-skills__toggles">
        {isExtra ? (
          <div className="hc-skills__toggle">
            <span className="hc-skills__toggle-label">{t('skills.toggle.enabled')}</span>
            <Switch
              checked={skill.enabled}
              onChange={(next) => onToggleEnabled?.(skill, next)}
              disabled={updating}
              checkedChildren={t('common.enabled')}
              unCheckedChildren={t('common.disabled')}
            />
          </div>
        ) : (
          <div className="hc-skills__toggle hc-skills__toggle--readonly">
            <span className="hc-skills__toggle-label">{t('skills.toggle.enabled')}</span>
            <span className="hc-skills__toggle-readonly">{toggleLabel}</span>
          </div>
        )}

        {isExtra ? (
          <div className="hc-skills__toggle">
            <span className="hc-skills__toggle-label">{t('skills.toggle.prompt')}</span>
            <Switch
              checked={skill.promptEnabled}
              onChange={(next) => onTogglePrompt?.(skill, next)}
              disabled={updating || !hasPrompt}
              checkedChildren={t('skills.status.promptOn')}
              unCheckedChildren={t('skills.status.promptOff')}
            />
          </div>
        ) : (
          <div className="hc-skills__toggle hc-skills__toggle--readonly">
            <span className="hc-skills__toggle-label">{t('skills.toggle.prompt')}</span>
            <span className="hc-skills__toggle-readonly">{promptStatus}</span>
          </div>
        )}
      </div>

      {expanded ? (
        <div className="hc-skills__prompt-block">
          <Typography.Text className="hc-skills__prompt-title">{t('skills.prompt.title')}</Typography.Text>
          {hasPrompt ? (
            <pre className="hc-skills__prompt-text">{skill.promptText}</pre>
          ) : (
            <Typography.Text className="hc-skills__prompt-empty">{t('skills.prompt.empty')}</Typography.Text>
          )}
          {isExtra ? (
            /* Allow extra-skill tag updates inside the expanded panel. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */
            <div className="hc-skills__tag-editor">
              <Typography.Text className="hc-skills__prompt-title">{t('skills.tags.manage')}</Typography.Text>
              <Input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder={t('skills.tags.placeholder')}
                disabled={updating}
                className="hc-skills__tag-input"
              />
              <Button
                type="default"
                onClick={saveTags}
                disabled={updating}
                className="hc-skills__tag-save"
              >
                {t('skills.tags.save')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export const SkillsPage: FC<SkillsPageProps> = ({ userPanel, navToggle }) => {
  const t = useT();
  const { message } = App.useApp();

  const builtInLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const extraLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreBuiltIn, setLoadingMoreBuiltIn] = useState(false);
  const [loadingMoreExtra, setLoadingMoreExtra] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [builtInSkills, setBuiltInSkills] = useState<SkillSummary[]>([]);
  const [extraSkills, setExtraSkills] = useState<SkillSummary[]>([]);
  const [builtInNextCursor, setBuiltInNextCursor] = useState<string | null>(null); // Track cursor for built-in skill pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [extraNextCursor, setExtraNextCursor] = useState<string | null>(null); // Track cursor for extra skill pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    // Load skills registry data for the dedicated console page. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setLoading(true);
    try {
      // Fetch the first paginated slice for built-in/extra skills. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      const [builtInPage, extraPage] = await Promise.all([
        fetchSkills({ source: 'built_in', limit: SKILLS_PAGE_SIZE }),
        fetchSkills({ source: 'extra', limit: SKILLS_PAGE_SIZE })
      ]);
      setBuiltInSkills(builtInPage.builtIn);
      setExtraSkills(extraPage.extra);
      setBuiltInNextCursor(builtInPage.builtInNextCursor ?? null);
      setExtraNextCursor(extraPage.extraNextCursor ?? null);
    } catch (err) {
      console.error(err);
      message.error(t('skills.toast.fetchFailed'));
      setBuiltInSkills([]);
      setExtraSkills([]);
      setBuiltInNextCursor(null);
      setExtraNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMoreBuiltIn = useCallback(async () => {
    // Append additional built-in skills when the list bottom is reached. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    if (!builtInNextCursor || loading || loadingMoreBuiltIn) return;
    setLoadingMoreBuiltIn(true);
    try {
      const page = await fetchSkills({ source: 'built_in', limit: SKILLS_PAGE_SIZE, cursor: builtInNextCursor });
      setBuiltInSkills((prev) => {
        const existing = new Set(prev.map((skill) => skill.id));
        return [...prev, ...page.builtIn.filter((skill) => !existing.has(skill.id))];
      });
      setBuiltInNextCursor(page.builtInNextCursor ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreBuiltIn(false);
    }
  }, [builtInNextCursor, loading, loadingMoreBuiltIn]);

  const loadMoreExtra = useCallback(async () => {
    // Append additional extra skills when the list bottom is reached. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    if (!extraNextCursor || loading || loadingMoreExtra) return;
    setLoadingMoreExtra(true);
    try {
      const page = await fetchSkills({ source: 'extra', limit: SKILLS_PAGE_SIZE, cursor: extraNextCursor });
      setExtraSkills((prev) => {
        const existing = new Set(prev.map((skill) => skill.id));
        return [...prev, ...page.extra.filter((skill) => !existing.has(skill.id))];
      });
      setExtraNextCursor(page.extraNextCursor ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreExtra(false);
    }
  }, [extraNextCursor, loading, loadingMoreExtra]);

  // Trigger built-in skill pagination when the sentinel enters view. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: builtInLoadMoreRef,
    enabled: Boolean(builtInNextCursor) && !loading && !loadingMoreBuiltIn,
    onLoadMore: () => void loadMoreBuiltIn()
  });

  // Trigger extra skill pagination when the sentinel enters view. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: extraLoadMoreRef,
    enabled: Boolean(extraNextCursor) && !loading && !loadingMoreExtra,
    onLoadMore: () => void loadMoreExtra()
  });

  const tagStats = useMemo(() => {
    // Derive tag counts for category-style browsing and filtering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const map = new Map<string, { label: string; count: number }>();
    [...builtInSkills, ...extraSkills].forEach((skill) => {
      (skill.tags ?? []).forEach((tag) => {
        const key = tag.toLowerCase();
        const current = map.get(key);
        if (current) {
          current.count += 1;
        } else {
          map.set(key, { label: tag, count: 1 });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [builtInSkills, extraSkills]);
  const topTags = tagStats.slice(0, 6); // Surface top categories inside the hero terminal. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

  // Apply shared tag + search filtering for the marketplace sections. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const filteredBuiltIn = useMemo(
    () => filterSkillsByQueryAndTags(builtInSkills, search, activeTags),
    [builtInSkills, search, activeTags]
  );
  const filteredExtra = useMemo(
    () => filterSkillsByQueryAndTags(extraSkills, search, activeTags),
    [extraSkills, search, activeTags]
  );

  const toggleExpand = useCallback((id: string) => {
    // Track prompt text expansion state per skill card. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setUpdating = useCallback((id: string, value: boolean) => {
    // Track per-skill update spinners while PATCH requests are inflight. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setUpdatingIds((prev) => ({ ...prev, [id]: value }));
  }, []);

  const updateSkill = useCallback(
    async (skill: SkillSummary, patch: { enabled?: boolean; promptEnabled?: boolean; tags?: string[] }) => {
      // Patch extra skill toggles without requiring a full refresh. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      setUpdating(skill.id, true);
      try {
        const updated = await patchSkill(skill.id, patch);
        setExtraSkills((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch (err) {
        console.error(err);
        message.error(t('skills.toast.updateFailed'));
      } finally {
        setUpdating(skill.id, false);
      }
    },
    [message, setUpdating, t]
  );

  const toggleTag = useCallback((tag: string) => {
    // Toggle tag filters for quick skill discovery. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }, []);

  const clearTags = useCallback(() => {
    setActiveTags([]);
  }, []);

  const resetUpload = useCallback(() => {
    // Reset upload modal state after success or cancel. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setUploadOpen(false);
    setUploadFile(null);
  }, []);

  const submitUpload = useCallback(async () => {
    // Upload extra skill archives and refresh the registry on success. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const file = uploadFile?.originFileObj;
    if (!file) {
      message.error(t('skills.upload.missing'));
      return;
    }
    setUploading(true);
    try {
      await uploadExtraSkill(file as File);
      message.success(t('skills.upload.success'));
      resetUpload();
      await refresh();
    } catch (err) {
      console.error(err);
      message.error(t('skills.upload.failed'));
    } finally {
      setUploading(false);
    }
  }, [message, refresh, resetUpload, t, uploadFile]);

  const headerMeta = `${filteredBuiltIn.length + filteredExtra.length} ${t('skills.page.subtitle')}`;
  const totalSkills = builtInSkills.length + extraSkills.length; // Surface marketplace headline stats. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const uploadFileList = uploadFile ? [uploadFile] : []; // Keep Upload in controlled mode for skill archives. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

  return (
    <div className="hc-page hc-skills">
      <PageNav title={t('skills.page.title')} meta={<Typography.Text type="secondary">{headerMeta}</Typography.Text>} userPanel={userPanel} navToggle={navToggle} />

      <section className="hc-skills__body">
        <div className="hc-skills__hero">
          <div className="hc-skills__hero-main">
            <div className="hc-skills__hero-copy">
              <Typography.Text className="hc-skills__hero-kicker">{t('skills.hero.kicker')}</Typography.Text>
              <Typography.Title level={2} className="hc-skills__hero-title">
                {t('skills.hero.title')}
              </Typography.Title>
              <Typography.Text className="hc-skills__hero-desc">{t('skills.hero.desc')}</Typography.Text>
            </div>
            <div className="hc-skills__hero-search">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                prefix={<SearchOutlined />}
                placeholder={t('skills.search.placeholder')}
                allowClear
                className="hc-skills__search"
              />
              <div className="hc-skills__hero-buttons">
                {/* Surface a hero CTA for uploading new skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadOpen(true)}
                  className="hc-skills__hero-cta"
                >
                  {t('skills.hero.cta')}
                </Button>
                <Button
                  type="default"
                  icon={<ReloadOutlined />}
                  onClick={refresh}
                  loading={loading}
                  className="hc-skills__refresh"
                >
                  {t('common.refresh')}
                </Button>
              </div>
            </div>
            <Typography.Text type="secondary" className="hc-skills__hero-hint">
              {t('skills.hero.hint')}
            </Typography.Text>
            {/* Surface headline metrics for the skills marketplace header. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
            <div className="hc-skills__hero-stats">
              <div className="hc-skills__hero-stat">
                <span className="hc-skills__hero-stat-value">{totalSkills}</span>
                <span className="hc-skills__hero-stat-label">{t('skills.hero.stat.total')}</span>
              </div>
              <div className="hc-skills__hero-stat">
                <span className="hc-skills__hero-stat-value">{builtInSkills.length}</span>
                <span className="hc-skills__hero-stat-label">{t('skills.hero.stat.builtIn')}</span>
              </div>
              <div className="hc-skills__hero-stat">
                <span className="hc-skills__hero-stat-value">{extraSkills.length}</span>
                <span className="hc-skills__hero-stat-label">{t('skills.hero.stat.extra')}</span>
              </div>
              <div className="hc-skills__hero-stat">
                <span className="hc-skills__hero-stat-value">{tagStats.length}</span>
                <span className="hc-skills__hero-stat-label">{t('skills.hero.stat.tags')}</span>
              </div>
            </div>
          </div>
          {/* Render a CLI-style preview panel to echo the SkillsMP layout. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
          <div className="hc-skills__hero-terminal">
            <div className="hc-skills__terminal-header">
              <div className="hc-skills__terminal-dots" aria-hidden="true">
                <span className="hc-skills__terminal-dot" />
                <span className="hc-skills__terminal-dot" />
                <span className="hc-skills__terminal-dot" />
              </div>
              <span className="hc-skills__terminal-title">{t('skills.hero.terminal.title')}</span>
            </div>
            <div className="hc-skills__terminal-body">
              <span className="hc-skills__terminal-line">
                <span className="hc-skills__terminal-prompt">$</span> {t('skills.hero.terminal.command')}
              </span>
              <span className="hc-skills__terminal-line">
                {t('skills.hero.terminal.stats', {
                  total: totalSkills,
                  builtIn: builtInSkills.length,
                  extra: extraSkills.length,
                  tags: tagStats.length
                })}
              </span>
              <span className="hc-skills__terminal-line">{t('skills.hero.terminal.status')}</span>
              <span className="hc-skills__terminal-section">{t('skills.hero.terminal.browse')}</span>
              <div className="hc-skills__terminal-tags">
                {topTags.length ? (
                  topTags.map((tag) => (
                    <span key={`hero-${tag.label}`} className="hc-skills__terminal-tag">
                      {tag.label}
                    </span>
                  ))
                ) : (
                  <span className="hc-skills__terminal-empty">{t('skills.hero.terminal.emptyTags')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Provide tag-based browsing for fast skill discovery. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
        <div className="hc-skills__categories">
          <div className="hc-skills__category-header">
            <div className="hc-skills__category-header-text">
              <Typography.Title level={4} className="hc-skills__category-title">
                {t('skills.categories.title')}
              </Typography.Title>
              <Typography.Text type="secondary" className="hc-skills__category-desc">
                {t('skills.categories.desc')}
              </Typography.Text>
            </div>
            {activeTags.length ? (
              <button type="button" className="hc-skills__category-clear" onClick={clearTags}>
                {t('skills.tags.clear')}
              </button>
            ) : null}
          </div>
          {activeTags.length ? (
            <div className="hc-skills__category-active">
              <span className="hc-skills__category-active-label">{t('skills.categories.active')}</span>
              <div className="hc-skills__category-active-tags">
                {activeTags.map((tag) => (
                  <Tag key={`active-${tag}`} className="hc-skills__tag-chip">
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>
          ) : null}
          <div className="hc-skills__category-grid">
            {tagStats.length ? (
              tagStats.map((tag) => {
                const active = activeTags.includes(tag.label);
                return (
                  <button
                    key={tag.label}
                    type="button"
                    className={`hc-skills__category-card ${active ? 'is-active' : ''}`}
                    onClick={() => toggleTag(tag.label)}
                    aria-pressed={active}
                  >
                    <span className="hc-skills__category-name">{tag.label}</span>
                    <span className="hc-skills__category-meta">
                      <span className="hc-skills__category-count">{tag.count}</span>
                      <span className="hc-skills__category-label">{t('skills.page.subtitle')}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <Typography.Text className="hc-skills__category-empty">{t('skills.tags.emptyFilter')}</Typography.Text>
            )}
          </div>
        </div>

        <div className="hc-skills__sections">
          <div className="hc-skills__section">
            <div className="hc-skills__section-header">
              <Typography.Title level={4} className="hc-skills__section-title">
                {t('skills.section.builtIn')}
              </Typography.Title>
              <Typography.Text className="hc-skills__section-meta">
                {t('skills.section.count', { count: filteredBuiltIn.length })}
              </Typography.Text>
            </div>
            <div className="hc-skills__grid">
              {filteredBuiltIn.length ? (
                filteredBuiltIn.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isExtra={false}
                    expanded={Boolean(expandedIds[skill.id])}
                    updating={Boolean(updatingIds[skill.id])}
                    onToggleExpand={toggleExpand}
                  />
                ))
              ) : (
                <Empty description={t('skills.section.emptyBuiltIn')} className="hc-skills__empty" />
              )}
            </div>
            {/* Add an infinite-scroll sentinel to load more built-in skills. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b */}
            <div ref={builtInLoadMoreRef} data-testid="hc-skills-built-in-load-more" />
            {loadingMoreBuiltIn ? (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
              </div>
            ) : null}
          </div>

          <div className="hc-skills__section">
            <div className="hc-skills__section-header">
              <Typography.Title level={4} className="hc-skills__section-title">
                {t('skills.section.extra')}
              </Typography.Title>
              <div className="hc-skills__section-actions">
                <Typography.Text className="hc-skills__section-meta">
                  {t('skills.section.count', { count: filteredExtra.length })}
                </Typography.Text>
                {/* Provide an upload entry point for extra skill archives. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
                <Button
                  size="small"
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadOpen(true)}
                  className="hc-skills__upload"
                >
                  {t('skills.upload.action')}
                </Button>
              </div>
            </div>
            <div className="hc-skills__grid">
              {filteredExtra.length ? (
                filteredExtra.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isExtra
                    expanded={Boolean(expandedIds[skill.id])}
                    updating={Boolean(updatingIds[skill.id])}
                    onToggleExpand={toggleExpand}
                    onToggleEnabled={(target, next) => updateSkill(target, { enabled: next })}
                    onTogglePrompt={(target, next) => updateSkill(target, { promptEnabled: next })}
                    /* Allow extra skills to update tags from the card editor. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */
                    onUpdateTags={(target, next) => updateSkill(target, { tags: next })}
                  />
                ))
              ) : (
                <Empty description={t('skills.section.emptyExtra')} className="hc-skills__empty" />
              )}
            </div>
            {/* Add an infinite-scroll sentinel to load more extra skills. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b */}
            <div ref={extraLoadMoreRef} data-testid="hc-skills-extra-load-more" />
            {loadingMoreExtra ? (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Provide archive upload workflow for extra skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
      <Modal
        title={t('skills.upload.title')}
        open={uploadOpen}
        onCancel={resetUpload}
        onOk={submitUpload}
        okText={t('skills.upload.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={uploading}
        okButtonProps={{ disabled: !uploadFile }}
        className="hc-skills__upload-modal"
      >
        <Upload.Dragger
          name="file"
          accept=".zip,.tar,.tgz,.tar.gz"
          multiple={false}
          maxCount={1}
          beforeUpload={() => false}
          fileList={uploadFileList}
          onChange={(info) => setUploadFile(info.fileList[0] ?? null)}
          onRemove={() => {
            setUploadFile(null);
            return true;
          }}
        >
          <div className="hc-skills__upload-inner">
            <Typography.Text className="hc-skills__upload-title">{t('skills.upload.dropTitle')}</Typography.Text>
            <Typography.Text type="secondary" className="hc-skills__upload-desc">
              {t('skills.upload.dropDesc')}
            </Typography.Text>
          </div>
        </Upload.Dragger>
        <Typography.Paragraph type="secondary" className="hc-skills__upload-tip">
          {t('skills.upload.tip')}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
};
