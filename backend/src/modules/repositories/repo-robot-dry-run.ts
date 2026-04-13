import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { buildPrompt } from '../../agent/promptBuilder';
import {
  CODEX_PROVIDER_KEY,
  mergeCodexRobotProviderConfig,
  runCodexExecWithSdk
} from '../../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  mergeClaudeCodeRobotProviderConfig,
  runClaudeCodeExecWithSdk
} from '../../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  mergeGeminiCliRobotProviderConfig,
  runGeminiCliExecWithCli
} from '../../modelProviders/geminiCli';
import {
  resolveProviderExecutionCredential,
  type ResolvedProviderCredentialSummary
} from '../../modelProviders/providerCredentialResolver';
import {
  buildProviderRoutingPlan,
  toProviderRoutingResult,
  updateProviderRoutingAttempt
} from '../../providerRouting/providerRouting.service';
import type { ProviderRoutingResult, RoutedProviderKey } from '../../providerRouting/providerRouting.types';
import type { GlobalRobotWithTokenLike } from '../../types/globalRobot';
import type { RepoScopedModelProviderCredentials } from './repository.service';
import type { RepoRobotWithToken } from './repo-robot.service';
import type { UserModelCredentials } from '../users/user.service';
import type { Repository } from '../../types/repository';
import type { Task } from '../../types/task';
import { resolveProviderRunConfig } from '../../utils/providerRunConfig';

export type RepoRobotDryRunMode = 'render_only' | 'execute_no_side_effect';
export type RepoRobotDryRunSimulationType = 'manual_chat' | 'issue' | 'merge_request' | 'push' | 'custom';

export interface RepoRobotDryRunSimulationInput {
  type?: RepoRobotDryRunSimulationType | null;
  title?: string | null;
  body?: string | null;
  number?: number | string | null;
  branch?: string | null;
  sha?: string | null;
  sourceBranch?: string | null;
  targetBranch?: string | null;
  payload?: unknown;
  eventType?: string | null;
}

export interface RepoRobotDryRunDraftInput {
  name?: string | null;
  promptDefault?: string | null;
  language?: string | null;
  permission?: 'read' | 'write' | string | null;
  modelProvider?: string | null;
  modelProviderConfig?: unknown;
}

export interface RepoRobotDryRunInput {
  mode?: RepoRobotDryRunMode | null;
  simulation?: RepoRobotDryRunSimulationInput | null;
  draft?: RepoRobotDryRunDraftInput | null;
}

export interface RepoRobotDryRunAction {
  type: 'provider_execute' | 'temp_workspace_write' | 'repo_write_blocked' | 'provider_failover';
  summary: string;
}

export interface RepoRobotDryRunResponse {
  renderedPrompt: string;
  resolvedProvider: {
    provider: RoutedProviderKey;
    model: string;
    sandbox: 'read-only' | 'workspace-write';
    networkAccess: boolean;
    routing: ProviderRoutingResult;
  };
  resolvedCredentialSummary: ResolvedProviderCredentialSummary;
  executionPlan: {
    mode: RepoRobotDryRunMode;
    workspaceStrategy: 'isolated_temp';
    outputFileName: string;
    sideEffectProtection: string[];
  };
  simulatedActions: RepoRobotDryRunAction[];
  modelOutput?: string;
  modelError?: string;
  warnings: string[];
}

type DryRunInternal = {
  runCodex?: typeof runCodexExecWithSdk;
  runClaude?: typeof runClaudeCodeExecWithSdk;
  runGemini?: typeof runGeminiCliExecWithCli;
  resolveCredential?: typeof resolveProviderExecutionCredential;
  buildRoutingPlan?: typeof buildProviderRoutingPlan;
};

type DryRunRobot = RepoRobotWithToken | GlobalRobotWithTokenLike;

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeMode = (value: unknown): RepoRobotDryRunMode =>
  value === 'execute_no_side_effect' ? 'execute_no_side_effect' : 'render_only';

const normalizeSimulationType = (value: unknown): RepoRobotDryRunSimulationType => {
  const raw = safeTrim(value);
  if (raw === 'issue' || raw === 'merge_request' || raw === 'push' || raw === 'custom') return raw;
  return 'manual_chat';
};

const normalizePermission = (value: unknown): 'read' | 'write' => (safeTrim(value).toLowerCase() === 'write' ? 'write' : 'read');

const pickProvider = (value: unknown, fallback?: string): RoutedProviderKey => {
  const raw = safeTrim(value).toLowerCase();
  if (raw === CLAUDE_CODE_PROVIDER_KEY) return CLAUDE_CODE_PROVIDER_KEY;
  if (raw === GEMINI_CLI_PROVIDER_KEY) return GEMINI_CLI_PROVIDER_KEY;
  if (raw === CODEX_PROVIDER_KEY) return CODEX_PROVIDER_KEY;
  return pickProvider(fallback, CODEX_PROVIDER_KEY);
};

const toInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Math.trunc(Number(value));
  return fallback;
};

const buildModelProviderConfig = (params: {
  provider: RoutedProviderKey;
  existingProvider?: string | null;
  existing: unknown;
  draft: unknown;
}): unknown => {
  // Preserve the saved provider config when the playground edits do not override it, but reset to provider defaults after provider switches. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
  if (params.draft === undefined || params.draft === null) {
    return params.existingProvider === params.provider ? params.existing : undefined;
  }

  // Preserve hidden embedded API keys for robot-scoped dry-run previews without persisting anything. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
  if (params.provider === CODEX_PROVIDER_KEY) {
    return mergeCodexRobotProviderConfig({ existing: params.existing, next: params.draft });
  }
  if (params.provider === CLAUDE_CODE_PROVIDER_KEY) {
    return mergeClaudeCodeRobotProviderConfig({ existing: params.existing, next: params.draft });
  }
  return mergeGeminiCliRobotProviderConfig({ existing: params.existing, next: params.draft });
};

const buildEffectiveRobot = (params: {
  repoId: string;
  existingRobot?: DryRunRobot | null;
  draft?: RepoRobotDryRunDraftInput | null;
}): DryRunRobot => {
  const now = new Date().toISOString();
  const existing = params.existingRobot ?? null;
  const provider = pickProvider(params.draft?.modelProvider, existing?.modelProvider);
  const modelProviderConfigRaw = buildModelProviderConfig({
    provider,
    existingProvider: existing?.modelProvider,
    existing: existing?.modelProviderConfigRaw,
    draft: params.draft?.modelProviderConfig
  });

  const base = {
    id: existing?.id ?? 'dry-run-robot',
    name: safeTrim(params.draft?.name) || existing?.name || 'dry-run-robot',
    permission: normalizePermission(params.draft?.permission ?? existing?.permission),
    promptDefault: safeTrim(params.draft?.promptDefault) || existing?.promptDefault || '',
    language: safeTrim(params.draft?.language) || existing?.language || undefined,
    modelProvider: provider,
    modelProviderConfig: modelProviderConfigRaw as any,
    modelProviderConfigRaw,
    enabled: true,
    isDefault: Boolean(existing?.isDefault),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existing?.scope === 'global') {
    // Preserve global robot identity during dry runs so shared-robot selectors and task metadata stay consistent. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    return {
      ...existing,
      ...base,
      scope: 'global',
      repoCredentialSource: existing.repoCredentialSource,
      repoCredentialProfileId: existing.repoCredentialProfileId,
      defaultWorkerId: existing.defaultWorkerId,
      dependencyConfig: existing.dependencyConfig,
      defaultBranch: existing.defaultBranch,
      defaultBranchRole: existing.defaultBranchRole,
      repoWorkflowMode: existing.repoWorkflowMode,
      timeWindow: existing.timeWindow
    };
  }

  return {
    ...(existing ?? {}),
    ...base,
    scope: 'repo',
    repoId: existing?.repoId ?? params.repoId,
    hasToken: Boolean(existing?.hasToken),
    repoCredentialSource: existing?.repoCredentialSource,
    repoCredentialProfileId: existing?.repoCredentialProfileId,
    repoCredentialRemark: existing?.repoCredentialRemark,
    cloneUsername: existing?.cloneUsername,
    repoTokenUserId: existing?.repoTokenUserId,
    repoTokenUsername: existing?.repoTokenUsername,
    repoTokenUserName: existing?.repoTokenUserName,
    repoTokenUserEmail: existing?.repoTokenUserEmail,
    repoTokenRepoRole: existing?.repoTokenRepoRole,
    repoTokenRepoRoleDetails: existing?.repoTokenRepoRoleDetails,
    token: existing?.token,
    dependencyConfig: existing?.dependencyConfig,
    defaultBranch: existing?.defaultBranch,
    defaultBranchRole: existing?.defaultBranchRole,
    repoWorkflowMode: existing?.repoWorkflowMode,
    timeWindow: existing?.timeWindow
  };
};

const buildSyntheticTaskAndPayload = (
  repo: Repository,
  simulation: RepoRobotDryRunSimulationInput | null | undefined
): { task: Task; payload: unknown } => {
  const type = normalizeSimulationType(simulation?.type);
  const number = toInteger(simulation?.number, 1);
  const branch = safeTrim(simulation?.branch) || 'main';
  const sha = safeTrim(simulation?.sha) || 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const title = safeTrim(simulation?.title) || 'Dry run preview';
  const body = safeTrim(simulation?.body) || 'Please preview this robot configuration.';
  const sourceBranch = safeTrim(simulation?.sourceBranch) || 'feature/dry-run';
  const targetBranch = safeTrim(simulation?.targetBranch) || 'main';
  const now = new Date().toISOString();

  if (type === 'custom') {
    return {
      task: {
        id: 'dry-run-task',
        eventType: safeTrim(simulation?.eventType) || 'unknown',
        status: 'queued',
        payload: simulation?.payload ?? {},
        repoId: repo.id,
        repoProvider: repo.provider,
        title: title || 'Custom payload',
        retries: 0,
        createdAt: now,
        updatedAt: now
      },
      payload: simulation?.payload ?? {}
    };
  }

  if (type === 'issue') {
    const payload =
      repo.provider === 'github'
        ? {
            issue: {
              id: number,
              number,
              title,
              body,
              html_url: `https://example.invalid/${repo.name}/issues/${number}`
            }
          }
        : {
            issue: {
              id: number,
              iid: number,
              title,
              description: body,
              web_url: `https://example.invalid/${repo.name}/-/issues/${number}`
            }
          };
    return {
      task: {
        id: 'dry-run-task',
        eventType: 'issue',
        status: 'queued',
        payload,
        repoId: repo.id,
        repoProvider: repo.provider,
        issueId: number,
        title,
        retries: 0,
        createdAt: now,
        updatedAt: now
      },
      payload
    };
  }

  if (type === 'merge_request') {
    const payload =
      repo.provider === 'github'
        ? {
            pull_request: {
              id: number,
              number,
              title,
              body,
              html_url: `https://example.invalid/${repo.name}/pull/${number}`,
              head: { ref: sourceBranch },
              base: { ref: targetBranch }
            }
          }
        : {
            object_attributes: {
              id: number,
              iid: number,
              title,
              description: body,
              web_url: `https://example.invalid/${repo.name}/-/merge_requests/${number}`,
              source_branch: sourceBranch,
              target_branch: targetBranch
            }
          };
    return {
      task: {
        id: 'dry-run-task',
        eventType: 'merge_request',
        status: 'queued',
        payload,
        repoId: repo.id,
        repoProvider: repo.provider,
        mrId: number,
        title,
        retries: 0,
        createdAt: now,
        updatedAt: now
      },
      payload
    };
  }

  if (type === 'push') {
    const payload =
      repo.provider === 'github'
        ? {
            ref: `refs/heads/${branch}`,
            after: sha,
            head_commit: { id: sha, message: body || title },
            commits: [{ id: sha, message: body || title }]
          }
        : {
            ref: `refs/heads/${branch}`,
            after: sha,
            checkout_sha: sha,
            commits: [{ id: sha, message: body || title }]
          };
    return {
      task: {
        id: 'dry-run-task',
        eventType: 'push',
        status: 'queued',
        payload,
        repoId: repo.id,
        repoProvider: repo.provider,
        ref: `refs/heads/${branch}`,
        title: `${branch}@${sha.slice(0, 8)}`,
        retries: 0,
        createdAt: now,
        updatedAt: now
      },
      payload
    };
  }

  const payload =
    repo.provider === 'github'
      ? {
          comment: {
            id: 1,
            body,
            user: { login: 'dry-run-user' }
          },
          sender: { login: 'dry-run-user' }
        }
      : {
          object_attributes: {
            id: 1,
            note: body
          },
          user: { username: 'dry-run-user' }
        };
  return {
    task: {
      id: 'dry-run-task',
      eventType: 'note',
      status: 'queued',
      payload,
      repoId: repo.id,
      repoProvider: repo.provider,
      title,
      retries: 0,
      createdAt: now,
      updatedAt: now
    },
    payload
  };
};

const buildSimulatedActions = (params: {
  sandbox: 'read-only' | 'workspace-write';
  mode: RepoRobotDryRunMode;
  routing: ProviderRoutingResult;
  permission: 'read' | 'write';
}): RepoRobotDryRunAction[] => {
  const actions: RepoRobotDryRunAction[] = [
    {
      type: 'provider_execute',
      summary:
        params.mode === 'execute_no_side_effect'
          ? `Run ${params.routing.selectedProvider} in an isolated temporary workspace.`
          : `Preview the ${params.routing.selectedProvider} execution plan without running the model.`
    }
  ];
  if (params.sandbox === 'workspace-write') {
    actions.push({
      type: 'temp_workspace_write',
      summary: 'Workspace-write tools are limited to a temporary sandbox and never touch the real repository.'
    });
  }
  if (params.permission === 'write') {
    actions.push({
      type: 'repo_write_blocked',
      summary: 'Repository write-back, provider comments, and PR/MR creation stay disabled in dry run.'
    });
  }
  if (params.routing.fallbackProvider) {
    actions.push({
      type: 'provider_failover',
      summary: `Provider failover remains available according to the configured routing policy (${params.routing.failoverPolicy}).`
    });
  }
  return actions;
};

const toCredentialSummary = (
  resolved: Awaited<ReturnType<typeof resolveProviderExecutionCredential>>
): ResolvedProviderCredentialSummary => ({
  provider: resolved.provider,
  requestedStoredSource: resolved.requestedStoredSource,
  resolvedLayer: resolved.resolvedLayer,
  resolvedMethod: resolved.resolvedMethod,
  canExecute: resolved.canExecute,
  displayName: resolved.displayName,
  profileId: resolved.profileId,
  apiBaseUrl: resolved.apiBaseUrl,
  supportsModelListing: resolved.supportsModelListing,
  fallbackUsed: resolved.fallbackUsed,
  reason: resolved.reason
});

const executeDryRunModel = async (params: {
  provider: RoutedProviderKey;
  runConfig: ReturnType<typeof resolveProviderRunConfig>;
  promptFile: string;
  outputLastMessageFile: string;
  resolvedCredential: Awaited<ReturnType<typeof resolveProviderExecutionCredential>>;
  tempRoot: string;
  __internal?: DryRunInternal;
}): Promise<{ threadId: string | null; finalResponse: string }> => {
  // Branch on the normalized run config itself so dry-run previews can read provider-only fields without unsafe casts. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
  if (params.runConfig.provider === CODEX_PROVIDER_KEY) {
    return await (params.__internal?.runCodex ?? runCodexExecWithSdk)({
      repoDir: params.tempRoot,
      workspaceDir: params.tempRoot,
      promptFile: params.promptFile,
      model: params.runConfig.normalized.model,
      sandbox: params.runConfig.sandbox,
      modelReasoningEffort: params.runConfig.normalized.model_reasoning_effort,
      apiKey: params.resolvedCredential.apiKey,
      apiBaseUrl: params.resolvedCredential.apiBaseUrl,
      outputLastMessageFile: params.outputLastMessageFile
    });
  }

  if (params.runConfig.provider === CLAUDE_CODE_PROVIDER_KEY) {
    return await (params.__internal?.runClaude ?? runClaudeCodeExecWithSdk)({
      repoDir: params.tempRoot,
      workspaceDir: params.tempRoot,
      promptFile: params.promptFile,
      model: params.runConfig.normalized.model,
      sandbox: params.runConfig.sandbox,
      networkAccess: params.runConfig.networkAccess,
      apiKey: params.resolvedCredential.apiKey,
      apiBaseUrl: params.resolvedCredential.apiBaseUrl,
      outputLastMessageFile: params.outputLastMessageFile
    });
  }

  return await (params.__internal?.runGemini ?? runGeminiCliExecWithCli)({
    repoDir: params.tempRoot,
    workspaceDir: params.tempRoot,
    promptFile: params.promptFile,
    model: params.runConfig.normalized.model,
    sandbox: params.runConfig.sandbox,
    networkAccess: params.runConfig.networkAccess,
    apiKey: params.resolvedCredential.apiKey,
    apiBaseUrl: params.resolvedCredential.apiBaseUrl,
    outputLastMessageFile: params.outputLastMessageFile,
    geminiHomeDir: path.join(params.tempRoot, 'gemini-home')
  });
};

// Reuse the production prompt/provider pipeline for robot playground previews while isolating execution side effects. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
export const runRepoRobotDryRun = async (params: {
  repo: Repository;
  existingRobot?: DryRunRobot | null;
  input?: RepoRobotDryRunInput | null;
  userCredentials?: UserModelCredentials | null;
  globalCredentials?: UserModelCredentials | null;
  repoScopedCredentials?: RepoScopedModelProviderCredentials | null;
  robotsInRepo?: DryRunRobot[];
  skillPromptPrefix?: string;
  __internal?: DryRunInternal;
}): Promise<RepoRobotDryRunResponse> => {
  const mode = normalizeMode(params.input?.mode);
  const robot = buildEffectiveRobot({
    repoId: params.repo.id,
    existingRobot: params.existingRobot,
    draft: params.input?.draft
  });
  if (!safeTrim(robot.promptDefault)) {
    throw new Error('promptDefault is required for dry run');
  }

  const { task, payload } = buildSyntheticTaskAndPayload(params.repo, params.input?.simulation);
  const promptCtx = await buildPrompt({
    task,
    payload,
    repo: params.repo,
    robot,
    robotsInRepo: params.robotsInRepo?.length ? params.robotsInRepo : [robot]
  });
  const renderedPrompt = `${params.skillPromptPrefix ?? ''}${promptCtx.body}`;

  const resolveCredential = params.__internal?.resolveCredential ?? resolveProviderExecutionCredential;
  const routingPlan = await (params.__internal?.buildRoutingPlan ?? buildProviderRoutingPlan)({
    primaryProvider: pickProvider(robot.modelProvider),
    primaryConfigRaw: robot.modelProviderConfigRaw,
    userCredentials: params.userCredentials,
    globalCredentials: params.globalCredentials,
    repoScopedCredentials: params.repoScopedCredentials,
    __internal: { resolveCredential }
  });
  let routing = toProviderRoutingResult(routingPlan);
  const selectedAttempt = routingPlan.attempts.find((attempt) => attempt.provider === routingPlan.selectedProvider) ?? routingPlan.attempts[0];
  const runConfig = resolveProviderRunConfig(selectedAttempt.provider, selectedAttempt.providerConfigRaw);
  let finalRunConfig = runConfig;
  const warnings: string[] = [
    'Dry run never writes the real repository, posts provider comments, or creates PRs/MRs.'
  ];
  if (runConfig.sandbox === 'workspace-write') {
    warnings.push('Workspace-write actions are redirected into a temporary sandbox instead of the checked-out repository.');
  }
  if (runConfig.networkAccess) {
    warnings.push('The selected provider still has network access according to its configured sandbox policy.');
  }

  let resolvedCredential = await resolveCredential({
    provider: selectedAttempt.provider,
    robotConfigRaw: selectedAttempt.providerConfigRaw,
    userCredentials: params.userCredentials,
    globalCredentials: params.globalCredentials,
    repoScopedCredentials: params.repoScopedCredentials
  });
  routing = updateProviderRoutingAttempt(routing, selectedAttempt.provider, {
    credential: {
      requestedStoredSource: resolvedCredential.requestedStoredSource,
      resolvedLayer: resolvedCredential.resolvedLayer,
      resolvedMethod: resolvedCredential.resolvedMethod,
      canExecute: resolvedCredential.canExecute,
      profileId: resolvedCredential.profileId,
      fallbackUsed: resolvedCredential.fallbackUsed,
      reason: resolvedCredential.reason
    }
  });

  let modelOutput: string | undefined;
  let modelError: string | undefined;

  if (mode === 'execute_no_side_effect') {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hookcode-dry-run-'));
    try {
      await mkdir(tempRoot, { recursive: true });
      const promptFile = path.join(tempRoot, '.hookcode_dry_run_prompt.txt');
      const outputLastMessageFile = path.join(tempRoot, runConfig.outputLastMessageFileName);
      await writeFile(promptFile, renderedPrompt, 'utf8');

      const fallbackAttempt =
        routingPlan.selectedProvider === routingPlan.primaryProvider && routingPlan.failoverPolicy === 'fallback_provider_once'
          ? routingPlan.attempts.find((attempt) => attempt.role === 'fallback')
          : undefined;
      const attemptQueue = fallbackAttempt ? [selectedAttempt, fallbackAttempt] : [selectedAttempt];

      for (let index = 0; index < attemptQueue.length; index += 1) {
        const attempt = attemptQueue[index];
        const attemptRunConfig = resolveProviderRunConfig(attempt.provider, attempt.providerConfigRaw);
        routing = updateProviderRoutingAttempt(routing, attempt.provider, {
          status: 'running',
          reason: index === 0 ? 'Selected for dry-run execution.' : 'Running after a failed primary dry run.',
          startedAt: new Date().toISOString()
        });

        const attemptCredential = await resolveCredential({
          provider: attempt.provider,
          robotConfigRaw: attempt.providerConfigRaw,
          userCredentials: params.userCredentials,
          globalCredentials: params.globalCredentials,
          repoScopedCredentials: params.repoScopedCredentials
        });
        routing = updateProviderRoutingAttempt(routing, attempt.provider, {
          credential: {
            requestedStoredSource: attemptCredential.requestedStoredSource,
            resolvedLayer: attemptCredential.resolvedLayer,
            resolvedMethod: attemptCredential.resolvedMethod,
            canExecute: attemptCredential.canExecute,
            profileId: attemptCredential.profileId,
            fallbackUsed: attemptCredential.fallbackUsed,
            reason: attemptCredential.reason
          }
        });

        if (!attemptCredential.canExecute) {
          const message = attemptCredential.reason || `No executable credential is available for provider ${attempt.provider}`;
          routing = updateProviderRoutingAttempt(routing, attempt.provider, {
            status: 'failed',
            error: message,
            finishedAt: new Date().toISOString()
          });
          modelError = message;
          warnings.push(message);
          continue;
        }

        try {
          const result = await executeDryRunModel({
            provider: attempt.provider,
            runConfig: attemptRunConfig,
            promptFile,
            outputLastMessageFile,
            resolvedCredential: attemptCredential,
            tempRoot,
            __internal: params.__internal
          });
          modelOutput = result.finalResponse;
          resolvedCredential = attemptCredential;
          finalRunConfig = attemptRunConfig;
          routing = {
            ...updateProviderRoutingAttempt(routing, attempt.provider, {
              status: 'succeeded',
              finishedAt: new Date().toISOString(),
              reason: 'Dry-run execution succeeded.'
            }),
            finalProvider: attempt.provider,
            failoverTriggered: routing.failoverTriggered || index > 0
          };
          modelError = undefined;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          routing = updateProviderRoutingAttempt(routing, attempt.provider, {
            status: 'failed',
            error: message,
            finishedAt: new Date().toISOString(),
            reason: 'Dry-run execution failed.'
          });
          modelError = message;
          warnings.push(`${attempt.provider} dry run failed: ${message}`);
        }
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  return {
    renderedPrompt,
    resolvedProvider: {
      provider: routing.finalProvider ?? selectedAttempt.provider,
      model: String(finalRunConfig.normalized.model ?? '').trim(),
      sandbox: finalRunConfig.sandbox,
      networkAccess: finalRunConfig.networkAccess,
      routing
    },
    resolvedCredentialSummary: toCredentialSummary(resolvedCredential),
    executionPlan: {
      mode,
      workspaceStrategy: 'isolated_temp',
      outputFileName: finalRunConfig.outputLastMessageFileName,
      sideEffectProtection: [
        'No repository checkout is mutated during dry run.',
        'No provider comment/postback step is executed.',
        'No PR/MR creation step is executed.'
      ]
    },
    simulatedActions: buildSimulatedActions({
      sandbox: finalRunConfig.sandbox,
      mode,
      routing,
      permission: robot.permission
    }),
    modelOutput: modelOutput && modelOutput.trim() ? modelOutput : undefined,
    modelError: modelError && modelError.trim() ? modelError : undefined,
    warnings: Array.from(new Set(warnings.filter((item) => item.trim())))
  };
};
