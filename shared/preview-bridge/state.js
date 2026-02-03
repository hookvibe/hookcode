// Centralize preview bridge state to share across modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const createBridgeState = () => ({
  allowedOrigin: null,
  trackedElement: null,
  cleanupFn: null
});
