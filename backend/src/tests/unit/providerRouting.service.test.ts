import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from '../../modelProviders/claudeCode';
import {
  buildFallbackProviderConfigRaw,
  buildProviderRoutingPlan,
  toProviderRoutingResult
} from '../../providerRouting/providerRouting.service';

describe('provider routing service', () => {
  test('selects the fallback provider early in availability-first mode when primary is unavailable', async () => {
    const plan = await buildProviderRoutingPlan({
      primaryProvider: CODEX_PROVIDER_KEY,
      primaryConfigRaw: {
        credentialSource: 'user',
        model: 'gpt-5.1-codex-max',
        sandbox: 'read-only',
        model_reasoning_effort: 'medium',
        routingConfig: {
          mode: 'availability_first',
          fallbackProvider: CLAUDE_CODE_PROVIDER_KEY,
          failoverPolicy: 'fallback_provider_once'
        }
      },
      __internal: {
        resolveCredential: jest.fn(async ({ provider }) => ({
          provider,
          requestedStoredSource: 'user',
          resolvedLayer: provider === CODEX_PROVIDER_KEY ? 'none' : 'user',
          resolvedMethod: provider === CODEX_PROVIDER_KEY ? 'none' : 'user_profile',
          canExecute: provider !== CODEX_PROVIDER_KEY,
          supportsModelListing: provider !== CODEX_PROVIDER_KEY,
          fallbackUsed: false
        })) as any
      }
    });

    expect(plan.selectedProvider).toBe(CLAUDE_CODE_PROVIDER_KEY);
    expect(plan.attempts).toHaveLength(2);

    const result = toProviderRoutingResult(plan);
    expect(result.selectedProvider).toBe(CLAUDE_CODE_PROVIDER_KEY);
    expect(result.attempts[0]).toMatchObject({ provider: CODEX_PROVIDER_KEY, status: 'skipped' });
    expect(result.attempts[1]).toMatchObject({ provider: CLAUDE_CODE_PROVIDER_KEY, status: 'planned' });
  });

  test('derives fallback config from the primary sandbox while avoiding robot-embedded cross-provider credentials', () => {
    const fallbackRaw = buildFallbackProviderConfigRaw({
      provider: CLAUDE_CODE_PROVIDER_KEY,
      primaryProvider: CODEX_PROVIDER_KEY,
      primaryConfigRaw: {
        credentialSource: 'robot',
        credential: { apiKey: 'secret' },
        model: 'gpt-5.1-codex-max',
        sandbox: 'workspace-write',
        model_reasoning_effort: 'medium',
        routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
      }
    });

    const normalized = normalizeClaudeCodeRobotProviderConfig(fallbackRaw);
    expect(normalized.credentialSource).toBe('user');
    expect(normalized.credential).toBeUndefined();
    expect(normalized.sandbox).toBe('workspace-write');
    expect(normalized.sandbox_workspace_write.network_access).toBe(true);
  });
});

