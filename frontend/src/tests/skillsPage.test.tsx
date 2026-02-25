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
    fetchSkills: vi.fn(async () => ({ builtIn: [], extra: [] })),
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

const renderPage = () =>
  render(
    <AntdApp>
      <SkillsPage />
    </AntdApp>
  );

describe('SkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/skills';
  });

  test('filters and toggles extra skills', async () => {
    // Validate skill filtering and toggle actions for the Skills page. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const ui = userEvent.setup();
    const builtInSkill = {
      id: 'builtin-1',
      slug: 'builtin-1',
      name: 'Built-in Skill',
      description: 'Built-in description',
      version: '1.0.0',
      source: 'built_in',
      enabled: true,
      promptEnabled: false,
      promptText: null,
      tags: ['core']
    };
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

    vi.mocked(api.fetchSkills).mockResolvedValueOnce({ builtIn: [builtInSkill as any], extra: [extraSkill as any] });
    vi.mocked(api.patchSkill).mockResolvedValueOnce({ ...extraSkill, promptEnabled: true } as any);

    renderPage();

    expect(await screen.findByText('Built-in Skill')).toBeInTheDocument();
    expect(screen.getByText('Extra Skill')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search skills by name, slug, or description');
    await ui.type(search, 'extra');

    expect(screen.queryByText('Built-in Skill')).not.toBeInTheDocument();
    expect(screen.getByText('Extra Skill')).toBeInTheDocument();

    // Validate tag filter chips narrow the skill list. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const opsFilter = screen.getByRole('button', { name: /ops/i });
    await ui.click(opsFilter);
    expect(screen.queryByText('Built-in Skill')).not.toBeInTheDocument();
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
