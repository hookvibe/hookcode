import { Skeleton, Table } from 'antd';
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
  // Prefer a skeleton placeholder on the first load to avoid showing a spinner-only table. ro3ln7zex8d0wyynfj0m
  const mergedScroll = scroll ? { ...scroll, x: scroll.x ?? 'max-content' } : { x: 'max-content' };
  const className = ['table-wrapper', wrapperClassName].filter(Boolean).join(' ');

  // Treat `loading` as false when omitted so empty tables do not render a never-ending skeleton. u55e45ffi8jng44erdzp
  const isLoading =
    typeof props.loading === 'boolean'
      ? props.loading
      : props.loading
        ? Boolean((props.loading as any)?.spinning ?? true)
        : false;
  const dataSize = Array.isArray(props.dataSource) ? props.dataSource.length : 0;
  if (isLoading && dataSize === 0) {
    return (
      <div className={className} aria-busy="true" data-testid="hc-table-skeleton">
        <div style={{ padding: 12 }}>
          <Skeleton active title={false} paragraph={{ rows: 8, width: ['96%', '92%', '90%', '88%', '86%', '80%', '72%', '60%'] }} />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Table<RecordType> {...props} scroll={mergedScroll} />
    </div>
  );
};
