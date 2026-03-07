import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../modules/auth/auth.decorator';
import { WorkersInternalController } from '../../modules/workers/workers-internal.controller';

describe('WorkersInternalController auth metadata', () => {
  test('marks internal worker APIs as public so worker-header auth can run before bearer auth', () => {
    // Keep worker internal routes exempt from the global bearer guard because they authenticate with worker bootstrap headers instead. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, WorkersInternalController)).toBe(true);
  });
});
