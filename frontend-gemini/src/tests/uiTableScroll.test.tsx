import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { Table } from '@/ui';
// Verify UI Table scroll wrappers for wide and tall data. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

type Row = { id: string; name: string };

const columns = [{ title: 'Name', dataIndex: 'name', key: 'name' }];
const data: Row[] = [{ id: 'r1', name: 'Alpha' }];

describe('UI Table scroll handling', () => {
  test('wraps table with a horizontal scroll container when scroll.x is set', () => {
    const { container } = render(
      <Table<Row> dataSource={data} columns={columns} rowKey="id" scroll={{ x: 640 }} />
    );

    const wrapper = container.querySelector('.hc-ui-table-content');
    expect(wrapper).toBeTruthy();
    expect(wrapper).toHaveStyle({ overflowX: 'auto' });

    const table = container.querySelector('table');
    expect(table).toHaveStyle({ minWidth: '640px' });
  });

  test('adds a vertical scroll container when scroll.y is set', () => {
    const { container } = render(
      <Table<Row> dataSource={data} columns={columns} rowKey="id" scroll={{ y: 240 }} />
    );

    const wrapper = container.querySelector('.hc-ui-table-body');
    expect(wrapper).toBeTruthy();
    expect(wrapper).toHaveStyle({ overflowY: 'auto', maxHeight: '240px' });
  });

  test('renders without a scroll wrapper when scroll is not provided', () => {
    const { container } = render(<Table<Row> dataSource={data} columns={columns} rowKey="id" />);
    expect(container.querySelector('.hc-ui-table-content')).toBeNull();
  });
});
