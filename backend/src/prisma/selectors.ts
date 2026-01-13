import { Prisma } from '@prisma/client';

/**
 * Prisma selectors (type-linking helpers):
 * - Use `Prisma.validator()` to lock select/include field sets
 * - Use `Prisma.*GetPayload` to get stable Row types
 * - Use these selectors consistently in services to reduce `any` and runtime issues caused by missing fields
 *
 * This file does not force all services to migrate immediately; adopt it gradually per module.
 */

export const userBaseSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  username: true,
  displayName: true,
  modelCredentials: true,
  disabled: true,
  createdAt: true,
  updatedAt: true
});

export const userRecordSelect = Prisma.validator<Prisma.UserSelect>()({
  ...userBaseSelect,
  usernameLower: true,
  passwordHash: true,
  passwordSalt: true
});

export type UserBaseRow = Prisma.UserGetPayload<{ select: typeof userBaseSelect }>;
export type UserRecordRow = Prisma.UserGetPayload<{ select: typeof userRecordSelect }>;

export const repoRobotBaseSelect = Prisma.validator<Prisma.RepoRobotSelect>()({
  id: true,
  repoId: true,
  name: true,
  permission: true,
  cloneUsername: true,
  repoCredentialProfileId: true,
  repoTokenUserId: true,
  repoTokenUsername: true,
  repoTokenUserName: true,
  repoTokenUserEmail: true,
  repoTokenRepoRole: true,
  repoTokenRepoRoleJson: true,
  promptDefault: true,
  language: true,
  modelProvider: true,
  modelProviderConfig: true,
  defaultBranchRole: true,
  defaultBranch: true,
  activatedAt: true,
  lastTestAt: true,
  lastTestOk: true,
  lastTestMessage: true,
  enabled: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true
});

export const repoRobotWithTokenSelect = Prisma.validator<Prisma.RepoRobotSelect>()({
  ...repoRobotBaseSelect,
  token: true
});

export type RepoRobotBaseRow = Prisma.RepoRobotGetPayload<{ select: typeof repoRobotBaseSelect }>;
export type RepoRobotWithTokenRow = Prisma.RepoRobotGetPayload<{ select: typeof repoRobotWithTokenSelect }>;

export const taskSelect = Prisma.validator<Prisma.TaskSelect>()({
  id: true,
  groupId: true,
  eventType: true,
  status: true,
  payload: true,
  promptCustom: true,
  title: true,
  projectId: true,
  repoProvider: true,
  repoId: true,
  robotId: true,
  ref: true,
  mrId: true,
  issueId: true,
  retries: true,
  result: true,
  createdAt: true,
  updatedAt: true
});

export type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;
