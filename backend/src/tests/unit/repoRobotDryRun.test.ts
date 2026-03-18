import { runRepoRobotDryRun } from '../../modules/repositories/repo-robot-dry-run';
import type { RepoRobotWithToken } from '../../modules/repositories/repo-robot.service';
import type { Repository } from '../../types/repository';

const iso = new Date(0).toISOString();

const baseRepo = (): Repository => ({
  id: 'repo-1',
  provider: 'gitlab',
  name: 'hookcode',
  branches: [{ name: 'main', isDefault: true }],
  enabled: true,
  createdAt: iso,
  updatedAt: iso
});

const baseRobot = (): RepoRobotWithToken => ({
  id: 'robot-1',
  repoId: 'repo-1',
  name: 'hookcode-review',
  permission: 'write',
  hasToken: false,
  promptDefault: 'Default prompt',
  modelProvider: 'codex',
  modelProviderConfig: {
    credentialSource: 'user',
    model: 'gpt-test',
    sandbox: 'read-only',
    model_reasoning_effort: 'medium',
    routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
  } as any,
  modelProviderConfigRaw: {
    credentialSource: 'user',
    model: 'gpt-test',
    sandbox: 'read-only',
    model_reasoning_effort: 'medium',
    routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
  },
  enabled: true,
  isDefault: true,
  createdAt: iso,
  updatedAt: iso
});

const resolvedCredential = {
  provider: 'codex' as const,
  requestedStoredSource: 'user' as const,
  resolvedLayer: 'user' as const,
  resolvedMethod: 'user_profile' as const,
  canExecute: true,
  supportsModelListing: true,
  fallbackUsed: false
};

describe('runRepoRobotDryRun', () => {
  // Keep dry-run tests deterministic by bypassing local runtime auth detection and provider CLIs. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
  test('renders the final prompt for payload-backed issue simulations without executing the model', async () => {
    const result = await runRepoRobotDryRun({
      repo: baseRepo(),
      existingRobot: {
        ...baseRobot(),
        promptDefault: 'Issue={{issue.title}} Body={{issue.body}} Branch={{repo.defaultBranch}}'
      },
      input: {
        mode: 'render_only',
        simulation: {
          type: 'issue',
          number: 7,
          title: 'Issue from playground',
          body: 'Issue body from playground'
        }
      },
      __internal: {
        resolveCredential: jest.fn().mockResolvedValue(resolvedCredential)
      }
    });

    expect(result.renderedPrompt).toContain('Issue=Issue from playground');
    expect(result.renderedPrompt).toContain('Body=Issue body from playground');
    expect(result.renderedPrompt).toContain('Branch=main');
    expect(result.modelOutput).toBeUndefined();
    expect(result.resolvedProvider.provider).toBe('codex');
    expect(result.resolvedCredentialSummary.canExecute).toBe(true);
  });

  test('falls back to the configured secondary provider when the primary dry run fails', async () => {
    const runCodex = jest.fn().mockRejectedValue(new Error('primary failed'));
    const runClaude = jest.fn().mockResolvedValue({ threadId: 'thread-2', finalResponse: 'fallback response' });
    const resolveCredential = jest.fn().mockImplementation(async ({ provider }: { provider: string }) => ({
      ...resolvedCredential,
      provider: provider === 'claude_code' ? 'claude_code' : 'codex'
    }));

    const result = await runRepoRobotDryRun({
      repo: baseRepo(),
      existingRobot: {
        ...baseRobot(),
        promptDefault: 'Hello {{comment.body}}',
        modelProviderConfig: {
          credentialSource: 'user',
          model: 'gpt-test',
          sandbox: 'read-only',
          model_reasoning_effort: 'medium',
          routingConfig: {
            mode: 'fixed',
            fallbackProvider: 'claude_code',
            failoverPolicy: 'fallback_provider_once'
          }
        } as any,
        modelProviderConfigRaw: {
          credentialSource: 'user',
          model: 'gpt-test',
          sandbox: 'read-only',
          model_reasoning_effort: 'medium',
          routingConfig: {
            mode: 'fixed',
            fallbackProvider: 'claude_code',
            failoverPolicy: 'fallback_provider_once'
          }
        }
      },
      input: {
        mode: 'execute_no_side_effect',
        simulation: {
          type: 'manual_chat',
          body: 'hello from playground'
        }
      },
      __internal: {
        resolveCredential,
        runCodex,
        runClaude
      }
    });

    expect(runCodex).toHaveBeenCalled();
    expect(runClaude).toHaveBeenCalled();
    expect(result.modelOutput).toBe('fallback response');
    expect(result.resolvedProvider.provider).toBe('claude_code');
    expect(result.resolvedProvider.routing.failoverTriggered).toBe(true);
    expect(result.warnings.some((item) => item.includes('primary failed'))).toBe(true);
  });
});
