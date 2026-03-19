export function getVendorChunkName(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  // Keep the shared React/Ant Design/runtime dependency graph in one primary vendor chunk so production chunks cannot form cyclic React namespace imports. docs/en/developer/plans/frontenddistuselayoutfix20260319/task_plan.md frontenddistuselayoutfix20260319
  if (id.includes('/react-markdown/') || id.includes('/remark-gfm/') || id.includes('/remark-breaks/')) return 'vendor-markdown';
  if (id.includes('/echarts/')) return 'vendor-charts';
  if (id.includes('/react-window/') || id.includes('/diff/')) return 'vendor-workspace';
  return 'vendor';
}
