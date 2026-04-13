import { resolveAutomationActions } from '../../services/automationEngine';
import type { RepoAutomationConfig, AutomationRule } from '../../types/automation';
import type { Repository, RepoProvider } from '../../types/repository';
import type { TaskEventType } from '../../types/task';
import { attachTaskSchedule, isTimeWindowActive, resolveTaskSchedule } from '../../utils/timeWindow';
import type { UserModelCredentials } from '../users/user.service';
import type { RepoScopedModelProviderCredentials } from '../repositories/repository.service';
import type { RepoAutomationService } from '../repositories/repo-automation.service';
import type { RobotCatalogService, SharedRobotWithToken } from '../repositories/robot-catalog.service';
import type { TaskService } from '../tasks/task.service';
import { runRepoRobotDryRun } from '../repositories/repo-robot-dry-run';
import { buildGithubTaskMeta } from './webhook.meta';
import { buildTaskMeta } from './webhook.meta';
import { mapGithubAutomationEvent, mapGitlabAutomationEvent } from './webhook.automation';
import { canCreateGithubAutomationTask, canCreateGitlabAutomationTask } from './webhook.guard';
import type { AutomationEventMapping } from './webhook.types';
import type { WebhookDryRunResult, WebhookErrorLayer, WebhookReplayMode, WebhookResolvedActionSnapshot, WebhookTraceRecorder } from './webhook-debug';

export interface ExecuteWebhookAutomationDeps {
  taskService: TaskService;
  robotCatalogService: RobotCatalogService;
  repoAutomationService: RepoAutomationService;
}

export interface WebhookReplaySelection {
  mode: WebhookReplayMode;
  robotId?: string;
  ruleId?: string;
  storedActions?: WebhookResolvedActionSnapshot[];
}

export interface ExecuteWebhookAutomationParams {
  provider: RepoProvider;
  repo: Repository;
  eventName: string;
  payload: any;
  actorUserId?: string;
  dryRun?: boolean;
  trace: WebhookTraceRecorder;
  selection: WebhookReplaySelection;
  dryRunContext?: {
    userCredentials?: UserModelCredentials | null;
    globalCredentials?: UserModelCredentials | null;
    repoScopedCredentials?: RepoScopedModelProviderCredentials | null;
    skillPromptPrefix?: string;
  };
}

export interface ExecuteWebhookAutomationResult {
  result: 'accepted' | 'skipped' | 'rejected' | 'error';
  code?: string;
  message?: string;
  errorLayer?: WebhookErrorLayer;
  mappedEventType?: TaskEventType;
  matchedRuleIds: string[];
  matchedRobotIds: string[];
  createdTasks: Array<{ id: string; robotId: string; groupId?: string }>;
  taskIds: string[];
  taskGroupIds: string[];
  resolvedActions: WebhookResolvedActionSnapshot[];
  dryRunResult?: WebhookDryRunResult;
}

type TaskMetaFactory = (eventType: TaskEventType, payload: any) => { title?: string; projectId?: number; ref?: string; mrId?: number; issueId?: number };

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const dedupeStrings = (values: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = safeTrim(value);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
};

const buildPromptCustom = (
  robot: Pick<SharedRobotWithToken, 'promptDefault'>,
  action?: Pick<{ promptOverride?: string; promptPatch?: string }, 'promptOverride' | 'promptPatch'> | null
): string | null => {
  const override = safeTrim(action?.promptOverride);
  if (override) return override;
  const base = safeTrim(robot.promptDefault);
  const patch = safeTrim(action?.promptPatch);
  const combined = [base, patch].filter(Boolean).join('\n\n').trim();
  return combined ? combined : null;
};

const resolveProviderMapping = (provider: RepoProvider, eventName: string, payload: any): AutomationEventMapping | null => {
  return provider === 'github' ? mapGithubAutomationEvent(eventName, payload) : mapGitlabAutomationEvent(eventName, payload);
};

const resolveProviderGuard = (
  provider: RepoProvider,
  eventType: TaskEventType,
  payload: any,
  robots: SharedRobotWithToken[]
): { allowed: boolean; reason?: string } => {
  return provider === 'github'
    ? canCreateGithubAutomationTask(eventType, payload, robots)
    : canCreateGitlabAutomationTask(eventType, payload, robots);
};

const resolveTaskMetaFactory = (provider: RepoProvider): TaskMetaFactory =>
  provider === 'github' ? buildGithubTaskMeta : buildTaskMeta;

const getRuleById = (config: RepoAutomationConfig, eventType: string, ruleId: string): AutomationRule | null => {
  const eventConfig = config.events?.[eventType];
  if (!eventConfig) return null;
  const rules = Array.isArray(eventConfig.rules) ? eventConfig.rules : [];
  return rules.find((rule) => rule.id === ruleId) ?? null;
};

const resolveCurrentActions = (params: {
  repo: Repository;
  payload: any;
  robots: SharedRobotWithToken[];
  config: RepoAutomationConfig;
  mappedEventType: TaskEventType;
  selection: WebhookReplaySelection;
}): { actions: WebhookResolvedActionSnapshot[]; message?: string; code?: string } => {
  const actions = resolveAutomationActions({
    eventType: params.mappedEventType,
    payload: params.payload,
    robots: params.robots,
    config: params.config,
    repo: params.repo
  }).map((action) => ({
    ruleId: action.ruleId,
    robotId: action.robotId,
    promptCustom: action.promptCustom ?? null,
    timeWindow: action.timeWindow ?? null,
    source: params.selection.ruleId ? 'override_rule' : 'current_config'
  } satisfies WebhookResolvedActionSnapshot));

  let filtered: WebhookResolvedActionSnapshot[] = actions;
  if (params.selection.ruleId) {
    filtered = filtered.filter((action) => action.ruleId === params.selection.ruleId);
    if (!filtered.length) {
      const rule = getRuleById(params.config, params.mappedEventType, params.selection.ruleId);
      if (!rule || !rule.enabled) {
        return { actions: [], code: 'RULE_NOT_FOUND', message: 'selected rule not found or disabled' };
      }
    }
  }

  if (params.selection.robotId) {
    filtered = filtered.filter((action) => action.robotId === params.selection.robotId);
    if (!filtered.length) {
      const robot = params.robots.find((item) => item.id === params.selection.robotId);
      if (!robot || !robot.enabled) {
        return { actions: [], code: 'ROBOT_NOT_FOUND', message: 'selected robot not found or disabled' };
      }
      const selectedRule = params.selection.ruleId ? getRuleById(params.config, params.mappedEventType, params.selection.ruleId) : null;
      filtered = [
        {
          ruleId: selectedRule?.id ?? 'override-robot',
          robotId: robot.id,
          promptCustom: buildPromptCustom(robot, null),
          timeWindow: selectedRule?.timeWindow ?? null,
          source: params.selection.ruleId ? 'override_rule' : 'override_robot'
        }
      ];
    }
  }

  return { actions: filtered };
};

const resolveStoredActions = (params: {
  robots: SharedRobotWithToken[];
  selection: WebhookReplaySelection;
}): { actions: WebhookResolvedActionSnapshot[]; code?: string; message?: string } => {
  const stored = Array.isArray(params.selection.storedActions) ? params.selection.storedActions : [];
  const availableRobotIds = new Set(params.robots.filter((robot) => robot.enabled).map((robot) => robot.id));
  let actions = stored.filter((action) => availableRobotIds.has(action.robotId)).map((action) => ({ ...action, source: 'stored_actions' as const }));

  if (params.selection.ruleId) actions = actions.filter((action) => action.ruleId === params.selection.ruleId);
  if (params.selection.robotId) actions = actions.filter((action) => action.robotId === params.selection.robotId);

  if (!actions.length) {
    return { actions: [], code: 'STORED_ACTIONS_UNAVAILABLE', message: 'stored actions are not available for replay' };
  }

  return { actions };
};

// Share the webhook action-resolution and task-creation pipeline between live ingress and replay APIs. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const executeWebhookAutomation = async (
  deps: ExecuteWebhookAutomationDeps,
  params: ExecuteWebhookAutomationParams
): Promise<ExecuteWebhookAutomationResult> => {
  params.trace.addStep({
    key: 'received',
    title: 'Webhook event received',
    status: 'success',
    meta: { provider: params.provider, eventName: params.eventName, replayMode: params.selection.mode, dryRun: Boolean(params.dryRun) }
  });

  const robots = (await deps.robotCatalogService.listAvailableByRepoWithToken(params.repo.id)).filter((robot) => robot.enabled);
  params.trace.addStep({
    key: 'robots',
    title: 'Enabled robots loaded',
    status: robots.length ? 'success' : 'failed',
    message: robots.length ? `${robots.length} enabled robot(s) available.` : 'No enabled robot configured.',
    meta: { robotIds: robots.map((robot) => robot.id) }
  });
  if (!robots.length) {
    return {
      result: 'skipped',
      message: 'no enabled robot configured',
      errorLayer: 'robot_resolution',
      matchedRuleIds: [],
      matchedRobotIds: [],
      createdTasks: [],
      taskIds: [],
      taskGroupIds: [],
      resolvedActions: []
    };
  }

  const mapped = resolveProviderMapping(params.provider, params.eventName, params.payload);
  params.trace.addStep({
    key: 'mapping',
    title: 'Provider event mapped',
    status: mapped ? 'success' : 'failed',
    message: mapped ? `Mapped to ${mapped.eventType}.` : 'Event not supported.',
    meta: mapped ? { eventType: mapped.eventType, subType: mapped.subType } : undefined
  });
  if (!mapped) {
    return {
      result: 'skipped',
      message: 'event not supported',
      errorLayer: 'event_mapping',
      matchedRuleIds: [],
      matchedRobotIds: [],
      createdTasks: [],
      taskIds: [],
      taskGroupIds: [],
      resolvedActions: []
    };
  }

  const mappedEventType = mapped.eventType;
  const payload = { ...params.payload, __subType: mapped.subType };
  const guard = resolveProviderGuard(params.provider, mappedEventType, payload, robots);
  params.trace.addStep({
    key: 'guard',
    title: 'Webhook guard evaluated',
    status: guard.allowed ? 'success' : 'failed',
    message: guard.allowed ? 'Webhook event passed guard checks.' : guard.reason ?? 'Webhook event did not pass guard checks.'
  });
  if (!guard.allowed) {
    return {
      result: 'skipped',
      message: guard.reason,
      errorLayer: 'guard',
      mappedEventType,
      matchedRuleIds: [],
      matchedRobotIds: [],
      createdTasks: [],
      taskIds: [],
      taskGroupIds: [],
      resolvedActions: []
    };
  }

  const automationConfig = await deps.repoAutomationService.getConfig(params.repo.id);
  const actionResolution =
    params.selection.mode === 'stored_actions'
      ? resolveStoredActions({ robots, selection: params.selection })
      : resolveCurrentActions({
          repo: params.repo,
          payload,
          robots,
          config: automationConfig,
          mappedEventType,
          selection: params.selection
        });
  const resolvedActions = actionResolution.actions;

  params.trace.addStep({
    key: 'rules',
    title: 'Automation actions resolved',
    status: resolvedActions.length ? 'success' : 'failed',
    code: actionResolution.code,
    message: resolvedActions.length ? `Resolved ${resolvedActions.length} action(s).` : actionResolution.message ?? 'No automation rule matched.',
    meta: { actionCount: resolvedActions.length }
  });
  params.trace.setResolvedActions(resolvedActions);

  if (!resolvedActions.length) {
    return {
      result: 'skipped',
      code: actionResolution.code,
      message: actionResolution.message ?? 'no automation rule matched',
      errorLayer: actionResolution.code === 'ROBOT_NOT_FOUND' || actionResolution.code === 'STORED_ACTIONS_UNAVAILABLE' ? 'robot_resolution' : 'rule_match',
      mappedEventType,
      matchedRuleIds: [],
      matchedRobotIds: [],
      createdTasks: [],
      taskIds: [],
      taskGroupIds: [],
      resolvedActions
    };
  }

  const matchedRuleIds = dedupeStrings(resolvedActions.map((action) => action.ruleId));
  const matchedRobotIds = dedupeStrings(resolvedActions.map((action) => action.robotId));

  if (params.dryRun) {
    const dryRunResults: WebhookDryRunResult['results'] = [];
    for (const action of resolvedActions) {
      const robot = robots.find((item) => item.id === action.robotId);
      if (!robot) {
        dryRunResults.push({
          robotId: action.robotId,
          ruleId: action.ruleId,
          ok: false,
          summary: { provider: 'unknown', model: 'unknown', sandbox: 'read-only', networkAccess: false },
          warnings: [],
          modelError: 'Robot not found for dry run.'
        });
        continue;
      }

      try {
        const dryRun = await runRepoRobotDryRun({
          repo: params.repo,
          existingRobot: {
            ...robot,
            promptDefault: action.promptCustom ?? robot.promptDefault
          },
          input: {
            mode: 'render_only',
            simulation: {
              type: 'custom',
              eventType: mappedEventType,
              payload
            }
          },
          userCredentials: params.dryRunContext?.userCredentials ?? null,
          globalCredentials: params.dryRunContext?.globalCredentials ?? null,
          repoScopedCredentials: params.dryRunContext?.repoScopedCredentials ?? null,
          robotsInRepo: robots,
          skillPromptPrefix: params.dryRunContext?.skillPromptPrefix
        });

        dryRunResults.push({
          robotId: robot.id,
          ruleId: action.ruleId,
          ok: true,
          summary: {
            provider: dryRun.resolvedProvider.provider,
            model: dryRun.resolvedProvider.model,
            sandbox: dryRun.resolvedProvider.sandbox,
            networkAccess: dryRun.resolvedProvider.networkAccess
          },
          warnings: dryRun.warnings,
          modelOutput: dryRun.modelOutput,
          modelError: dryRun.modelError
        });
      } catch (err) {
        dryRunResults.push({
          robotId: robot.id,
          ruleId: action.ruleId,
          ok: false,
          summary: { provider: robot.modelProvider ?? 'unknown', model: 'unknown', sandbox: 'read-only', networkAccess: false },
          warnings: [],
          modelError: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const dryRunResult: WebhookDryRunResult = {
      mode: params.selection.mode,
      results: dryRunResults
    };
    params.trace.setDryRunResult(dryRunResult);
    params.trace.addStep({
      key: 'dry-run',
      title: 'Replay dry run executed',
      status: dryRunResults.every((item) => item.ok) ? 'success' : dryRunResults.some((item) => item.ok) ? 'skipped' : 'failed',
      message: `${dryRunResults.length} dry-run result(s) captured.`
    });

    return {
      result: 'accepted',
      message: 'dry run completed',
      mappedEventType,
      matchedRuleIds,
      matchedRobotIds,
      createdTasks: [],
      taskIds: [],
      taskGroupIds: [],
      resolvedActions,
      dryRunResult
    };
  }

  const buildMeta = resolveTaskMetaFactory(params.provider);
  const baseMeta = buildMeta(mappedEventType, payload);
  const createdTasks: Array<{ id: string; robotId: string; groupId?: string }> = [];

  for (const action of resolvedActions) {
    const robot = robots.find((item) => item.id === action.robotId);
    const title = baseMeta.title
      ? `${baseMeta.title} · ${robot?.name ?? action.robotId}`
      : robot?.name
        ? `${robot.name} · ${mappedEventType}`
        : undefined;

    const schedule = resolveTaskSchedule({
      triggerWindow: action.timeWindow ?? null,
      robotWindow: robot?.timeWindow ?? null,
      ruleId: action.ruleId
    });
    const scheduleActive = schedule ? isTimeWindowActive(schedule.window) : true;
    if (schedule && schedule.source === 'trigger' && !scheduleActive) {
      const alreadyQueued = await deps.taskService.hasQueuedTaskForRule({
        repoId: params.repo.id,
        robotId: action.robotId,
        ruleId: schedule.ruleId ?? action.ruleId
      });
      if (alreadyQueued) continue;
    }

    const task = await deps.taskService.createTask(mappedEventType, attachTaskSchedule(payload, schedule), {
      ...baseMeta,
      title,
      repoId: params.repo.id,
      repoProvider: params.provider,
      robotId: action.robotId,
      promptCustom: action.promptCustom ?? null,
      actorUserId: params.actorUserId
    });
    createdTasks.push({ id: task.id, robotId: action.robotId, groupId: task.groupId });
  }

  const taskIds = createdTasks.map((task) => task.id);
  const taskGroupIds = dedupeStrings(createdTasks.map((task) => task.groupId));
  params.trace.setTaskLinks(taskIds, taskGroupIds);
  params.trace.addStep({
    key: 'tasks',
    title: 'Tasks enqueued',
    status: 'success',
    message: `Created ${taskIds.length} task(s).`,
    meta: { taskIds, taskGroupIds }
  });

  return {
    result: 'accepted',
    message: taskIds.length ? 'tasks created' : 'no tasks created after schedule checks',
    mappedEventType,
    matchedRuleIds,
    matchedRobotIds,
    createdTasks,
    taskIds,
    taskGroupIds,
    resolvedActions
  };
};
