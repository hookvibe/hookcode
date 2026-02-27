// Share UUID format validation for pagination cursors and list filters. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
export const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
