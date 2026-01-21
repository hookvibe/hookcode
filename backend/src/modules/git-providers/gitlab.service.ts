import dotenv from 'dotenv';
import { Injectable } from '@nestjs/common';
import { GitProviderHttpError } from './git-provider-http-error';

dotenv.config();

/**
 * GitLab API wrapper (REST v4):
 * - Read: `backend/src/agent/promptBuilder.ts` uses it to fetch Issue/comment context to build prompts.
 * - Write: `backend/src/agent/reporter.ts` uses it to post final outputs back to MR/Issue/Commit comments.
 */
export type ProjectIdentifier = number | string;

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string;
  web_url?: string;
}

export interface GitlabCurrentUser extends GitlabUser {
  email?: string;
  public_email?: string;
}

export interface GitlabProjectMember {
  id: number;
  username: string;
  name: string;
  access_level: number;
  state?: string;
  expires_at?: string | null;
}

export interface GitlabProject {
  id: number;
  name: string;
  path?: string;
  path_with_namespace: string;
  default_branch?: string;
  web_url: string;
  http_url_to_repo?: string;
  ssh_url_to_repo?: string;
  import_status?: string | null;
  forked_from_project?: { id: number; path_with_namespace?: string; web_url?: string } | null;
}

export interface GitlabMergeRequest {
  id: number;
  iid: number;
  title: string;
  state: string;
  web_url: string;
  source_branch: string;
  target_branch: string;
}

export interface GitlabIssue {
  id: number;
  iid: number;
  project_id?: number;
  title: string;
  description?: string;
  state: string;
  web_url: string;
}

export interface GitlabNote {
  id: number;
  body: string;
  created_at: string;
  updated_at?: string;
  discussion_id?: string;
  author?: GitlabUser;
  system?: boolean;
  resolvable?: boolean;
}

export interface GitlabCommit {
  id: string;
  short_id: string;
  title: string;
  message?: string;
  web_url: string;
  created_at?: string;
}

export interface GitlabCommitComment {
  id: number;
  note: string;
  created_at: string;
  updated_at?: string;
  author?: GitlabUser;
  path?: string;
  line?: number;
  line_type?: 'new' | 'old';
}

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Support two GitLab Base URL formats:
 * - https://gitlab.example.com
 * - https://gitlab.example.com/api/v4
 *
 * Internally we store it as the "site root (may include a sub-path)" and append `/api/v4/...` when making requests.
 */
const normalizeGitlabBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Remove redundant trailing `/`.
  let url = trimmed.replace(/\/+$/, '');
  // Users/frontend may mistakenly include `/api/v4`; strip it to avoid `/api/v4/api/v4/...`.
  url = url.replace(/\/api\/v4$/, '');
  return url;
};

@Injectable()
export class GitlabService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options?: { token?: string; tokenEnvName?: string; baseUrl?: string }) {
    const rawBaseUrl = options?.baseUrl ?? 'https://gitlab.com';
    this.baseUrl = normalizeGitlabBaseUrl(rawBaseUrl) || 'https://gitlab.com';
    this.token = options?.token ?? '';

    // if (!this.token) {
    //   console.warn(`[gitlab] ${envName} is not configured; all requests will fail`);
    // }
  }

  private encodeProject(project: ProjectIdentifier): string {
    return encodeURIComponent(String(project));
  }

  private async request<T>(path: string, init: RequestInit = {}, responseType: 'json' | 'text' = 'json'): Promise<T> {
    const url = `${this.baseUrl}/api/v4/${path.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Private-Token': this.token } : {}), // Only send auth header when configured so anonymous metadata checks can still succeed. 58w1q3n5nr58flmempxe
      ...(init.headers as Record<string, string> | undefined)
    };

    const res = await fetch(url, {
      ...init,
      headers
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const method = String(init.method ?? 'GET').toUpperCase();
      // Preserve HTTP status metadata on provider errors so callers can handle auth-required flows. kzxac35mxk0fg358i7zs
      throw new GitProviderHttpError({
        provider: 'gitlab',
        status: res.status,
        statusText: res.statusText,
        url,
        method,
        responseText: errorText,
        message: `[gitlab] ${res.status} ${res.statusText}: ${errorText} (${method} ${url})`
      });
    }

    if (res.status === 204) {
      // Some delete endpoints or endpoints with no response body.
      return undefined as T;
    }

    if (responseType === 'text') {
      return (await res.text()) as T;
    }

    return (await res.json()) as T;
  }

  /**
   * Get project info.
   */
  async getProject(project: ProjectIdentifier): Promise<GitlabProject> {
    return this.request<GitlabProject>(`projects/${this.encodeProject(project)}`);
  }

  async listProjectForks(
    project: ProjectIdentifier,
    options?: { owned?: boolean; search?: string; perPage?: number; page?: number }
  ): Promise<GitlabProject[]> {
    // List forks to detect/reuse an existing fork before attempting to fork again. 24yz61mdik7tqdgaa152
    const query = buildQuery({
      owned: options?.owned,
      search: options?.search,
      per_page: options?.perPage ?? 100,
      page: options?.page ?? 1
    });
    return this.request<GitlabProject[]>(`projects/${this.encodeProject(project)}/forks${query}`);
  }

  async forkProject(
    project: ProjectIdentifier,
    options?: { namespaceId?: number; namespacePath?: string; mrDefaultTargetSelf?: boolean }
  ): Promise<GitlabProject> {
    // Fork projects via API tokens (no interactive login) to enable upstream-target merge requests. 24yz61mdik7tqdgaa152
    const payload: Record<string, unknown> = {};
    if (typeof options?.namespaceId === 'number' && Number.isFinite(options.namespaceId)) {
      payload.namespace_id = options.namespaceId;
    }
    const namespacePath = typeof options?.namespacePath === 'string' ? options.namespacePath.trim() : '';
    if (namespacePath) payload.namespace_path = namespacePath;
    if (typeof options?.mrDefaultTargetSelf === 'boolean') {
      payload.mr_default_target_self = options.mrDefaultTargetSelf;
    }

    return this.request<GitlabProject>(`projects/${this.encodeProject(project)}/fork`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Get the authenticated user.
   */
  async getCurrentUser(): Promise<GitlabCurrentUser> {
    return this.request<GitlabCurrentUser>('user');
  }

  /**
   * Get a project member (including inherited group membership).
   *
   * Note: requires the authenticated user to have access to the project.
   */
  async getProjectMember(project: ProjectIdentifier, userId: number | string): Promise<GitlabProjectMember> {
    return this.request<GitlabProjectMember>(
      `projects/${this.encodeProject(project)}/members/all/${encodeURIComponent(String(userId))}`
    );
  }

  /**
   * List Merge Requests of a project (sorted by updated_at desc by default).
   */
  async listMergeRequests(
    project: ProjectIdentifier,
    options?: { state?: 'opened' | 'closed' | 'merged' | 'all'; search?: string; perPage?: number; page?: number }
  ): Promise<GitlabMergeRequest[]> {
    // Support repo activity dashboard by allowing merged MR listing with paging. kzxac35mxk0fg358i7zs
    const query = buildQuery({
      state: options?.state ?? 'opened',
      search: options?.search,
      order_by: 'updated_at',
      sort: 'desc',
      per_page: options?.perPage ?? 100,
      page: options?.page ?? 1
    });
    return this.request<GitlabMergeRequest[]>(`projects/${this.encodeProject(project)}/merge_requests${query}`);
  }

  /**
   * Get Merge Request details.
   */
  async getMergeRequest(project: ProjectIdentifier, mrIid: number): Promise<GitlabMergeRequest> {
    return this.request<GitlabMergeRequest>(`projects/${this.encodeProject(project)}/merge_requests/${mrIid}`);
  }

  /**
   * Get Merge Request diff changes.
   */
  async getMergeRequestChanges(
    project: ProjectIdentifier,
    mrIid: number
  ): Promise<{ changes: Array<{ old_path: string; new_path: string; diff: string }> }> {
    return this.request(`projects/${this.encodeProject(project)}/merge_requests/${mrIid}/changes`);
  }

  /**
   * Add a comment to a Merge Request.
   */
  async addMergeRequestNote(project: ProjectIdentifier, mrIid: number, body: string): Promise<GitlabNote> {
    return this.request<GitlabNote>(`projects/${this.encodeProject(project)}/merge_requests/${mrIid}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  /**
   * Reply under an existing MR discussion.
   */
  async addMergeRequestDiscussionNote(
    project: ProjectIdentifier,
    mrIid: number,
    discussionId: string,
    body: string
  ): Promise<GitlabNote> {
    return this.request<GitlabNote>(
      `projects/${this.encodeProject(project)}/merge_requests/${mrIid}/discussions/${discussionId}/notes`,
      {
        method: 'POST',
        body: JSON.stringify({ body })
      }
    );
  }

  async listMergeRequestNotes(project: ProjectIdentifier, mrIid: number): Promise<GitlabNote[]> {
    return this.request<GitlabNote[]>(`projects/${this.encodeProject(project)}/merge_requests/${mrIid}/notes`);
  }

  /**
   * Get issue details.
   */
  async getIssue(project: ProjectIdentifier, issueIid: number): Promise<GitlabIssue> {
    return this.request<GitlabIssue>(`projects/${this.encodeProject(project)}/issues/${issueIid}`);
  }

  /**
   * Get issue details (by global id).
   * - Used when the webhook payload doesn't carry `iid`, or the task only stores `issue.id`.
   */
  async getIssueById(issueId: number): Promise<GitlabIssue> {
    return this.request<GitlabIssue>(`issues/${issueId}`);
  }

  /**
   * Add a comment to an issue.
   */
  async addIssueNote(project: ProjectIdentifier, issueIid: number, body: string): Promise<GitlabNote> {
    return this.request<GitlabNote>(`projects/${this.encodeProject(project)}/issues/${issueIid}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  /**
   * Reply under an existing issue discussion.
   */
  async addIssueDiscussionNote(
    project: ProjectIdentifier,
    issueIid: number,
    discussionId: string,
    body: string
  ): Promise<GitlabNote> {
    return this.request<GitlabNote>(`projects/${this.encodeProject(project)}/issues/${issueIid}/discussions/${discussionId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  async listIssueNotes(project: ProjectIdentifier, issueIid: number): Promise<GitlabNote[]> {
    return this.request<GitlabNote[]>(`projects/${this.encodeProject(project)}/issues/${issueIid}/notes`);
  }

  async listIssues(
    project: ProjectIdentifier,
    options?: { state?: 'opened' | 'closed' | 'all'; search?: string; perPage?: number; page?: number }
  ): Promise<GitlabIssue[]> {
    // List issues for repo activity dashboard (sorted by updated_at desc). kzxac35mxk0fg358i7zs
    const query = buildQuery({
      state: options?.state ?? 'opened',
      search: options?.search,
      order_by: 'updated_at',
      sort: 'desc',
      per_page: options?.perPage ?? 100,
      page: options?.page ?? 1
    });
    return this.request<GitlabIssue[]>(`projects/${this.encodeProject(project)}/issues${query}`);
  }

  async listCommitComments(project: ProjectIdentifier, commitSha: string): Promise<GitlabCommitComment[]> {
    return this.request<GitlabCommitComment[]>(`projects/${this.encodeProject(project)}/repository/commits/${commitSha}/comments`);
  }

  /**
   * Add a comment to a commit (optional line context).
   */
  async addCommitComment(
    project: ProjectIdentifier,
    commitSha: string,
    body: string,
    options?: { path?: string; line?: number; lineType?: 'new' | 'old' }
  ): Promise<GitlabNote> {
    return this.request<GitlabNote>(`projects/${this.encodeProject(project)}/repository/commits/${commitSha}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        note: body,
        path: options?.path,
        line: options?.line,
        line_type: options?.lineType
      })
    });
  }

  /**
   * Get raw file content.
   */
  async getFileRaw(project: ProjectIdentifier, filePath: string, ref: string): Promise<string> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const query = buildQuery({ ref });
    return this.request<string>(`projects/${this.encodeProject(project)}/repository/files/${encodedPath}/raw${query}`, {}, 'text');
  }

  /**
   * Get commit (for Push event scenarios).
   */
  async getCommit(project: ProjectIdentifier, commitSha: string): Promise<GitlabCommit> {
    return this.request<GitlabCommit>(`projects/${this.encodeProject(project)}/repository/commits/${commitSha}`);
  }

  async listCommits(
    project: ProjectIdentifier,
    options?: { refName?: string; perPage?: number; page?: number }
  ): Promise<GitlabCommit[]> {
    // List commits for repo activity dashboard (best-effort for public/anonymous repos). kzxac35mxk0fg358i7zs
    const query = buildQuery({
      ref_name: options?.refName,
      per_page: options?.perPage ?? 50,
      page: options?.page ?? 1
    });
    return this.request<GitlabCommit[]>(`projects/${this.encodeProject(project)}/repository/commits${query}`);
  }
}
