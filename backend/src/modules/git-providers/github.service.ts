import dotenv from 'dotenv';
import { Injectable } from '@nestjs/common';

dotenv.config();

/**
 * GitHub API wrapper (REST v3):
 * - Read: `backend/src/agent/promptBuilder.ts` uses it to fetch Issue/comment context to build prompts.
 * - Write: `backend/src/agent/reporter.ts` uses it to post final outputs back to Issue/Commit comments.
 */

export interface GithubUser {
  login: string;
  id: number;
  html_url?: string;
}

export interface GithubCurrentUser extends GithubUser {
  name?: string | null;
  email?: string | null;
}

export interface GithubUserEmail {
  email: string;
  primary?: boolean;
  verified?: boolean;
  visibility?: string | null;
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  html_url?: string;
  state?: string;
  user?: GithubUser;
}

export interface GithubIssueComment {
  id: number;
  body?: string | null;
  html_url?: string;
  user?: GithubUser;
  created_at?: string;
  updated_at?: string;
}

export interface GithubCommitComment {
  id: number;
  body?: string | null;
  html_url?: string;
  user?: GithubUser;
}

export interface GithubCommit {
  sha: string;
  html_url?: string;
  commit?: { message?: string };
}

export interface GithubRepository {
  id: number;
  full_name?: string;
  html_url?: string;
  private?: boolean;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

@Injectable()
class GithubService {
  private readonly apiBaseUrl: string;
  private readonly token: string;

  constructor(options?: { token?: string; apiBaseUrl?: string }) {
    this.apiBaseUrl = (options?.apiBaseUrl || 'https://api.github.com').replace(/\/$/, '');
    this.token = (options?.token ?? '').trim();

    if (!this.token) {
      console.warn(
        '[github] token is not configured: requests will be anonymous (write operations will fail and rate limits are more likely); please configure a token in the trigger/robot settings'
      );
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    responseType: 'json' | 'text' = 'json'
  ): Promise<T> {
    const url = `${this.apiBaseUrl}/${path.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers as Record<string, string> | undefined)
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`[github] ${res.status} ${res.statusText}: ${errorText}`);
    }

    if (res.status === 204) return undefined as T;
    if (responseType === 'text') return (await res.text()) as T;
    return (await res.json()) as T;
  }

  async getRepositoryById(repoId: number | string): Promise<GithubRepository> {
    return this.request<GithubRepository>(`repositories/${repoId}`);
  }

  async getRepository(owner: string, repo: string): Promise<GithubRepository> {
    return this.request<GithubRepository>(`repos/${owner}/${repo}`);
  }

  async getCurrentUser(): Promise<GithubCurrentUser> {
    return this.request<GithubCurrentUser>('user');
  }

  async listUserEmails(): Promise<GithubUserEmail[]> {
    return this.request<GithubUserEmail[]>('user/emails');
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GithubIssue> {
    return this.request<GithubIssue>(`repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<GithubIssueComment[]> {
    return this.request<GithubIssueComment[]>(`repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
  }

  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<GithubIssueComment> {
    return this.request<GithubIssueComment>(`repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
  }

  async addCommitComment(owner: string, repo: string, sha: string, body: string): Promise<GithubCommitComment> {
    return this.request<GithubCommitComment>(`repos/${owner}/${repo}/commits/${sha}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GithubCommit> {
    return this.request<GithubCommit>(`repos/${owner}/${repo}/commits/${sha}`);
  }

  async listCommitComments(owner: string, repo: string, sha: string): Promise<GithubCommitComment[]> {
    return this.request<GithubCommitComment[]>(`repos/${owner}/${repo}/commits/${sha}/comments?per_page=100`);
  }
}

export { GithubService };

