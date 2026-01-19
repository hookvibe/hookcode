import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RepoAutomationService, findRobotAutomationUsages, RepoAutomationConfigValidationError } from './repo-automation.service';
import { RepoRobotService } from './repo-robot.service';
import { RepoWebhookDeliveryService } from './repo-webhook-delivery.service';
import { RepositoryService } from './repository.service';
import { GitlabService } from '../../services/gitlabService';
import { GithubService } from '../../services/githubService';
import { UserService } from '../users/user.service';
import { inferRobotRepoProviderCredentialSource, resolveRobotProviderToken } from '../../services/repoRobotAccess';
import type { RepoProvider, RepositoryBranch } from '../../types/repository';
import type { RobotDefaultBranchRole } from '../../types/repoRobot';
import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY, normalizeGeminiCliRobotProviderConfig } from '../../modelProviders/geminiCli';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { CreateRepoRobotDto } from './dto/create-repo-robot.dto';
import { UpdateRepoRobotDto } from './dto/update-repo-robot.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { parsePositiveInt } from '../../utils/parse';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  AutomationConfigResponseDto,
  CreateRepoRobotResponseDto,
  CreateRepositoryResponseDto,
  DeleteRobotResponseDto,
  GetRepoWebhookDeliveryResponseDto,
  GetRepositoryResponseDto,
  ListRepoRobotsResponseDto,
  ListRepoWebhookDeliveriesResponseDto,
  ListRepositoriesResponseDto,
  TestRobotResponseDto,
  UpdateRepoRobotResponseDto,
  UpdateRepositoryResponseDto
} from './dto/repositories-swagger.dto';

const normalizeProvider = (value: unknown): RepoProvider => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'gitlab' || raw === 'github') return raw;
  throw new Error('provider must be gitlab or github');
};

const normalizeDefaultBranchRole = (value: unknown): RobotDefaultBranchRole | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw === 'main' || raw === 'dev' || raw === 'test') return raw;
  throw new Error('defaultBranchRole must be main/dev/test or null');
};

const normalizeDefaultBranch = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('defaultBranch must be string or null');
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeNullableTrimmedString = (value: unknown, fieldName: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${fieldName} must be string or null`);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeRepoCredentialSource = (
  value: unknown
): 'robot' | 'user' | 'repo' | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('repoCredentialSource must be string or null');
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'robot' || raw === 'user' || raw === 'repo') return raw;
  throw new Error('repoCredentialSource must be robot/user/repo or null');
};

@Controller('repos')
@ApiTags('Repos')
@ApiBearerAuth('bearerAuth')
export class RepositoriesController {
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly repoRobotService: RepoRobotService,
    private readonly repoAutomationService: RepoAutomationService,
    private readonly repoWebhookDeliveryService: RepoWebhookDeliveryService,
    private readonly userService: UserService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List repositories',
    description: 'List repositories visible to the current user.',
    operationId: 'repos_list'
  })
  @ApiOkResponse({ description: 'OK', type: ListRepositoriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list() {
    try {
      const repos = await this.repositoryService.listAll();
      return { repos };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repos' });
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create repository',
    description: 'Create a repository and return webhook config info.',
    operationId: 'repos_create'
  })
  @ApiCreatedResponse({ description: 'Created', type: CreateRepositoryResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async create(@Req() req: Request, @Body() body: CreateRepositoryDto) {
    try {
      const provider = normalizeProvider(body?.provider);
      const name = typeof body?.name === 'string' ? body.name : '';
      const externalId =
        body?.externalId === undefined
          ? undefined
          : body?.externalId === null
            ? null
            : typeof body?.externalId === 'string'
              ? body.externalId
              : undefined;
      const apiBaseUrl =
        body?.apiBaseUrl === undefined
          ? undefined
          : body?.apiBaseUrl === null
            ? null
            : typeof body?.apiBaseUrl === 'string'
              ? body.apiBaseUrl
              : undefined;
      const webhookSecret =
        body?.webhookSecret === undefined
          ? undefined
          : body?.webhookSecret === null
            ? null
            : typeof body?.webhookSecret === 'string'
              ? body.webhookSecret
              : undefined;

      const branches: RepositoryBranch[] | undefined =
        body?.branches === undefined
          ? undefined
          : Array.isArray(body.branches)
            ? body.branches
                .filter((b: any) => b && typeof b === 'object')
                .map((b: any) => ({
                  name: typeof b.name === 'string' ? b.name : '',
                  note: typeof b.note === 'string' ? b.note : undefined,
                  isDefault: Boolean(b.isDefault)
                }))
            : undefined;

      const created = await this.repositoryService.createRepository(req.user ?? null, {
        provider,
        name,
        externalId,
        apiBaseUrl,
        webhookSecret,
        branches
      });

      // Use a relative webhook path; the frontend can prefix with current origin / VITE_API_BASE_URL.
      const webhookPath = `/api/webhook/${created.repo.provider}/${created.repo.id}`;

      return {
        repo: created.repo,
        webhookSecret: created.webhookSecret,
        webhookPath
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : 'Failed to create repo';
      if (message.includes('provider must be')) {
        throw new BadRequestException({ error: message });
      }
      if (message.includes('name is required')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[repos] create failed', err);
      throw new InternalServerErrorException({ error: 'Failed to create repo' });
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get repository (with robots & automation)',
    description: 'Get repository detail including robots, automation config and webhook info.',
    operationId: 'repos_get'
  })
  @ApiOkResponse({ description: 'OK', type: GetRepositoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async get(@Param('id') id: string) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const robots = await this.repoRobotService.listByRepo(repoId);
      const automationConfig = await this.repoAutomationService.getConfig(repoId);
      const webhookPath = `/api/webhook/${repo.provider}/${repoId}`;
      const webhookSecret = (await this.repositoryService.getByIdWithSecret(repoId))?.webhookSecret ?? null;
      const repoScopedCredentials = (await this.repositoryService.getRepoScopedCredentials(repoId))?.public ?? undefined;

      return { repo, robots, automationConfig, webhookSecret, webhookPath, repoScopedCredentials };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repo' });
    }
  }

  @Get(':id/provider-meta')
  @ApiOperation({
    summary: 'Get provider metadata (visibility)',
    description: 'Fetch repository visibility (public/private/internal) from the Git provider using a selected credential token (or anonymous mode for public repos).',
    operationId: 'repos_get_provider_meta'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getProviderMeta(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('credentialSource') credentialSourceRaw: string | undefined,
    @Query('credentialProfileId') credentialProfileIdRaw: string | undefined
  ) {
    try {
      // Provide provider visibility metadata to drive the repo onboarding wizard. 58w1q3n5nr58flmempxe
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const repoIdentity = (repo.externalId ?? '').trim() || (repo.name ?? '').trim();
      if (!repoIdentity) {
        throw new BadRequestException({ error: 'repo identity is required (externalId or name)' });
      }

      const credentialSource = (() => {
        const raw = String(credentialSourceRaw ?? '').trim().toLowerCase();
        if (raw === 'repo') return 'repo';
        if (raw === 'user') return 'user';
        if (raw === 'anonymous') return 'anonymous';
        return 'user';
      })();
      const credentialProfileId = typeof credentialProfileIdRaw === 'string' ? credentialProfileIdRaw.trim() : '';

      const userCredentials = req.user ? await this.userService.getModelCredentialsRaw(req.user.id) : null;
      const repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repoId);

      const token =
        credentialSource === 'anonymous'
          ? ''
          : resolveRobotProviderToken({
              provider: repo.provider,
              robot: { repoCredentialProfileId: credentialProfileId || null },
              userCredentials,
              repoCredentials: repoScopedCredentials?.repoProvider ?? null,
              source: credentialSource === 'repo' ? 'repo' : 'user'
            });
      if (credentialSource !== 'anonymous' && !token) {
        throw new BadRequestException({
          error: 'repo provider token is required to fetch visibility',
          code: 'REPO_PROVIDER_TOKEN_REQUIRED'
        });
      }

      const apiBaseUrl = (repo.apiBaseUrl ?? '').trim() || undefined;

      if (repo.provider === 'gitlab') {
        try {
          const gitlab = new GitlabService({ token, baseUrl: apiBaseUrl });
          const project: any = await gitlab.getProject(repoIdentity);
          const rawVisibility = String(project?.visibility ?? '').trim().toLowerCase();
          const visibility = rawVisibility === 'public' ? 'public' : rawVisibility === 'internal' ? 'internal' : 'private';
          const webUrl = String(project?.web_url ?? '').trim();
          return { provider: repo.provider, visibility, webUrl: webUrl || undefined };
        } catch (err) {
          // Anonymous mode cannot distinguish private vs not-found; return `unknown` so onboarding can guide credentials. 58w1q3n5nr58flmempxe
          if (credentialSource === 'anonymous') return { provider: repo.provider, visibility: 'unknown' };
          throw err;
        }
      }

      if (repo.provider === 'github') {
        try {
          const github = new GithubService({ token, apiBaseUrl });
          const repoIdOrSlug = repoIdentity;
          const repoInfo: any = await (async () => {
            if (!repoIdOrSlug.includes('/')) return github.getRepositoryById(repoIdOrSlug);
            const [owner, repoName] = repoIdOrSlug.split('/');
            if (!owner || !repoName) {
              throw new BadRequestException({ error: 'invalid github externalId (expected owner/repo)' });
            }
            return github.getRepository(owner, repoName);
          })();
          const visibility = Boolean(repoInfo?.private) ? 'private' : 'public';
          const webUrl = String(repoInfo?.html_url ?? '').trim();
          return { provider: repo.provider, visibility, webUrl: webUrl || undefined };
        } catch (err) {
          // Anonymous mode cannot distinguish private vs not-found; return `unknown` so onboarding can guide credentials. 58w1q3n5nr58flmempxe
          if (credentialSource === 'anonymous') return { provider: repo.provider, visibility: 'unknown' };
          throw err;
        }
      }

      throw new BadRequestException({ error: `unsupported provider: ${repo.provider}` });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get provider meta failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch provider metadata' });
    }
  }

  @Get(':id/webhook-deliveries')
  @ApiOperation({
    summary: 'List webhook deliveries',
    description: 'List webhook deliveries for a repository.',
    operationId: 'repos_list_webhook_deliveries'
  })
  @ApiOkResponse({ description: 'OK', type: ListRepoWebhookDeliveriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async listWebhookDeliveries(
    @Param('id') id: string,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined
  ) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const limit = parsePositiveInt(limitRaw, 50);
      const cursor = typeof cursorRaw === 'string' ? cursorRaw.trim() : '';

      const data = await this.repoWebhookDeliveryService.listDeliveries(repoId, {
        limit,
        ...(cursor ? { cursor } : {})
      });
      return data;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] list webhook deliveries failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch webhook deliveries' });
    }
  }

  @Get(':id/webhook-deliveries/:deliveryId')
  @ApiOperation({
    summary: 'Get webhook delivery',
    description: 'Get a webhook delivery record by id.',
    operationId: 'repos_get_webhook_delivery'
  })
  @ApiOkResponse({ description: 'OK', type: GetRepoWebhookDeliveryResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getWebhookDelivery(
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string
  ) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const normalizedDeliveryId = String(deliveryId ?? '').trim();
      if (!normalizedDeliveryId) throw new BadRequestException({ error: 'deliveryId is required' });

      const delivery = await this.repoWebhookDeliveryService.getDelivery(repoId, normalizedDeliveryId);
      if (!delivery) throw new NotFoundException({ error: 'Webhook delivery not found' });
      return { delivery };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get webhook delivery failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch webhook delivery' });
    }
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update repository',
    description: 'Update repository settings.',
    operationId: 'repos_patch'
  })
  @ApiOkResponse({ description: 'OK', type: UpdateRepositoryResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patch(@Param('id') id: string, @Body() body: UpdateRepositoryDto) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const name = typeof body?.name === 'string' ? body.name : undefined;
      const externalId =
        body?.externalId === undefined
          ? undefined
          : body?.externalId === null
            ? null
            : typeof body?.externalId === 'string'
              ? body.externalId
              : undefined;
      const apiBaseUrl =
        body?.apiBaseUrl === undefined
          ? undefined
          : body?.apiBaseUrl === null
            ? null
            : typeof body?.apiBaseUrl === 'string'
              ? body.apiBaseUrl
              : undefined;

      const branches: RepositoryBranch[] | null | undefined =
        body?.branches === undefined
          ? undefined
          : body?.branches === null
            ? null
            : Array.isArray(body.branches)
              ? body.branches
                  .filter((b: any) => b && typeof b === 'object')
                  .map((b: any) => ({
                    name: typeof b.name === 'string' ? b.name : '',
                    note: typeof b.note === 'string' ? b.note : undefined,
                    isDefault: Boolean(b.isDefault)
                  }))
              : undefined;
      const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
      const webhookSecret =
        body?.webhookSecret === undefined
          ? undefined
          : body?.webhookSecret === null
            ? null
            : typeof body?.webhookSecret === 'string'
              ? body.webhookSecret
              : undefined;

      // Change record: repo-scoped credentials are now updated via profile patch objects (profiles/remove/default).
      const repoProviderCredential = body?.repoProviderCredential as any;
      const modelProviderCredential = body?.modelProviderCredential as any;

      const updated = await this.repositoryService.updateRepository(repoId, {
        name,
        externalId,
        apiBaseUrl,
        branches,
        enabled,
        webhookSecret,
        repoProviderCredential,
        modelProviderCredential
      });
      if (!updated) throw new NotFoundException({ error: 'Repo not found' });

      const repoScopedCredentials = (await this.repositoryService.getRepoScopedCredentials(repoId))?.public ?? undefined;

      return {
        repo: updated.repo,
        webhookSecret: updated.webhookSecret,
        repoScopedCredentials
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : 'Failed to update repo';
      if (message.includes('is locked after webhook verification')) {
        throw new ConflictException({ error: message, code: 'REPO_IDENTITY_LOCKED' });
      }
      if (message.includes('name is required')) {
        throw new BadRequestException({ error: message });
      }
      if (
        message.includes('repo provider credential profile remark is required') ||
        message.includes('model provider credential profile remark is required')
      ) {
        throw new BadRequestException({ error: message });
      }
      console.error('[repos] update failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update repo' });
    }
  }

  @Get(':id/robots')
  @ApiOperation({
    summary: 'List robots',
    description: 'List robots under a repository.',
    operationId: 'repos_list_robots'
  })
  @ApiOkResponse({ description: 'OK', type: ListRepoRobotsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async listRobots(@Param('id') id: string) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const robots = await this.repoRobotService.listByRepo(repoId);
      return { robots };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] list robots failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch robots' });
    }
  }

  @Post(':id/robots')
  @ApiOperation({
    summary: 'Create robot',
    description: 'Create a robot under a repository.',
    operationId: 'repos_create_robot'
  })
  @ApiCreatedResponse({ description: 'Created', type: CreateRepoRobotResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async createRobot(@Param('id') id: string, @Req() req: Request, @Body() body: CreateRepoRobotDto) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Allow configuring robots without requiring webhook verification (webhooks are optional). 58w1q3n5nr58flmempxe

      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const token = normalizeNullableTrimmedString(body?.token, 'token');
      const repoCredentialSourceRaw = normalizeRepoCredentialSource(body?.repoCredentialSource);
      const repoCredentialProfileId = normalizeNullableTrimmedString(body?.repoCredentialProfileId, 'repoCredentialProfileId');
      const cloneUsername = normalizeNullableTrimmedString(body?.cloneUsername, 'cloneUsername');
      const repoCredentialRemark = normalizeNullableTrimmedString(body?.repoCredentialRemark, 'repoCredentialRemark');

      // Enforce explicit scope selection (robot/user/repo) now that both user/repo credentials can have multiple profiles.
      const repoCredentialSource: 'robot' | 'user' | 'repo' = (() => {
        if (repoCredentialSourceRaw === 'robot' || repoCredentialSourceRaw === 'user' || repoCredentialSourceRaw === 'repo') {
          return repoCredentialSourceRaw;
        }
        if (token) return 'robot';
        if (repoCredentialProfileId) {
          throw new BadRequestException({ error: 'repoCredentialSource is required when selecting a credential profile' });
        }
        throw new BadRequestException({ error: 'repoCredentialSource and repoCredentialProfileId are required' });
      })();

      if (repoCredentialSource === 'robot') {
        if (repoCredentialProfileId) {
          throw new BadRequestException({ error: 'repoCredentialProfileId must be null when repoCredentialSource=robot' });
        }
      } else {
        if (token) {
          throw new BadRequestException({ error: 'token must be null when repoCredentialSource is user/repo' });
        }
        if (!repoCredentialProfileId) {
          throw new BadRequestException({ error: 'repoCredentialProfileId is required when repoCredentialSource is user/repo' });
        }
        if (repoCredentialRemark !== undefined) {
          throw new BadRequestException({ error: 'repoCredentialRemark is only supported for repoCredentialSource=robot' });
        }
      }
      const defaultBranch = body?.defaultBranch === undefined ? undefined : normalizeDefaultBranch(body?.defaultBranch);
      const defaultBranchRole =
        body?.defaultBranchRole === undefined ? undefined : normalizeDefaultBranchRole(body?.defaultBranchRole);
      const promptDefault = typeof body?.promptDefault === 'string' ? body.promptDefault.trim() : '';
      if (!promptDefault) {
        throw new BadRequestException({ error: 'promptDefault is required' });
      }
      const language = typeof body?.language === 'string' ? body.language.trim() : undefined;
      const modelProvider = body?.modelProvider;
      const modelProviderConfig = body?.modelProviderConfig;
      const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : undefined;

      let repoScopedCredentials:
        | Awaited<ReturnType<RepositoryService['getRepoScopedCredentials']>>
        | null
        | undefined;
      const loadRepoScopedCredentials = async () => {
        if (repoScopedCredentials !== undefined) return repoScopedCredentials;
        repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repoId);
        return repoScopedCredentials;
      };

      const loadUserCredentials = async () => {
        if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
        return await this.userService.getModelCredentialsRaw(req.user.id);
      };

      // Repo provider credential validation by scope.
      if (repoCredentialSource === 'user') {
        const rawCredentials = await loadUserCredentials();
        const providerCredentials = repo.provider === 'github' ? rawCredentials?.github : rawCredentials?.gitlab;
        const profile = (providerCredentials?.profiles ?? []).find((p) => p.id === repoCredentialProfileId);
        if (!profile) {
          throw new BadRequestException({ error: 'repoCredentialProfileId does not exist in your account credentials' });
        }
        if (!String(profile.token ?? '').trim()) {
          throw new BadRequestException({ error: 'selected repo credential profile token is missing' });
        }
      } else if (repoCredentialSource === 'repo') {
        const repoScopedCredentials = await loadRepoScopedCredentials();
        const profile = (repoScopedCredentials?.repoProvider?.profiles ?? []).find((p) => p.id === repoCredentialProfileId);
        if (!profile) {
          throw new BadRequestException({ error: 'repoCredentialProfileId does not exist in repo-scoped credentials' });
        }
        if (!String(profile.token ?? '').trim()) {
          throw new BadRequestException({ error: 'selected repo-scoped repo provider token is missing' });
        }
      }

      const normalizedModelProvider = typeof modelProvider === 'string' ? modelProvider.trim().toLowerCase() : CODEX_PROVIDER_KEY;
      const validateModelCredential = async (cfg: { credentialSource: string; credentialProfileId?: string; credential?: { apiKey?: string } }, providerKey: string) => {
        const credentialSource = String(cfg.credentialSource ?? '').trim().toLowerCase();
        if (credentialSource === 'robot') {
          if (!String(cfg.credential?.apiKey ?? '').trim()) {
            throw new BadRequestException({ error: `${providerKey} apiKey is required (robot credential)` });
          }
          return;
        }

        const profileId = String(cfg.credentialProfileId ?? '').trim();
        if (!profileId) {
          throw new BadRequestException({ error: `${providerKey} credentialProfileId is required when credentialSource is user/repo` });
        }

        if (credentialSource === 'user') {
          const rawCredentials = await loadUserCredentials();
          const providerCredentials = (rawCredentials as any)?.[providerKey] as any;
          const profile = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles.find((p: any) => p && p.id === profileId) : null;
          if (!profile) throw new BadRequestException({ error: `${providerKey} credentialProfileId does not exist in your account credentials` });
          if (!String(profile.apiKey ?? '').trim()) throw new BadRequestException({ error: `selected ${providerKey} profile apiKey is missing` });
          return;
        }

        if (credentialSource === 'repo') {
          const repoScopedCredentials = await loadRepoScopedCredentials();
          const providerCredentials = (repoScopedCredentials as any)?.modelProvider?.[providerKey] as any;
          const profile = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles.find((p: any) => p && p.id === profileId) : null;
          if (!profile) throw new BadRequestException({ error: `${providerKey} credentialProfileId does not exist in repo-scoped credentials` });
          if (!String(profile.apiKey ?? '').trim()) throw new BadRequestException({ error: `selected repo-scoped ${providerKey} apiKey is missing` });
          return;
        }
      };

      if (!normalizedModelProvider || normalizedModelProvider === CODEX_PROVIDER_KEY) {
        const cfg = normalizeCodexRobotProviderConfig(modelProviderConfig);
        await validateModelCredential(cfg as any, CODEX_PROVIDER_KEY);
      } else if (normalizedModelProvider === CLAUDE_CODE_PROVIDER_KEY) {
        const cfg = normalizeClaudeCodeRobotProviderConfig(modelProviderConfig);
        await validateModelCredential(cfg as any, CLAUDE_CODE_PROVIDER_KEY);
      } else if (normalizedModelProvider === GEMINI_CLI_PROVIDER_KEY) {
        const cfg = normalizeGeminiCliRobotProviderConfig(modelProviderConfig);
        await validateModelCredential(cfg as any, GEMINI_CLI_PROVIDER_KEY);
      }

      const robot = await this.repoRobotService.createRobot(req.user ?? null, repoId, {
        name,
        token,
        repoCredentialSource,
        cloneUsername,
        repoCredentialProfileId,
        repoCredentialRemark,
        defaultBranch,
        defaultBranchRole,
        promptDefault,
        language,
        modelProvider,
        modelProviderConfig,
        isDefault
      });

      if (robot.isDefault) {
        await this.repoRobotService.setDefaultRobot(repoId, robot.id);
      }

      return { robot };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : 'Failed to create robot';
      if (
        message.includes('modelProvider must be') ||
        message.includes('defaultBranchRole must be') ||
        message.includes('defaultBranch must be') ||
        message.includes('robot must be activated') ||
        message.includes('name is required') ||
        message.includes('promptDefault is required') ||
        message.includes('repoCredential') ||
        message.includes('credentialProfileId') ||
        message.includes('token must be null')
      ) {
        throw new BadRequestException({ error: message });
      }
      console.error('[repos] create robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to create robot' });
    }
  }

  @Patch(':id/robots/:robotId')
  @ApiOperation({
    summary: 'Update robot',
    description: 'Update a robot under a repository.',
    operationId: 'repos_patch_robot'
  })
  @ApiOkResponse({ description: 'OK', type: UpdateRepoRobotResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patchRobot(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @Req() req: Request,
    @Body() body: UpdateRepoRobotDto
  ) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Keep robot updates available before webhook verification to support manual chat workflows. 58w1q3n5nr58flmempxe

      const existing = await this.repoRobotService.getByIdWithToken(robotId);
      if (!existing || existing.repoId !== repoId) {
        throw new NotFoundException({ error: 'Robot not found' });
      }

      const name = typeof body?.name === 'string' ? body.name : undefined;
      const cloneUsername =
        body?.cloneUsername === undefined ? undefined : normalizeNullableTrimmedString(body?.cloneUsername, 'cloneUsername');
      const repoCredentialSourceRaw =
        body?.repoCredentialSource === undefined ? undefined : normalizeRepoCredentialSource(body?.repoCredentialSource);
      const repoCredentialSource =
        repoCredentialSourceRaw === 'robot' || repoCredentialSourceRaw === 'user' || repoCredentialSourceRaw === 'repo'
          ? repoCredentialSourceRaw
          : undefined;
      const repoCredentialProfileId =
        body?.repoCredentialProfileId === undefined
          ? undefined
          : normalizeNullableTrimmedString(body?.repoCredentialProfileId, 'repoCredentialProfileId');
      const repoCredentialRemark =
        body?.repoCredentialRemark === undefined
          ? undefined
          : normalizeNullableTrimmedString(body?.repoCredentialRemark, 'repoCredentialRemark');
      const language =
        body?.language === undefined
          ? undefined
          : body?.language === null
            ? null
            : typeof body?.language === 'string'
              ? body.language.trim()
              : undefined;
      const modelProvider =
        body?.modelProvider === undefined ? undefined : typeof body?.modelProvider === 'string' ? body.modelProvider : undefined;
      const modelProviderConfig = body?.modelProviderConfig;
      const defaultBranch = body?.defaultBranch === undefined ? undefined : normalizeDefaultBranch(body?.defaultBranch);
      const defaultBranchRole =
        body?.defaultBranchRole === undefined ? undefined : normalizeDefaultBranchRole(body?.defaultBranchRole);
      const promptDefault =
        body?.promptDefault === undefined ? undefined : typeof body?.promptDefault === 'string' ? body.promptDefault.trim() : '';
      if (body?.promptDefault !== undefined && !promptDefault) {
        throw new BadRequestException({ error: 'promptDefault is required' });
      }
      const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
      const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : undefined;

      const token =
        body?.token === undefined ? undefined : normalizeNullableTrimmedString(body?.token, 'token');

      const existingRepoCredentialSource =
        normalizeRepoCredentialSource((existing as any).repoCredentialSource) ??
        (String((existing as any).token ?? '').trim()
          ? 'robot'
          : String((existing as any).repoCredentialProfileId ?? '').trim()
            ? 'user'
            : 'repo');

      // If the client patches `repoCredentialProfileId` while the current robot is using `robot` credentials,
      // force an explicit `repoCredentialSource` to avoid ambiguity (user vs repo).
      const profileProvided =
        repoCredentialProfileId !== undefined && repoCredentialProfileId !== null && String(repoCredentialProfileId).trim();
      if (profileProvided && !repoCredentialSource && existingRepoCredentialSource === 'robot') {
        throw new BadRequestException({ error: 'repoCredentialSource is required when selecting a credential profile' });
      }

      const nextRepoCredentialSource = repoCredentialSource ?? existingRepoCredentialSource;

      // Repo provider credential validation by scope.
      const validateRepoProviderCredential = async (source: 'robot' | 'user' | 'repo') => {
        if (source === 'robot') {
          if (repoCredentialProfileId !== undefined && repoCredentialProfileId !== null && repoCredentialProfileId.trim()) {
            throw new BadRequestException({ error: 'repoCredentialProfileId must be null when repoCredentialSource=robot' });
          }
          return;
        }

        if (token !== undefined && token !== null && token.trim()) {
          throw new BadRequestException({ error: 'token must be null when repoCredentialSource is user/repo' });
        }

        const profileId = (repoCredentialProfileId === undefined
          ? String((existing as any).repoCredentialProfileId ?? '').trim()
          : String(repoCredentialProfileId ?? '').trim());
        if (!profileId) {
          throw new BadRequestException({ error: 'repoCredentialProfileId is required when repoCredentialSource is user/repo' });
        }

        if (repoCredentialRemark !== undefined) {
          throw new BadRequestException({ error: 'repoCredentialRemark is only supported for repoCredentialSource=robot' });
        }

        if (source === 'user') {
          if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
          const rawCredentials = await this.userService.getModelCredentialsRaw(req.user.id);
          const providerCredentials = repo.provider === 'github' ? rawCredentials?.github : rawCredentials?.gitlab;
          const profile = (providerCredentials?.profiles ?? []).find((p) => p.id === profileId);
          if (!profile) {
            throw new BadRequestException({ error: 'repoCredentialProfileId does not exist in your account credentials' });
          }
          if (!String(profile.token ?? '').trim()) {
            throw new BadRequestException({ error: 'selected repo credential profile token is missing' });
          }
          return;
        }

        const repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repoId);
        const profile = (repoScopedCredentials?.repoProvider?.profiles ?? []).find((p) => p.id === profileId);
        if (!profile) {
          throw new BadRequestException({ error: 'repoCredentialProfileId does not exist in repo-scoped credentials' });
        }
        if (!String(profile.token ?? '').trim()) {
          throw new BadRequestException({ error: 'selected repo-scoped repo provider token is missing' });
        }
      };

      // Only validate repo provider credential scope when related fields are being patched.
      if (repoCredentialSource !== undefined || repoCredentialProfileId !== undefined || token !== undefined || repoCredentialRemark !== undefined) {
        await validateRepoProviderCredential(nextRepoCredentialSource);
      }

      const normalizedModelProvider =
        typeof modelProvider === 'string'
          ? modelProvider.trim().toLowerCase()
          : String((existing as any).modelProvider ?? '').trim().toLowerCase() || CODEX_PROVIDER_KEY;

      const validateModelCredential = async (
        cfg: { credentialSource: string; credentialProfileId?: string; credential?: { apiKey?: string } },
        providerKey: string
      ) => {
        const credentialSource = String(cfg.credentialSource ?? '').trim().toLowerCase();
        if (credentialSource === 'robot') {
          if (!String(cfg.credential?.apiKey ?? '').trim()) {
            throw new BadRequestException({ error: `${providerKey} apiKey is required (robot credential)` });
          }
          return;
        }

        const profileId = String(cfg.credentialProfileId ?? '').trim();
        if (!profileId) {
          throw new BadRequestException({ error: `${providerKey} credentialProfileId is required when credentialSource is user/repo` });
        }

        if (credentialSource === 'user') {
          if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
          const rawCredentials = await this.userService.getModelCredentialsRaw(req.user.id);
          const providerCredentials = (rawCredentials as any)?.[providerKey] as any;
          const profile = Array.isArray(providerCredentials?.profiles)
            ? providerCredentials.profiles.find((p: any) => p && p.id === profileId)
            : null;
          if (!profile) throw new BadRequestException({ error: `${providerKey} credentialProfileId does not exist in your account credentials` });
          if (!String(profile.apiKey ?? '').trim()) throw new BadRequestException({ error: `selected ${providerKey} profile apiKey is missing` });
          return;
        }

        if (credentialSource === 'repo') {
          const repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repoId);
          const providerCredentials = (repoScopedCredentials as any)?.modelProvider?.[providerKey] as any;
          const profile = Array.isArray(providerCredentials?.profiles)
            ? providerCredentials.profiles.find((p: any) => p && p.id === profileId)
            : null;
          if (!profile) throw new BadRequestException({ error: `${providerKey} credentialProfileId does not exist in repo-scoped credentials` });
          if (!String(profile.apiKey ?? '').trim()) throw new BadRequestException({ error: `selected repo-scoped ${providerKey} apiKey is missing` });
          return;
        }
      };

      if (modelProviderConfig !== undefined) {
        if (!normalizedModelProvider || normalizedModelProvider === CODEX_PROVIDER_KEY) {
          const cfg = normalizeCodexRobotProviderConfig(modelProviderConfig);
          await validateModelCredential(cfg as any, CODEX_PROVIDER_KEY);
        } else if (normalizedModelProvider === CLAUDE_CODE_PROVIDER_KEY) {
          const cfg = normalizeClaudeCodeRobotProviderConfig(modelProviderConfig);
          await validateModelCredential(cfg as any, CLAUDE_CODE_PROVIDER_KEY);
        } else if (normalizedModelProvider === GEMINI_CLI_PROVIDER_KEY) {
          const cfg = normalizeGeminiCliRobotProviderConfig(modelProviderConfig);
          await validateModelCredential(cfg as any, GEMINI_CLI_PROVIDER_KEY);
        }
      }

      const robot = await this.repoRobotService.updateRobot(robotId, {
        name,
        token,
        repoCredentialSource,
        cloneUsername,
        repoCredentialProfileId,
        repoCredentialRemark,
        defaultBranch,
        defaultBranchRole,
        promptDefault,
        language,
        enabled,
        modelProvider,
        modelProviderConfig,
        isDefault
      });
      if (!robot) throw new NotFoundException({ error: 'Robot not found' });

      if (robot.isDefault) {
        await this.repoRobotService.setDefaultRobot(repoId, robot.id);
      }

      return { robot };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : 'Failed to update robot';
      if (
        message.includes('modelProvider must be') ||
        message.includes('defaultBranchRole must be') ||
        message.includes('defaultBranch must be') ||
        message.includes('robot must be activated') ||
        message.includes('name is required') ||
        message.includes('promptDefault is required') ||
        message.includes('repoCredential') ||
        message.includes('credentialProfileId') ||
        message.includes('token must be null')
      ) {
        throw new BadRequestException({ error: message });
      }
      console.error('[repos] update robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update robot' });
    }
  }

  @Post(':id/robots/:robotId/test')
  @ApiOperation({
    summary: 'Test robot token (activate)',
    description: 'Validate the robot token and record permission/identity info.',
    operationId: 'repos_test_robot'
  })
  @ApiOkResponse({ description: 'OK', type: TestRobotResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async testRobot(@Param('id') id: string, @Param('robotId') robotId: string, @Req() req: Request) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Support robot token activation tests without depending on webhook verification. 58w1q3n5nr58flmempxe

      const existing = await this.repoRobotService.getByIdWithToken(robotId);
      if (!existing || existing.repoId !== repoId) {
        throw new NotFoundException({ error: 'Robot not found' });
      }

      const userCredentials = req.user ? await this.userService.getModelCredentialsRaw(req.user.id) : null;
      const repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repoId);
      const source = inferRobotRepoProviderCredentialSource(existing);
      const token = resolveRobotProviderToken({
        provider: repo.provider,
        robot: existing,
        userCredentials,
        repoCredentials: repoScopedCredentials?.repoProvider ?? null,
        source
      });
      if (!token) {
        throw new BadRequestException({
          error:
            'repo provider token is required for activation test (configure per-robot, account-level, or repo-scoped credentials)'
        });
      }

      const externalId = (repo.externalId ?? '').trim();
      const repoIdentity = externalId || (repo.name ?? '').trim();
      if (!repoIdentity) {
        throw new BadRequestException({ error: 'repo identity is required for activation test (externalId or name)' });
      }

      const apiBaseUrl = (repo.apiBaseUrl ?? '').trim() || undefined;

      try {
        const provider = repo.provider;
        if (provider === 'gitlab') {
          const gitlab = new GitlabService({ token, baseUrl: apiBaseUrl });
          const project = await gitlab.getProject(repoIdentity);
          const me = await gitlab.getCurrentUser();
          const member = await gitlab.getProjectMember(project.id, me.id);

          const email = String((me as any).email ?? (me as any).public_email ?? '').trim();
          if (!email) {
            throw new Error('gitlab user email is missing (token may lack required scope)');
          }

          const accessLevel = typeof (member as any).access_level === 'number' ? (member as any).access_level : -1;
          const role =
            accessLevel >= 50
              ? 'owner'
              : accessLevel >= 40
                ? 'maintainer'
                : accessLevel >= 30
                  ? 'developer'
                  : accessLevel >= 20
                    ? 'reporter'
                    : accessLevel >= 10
                      ? 'guest'
                      : 'unknown';

          const saved = await this.repoRobotService.recordTestResult(existing.id, {
            ok: true,
            message: 'ok',
            tokenInfo: {
              userId: String(me.id),
              username: String(me.username ?? '').trim() || undefined,
              name: String(me.name ?? '').trim() || String(me.username ?? '').trim() || undefined,
              email,
              repoRole: role,
              repoRoleDetails: {
                provider: 'gitlab',
                projectId: project.id,
                accessLevel,
                member: {
                  id: (member as any)?.id,
                  username: (member as any)?.username,
                  name: (member as any)?.name,
                  access_level: (member as any)?.access_level,
                  state: (member as any)?.state,
                  expires_at: (member as any)?.expires_at ?? null
                }
              }
            }
          });
          if (!saved) throw new NotFoundException({ error: 'Robot not found' });
          return { ok: true, robot: saved };
        }

        if (provider === 'github') {
          const github = new GithubService({ token, apiBaseUrl });
          const repoIdOrSlug = repoIdentity;
          const me = await github.getCurrentUser();
          const login = String(me.login ?? '').trim();
          const displayName = String((me as any).name ?? '').trim() || login;
          let email = String((me as any).email ?? '').trim();
          if (!email && login && me.id) {
            email = `${me.id}+${login}@users.noreply.github.com`;
          }
          if (!email) {
            try {
              const emails = await github.listUserEmails();
              const primary = emails.find((e) => e && e.primary && e.verified && String(e.email ?? '').trim());
              const anyVerified = emails.find((e) => e && e.verified && String(e.email ?? '').trim());
              email = String(primary?.email ?? anyVerified?.email ?? '').trim();
            } catch (_err) {
              // ignore: token may not have user:email scope
            }
          }
          if (!email) {
            throw new Error('github user email is missing (configure a public email, grant user:email, or use noreply)');
          }

          let repoInfo: any;
          if (repoIdOrSlug.includes('/')) {
            const [owner, repoName] = repoIdOrSlug.split('/');
            if (!owner || !repoName) throw new Error('invalid github externalId (expected owner/repo)');
            repoInfo = await github.getRepository(owner, repoName);
          } else {
            repoInfo = await github.getRepositoryById(repoIdOrSlug);
          }

          const perms = (repoInfo as any)?.permissions ?? null;
          const role =
            perms?.admin
              ? 'admin'
              : perms?.maintain
                ? 'maintain'
                : perms?.push
                  ? 'write'
                  : perms?.triage
                    ? 'triage'
                    : perms?.pull
                      ? 'read'
                      : 'unknown';

          const saved = await this.repoRobotService.recordTestResult(existing.id, {
            ok: true,
            message: 'ok',
            tokenInfo: {
              userId: String(me.id),
              username: login || undefined,
              name: displayName || undefined,
              email,
              repoRole: role,
              repoRoleDetails: {
                provider: 'github',
                repo: {
                  id: (repoInfo as any)?.id,
                  full_name: (repoInfo as any)?.full_name,
                  private: Boolean((repoInfo as any)?.private),
                  html_url: (repoInfo as any)?.html_url
                },
                permissions: perms ?? undefined
              }
            }
          });
          if (!saved) throw new NotFoundException({ error: 'Robot not found' });
          return { ok: true, robot: saved };
        }

        throw new BadRequestException({ error: `unsupported provider: ${provider}` });
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
        const message = err?.message ? String(err.message) : 'robot activation test failed';
        const saved = await this.repoRobotService.recordTestResult(existing.id, { ok: false, message, tokenInfo: null });
        if (!saved) throw new NotFoundException({ error: 'Robot not found' });
        return { ok: false, message, robot: saved };
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] test robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to test robot' });
    }
  }

  @Delete(':id/robots/:robotId')
  @ApiOperation({
    summary: 'Delete robot',
    description: 'Delete a robot under a repository.',
    operationId: 'repos_delete_robot'
  })
  @ApiOkResponse({ description: 'OK', type: DeleteRobotResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async deleteRobot(@Param('id') id: string, @Param('robotId') robotId: string) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Permit robot deletion even when webhooks are not configured yet. 58w1q3n5nr58flmempxe

      const existing = await this.repoRobotService.getById(robotId);
      if (!existing || existing.repoId !== repoId) {
        throw new NotFoundException({ error: 'Robot not found' });
      }

      const config = await this.repoAutomationService.getConfig(repoId);
      const usages = findRobotAutomationUsages(config, existing.id);
      if (usages.length) {
        throw new ConflictException({
          error: 'Robot is referenced by automation rules',
          code: 'ROBOT_IN_USE',
          usages
        });
      }

      const deleted = await this.repoRobotService.deleteRobot(existing.id);
      if (!deleted) throw new NotFoundException({ error: 'Robot not found' });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] delete robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to delete robot' });
    }
  }

  @Get(':id/automation')
  @ApiOperation({
    summary: 'Get automation config',
    description: 'Fetch automation config for a repository.',
    operationId: 'repos_get_automation'
  })
  @ApiOkResponse({ description: 'OK', type: AutomationConfigResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getAutomation(@Param('id') id: string) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });

      const config = await this.repoAutomationService.getConfig(repoId);
      return { config };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get automation failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch automation config' });
    }
  }

  @Put(':id/automation')
  @ApiOperation({
    summary: 'Save automation config',
    description: 'Save automation config for a repository.',
    operationId: 'repos_put_automation'
  })
  @ApiOkResponse({ description: 'OK', type: AutomationConfigResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateAutomation(@Param('id') id: string, @Body() body: UpdateAutomationDto) {
    try {
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      // Allow editing automation rules before webhooks are enabled so users can pre-configure triggers. 58w1q3n5nr58flmempxe

      const config = body?.config;
      if (!config || typeof config !== 'object') {
        throw new BadRequestException({ error: 'config is required' });
      }

      const saved = await this.repoAutomationService.updateConfig(repoId, config as any);
      return { config: saved };
    } catch (err: any) {
      if (err instanceof RepoAutomationConfigValidationError) {
        throw new BadRequestException({ error: err.message, code: err.code, details: err.details });
      }
      if (err instanceof HttpException) throw err;
      console.error('[repos] update automation failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update automation config' });
    }
  }
}
