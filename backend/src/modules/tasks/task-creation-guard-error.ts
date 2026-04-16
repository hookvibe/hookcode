// Surface task-creation guard failures with stable codes so controllers can return explicit worker/provider readiness errors instead of generic 500s. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
export class TaskCreationGuardError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = 'TaskCreationGuardError';
    this.code = code;
    this.status = status;
  }
}

export const isTaskCreationGuardError = (error: unknown): error is TaskCreationGuardError =>
  error instanceof Error &&
  error.name === 'TaskCreationGuardError' &&
  typeof (error as TaskCreationGuardError).code === 'string' &&
  Number.isFinite((error as TaskCreationGuardError).status);
