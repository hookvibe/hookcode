export const GITHUB_CONFIG = 'GITHUB_CONFIG';
export const GITLAB_CONFIG = 'GITLAB_CONFIG';

export interface GithubConfig {
  token?: string;
  apiBaseUrl?: string;
}

export interface GitlabConfig {
  token?: string;
  baseUrl?: string;
}

