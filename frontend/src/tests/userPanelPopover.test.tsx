import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    updateMyModelCredentials: vi.fn(async () => ({
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null },
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null }
    })),
    fetchAdminToolsMeta: vi.fn(async () => ({ enabled: true, ports: { prisma: 7215, swagger: 7216 } }))
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
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocale('en-US');
    window.location.hash = '#/';
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
    expect(await screen.findByText('Model provider credentials')).toBeInTheDocument();
    expect(await screen.findByText('Claude Code')).toBeInTheDocument();
  });
});
