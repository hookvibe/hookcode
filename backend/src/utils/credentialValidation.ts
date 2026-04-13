export class CredentialValidationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, params: { code: string; details?: Record<string, unknown> }) {
    super(message);
    this.name = 'CredentialValidationError';
    this.code = params.code;
    this.details = params.details;
  }
}

type CredentialValidationScope = 'global' | 'user' | 'repo_scoped';
type CredentialValidationKind = 'model' | 'repo';

const buildRemarkRequiredCode = (params: { scope: CredentialValidationScope; kind: CredentialValidationKind }): string => {
  const scopePrefix =
    params.scope === 'global' ? 'GLOBAL_CREDENTIAL' : params.scope === 'user' ? 'USER_CREDENTIAL' : 'REPO_SCOPED_CREDENTIAL';
  const kindSegment = params.kind === 'model' ? 'MODEL' : 'REPO';
  return `${scopePrefix}_${kindSegment}_PROFILE_REMARK_REQUIRED`;
};

export const createCredentialProfileRemarkRequiredError = (params: {
  scope: CredentialValidationScope;
  kind: CredentialValidationKind;
  provider: string;
  profileId: string;
}): CredentialValidationError => {
  // Centralize credential profile remark validation so global, user, and repo-scoped updates emit stable codes/details without duplicating controller-facing error glue. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  return new CredentialValidationError(
    params.kind === 'model' ? 'model provider credential profile remark is required' : 'repo provider credential profile remark is required',
    {
      code: buildRemarkRequiredCode({ scope: params.scope, kind: params.kind }),
      details: {
        scope: params.scope,
        provider: params.provider,
        profileId: params.profileId
      }
    }
  );
};
