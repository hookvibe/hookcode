import type { AuthTokenPayload } from '../../auth/authService';
import type { PatScopeMap } from './patScopes';

// Unify session and PAT auth metadata for request context checks. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export type AuthTokenType = 'session' | 'pat';

export interface SessionAuthContext extends AuthTokenPayload {
  tokenType: 'session';
}

export interface PatAuthContext {
  tokenType: 'pat';
  sub: string;
  username?: string;
  iat: number;
  exp?: number | null;
  scopes: PatScopeMap;
  patId: string;
}

export type AuthContext = SessionAuthContext | PatAuthContext;
