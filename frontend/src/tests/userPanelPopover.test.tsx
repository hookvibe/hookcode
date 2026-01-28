import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { UserPanelPopover } from '../components/UserPanelPopover';

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    updateMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    changeMyPassword: vi.fn(async () => undefined),
    fetchMyModelCredentials: vi.fn(async () => ({
      // Change record: credentials API returns `profiles[]` per provider (multi-profile support).
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null },
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null }
    })),
    listMyModelProviderModels: vi.fn(async () => ({ models: [], source: 'fallback' })), // Mock model discovery API. b8fucnmey62u0muyn7i0
    updateMyModelCredentials: vi.fn(async () => ({
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null },
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null }
    })),
    fetchAdminToolsMeta: vi.fn(async () => ({ enabled: true, ports: { prisma: 7215, swagger: 7216 } })),
    // Provide runtime API mocks for the environment tab. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    fetchSystemRuntimes: vi.fn(async () => ({ runtimes: [], detectedAt: null }))
  };
});

const renderPopover = (props?: { token?: string }) => {
  if (props?.token) window.localStorage.setItem('hookcode-token', props.token);
  return render(
    <AntdApp>
      <UserPanelPopover
        themePreference="dark"
        onThemePreferenceChange={() => {}}
        accentPreset="blue"
        onAccentPresetChange={() => {}}
      />
    </AntdApp>
  );
};

describe('UserPanelPopover', () => {
  const ORIGINAL_DISABLE_ACCOUNT_EDIT = process.env.VITE_DISABLE_ACCOUNT_EDIT;

  const setDisableAccountEditEnv = (value?: string) => {
    // Test helper: keep env mutation explicit and reversible within this file.
    if (value === undefined) {
      delete process.env.VITE_DISABLE_ACCOUNT_EDIT;
      return;
    }
    process.env.VITE_DISABLE_ACCOUNT_EDIT = value;
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocale('en-US');
    window.location.hash = '#/';
  });

  afterEach(() => {
    // Test isolation: restore env so other test files are not affected.
    setDisableAccountEditEnv(ORIGINAL_DISABLE_ACCOUNT_EDIT);
  });

  test('forces Settings tab when not signed in', async () => {
    const ui = userEvent.setup();
    renderPopover();

    await ui.click(screen.getByRole('button', { name: /Panel/i }));

    // Settings content should be visible; auth-only nav items are disabled.
    expect(await screen.findByText('Language')).toBeInTheDocument();
    // UX regression guard (2026-01-13): the user panel should always render in compact density mode.
    expect(document.querySelector('.hc-user-panel')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByRole('button', { name: 'Me' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  test('allows switching tabs when signed in', async () => {
    const ui = userEvent.setup();
    renderPopover({ token: 't' });

    await ui.click(screen.getByRole('button', { name: /Panel/i }));

    // UX regression guard (2026-01-13): the user panel should always render in compact density mode.
    expect(document.querySelector('.hc-user-panel')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByRole('button', { name: 'Me' })).not.toBeDisabled();

    await ui.click(screen.getByRole('button', { name: 'Credentials' }));
    // Model provider title appears in both section header and card title after list unification. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const modelTitles = await screen.findAllByText('Model provider credentials');
    expect(modelTitles.length).toBeGreaterThan(0);
    // Provider labels now appear inside default selection text, so use a partial match. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(await screen.findByText(/Claude Code/i)).toBeInTheDocument();
  });

  test('renders placeholders for panel inputs', async () => {
    const ui = userEvent.setup();
    renderPopover({ token: 't' });

    await ui.click(screen.getByRole('button', { name: /Panel/i }));

    const displayName = (await screen.findByLabelText('Display name')) as HTMLInputElement;
    expect(displayName.placeholder).not.toBe('');

    const currentPassword = screen.getByLabelText('Current password') as HTMLInputElement;
    expect(currentPassword.placeholder).not.toBe('');

    const newPassword = screen.getByLabelText('New password') as HTMLInputElement;
    expect(newPassword.placeholder).not.toBe('');

    const confirmPassword = screen.getByLabelText('Confirm new password') as HTMLInputElement;
    expect(confirmPassword.placeholder).not.toBe('');

    await ui.click(screen.getByRole('button', { name: 'Credentials' }));
    // Model provider title appears in both section header and card title after list unification. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const modelTitles = await screen.findAllByText('Model provider credentials');
    expect(modelTitles.length).toBeGreaterThan(0);

    // Provider labels now appear inside default selection text, so use a partial match. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const codexCard = screen.getByText(/Codex/).closest('.ant-card');
    expect(codexCard).toBeTruthy();

    await ui.click(within(codexCard as HTMLElement).getByRole('button', { name: /Add/i }));
    expect(await screen.findByText('Add credential profile')).toBeInTheDocument();

    // Modal structure note:
    // - The secret input is rendered inside a nested Form.Item (no direct label->control association),
    //   so we assert placeholders by checking all visible textboxes within the profile dialog.
    const dialogs = screen.getAllByRole('dialog');
    const profileDialog = dialogs[dialogs.length - 1] as HTMLElement;
    // Assert provider selector is visible for unified credential adds. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(within(profileDialog).getByText('Provider')).toBeInTheDocument();
    const textboxes = within(profileDialog).getAllByRole('textbox') as HTMLInputElement[];
    for (const input of textboxes) {
      expect(input.placeholder).not.toBe('');
    }
  });

  test('disables account editing when VITE_DISABLE_ACCOUNT_EDIT=1', async () => {
    const ui = userEvent.setup();
    setDisableAccountEditEnv('1');
    renderPopover({ token: 't' });

    await ui.click(screen.getByRole('button', { name: /Panel/i }));

    expect(await screen.findByLabelText('Display name')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    expect(screen.getByLabelText('Current password')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Update password/i })).toBeDisabled();
  });

  test('keeps account editing enabled by default (VITE_DISABLE_ACCOUNT_EDIT=0)', async () => {
    const ui = userEvent.setup();
    setDisableAccountEditEnv('0');
    renderPopover({ token: 't' });

    await ui.click(screen.getByRole('button', { name: /Panel/i }));

    expect(await screen.findByLabelText('Display name')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Save/i })).not.toBeDisabled();
  });
});
