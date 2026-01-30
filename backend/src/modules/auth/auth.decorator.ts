import { SetMetadata } from '@nestjs/common';
import type { PatScopeGroup, PatScopeLevel } from './patScopes';

export const IS_PUBLIC_KEY = 'hookcode:isPublic';
export const IS_HEALTH_CHECK_KEY = 'hookcode:isHealthCheck';
export const ALLOW_QUERY_TOKEN_KEY = 'hookcode:allowQueryToken';
export const AUTH_SCOPE_GROUP_KEY = 'hookcode:authScopeGroup';
export const AUTH_SCOPE_LEVEL_KEY = 'hookcode:authScopeLevel';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Mark a route as "health check". When `AUTH_EXEMPT_HEALTH=true` (default),
 * auth guard will allow unauthenticated access.
 */
export const HealthCheck = () => SetMetadata(IS_HEALTH_CHECK_KEY, true);

/**
 * Allow passing the auth token via query string (?token=...).
 *
 * Notes:
 * - Prefer Authorization headers or cookies whenever possible.
 * - This exists mainly for SSE/EventSource, which cannot set custom headers.
 */
export const AllowQueryToken = () => SetMetadata(ALLOW_QUERY_TOKEN_KEY, true);

// Declare PAT scope group/level metadata for API authorization. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export const AuthScopeGroup = (group: PatScopeGroup) => SetMetadata(AUTH_SCOPE_GROUP_KEY, group);
export const AuthScopeLevel = (level: PatScopeLevel) => SetMetadata(AUTH_SCOPE_LEVEL_KEY, level);
