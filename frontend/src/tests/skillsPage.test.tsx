import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { SkillsPage } from '../pages/SkillsPage';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    // Return paginated skill list mocks for SkillsPage pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    fetchSkills: vi.fn(async () => ({ builtIn: [], extra: [], builtInNextCursor: null, extraNextCursor: null })),
    patchSkill: vi.fn(async () => ({
      id: 'x',
      slug: 'x',
      name: 'x',
      source: 'extra',
      enabled: true,
      promptEnabled: true,
      tags: []
    })),
    uploadExtraSkill: vi.fn(async () => ({
      id: 'upload-1',
      slug: 'upload-skill',
      name: 'Upload Skill',
      source: 'extra',
      enabled: true,
      promptEnabled: false,
      tags: []
    }))
  };
});

const renderPage = (props?: { skillsTab?: string }) =>
  render(
    <AntdApp>
      <SkillsPage skillsTab={props?.skillsTab as any} />
    </AntdApp>
  );

describe('SkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/skills';
  });

  test('filters and toggles extra skills', async () => {
    // Validate skill filtering and toggle actions on the extra skills tab. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
    const ui = userEvent.setup();
    const extraSkill = {
      id: 'extra-1',
      slug: 'extra-1',
      name: 'Extra Skill',
      description: 'Extra description',
      version: '2.0.0',
      source: 'extra',
      enabled: true,
      promptEnabled: false,
      promptText: 'Do the thing.',
      tags: ['ops', 'ui']
    };

    vi.mocked(api.fetchSkills)
      // Provide built-in skills page response. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      .mockResolvedValueOnce({ builtIn: [], extra: [], builtInNextCursor: null })
      // Provide extra skills page response. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      .mockResolvedValueOnce({ builtIn: [], extra: [extraSkill as any], extraNextCursor: null });
    vi.mocked(api.patchSkill).mockResolvedValueOnce({ ...extraSkill, promptEnabled: true } as any);

    // Render the extra skills tab directly to test extra skill actions. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
    renderPage({ skillsTab: 'extra' });

    expect(await screen.findByText('Extra Skill')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search skills by name, slug, or description');
    await ui.type(search, 'extra');

    expect(screen.getByText('Extra Skill')).toBeInTheDocument();

    const extraCard = screen.getByText('Extra Skill').closest('.hc-skills__card') as HTMLElement;
    const switches = within(extraCard).getAllByRole('switch');
    await ui.click(switches[1]);

    await waitFor(() => {
      expect(api.patchSkill).toHaveBeenCalledWith('extra-1', { promptEnabled: true });
    });

    // Update extra skill tags via the editor. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    await ui.click(within(extraCard).getByRole('button', { name: 'Show prompt' }));
    const tagInput = within(extraCard).getByPlaceholderText('Add tags, comma-separated');
    await ui.clear(tagInput);
    await ui.type(tagInput, 'ops, backend');
    vi.mocked(api.patchSkill).mockResolvedValueOnce({ ...extraSkill, tags: ['ops', 'backend'] } as any);
    await ui.click(within(extraCard).getByRole('button', { name: 'Save tags' }));
    await waitFor(() => {
      expect(api.patchSkill).toHaveBeenCalledWith('extra-1', { tags: ['ops', 'backend'] });
    });
  });

  test('uploads extra skill archives from the modal', async () => {
    // Validate extra skill uploads trigger the archive API call. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const ui = userEvent.setup();

    renderPage();

    // Target the hero CTA to avoid matching the section upload button. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const uploadButton = await screen.findByRole('button', { name: /Add extra skill/i });
    await ui.click(uploadButton);

    const dialog = await screen.findByRole('dialog');
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['archive'], 'bundle.zip', { type: 'application/zip' });
    await ui.upload(fileInput, file);

    const confirmButton = within(dialog).getByRole('button', { name: 'Upload' });
    await ui.click(confirmButton);

    await waitFor(() => {
      expect(api.uploadExtraSkill).toHaveBeenCalled();
    });
  });
});
