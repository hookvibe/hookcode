import { ValidationPipe } from '@nestjs/common';
import { CreateWorkerRequestDto, PrepareRuntimeRequestDto, ResetWorkerBindCodeRequestDto, UpdateWorkerRequestDto } from '../../modules/workers/dto/workers-swagger.dto';

describe('Workers request DTOs', () => {
  test('preserves create-worker fields with ValidationPipe whitelist', async () => {
    // Verify worker create DTO fields survive whitelist validation so admin bootstrap requests keep name and concurrency values. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = { name: '  service  ', maxConcurrency: 2, backendUrl: 'http://yuhe.space:7213' };
    const result = await pipe.transform(payload, { type: 'body', metatype: CreateWorkerRequestDto });
    expect(result).toMatchObject({ name: 'service', maxConcurrency: 2, backendUrl: 'http://yuhe.space:7213/api' });
  });

  test('preserves update-worker fields with ValidationPipe whitelist', async () => {
    // Verify worker update DTO fields survive whitelist validation so admin status toggles and rename requests keep their payload. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = { name: '  renamed worker  ', status: 'disabled', maxConcurrency: 3, isGlobalDefault: true };
    const result = await pipe.transform(payload, { type: 'body', metatype: UpdateWorkerRequestDto });
    expect(result).toMatchObject({ name: 'renamed worker', status: 'disabled', maxConcurrency: 3, isGlobalDefault: true });
  });

  test('preserves provider arrays for runtime preparation requests', async () => {
    // Verify runtime-prep DTO fields survive whitelist validation so worker prepare requests still forward provider names. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = { providers: [' codex ', 'gemini_cli'] };
    const result = await pipe.transform(payload, { type: 'body', metatype: PrepareRuntimeRequestDto });
    expect(result).toMatchObject({ providers: ['codex', 'gemini_cli'] });
  });

  test('normalizes reset-bind-code backend urls', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = { backendUrl: 'https://backend.example.com:7443/root/' };
    const result = await pipe.transform(payload, { type: 'body', metatype: ResetWorkerBindCodeRequestDto });
    expect(result).toMatchObject({ backendUrl: 'https://backend.example.com:7443/root/api' });
  });
});
