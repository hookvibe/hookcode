import { PreviewPortPool } from '../../modules/tasks/previewPortPool';

// Validate preview port pool allocation/release behavior. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

describe('PreviewPortPool', () => {
  test('allocates and releases ports', async () => {
    const pool = new PreviewPortPool(12000, 12010);
    const port = await pool.allocatePort('group-1');
    expect(port).toBeGreaterThanOrEqual(12000);
    expect(port).toBeLessThanOrEqual(12010);

    pool.releasePort('group-1', port);
    const port2 = await pool.allocatePort('group-1');
    expect(port2).toBeGreaterThanOrEqual(12000);
    expect(port2).toBeLessThanOrEqual(12010);
  });

  test('releases all group ports', async () => {
    const pool = new PreviewPortPool(12020, 12030);
    const portA = await pool.allocatePort('group-2');
    const portB = await pool.allocatePort('group-2');

    pool.releaseTaskGroup('group-2');

    const portC = await pool.allocatePort('group-2');
    expect([portA, portB]).toContain(portC);
  });

});
