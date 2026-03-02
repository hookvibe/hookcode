import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersController } from '../../modules/users/users.controller';
import { UserService } from '../../modules/users/user.service';
// Include UserApiTokenService for controller DI mocks in this test. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
import { UserApiTokenService } from '../../modules/users/user-api-token.service';
import { LogWriterService } from '../../modules/logs/log-writer.service'; // Provide log writer mock for user controller tests. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

describe('users account edit feature toggle (VITE_DISABLE_ACCOUNT_EDIT)', () => {
  // Provide a stable LogWriterService mock for account edit tests. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  const logWriter = { logOperation: jest.fn(), logSystem: jest.fn(), logExecution: jest.fn() };
  test('patchMe/patchPassword return 403 when disabled', async () => {
    // Reset log writer mocks before each account edit test. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    logWriter.logOperation.mockClear();
    const prev = process.env.VITE_DISABLE_ACCOUNT_EDIT;
    process.env.VITE_DISABLE_ACCOUNT_EDIT = 'true';

    const userService = {
      updateUser: jest.fn(),
      verifyPassword: jest.fn(),
      setPassword: jest.fn()
    } as any;
    const apiTokenService = {} as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      // Provide UserApiTokenService mock to satisfy UsersController DI in unit tests. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
      providers: [
        { provide: UserService, useValue: userService },
        { provide: UserApiTokenService, useValue: apiTokenService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const ctrl = moduleRef.get(UsersController);

    const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;

    try {
      await ctrl.patchMe(req, { displayName: 'New' } as any);
      throw new Error('expected patchMe to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toMatchObject({ code: 'ACCOUNT_EDIT_DISABLED' });
    }
    expect(userService.updateUser).not.toHaveBeenCalled();

    try {
      await ctrl.patchPassword(req, { currentPassword: 'old', newPassword: 'new123' } as any);
      throw new Error('expected patchPassword to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toMatchObject({ code: 'ACCOUNT_EDIT_DISABLED' });
    }
    expect(userService.verifyPassword).not.toHaveBeenCalled();
    expect(userService.setPassword).not.toHaveBeenCalled();
    expect(logWriter.logOperation).not.toHaveBeenCalled();

    await moduleRef.close();
    if (prev !== undefined) process.env.VITE_DISABLE_ACCOUNT_EDIT = prev;
    else delete process.env.VITE_DISABLE_ACCOUNT_EDIT;
  });

  test('patchMe/patchPassword work when enabled', async () => {
    // Reset log writer mocks before asserting audit logging behavior. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    logWriter.logOperation.mockClear();
    const prev = process.env.VITE_DISABLE_ACCOUNT_EDIT;
    delete process.env.VITE_DISABLE_ACCOUNT_EDIT;

    const userService = {
      updateUser: jest.fn().mockResolvedValue({ id: 'u1', username: 'u1', displayName: 'New', roles: [], createdAt: '', updatedAt: '' }),
      verifyPassword: jest.fn().mockResolvedValue(true),
      setPassword: jest.fn().mockResolvedValue(undefined)
    } as any;
    const apiTokenService = {} as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      // Provide UserApiTokenService mock to satisfy UsersController DI in unit tests. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
      providers: [
        { provide: UserService, useValue: userService },
        { provide: UserApiTokenService, useValue: apiTokenService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const ctrl = moduleRef.get(UsersController);

    const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;

    const patched = await ctrl.patchMe(req, { displayName: 'New' } as any);
    expect(patched).toEqual({ user: { id: 'u1', username: 'u1', displayName: 'New', roles: [], createdAt: '', updatedAt: '' } });
    expect(userService.updateUser).toHaveBeenCalledWith('u1', { displayName: 'New' });
    // Assert log emission for successful profile updates. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    expect(logWriter.logOperation).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_PROFILE_UPDATED' }));

    const changed = await ctrl.patchPassword(req, { currentPassword: 'old', newPassword: 'new123' } as any);
    expect(changed).toEqual({ success: true });
    expect(userService.verifyPassword).toHaveBeenCalledWith('u1', 'old');
    expect(userService.setPassword).toHaveBeenCalledWith('u1', 'new123');
    // Assert log emission for successful password updates. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    expect(logWriter.logOperation).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_PASSWORD_CHANGED' }));

    await moduleRef.close();
    if (prev !== undefined) process.env.VITE_DISABLE_ACCOUNT_EDIT = prev;
    else delete process.env.VITE_DISABLE_ACCOUNT_EDIT;
  });
});
