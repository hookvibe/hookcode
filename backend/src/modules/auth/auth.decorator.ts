import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'hookcode:isPublic';
export const IS_HEALTH_CHECK_KEY = 'hookcode:isHealthCheck';
export const ALLOW_QUERY_TOKEN_KEY = 'hookcode:allowQueryToken';

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
