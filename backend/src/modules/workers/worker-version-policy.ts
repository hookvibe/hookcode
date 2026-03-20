import { readFileSync } from 'fs';
import path from 'path';

export const WORKER_PACKAGE_NAME = '@hookvibe/hookcode-worker';
export const WORKER_DOCKER_IMAGE = 'ghcr.io/hookvibe/hookcode-worker';
export const REQUIRED_WORKER_VERSION = '0.1.4';

export type WorkerVersionStatus = 'compatible' | 'mismatch' | 'unknown';

export interface WorkerVersionRequirement {
  packageName: string;
  requiredVersion: string;
  npmInstallCommand: string;
  cliUpgradeCommand: string;
  dockerImage: string;
  dockerPullCommand: string;
}

export interface WorkerVersionState {
  currentVersion?: string;
  status: WorkerVersionStatus;
  upgradeRequired: boolean;
}

type BackendPackageJson = {
  dependencies?: Record<string, string>;
};

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeVersion = (value: unknown): string | undefined => {
  const raw = trimString(value);
  if (!raw) return undefined;
  return raw.startsWith('v') ? raw.slice(1) : raw;
};

export const readDeclaredWorkerDependencyVersion = (): string | undefined => {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const raw = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as BackendPackageJson;
    return normalizeVersion(raw.dependencies?.[WORKER_PACKAGE_NAME]);
  } catch (error) {
    console.warn('[workers] failed to read declared worker dependency version from backend/package.json', error);
  }
  return undefined;
};

export const isDeclaredWorkerDependencyAligned = (): boolean => readDeclaredWorkerDependencyVersion() === REQUIRED_WORKER_VERSION;

export const getWorkerVersionRequirement = (): WorkerVersionRequirement => ({
  packageName: WORKER_PACKAGE_NAME,
  requiredVersion: REQUIRED_WORKER_VERSION,
  npmInstallCommand: `npm install -g ${WORKER_PACKAGE_NAME}@${REQUIRED_WORKER_VERSION}`,
  cliUpgradeCommand: `hookcode-worker upgrade --to ${REQUIRED_WORKER_VERSION}`,
  dockerImage: WORKER_DOCKER_IMAGE,
  dockerPullCommand: `docker pull ${WORKER_DOCKER_IMAGE}:${REQUIRED_WORKER_VERSION}`
});

export const evaluateWorkerVersion = (currentVersion: unknown): WorkerVersionState => {
  const normalizedCurrent = normalizeVersion(currentVersion);
  if (!normalizedCurrent) {
    return { currentVersion: undefined, status: 'unknown', upgradeRequired: true };
  }
  if (normalizedCurrent === REQUIRED_WORKER_VERSION) {
    return { currentVersion: normalizedCurrent, status: 'compatible', upgradeRequired: false };
  }
  return { currentVersion: normalizedCurrent, status: 'mismatch', upgradeRequired: true };
};

export const buildWorkerVersionMismatchMessage = (name: string, currentVersion: unknown): string => {
  const version = evaluateWorkerVersion(currentVersion);
  const requirement = getWorkerVersionRequirement();
  const label = trimString(name) || 'Selected worker';
  const currentLabel = version.currentVersion ?? 'unknown';
  return `${label} requires ${requirement.packageName}@${requirement.requiredVersion}, current version: ${currentLabel}. Upgrade with: ${requirement.npmInstallCommand}`;
};
