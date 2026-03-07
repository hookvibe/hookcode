export interface WorkerTaskContextResponse {
  task?: Record<string, unknown> | null;
  repo?: Record<string, unknown> | null;
  repoScopedCredentials?: Record<string, unknown> | null;
  robotsInRepo?: Array<Record<string, unknown>>;
  defaultUserCredentials?: Record<string, unknown> | null;
}

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export class BackendInternalApiClient {
  constructor(
    private readonly backendUrl: string,
    private readonly workerId: string,
    private readonly workerToken: string
  ) {}

  private buildUrl(pathname: string): string {
    return `${this.backendUrl.replace(/\/+$/, '')}/workers/internal${pathname}`;
  }

  private buildHeaders(body?: unknown, extra?: HeadersInit): HeadersInit {
    return {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-hookcode-worker-id': this.workerId,
      'x-hookcode-worker-token': this.workerToken,
      ...(extra ?? {})
    };
  }

  private async request<T>(pathname: string, init?: RequestInit, options?: { allow404?: boolean }): Promise<T> {
    // Route every stateful worker action through backend-owned APIs so the executor stays stateless and deployable anywhere. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const response = await fetch(this.buildUrl(pathname), {
      ...init,
      headers: this.buildHeaders(init?.body, init?.headers)
    });
    if (options?.allow404 && response.status === 404) {
      return null as T;
    }
    if (!response.ok) {
      const text = trimString(await response.text().catch(() => ''));
      throw new Error(`Worker internal API failed (${response.status} ${response.statusText}): ${text || pathname}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  getRepo(repoId: string): Promise<{ repo: Record<string, unknown> | null }> {
    return this.request(`/repos/${encodeURIComponent(repoId)}`);
  }

  getRepoScopedCredentials(repoId: string): Promise<{ repoScopedCredentials: Record<string, unknown> | null }> {
    return this.request(`/repos/${encodeURIComponent(repoId)}/credentials`);
  }

  getRepoRobots(repoId: string): Promise<{ robots: Array<Record<string, unknown>> }> {
    return this.request(`/repos/${encodeURIComponent(repoId)}/robots`);
  }

  getDefaultUserCredentials(): Promise<{ defaultUserCredentials: Record<string, unknown> | null }> {
    return this.request('/users/default-credentials');
  }

  getTaskContext(taskId: string): Promise<WorkerTaskContextResponse> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/context`);
  }

  getTaskControlState(taskId: string): Promise<{ status: string; archivedAt?: string; stopRequested: boolean } | null> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/control-state`, undefined, { allow404: true });
  }

  executeInlineTask(taskId: string): Promise<{ success: true }> {
    // Delegate local fallback execution back to backend only through the authenticated worker channel so remote workers keep the same API surface. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return this.request(`/tasks/${encodeURIComponent(taskId)}/execute-inline`, { method: 'POST' });
  }

  appendLogs(taskId: string, startSeq: number, lines: string[]): Promise<{ success: true }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/logs`, {
      method: 'POST',
      body: JSON.stringify({ startSeq, lines })
    });
  }

  patchResult(taskId: string, patch: Record<string, unknown>, status?: string): Promise<{ success: true }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/result-patch`, {
      method: 'POST',
      body: JSON.stringify({ patch, status })
    });
  }

  patchDependencyResult(taskId: string, dependencyResult: unknown): Promise<{ success: true }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/dependency-result`, {
      method: 'POST',
      body: JSON.stringify({ dependencyResult })
    });
  }

  finalizeTask(
    taskId: string,
    body: {
      status?: 'succeeded' | 'failed';
      message?: string;
      providerCommentUrl?: string;
      outputText?: string;
      gitStatus?: unknown;
      durationMs?: number;
      stopReason?: 'manual_stop' | 'deleted';
    }
  ): Promise<{ success: true }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/finalize`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  ensureGroupId(taskId: string): Promise<{ groupId: string | null }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/ensure-group-id`, { method: 'POST' });
  }

  getThreadId(groupId: string): Promise<{ threadId: string | null }> {
    return this.request(`/task-groups/${encodeURIComponent(groupId)}/thread-id`);
  }

  setThreadId(groupId: string, threadId: string): Promise<{ success: boolean }> {
    return this.request(`/task-groups/${encodeURIComponent(groupId)}/thread-id`, {
      method: 'POST',
      body: JSON.stringify({ threadId })
    });
  }

  getTaskGroupHistory(groupId: string, taskId: string): Promise<{ hasPriorTaskGroupTask: boolean; hasTaskGroupLogs: boolean }> {
    return this.request(`/task-groups/${encodeURIComponent(groupId)}/history/${encodeURIComponent(taskId)}`);
  }

  getTaskGroupSkills(groupId: string): Promise<{ selection: string[] | null }> {
    return this.request(`/task-groups/${encodeURIComponent(groupId)}/skills`);
  }

  getPromptPrefix(selection: string[] | null): Promise<{ promptPrefix: string }> {
    return this.request('/skills/prompt-prefix', {
      method: 'POST',
      body: JSON.stringify({ selection })
    });
  }

  verifyPat(token: string): Promise<{ result: unknown }> {
    return this.request('/pat/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  ensureBootstrapUser(): Promise<{ success: boolean }> {
    return this.request('/bootstrap-user', { method: 'POST' });
  }

  createPat(
    userId: string | null | undefined,
    input: { name?: string; scopes?: unknown; expiresAt?: string | null; expiresInDays?: number | null }
  ): Promise<{ token: string; apiToken: unknown }> {
    return this.request('/pat/create', {
      method: 'POST',
      body: JSON.stringify({ userId: userId ?? undefined, input })
    });
  }
}
