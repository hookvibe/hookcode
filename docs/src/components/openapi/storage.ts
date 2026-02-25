// Isolate OpenAPI storage helpers for settings persistence. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const readStoredValue = (key: string, fallback: string, storage: Storage | null) => {
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  return raw && raw.trim() ? raw : fallback;
};

export const writeStoredValue = (key: string, value: string, storage: Storage | null) => {
  if (!storage) return;
  if (!value) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, value);
};
