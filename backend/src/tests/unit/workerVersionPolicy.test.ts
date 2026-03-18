import {
  REQUIRED_WORKER_VERSION,
  buildWorkerVersionMismatchMessage,
  evaluateWorkerVersion,
  getWorkerVersionRequirement,
  isDeclaredWorkerDependencyAligned,
  readDeclaredWorkerDependencyVersion
} from '../../modules/workers/worker-version-policy';

describe('worker version policy', () => {
  test('loads the required worker version from backend dependencies', () => {
    const requirement = getWorkerVersionRequirement();

    expect(requirement.packageName).toBe('@hookvibe/hookcode-worker');
    expect(requirement.requiredVersion).toBe(REQUIRED_WORKER_VERSION);
    expect(requirement.npmInstallCommand).toContain(`${requirement.packageName}@${requirement.requiredVersion}`);
    expect(requirement.cliUpgradeCommand).toBe(`hookcode-worker upgrade --to ${requirement.requiredVersion}`);
  });

  test('keeps the declared backend dependency aligned with the runtime requirement', () => {
    expect(readDeclaredWorkerDependencyVersion()).toBe(REQUIRED_WORKER_VERSION);
    expect(isDeclaredWorkerDependencyAligned()).toBe(true);
  });

  test('marks matching versions as compatible', () => {
    const requirement = getWorkerVersionRequirement();

    expect(evaluateWorkerVersion(requirement.requiredVersion)).toEqual({
      currentVersion: requirement.requiredVersion,
      status: 'compatible',
      upgradeRequired: false
    });
  });

  test('marks missing or different versions for upgrade', () => {
    const requirement = getWorkerVersionRequirement();
    const mismatchedVersion = requirement.requiredVersion === '0.0.0' ? '9.9.9' : '0.0.0';

    expect(evaluateWorkerVersion(undefined)).toEqual({
      currentVersion: undefined,
      status: 'unknown',
      upgradeRequired: true
    });

    expect(evaluateWorkerVersion(mismatchedVersion)).toEqual({
      currentVersion: mismatchedVersion,
      status: 'mismatch',
      upgradeRequired: true
    });
  });

  test('builds an actionable mismatch message', () => {
    const requirement = getWorkerVersionRequirement();
    const mismatchedVersion = requirement.requiredVersion === '0.0.0' ? '9.9.9' : '0.0.0';

    expect(buildWorkerVersionMismatchMessage('Worker B', mismatchedVersion)).toContain(requirement.npmInstallCommand);
  });
});
