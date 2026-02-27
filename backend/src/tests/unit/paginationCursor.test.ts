import { decodeNameCursor, decodeUpdatedAtCursor, encodeNameCursor, encodeUpdatedAtCursor } from '../../utils/pagination';

describe('pagination cursor helpers', () => {
  test('round-trips updatedAt cursors', () => {
    // Ensure cursor encoding/decoding stays stable for keyset pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    const cursor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      updatedAt: new Date('2026-02-01T12:00:00.000Z')
    };
    const encoded = encodeUpdatedAtCursor(cursor);
    const decoded = decodeUpdatedAtCursor(encoded);
    expect(decoded?.id).toBe(cursor.id);
    expect(decoded?.updatedAt.toISOString()).toBe(cursor.updatedAt.toISOString());
  });

  test('returns null for invalid cursor payloads', () => {
    // Reject malformed cursor data to keep pagination deterministic. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    expect(decodeUpdatedAtCursor('not-a-real-cursor')).toBeNull();
  });

  test('round-trips name cursors', () => {
    // Ensure name cursor encoding/decoding stays stable for list pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    const cursor = { id: 'skill-123', name: 'Alpha Skill' };
    const encoded = encodeNameCursor(cursor);
    const decoded = decodeNameCursor(encoded);
    expect(decoded?.id).toBe(cursor.id);
    expect(decoded?.name).toBe(cursor.name);
  });

  test('returns null for invalid name cursor payloads', () => {
    // Reject malformed name cursors for deterministic pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    expect(decodeNameCursor('invalid')).toBeNull();
  });
});
