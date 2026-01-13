import { Table } from 'antd';
import type { TableProps } from 'antd';

/**
 * ScrollableTable:
 * - Business context: shared table wrapper for the `frontend-chat` console UI.
 * - Purpose: enforce horizontal scrolling on narrow screens (especially mobile) without global CSS hacks.
 *
 * Usage:
 * - Prefer `ScrollableTable` over raw `antd` Table to avoid squeezed columns.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to support RepoDetail automation/webhook/branches tables.
 */

export type ScrollableTableProps<RecordType extends object> = TableProps<RecordType> & {
  /**
   * Extra wrapper classes appended to the base `table-wrapper`.
   * - Example: `table-wrapper--branches`
   */
  wrapperClassName?: string;
};

export const ScrollableTable = <RecordType extends object>({
  wrapperClassName,
  scroll,
  ...props
}: ScrollableTableProps<RecordType>) => {
  const mergedScroll = scroll ? { ...scroll, x: scroll.x ?? 'max-content' } : { x: 'max-content' };
  const className = ['table-wrapper', wrapperClassName].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <Table<RecordType> {...props} scroll={mergedScroll} />
    </div>
  );
};

