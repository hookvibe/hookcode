import * as z from 'zod/v4';
import type { BackendRequest } from './backendClient';

export interface BackendToolDefinition<InputSchema extends z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  buildRequest: (input: z.output<InputSchema>) => BackendRequest;
}

const optionalString = z.string().trim().min(1).optional();
const optionalNumber = z.number().int().positive().optional();
const optionalBoolean = z.boolean().optional();

const headersSchema = z.record(z.string(), z.string()).optional();

// Preserve input typing for tool definitions while keeping a single registry list. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const defineTool = <Schema extends z.ZodTypeAny>(definition: BackendToolDefinition<Schema>) => definition;

// Central registry for MCP tools so new endpoints are easy to add. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
export const backendToolDefinitions = [
  defineTool({
    name: 'tasks.list',
    description: 'List tasks with optional filters.',
    inputSchema: z.object({
      limit: optionalNumber,
      repoId: optionalString,
      robotId: optionalString,
      status: optionalString,
      eventType: optionalString,
      archived: optionalString,
      includeQueue: optionalBoolean
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: '/tasks',
      query: input
    })
  }),
  defineTool({
    name: 'tasks.get',
    description: 'Get a task by id.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'GET',
      path: `/tasks/${encodeURIComponent(input.id)}`
    })
  }),
  defineTool({
    name: 'tasks.stats',
    description: 'Get task status aggregates.',
    inputSchema: z.object({
      repoId: optionalString,
      robotId: optionalString,
      eventType: optionalString,
      archived: optionalString
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: '/tasks/stats',
      query: input
    })
  }),
  defineTool({
    name: 'tasks.volume',
    description: 'Get task volume by day.',
    inputSchema: z.object({
      repoId: z.string().trim().min(1),
      startDay: z.string().trim().min(1),
      endDay: z.string().trim().min(1),
      robotId: optionalString,
      eventType: optionalString,
      archived: optionalString
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: '/tasks/volume',
      query: input
    })
  }),
  defineTool({
    name: 'tasks.logs.get',
    description: 'Fetch task logs.',
    inputSchema: z.object({
      id: z.string().trim().min(1),
      tail: optionalNumber
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: `/tasks/${encodeURIComponent(input.id)}/logs`,
      query: { tail: input.tail }
    })
  }),
  defineTool({
    name: 'tasks.logs.clear',
    description: 'Clear task logs.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'DELETE',
      path: `/tasks/${encodeURIComponent(input.id)}/logs`
    })
  }),
  defineTool({
    name: 'tasks.retry',
    description: 'Retry a task.',
    inputSchema: z.object({
      id: z.string().trim().min(1),
      force: optionalBoolean
    }),
    buildRequest: (input) => ({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(input.id)}/retry`,
      query: { force: input.force }
    })
  }),
  defineTool({
    name: 'tasks.execute_now',
    description: 'Execute a queued task immediately.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(input.id)}/execute-now`
    })
  }),
  defineTool({
    name: 'tasks.push_git',
    description: 'Push task git changes.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(input.id)}/git/push`
    })
  }),
  defineTool({
    name: 'tasks.delete',
    description: 'Delete a task by id.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'DELETE',
      path: `/tasks/${encodeURIComponent(input.id)}`
    })
  }),
  defineTool({
    name: 'task_groups.list',
    description: 'List task groups with optional filters.',
    inputSchema: z.object({
      limit: optionalNumber,
      repoId: optionalString,
      robotId: optionalString,
      kind: optionalString,
      archived: optionalString
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: '/task-groups',
      query: input
    })
  }),
  defineTool({
    name: 'task_groups.get',
    description: 'Get task group by id.',
    inputSchema: z.object({ id: z.string().trim().min(1) }),
    buildRequest: (input) => ({
      method: 'GET',
      path: `/task-groups/${encodeURIComponent(input.id)}`
    })
  }),
  defineTool({
    name: 'task_groups.tasks',
    description: 'List tasks inside a task group.',
    inputSchema: z.object({
      id: z.string().trim().min(1),
      limit: optionalNumber
    }),
    buildRequest: (input) => ({
      method: 'GET',
      path: `/task-groups/${encodeURIComponent(input.id)}/tasks`,
      query: { limit: input.limit }
    })
  }),
  defineTool({
    name: 'webhook.gitlab',
    description: 'Send a GitLab webhook payload to HookCode.',
    inputSchema: z.object({
      repoId: z.string().trim().min(1),
      payload: z.unknown(),
      headers: headersSchema
    }),
    buildRequest: (input) => ({
      method: 'POST',
      path: `/webhook/gitlab/${encodeURIComponent(input.repoId)}`,
      body: input.payload,
      headers: input.headers
    })
  }),
  defineTool({
    name: 'webhook.github',
    description: 'Send a GitHub webhook payload to HookCode.',
    inputSchema: z.object({
      repoId: z.string().trim().min(1),
      payload: z.unknown(),
      headers: headersSchema
    }),
    buildRequest: (input) => ({
      method: 'POST',
      path: `/webhook/github/${encodeURIComponent(input.repoId)}`,
      body: input.payload,
      headers: input.headers
    })
  })
];
