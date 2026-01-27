import type { FC, ReactNode } from 'react';
import { Button, Typography } from '@/ui';
import { ArrowLeftOutlined } from '@/ui/icons';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * PageNav:
 * - Business context: shared top navigation bar for migrated `frontend-chat` pages.
 * - Purpose:
 *   - Keep all pages' header layout consistent (left title/meta + right actions + rightmost user panel).
 *   - Enforce a single-row header to avoid 2-line toolbars on small screens.
 *
 * Notes:
 * - The user panel trigger must always be the rightmost element for predictable muscle memory.
 * - The left section uses ellipsis + overflow clipping so the header stays 1 row even when titles are long.
 *
 * Change record:
 * - 2026-01-12: Introduced to unify headers and move the user panel into the nav.
 * - 2026-01-12: Add an optional header back icon for detail pages (behavior is owned by the page).
 */

export interface PageNavBackAction {
  /**
   * Accessible label for the back icon button.
   *
   * Usage note: keep this i18n'ed even when the button has no visible text.
   */
  ariaLabel: string;
  onClick: () => void;
}

export interface PageNavProps {
  title: string;
  /**
   * Optional header back icon (left of the title).
   *
   * Business intent: keep all full-page "go back" interactions in the header, not inside page content.
   */
  back?: PageNavBackAction;
  /**
   * Extra inline meta shown next to the title (e.g. counts / updatedAt / status tags).
   *
   * Usage note: keep it compact because it may be hidden on small screens.
   */
  meta?: ReactNode;
  /**
   * Buttons placed left of the user panel.
   */
  actions?: ReactNode;
  /**
   * "My panel" trigger. Must be rendered as the rightmost element.
   */
  userPanel?: ReactNode;
}

export const PageNav: FC<PageNavProps> = ({ title, back, meta, actions, userPanel }) => {
  return (
    <div className="hc-page__header hc-nav">
      <div className="hc-nav__left">
        {back ? (
          <Button
            type="text"
            size="small"
            className="hc-nav__back"
            icon={<ArrowLeftOutlined />}
            aria-label={back.ariaLabel}
            onClick={back.onClick}
          />
        ) : null}
        <Typography.Text className="hc-page__title">{title}</Typography.Text>
        {meta ? <div className="hc-nav__meta">{meta}</div> : null}
      </div>

      <div className="hc-nav__right">
        {actions ? <div className="hc-nav__actions">{actions}</div> : null}
        {userPanel ? <div className="hc-nav__user">{userPanel}</div> : null}
      </div>
    </div>
  );
};