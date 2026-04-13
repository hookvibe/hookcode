export {};

import { BadRequestException, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { GlobalCredentialService } from '../../modules/repositories/global-credentials.service';
import { GlobalRobotService } from '../../modules/repositories/global-robot.service';
import { GlobalRobotsController } from '../../modules/system/global-robots.controller';

describe('GlobalRobotsController', () => {
  const globalRobotService = {
    listAll: jest.fn(),
    createRobot: jest.fn(),
    updateRobot: jest.fn(),
    deleteRobot: jest.fn(),
    setDefaultRobot: jest.fn()
  };
  const globalCredentialService = {
    getCredentialsPublic: jest.fn(),
    replaceCredentials: jest.fn(),
    updateCredentials: jest.fn()
  };
  const logWriter = {
    logOperation: jest.fn()
  };

  const adminReq = (params: Record<string, string> = {}) =>
    ({ user: { id: 'admin-1', username: 'admin', roles: ['admin'] }, params } as any);
  const userReq = (params: Record<string, string> = {}) =>
    ({ user: { id: 'user-1', username: 'alice', roles: ['user'] }, params } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks non-admin access to global robot listing', async () => {
    // Verify system-scoped global robot APIs keep the admin-only boundary even in direct controller calls. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    const moduleRef = await Test.createTestingModule({
      controllers: [GlobalRobotsController],
      providers: [
        { provide: GlobalRobotService, useValue: globalRobotService },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(GlobalRobotsController);

    await expect(controller.listGlobalRobots(userReq())).rejects.toBeInstanceOf(ForbiddenException);
    await moduleRef.close();
  });

  test('creates a global robot, promotes it to default, and writes an audit log', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GlobalRobotsController],
      providers: [
        { provide: GlobalRobotService, useValue: globalRobotService },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(GlobalRobotsController);
    const robot = { id: 'global-1', name: 'shared-review', enabled: true, isDefault: true, modelProvider: 'codex' };
    globalRobotService.createRobot.mockResolvedValueOnce(robot);
    globalRobotService.setDefaultRobot.mockResolvedValueOnce(undefined);

    const result = await controller.createGlobalRobot(adminReq(), {
      name: 'shared-review',
      promptDefault: 'Review this change'
    } as any);

    expect(result).toEqual({ robot });
    expect(globalRobotService.createRobot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1' }),
      expect.objectContaining({ name: 'shared-review' })
    );
    expect(globalRobotService.setDefaultRobot).toHaveBeenCalledWith('global-1');
    expect(logWriter.logOperation).toHaveBeenCalledWith(expect.objectContaining({ code: 'GLOBAL_ROBOT_CREATED', actorUserId: 'admin-1' }));
    await moduleRef.close();
  });

  test('maps explicit credential profile validation failures to 400 responses', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GlobalRobotsController],
      providers: [
        { provide: GlobalRobotService, useValue: globalRobotService },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(GlobalRobotsController);
    globalRobotService.createRobot.mockRejectedValueOnce(new Error('repoCredentialProfileId does not exist in global credentials'));

    try {
      await controller.createGlobalRobot(adminReq(), {
        name: 'shared-review',
        promptDefault: 'Review this change',
        repoCredentialSource: 'global',
        repoCredentialProfileId: 'missing-profile'
      } as any);
      throw new Error('expected createGlobalRobot to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toEqual(expect.objectContaining({ error: 'repoCredentialProfileId does not exist in global credentials' }));
    }

    await moduleRef.close();
  });

  test('returns 404 when updating a missing global robot', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GlobalRobotsController],
      providers: [
        { provide: GlobalRobotService, useValue: globalRobotService },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(GlobalRobotsController);
    globalRobotService.updateRobot.mockResolvedValueOnce(null);

    await expect(controller.updateGlobalRobot(adminReq({ id: 'missing-robot' }), {} as any)).rejects.toBeInstanceOf(NotFoundException);
    await moduleRef.close();
  });

  test('sanitizes secret-bearing credential update errors before logging them', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GlobalRobotsController],
      providers: [
        { provide: GlobalRobotService, useValue: globalRobotService },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(GlobalRobotsController);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    globalCredentialService.replaceCredentials.mockRejectedValueOnce(new Error('token=secret-123 apiKey=sk-live password=hunter2'));

    await expect(controller.replaceGlobalCredentials(adminReq(), { credentials: {} })).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[system] replace global credentials failed: Error: token=[REDACTED] apiKey=[REDACTED] password=[REDACTED]')
    );

    consoleError.mockRestore();
    await moduleRef.close();
  });
});
