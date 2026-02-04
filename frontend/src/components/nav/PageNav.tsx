import type { FC, ReactNode } from 'react';
import { ArrowLeftOutlined, MenuOutlined } from '@ant-design/icons';

export interface PageNavBackAction {
  ariaLabel: string;
  onClick: () => void;
}

export interface PageNavMenuAction {
  ariaLabel: string;
  onClick: () => void;
}

export interface PageNavProps {
  title: string;
  back?: PageNavBackAction;
  meta?: ReactNode;
  actions?: ReactNode;
  navToggle?: PageNavMenuAction;
  userPanel?: ReactNode;
}

export const PageNav: FC<PageNavProps> = ({ title, back, meta, actions, navToggle, userPanel }) => {
  const showNavToggle = Boolean(navToggle && !back);

  return (
    <header className="hc-modern-nav">
      <div className="hc-modern-nav__left">
        {showNavToggle && (
          <button
            type="button"
            className="hc-modern-nav__toggle"
            aria-label={navToggle?.ariaLabel}
            onClick={navToggle?.onClick}
          >
            <MenuOutlined />
          </button>
        )}
        
        {back && (
          <button
            type="button"
            className="hc-modern-nav__back"
            aria-label={back.ariaLabel}
            onClick={back.onClick}
          >
            <ArrowLeftOutlined />
          </button>
        )}

        <div className="hc-modern-nav__title-area">
          <h1 className="hc-modern-nav__title">{title}</h1>
          {meta && <div className="hc-modern-nav__meta">{meta}</div>}
        </div>
      </div>

      <div className="hc-modern-nav__right">
        {actions && <div className="hc-modern-nav__actions">{actions}</div>}
        {userPanel}
      </div>
    </header>
  );
};
