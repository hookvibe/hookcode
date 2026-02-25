import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RepoProvider } from '../../types/repository';
import { deriveRepoIdentityFromWebhook, deriveRepoNameFromWebhook } from '../../services/repoHydration';

// Split webhook validation + secret helpers into a dedicated module for reuse. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
const constantTimeEqualHex = (aHex: string, bHex: string): boolean => {
  const a = Buffer.from(aHex, 'utf8');
  const b = Buffer.from(bHex, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const verifyGitlabSecret = (req: any, secret: string | null): { ok: boolean; reason?: string } => {
  if (!secret) return { ok: true };
  const header = (req.header('x-gitlab-token') ?? req.header('X-Gitlab-Token') ?? '').trim();
  if (!header) return { ok: false, reason: 'missing x-gitlab-token' };
  return header === secret ? { ok: true } : { ok: false, reason: 'invalid x-gitlab-token' };
};

export const verifyGithubSecret = (req: any, secret: string | null): { ok: boolean; reason?: string } => {
  if (!secret) return { ok: true };
  const sig256 = (req.header('x-hub-signature-256') ?? '').trim();
  if (!sig256) return { ok: false, reason: 'missing x-hub-signature-256' };

  const rawBody: Buffer | undefined = req.rawBody;
  if (!rawBody) return { ok: false, reason: 'missing rawBody (server misconfigured)' };

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedHeader = `sha256=${expected}`;
  return constantTimeEqualHex(expectedHeader, sig256) ? { ok: true } : { ok: false, reason: 'invalid signature' };
};

const normalizeApiBaseUrlForCompare = (provider: RepoProvider, value: string): string => {
  let url = value.trim().replace(/\/+$/, '');
  if (provider === 'gitlab') {
    url = url.replace(/\/api\/v4$/i, '');
  }
  return url;
};

const deriveExternalIdCandidates = (provider: RepoProvider, payload: any): string[] => {
  const ids = new Set<string>();
  const derived = deriveRepoIdentityFromWebhook(provider, payload).externalId;
  if (typeof derived === 'string' && derived.trim()) ids.add(derived.trim());

  if (provider === 'github') {
    const full = typeof payload?.repository?.full_name === 'string' ? payload.repository.full_name.trim() : '';
    if (full) ids.add(full);
    const numId = payload?.repository?.id;
    if (typeof numId === 'number' && Number.isFinite(numId)) ids.add(String(numId));
  }

  return Array.from(ids);
};

export const validateRepoWebhookBinding = (
  provider: RepoProvider,
  repo: { externalId?: string; apiBaseUrl?: string },
  payload: any
): { ok: true; derived: ReturnType<typeof deriveRepoIdentityFromWebhook>; externalIdCandidates: string[] } | { ok: false; status: number; body: any } => {
  const derived = deriveRepoIdentityFromWebhook(provider, payload);
  const externalIdCandidates = deriveExternalIdCandidates(provider, payload);
  if (!externalIdCandidates.length) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Webhook payload is missing repository identity', code: 'WEBHOOK_REPO_ID_MISSING' }
    };
  }

  const expectedExternalId = (repo.externalId ?? '').trim();
  if (expectedExternalId && !externalIdCandidates.includes(expectedExternalId)) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Webhook repository mismatch',
        code: 'WEBHOOK_REPO_BINDING_MISMATCH',
        expectedExternalId,
        actualExternalIds: externalIdCandidates
      }
    };
  }

  const expectedBaseUrl = (repo.apiBaseUrl ?? '').trim();
  const actualBaseUrl = (derived.apiBaseUrl ?? '').trim();
  if (expectedBaseUrl && actualBaseUrl) {
    const expectedNormalized = normalizeApiBaseUrlForCompare(provider, expectedBaseUrl);
    const actualNormalized = normalizeApiBaseUrlForCompare(provider, actualBaseUrl);
    if (expectedNormalized && actualNormalized && expectedNormalized !== actualNormalized) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'Webhook apiBaseUrl mismatch',
          code: 'WEBHOOK_REPO_BASE_URL_MISMATCH',
          expectedApiBaseUrl: expectedNormalized,
          actualApiBaseUrl: actualNormalized
        }
      };
    }
  }

  return { ok: true, derived, externalIdCandidates };
};

const normalizeRepoNameForCompare = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
};

const isSlugLikeRepoName = (value: string): boolean => /^[a-z0-9][a-z0-9._-]*$/i.test(value);

export const validateRepoWebhookNameBinding = (
  provider: RepoProvider,
  repo: { name?: string | null; externalId?: string | null },
  payload: any
): { ok: true } | { ok: false; status: number; body: any } => {
  const expectedExternalId = (repo.externalId ?? '').trim();
  if (expectedExternalId) return { ok: true };

  const expectedName = normalizeRepoNameForCompare(repo.name ?? '');
  if (!expectedName) return { ok: true };

  const derivedName = deriveRepoNameFromWebhook(provider, payload);
  const actualName = normalizeRepoNameForCompare(derivedName ?? '');
  if (!actualName) return { ok: true };

  const expectedLower = expectedName.toLowerCase();
  const actualLower = actualName.toLowerCase();
  if (expectedName.includes('/')) {
    if (expectedLower === actualLower) return { ok: true };
  } else if (isSlugLikeRepoName(expectedName) && actualName.includes('/')) {
    const actualLast = actualName.split('/').pop() ?? '';
    if (actualLast && actualLast.toLowerCase() === expectedLower) return { ok: true };
  } else if (expectedLower === actualLower) {
    return { ok: true };
  } else {
    // Not enough signal (non-slug-like configured name), skip name binding.
    return { ok: true };
  }

  if (expectedLower !== actualLower) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Webhook repository name mismatch',
        code: 'WEBHOOK_REPO_NAME_MISMATCH',
        expectedName,
        actualName
      }
    };
  }

  return { ok: true };
};

export const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Webhook ingress guard (Webhook module -> provider routing):
 * - Business behavior: detect provider-mismatch deliveries (e.g., GitHub headers hitting the GitLab endpoint) and return a clear 400.
 * - Key steps: if the expected provider event header is absent, look for the other provider's signature/event/user-agent hints.
 * - Change record (2026-01-15): added mismatch detection to avoid misleading "missing x-gitlab-token"/"missing x-hub-signature-256" errors.
 * - Usage: called before secret verification in each provider handler to short-circuit with a provider hint.
 * - Notes/pitfalls: detection is heuristic and we intentionally do NOT auto-route requests across providers for security clarity.
 */
export const detectWebhookProviderMismatch = (
  expectedProvider: RepoProvider,
  req: Request,
  expectedEventName: string
): { expectedProvider: RepoProvider; detectedProvider: RepoProvider; hint: string; message: string } | null => {
  const userAgent = safeString(req.header('user-agent') ?? '').trim();
  const hasGitlabEvent = Boolean(safeString(req.header('x-gitlab-event') ?? '').trim());
  const hasGitlabToken = Boolean(safeString(req.header('x-gitlab-token') ?? req.header('X-Gitlab-Token') ?? '').trim());
  const hasGitlabDelivery = Boolean(safeString(req.header('x-gitlab-event-uuid') ?? req.header('X-Gitlab-Event-UUID') ?? '').trim());
  const hasGithubEvent = Boolean(safeString(req.header('x-github-event') ?? '').trim());
  const hasGithubDelivery = Boolean(safeString(req.header('x-github-delivery') ?? '').trim());
  const hasGithubSignature = Boolean(
    safeString(req.header('x-hub-signature-256') ?? req.header('x-hub-signature') ?? '').trim()
  );
  const looksGithub = hasGithubEvent || hasGithubDelivery || hasGithubSignature || /github-hookshot/i.test(userAgent);
  const looksGitlab = hasGitlabEvent || hasGitlabToken || hasGitlabDelivery;

  if (expectedEventName) return null;

  if (expectedProvider === 'gitlab' && looksGithub) {
    return {
      expectedProvider: 'gitlab',
      detectedProvider: 'github',
      hint: '/api/webhook/github/:repoId',
      message: 'github webhook headers detected on gitlab endpoint'
    };
  }

  if (expectedProvider === 'github' && looksGitlab) {
    return {
      expectedProvider: 'github',
      detectedProvider: 'gitlab',
      hint: '/api/webhook/gitlab/:repoId',
      message: 'gitlab webhook headers detected on github endpoint'
    };
  }

  return null;
};
