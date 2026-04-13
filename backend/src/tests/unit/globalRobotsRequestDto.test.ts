import { ValidationPipe } from '@nestjs/common';
import { CreateGlobalRobotDto, UpdateGlobalRobotDto } from '../../modules/system/dto/global-robots.dto';

describe('Global robot request DTOs', () => {
  test('preserves create-global-robot fields with ValidationPipe whitelist', async () => {
    // Verify system global robot create payloads keep shared credential and JSON config fields under whitelist validation. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = {
      name: 'shared-review',
      permission: 'write',
      repoCredentialSource: 'global',
      repoCredentialProfileId: 'repo-default',
      promptDefault: 'Review this change',
      language: 'en-US',
      modelProvider: 'codex',
      modelProviderConfig: { credentialSource: 'global', credentialProfileId: 'codex-default', model: 'gpt-5.1-codex-max' },
      dependencyConfig: { enabled: true, failureMode: 'soft' },
      defaultBranch: 'main',
      repoWorkflowMode: 'fork',
      timeWindow: { startHour: 8, endHour: 18 },
      enabled: true,
      isDefault: true,
      ignoredField: 'drop-me'
    };

    const result = await pipe.transform(payload, { type: 'body', metatype: CreateGlobalRobotDto });
    expect(result).toMatchObject({
      name: 'shared-review',
      permission: 'write',
      repoCredentialSource: 'global',
      repoCredentialProfileId: 'repo-default',
      modelProvider: 'codex',
      modelProviderConfig: { credentialSource: 'global', credentialProfileId: 'codex-default', model: 'gpt-5.1-codex-max' },
      dependencyConfig: { enabled: true, failureMode: 'soft' },
      timeWindow: { startHour: 8, endHour: 18 },
      enabled: true,
      isDefault: true
    });
    expect((result as any).ignoredField).toBeUndefined();
  });

  test('preserves update-global-robot fields with ValidationPipe whitelist', async () => {
    // Verify system global robot patch payloads keep partial shared-robot fields without leaking unknown properties. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const payload = {
      repoCredentialSource: 'user',
      repoCredentialProfileId: 'user-1',
      modelProviderConfig: { credentialSource: 'user', credentialProfileId: 'codex-user-1', model: 'gpt-5.1-codex-max' },
      enabled: false,
      unexpected: true
    };

    const result = await pipe.transform(payload, { type: 'body', metatype: UpdateGlobalRobotDto });
    expect(result).toMatchObject({
      repoCredentialSource: 'user',
      repoCredentialProfileId: 'user-1',
      modelProviderConfig: { credentialSource: 'user', credentialProfileId: 'codex-user-1', model: 'gpt-5.1-codex-max' },
      enabled: false
    });
    expect((result as any).unexpected).toBeUndefined();
  });
});
