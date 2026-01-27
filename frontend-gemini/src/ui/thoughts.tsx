import React, { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

// Provide local ThoughtChain/Think components for execution logs without legacy UI X. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export type ThoughtChainStatus = 'success' | 'error' | 'loading' | 'abort' | undefined;

export type ThoughtChainItemType = {
  key: string;
  title?: ReactNode;
  description?: ReactNode;
  content?: ReactNode;
  status?: ThoughtChainStatus;
  blink?: boolean;
};

export type ThoughtChainProps = {
  items?: ThoughtChainItemType[];
  rootClassName?: string;
  line?: 'solid' | 'dashed';
};

// Render execution timeline nodes with status dots and optional content blocks. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const ThoughtChain = ({ items = [], rootClassName }: ThoughtChainProps) => (
  <div className={clsx('hc-thought-chain', rootClassName)}>
    {items.map((item) => (
      <div key={item.key} className={clsx('hc-thought-chain__item', item.status && `hc-thought-chain__item--${item.status}`)}>
        <div className="hc-thought-chain__header">
          <span className={clsx('hc-thought-chain__status', item.blink && 'is-blink')} />
          <div className="hc-thought-chain__titles">
            {item.title ? <div className="hc-thought-chain__title">{item.title}</div> : null}
            {item.description ? <div className="hc-thought-chain__description">{item.description}</div> : null}
          </div>
        </div>
        {item.content ? <div className="hc-thought-chain__content">{item.content}</div> : null}
      </div>
    ))}
  </div>
);

export type ThinkProps = {
  title?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  blink?: boolean;
  expanded?: boolean;
  onExpand?: (expanded: boolean) => void;
  className?: string;
  hideIcon?: boolean;
  children?: ReactNode;
};

// Provide expandable blocks for each thought step with controlled expand state. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Think = ({ title, icon, loading, blink, expanded, onExpand, className, hideIcon, children }: ThinkProps) => {
  const [internal, setInternal] = useState(true);
  const isExpanded = expanded ?? internal;
  const toggle = () => {
    const next = !isExpanded;
    onExpand?.(next);
    if (expanded === undefined) setInternal(next);
  };

  return (
    <div className={clsx('hc-think', className, loading && 'is-loading', blink && 'is-blink')}>
      <button type="button" className="hc-think__header" onClick={toggle}>
        {!hideIcon ? <span className="hc-think__icon">{icon}</span> : null}
        <span className="hc-think__title">{title}</span>
      </button>
      {isExpanded ? <div className="hc-think__body">{children}</div> : null}
    </div>
  );
};
