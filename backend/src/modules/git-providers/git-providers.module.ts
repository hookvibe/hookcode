import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GitlabService } from './gitlab.service';
import { GITHUB_CONFIG, GITLAB_CONFIG, type GithubConfig, type GitlabConfig } from './git-providers.types';

@Module({
  providers: [
    {
      provide: GITHUB_CONFIG,
      useFactory: (): GithubConfig => ({
        token: process.env.GITHUB_TOKEN,
        apiBaseUrl: process.env.GITHUB_API_URL
      })
    },
    {
      provide: GITLAB_CONFIG,
      useFactory: (): GitlabConfig => ({
        token: process.env.GITLAB_TOKEN,
        baseUrl: process.env.GITLAB_URL
      })
    },
    {
      provide: GithubService,
      useFactory: (config: GithubConfig) => new GithubService(config),
      inject: [GITHUB_CONFIG]
    },
    {
      provide: GitlabService,
      useFactory: (config: GitlabConfig) => new GitlabService({ token: config.token, baseUrl: config.baseUrl }),
      inject: [GITLAB_CONFIG]
    }
  ],
  exports: [GithubService, GitlabService]
})
export class GitProvidersModule {}

