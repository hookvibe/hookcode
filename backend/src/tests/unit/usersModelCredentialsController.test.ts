export {};

import { BadRequestException, HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { UserApiTokenService } from '../../modules/users/user-api-token.service';
import { UserCredentialValidationError, UserService } from '../../modules/users/user.service';
import { UsersController } from '../../modules/users/users.controller';

describe('UsersController model credential validation', () => {
  const userService = {
    updateModelCredentials: jest.fn()
  };
  const apiTokenService = {};
  const logWriter = {
    logOperation: jest.fn()
  };
  const req = { user: { id: 'u1', username: 'alice', roles: [] } } as any;

  beforeEach(() => {
    // Reset user credential controller mocks between cases so validation mapping assertions stay isolated. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    jest.clearAllMocks();
  });

  test('maps stable credential validation errors to 400 responses', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: UserApiTokenService, useValue: apiTokenService },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(UsersController);
    userService.updateModelCredentials.mockRejectedValueOnce(
      new UserCredentialValidationError('repo provider credential profile remark is required', {
        code: 'USER_CREDENTIAL_REPO_PROFILE_REMARK_REQUIRED',
        details: { scope: 'user', provider: 'github', profileId: 'github-1' }
      })
    );

    try {
      await controller.patchModelCredentials(req, {
        github: { profiles: [{ id: 'github-1', remark: '' }] }
      } as any);
      throw new Error('expected patchModelCredentials to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toEqual(
        expect.objectContaining({
          error: 'repo provider credential profile remark is required',
          code: 'USER_CREDENTIAL_REPO_PROFILE_REMARK_REQUIRED',
          details: { scope: 'user', provider: 'github', profileId: 'github-1' }
        })
      );
    }

    await moduleRef.close();
  });
});
