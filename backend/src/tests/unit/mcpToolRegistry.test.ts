import { backendToolDefinitions } from '../../mcp/toolRegistry';

// Ensure MCP tool definitions map to backend endpoints correctly. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2

const findTool = (name: string) => {
  const tool = backendToolDefinitions.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool: ${name}`);
  return tool;
};

describe('backendToolDefinitions', () => {
  test('maps tasks.retry to the expected endpoint and query', () => {
    const tool = findTool('tasks.retry');
    const request = tool.buildRequest({ id: 'task_1', force: true });
    expect(request.method).toBe('POST');
    expect(request.path).toBe('/tasks/task_1/retry');
    expect(request.query).toEqual({ force: true });
  });

  test('maps task_groups.tasks to group task listing', () => {
    const tool = findTool('task_groups.tasks');
    const request = tool.buildRequest({ id: 'group_1', limit: 25 });
    expect(request.method).toBe('GET');
    expect(request.path).toBe('/task-groups/group_1/tasks');
    expect(request.query).toEqual({ limit: 25 });
  });

  test('maps webhook.github payload to request body', () => {
    const tool = findTool('webhook.github');
    const payload = { ref: 'refs/heads/main' };
    const headers = { 'x-github-event': 'push' };
    const request = tool.buildRequest({ repoId: 'repo_1', payload, headers });
    expect(request.method).toBe('POST');
    expect(request.path).toBe('/webhook/github/repo_1');
    expect(request.body).toEqual(payload);
    expect(request.headers).toEqual(headers);
  });
});
