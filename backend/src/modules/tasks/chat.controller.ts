import { BadRequestException, Controller, HttpException, InternalServerErrorException, NotFoundException, Post, Body } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RepoRobotService } from '../repositories/repo-robot.service';
import { RepositoryService } from '../repositories/repository.service';
import { buildChatTaskPayload } from '../../services/chatPayload';
import { isTruthy } from '../../utils/env';
import { normalizeString } from '../../utils/parse';
import { attachTaskSchedule, normalizeTimeWindow, resolveTaskSchedule } from '../../utils/timeWindow';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';
import { ChatExecuteRequestDto, ChatExecuteResponseDto } from './dto/chat-swagger.dto';

/**
 * Chat API (manual trigger):
 * - Business context: allow users to run tasks from the console without Webhooks.
 * - This endpoint creates a Task and binds it to a TaskGroup (create on first run, reuse on subsequent runs).
 *
 * Change record:
 * - 2026-01-10: Added `/chat` to support the new frontend Chat page and the "run chat" embeds in task/group pages.
 */

const normalizeSnippet = (text: string, maxLen: number): string => {
  const merged = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!merged) return '';
  if (merged.length <= maxLen) return merged;
  return `${merged.slice(0, maxLen - 1)}…`;
};

const hasCommentBodyVar = (template: string): boolean => /\{\{\s*comment\.body\s*\}\}/.test(template);

const buildChatPromptCustom = (robotTemplate: string): string => {
  const base = String(robotTemplate ?? '').trim();
  if (!base) return '';

  // Ensure the user input is included even when the robot template was originally designed for non-comment events.
  // - Business intent: Chat is console-initiated, but we keep using `comment.body` as the canonical variable.
  // - Pitfall: some robots already include `{{comment.body}}`; avoid duplicating the input.
  const patch = [
    '--- HookCode Chat (console manual trigger) ---',
    'Change record: injected by /chat API to guarantee the user input is part of the prompt.',
    hasCommentBodyVar(base) ? '' : 'User request:\n{{comment.body}}'
  ]
    .filter(Boolean)
    .join('\n');

  return [base, patch].filter(Boolean).join('\n\n').trim();
};

@AuthScopeGroup('tasks') // Scope chat APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('chat')
@ApiTags('Chat')
@ApiBearerAuth('bearerAuth')
export class ChatController {
  constructor(
    private readonly taskService: TaskService,
    private readonly repositoryService: RepositoryService,
    private readonly repoRobotService: RepoRobotService,
    private readonly taskRunner: TaskRunner
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Execute a chat task (manual trigger)',
    description:
      'Create a queued task without Webhooks. If taskGroupId is not provided, a new TaskGroup(kind=chat) will be created.',
    operationId: 'chat_execute'
  })
  @ApiOkResponse({ description: 'OK', type: ChatExecuteResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async execute(@Body() body: ChatExecuteRequestDto) {
    try {
      const repoId = normalizeString((body as any)?.repoId);
      const robotId = normalizeString((body as any)?.robotId);
      const taskGroupId = normalizeString((body as any)?.taskGroupId);
      const text = typeof (body as any)?.text === 'string' ? String((body as any).text).trim() : '';

      if (!repoId) throw new BadRequestException({ error: 'repoId is required' });
      if (!robotId) throw new BadRequestException({ error: 'robotId is required' });
      if (!text) throw new BadRequestException({ error: 'text is required' });

      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Prevent manual-trigger tasks for archived repos (archived area should be read-only). qnp1mtxhzikhbi0xspbc
      if (repo.archivedAt) throw new BadRequestException({ error: 'Repo is archived' });
      if (!repo.enabled) throw new BadRequestException({ error: 'Repo is disabled' });

      const robot = await this.repoRobotService.getById(robotId);
      if (!robot || robot.repoId !== repoId) throw new NotFoundException({ error: 'Robot not found' });
      if (!robot.enabled) throw new BadRequestException({ error: 'Robot is disabled' });

      // Parse optional chat-level time windows for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const timeWindowRaw = (body as any)?.timeWindow;
      const timeWindow =
        timeWindowRaw === undefined || timeWindowRaw === null ? null : normalizeTimeWindow(timeWindowRaw);
      if (timeWindowRaw !== undefined && timeWindowRaw !== null && !timeWindow) {
        throw new BadRequestException({ error: 'timeWindow is invalid' });
      }

      const group = taskGroupId
        ? await this.taskService.getTaskGroup(taskGroupId)
        : await this.taskService.createManualTaskGroup({
            kind: 'chat',
            repoProvider: repo.provider,
            repoId,
            robotId,
            title: `Chat · ${normalizeSnippet(text, 80) || repo.name || repo.id}`
          });
      if (!group) throw new NotFoundException({ error: 'Task group not found' });
      if (group.repoId && group.repoId !== repoId) {
        throw new BadRequestException({ error: 'Task group repo mismatch' });
      }

      const promptCustom = buildChatPromptCustom(robot.promptDefault ?? '');
      if (!promptCustom) {
        throw new BadRequestException({ error: 'Robot prompt template is required' });
      }

      // Resolve chat > robot time windows and persist scheduling metadata on the task payload. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const schedule = resolveTaskSchedule({
        chatWindow: timeWindow,
        robotWindow: robot.timeWindow ?? null
      });
      const payload = attachTaskSchedule(buildChatTaskPayload({ repo, text, author: 'console' }), schedule);
      const title = `Chat · ${robot.name} · ${normalizeSnippet(text, 80) || 'Task'}`.trim();

      const created = await this.taskService.createTaskInGroup(
        group.id,
        'chat',
        payload,
        {
          title,
          repoId,
          repoProvider: repo.provider,
          robotId,
          promptCustom
        },
        { updateGroupRobotId: group.kind === 'chat' }
      );

      if (isTruthy(process.env.INLINE_WORKER_ENABLED, true)) {
        this.taskRunner.trigger().catch((err: unknown) => console.error('[chat] trigger task runner failed', err));
      }

      const [taskWithMeta, groupWithMeta] = await Promise.all([
        this.taskService.getTask(created.id, { includeMeta: true }),
        this.taskService.getTaskGroup(group.id, { includeMeta: true })
      ]);
      if (!taskWithMeta) throw new NotFoundException({ error: 'Task not found' });
      if (!groupWithMeta) throw new NotFoundException({ error: 'Task group not found' });

      return { task: taskWithMeta as any, taskGroup: groupWithMeta as any };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[chat] execute failed', err);
      throw new InternalServerErrorException({ error: 'Failed to execute chat task' });
    }
  }
}
