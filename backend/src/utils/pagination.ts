import { isUuidLike } from './uuid';

export type UpdatedAtCursor = {
  id: string;
  updatedAt: Date;
};

export type NameCursor = {
  id: string;
  name: string;
};

// Encode an updated-at cursor for API pagination responses. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
export const encodeUpdatedAtCursor = (cursor: UpdatedAtCursor): string => {
  const payload = JSON.stringify({ id: cursor.id, updatedAt: cursor.updatedAt.toISOString() });
  return Buffer.from(payload, 'utf8').toString('base64url');
};

// Decode an updated-at cursor from API query params, returning null when invalid. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
export const decodeUpdatedAtCursor = (raw: unknown): UpdatedAtCursor | null => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  try {
    const payload = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as { id?: unknown; updatedAt?: unknown };
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const updatedAtRaw = typeof parsed.updatedAt === 'string' ? parsed.updatedAt.trim() : '';
    if (!id || !updatedAtRaw || !isUuidLike(id)) return null;
    const updatedAt = new Date(updatedAtRaw);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { id, updatedAt };
  } catch {
    return null;
  }
};

// Encode a name cursor for alphabetically sorted lists (name + id). docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
export const encodeNameCursor = (cursor: NameCursor): string => {
  const payload = JSON.stringify({ id: cursor.id, name: cursor.name });
  return Buffer.from(payload, 'utf8').toString('base64url');
};

// Decode a name cursor from API query params, returning null when invalid. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
export const decodeNameCursor = (raw: unknown): NameCursor | null => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  try {
    const payload = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as { id?: unknown; name?: unknown };
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!id || !name) return null;
    return { id, name };
  } catch {
    return null;
  }
};
