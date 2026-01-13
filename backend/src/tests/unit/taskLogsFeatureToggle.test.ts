export {};

import { Test } from '@nestjs/testing';
import { TasksController } from '../../modules/tasks/tasks.controller';
import { HttpException } from '@nestjs/common';
import { TaskLogStream } from '../../modules/tasks/task-log-stream.service';
import { TaskRunner } from '../../modules/tasks/task-runner.service';
import { TaskService } from '../../modules/tasks/task.service';

describe('task logs feature toggle (TASK_LOGS_ENABLED)', () => {
  test('logs endpoints return 404 when disabled', async () => {
    const prev = process.env.TASK_LOGS_ENABLED;
    delete process.env.TASK_LOGS_ENABLED;

    const taskService = { getTask: jest.fn() } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner }
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    try {
      await ctrl.logs('t1', undefined);
      throw new Error('expected logs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(taskService.getTask).not.toHaveBeenCalled();

    try {
      await ctrl.clearLogs('t1');
      throw new Error('expected clearLogs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }

    await moduleRef.close();
    if (prev !== undefined) process.env.TASK_LOGS_ENABLED = prev;
  });

  test('logs endpoint works when enabled', async () => {
    const prev = process.env.TASK_LOGS_ENABLED;
    process.env.TASK_LOGS_ENABLED = 'true';

    const taskService = {
      getTask: jest.fn().mockResolvedValue({ id: 't1', result: { logs: ['l1', 'l2'], logsSeq: 2 } })
    } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner }
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    const result = await ctrl.logs('t1', undefined);
    expect(result).toEqual({ logs: ['l1', 'l2'] });

    await moduleRef.close();
    if (prev !== undefined) process.env.TASK_LOGS_ENABLED = prev;
    else delete process.env.TASK_LOGS_ENABLED;
  });
});
