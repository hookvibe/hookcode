#!/usr/bin/env node
import { WorkerProcess } from './workerProcess';

const main = async (): Promise<void> => {
  // Start the standalone worker entrypoint so backend-supervised and remote workers share the same protocol client. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const worker = new WorkerProcess();
  await worker.start();
};

void main().catch((error) => {
  console.error('[worker] failed to start', error);
  process.exitCode = 1;
});
