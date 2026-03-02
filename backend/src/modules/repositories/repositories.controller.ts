import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { RepoAutomationService, findRobotAutomationUsages, RepoAutomationConfigValidationError } from './repo-automation.service';
import { RepoAccessService, type RepoRole } from './repo-access.service';
import { RepoMemberService } from './repo-member.service';
import { RepoRobotService } from './repo-robot.service';
import { RepoWebhookDeliveryService } from './repo-webhook-delivery.service';
import { RepositoryService, type ArchiveScope } from './repository.service';
import { db } from '../../db';
import { GitlabService } from '../../services/gitlabService';
import { GithubService } from '../../services/githubService';
import { UserService } from '../users/user.service';
import { inferRobotRepoProviderCredentialSource, resolveRobotProviderToken } from '../../services/repoRobotAccess';
import { fetchRepoProviderActivity, RepoProviderAuthRequiredError } from '../../services/repoProviderActivity';
import type { RepoProvider, Repository, RepositoryBranch } from '../../types/repository';
import type { RobotDefaultBranchRole } from '../../types/repoRobot';
import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY, normalizeGeminiCliRobotProviderConfig } from '../../modelProviders/geminiCli';
import type { RobotDependencyConfig } from '../../types/dependency';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { CreateRepoRobotDto } from './dto/create-repo-robot.dto';
import { UpdateRepoRobotDto } from './dto/update-repo-robot.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AcceptRepoInviteDto, CreateRepoInviteDto, UpdateRepoMemberDto } from './dto/repo-members.dto';
import { parsePositiveInt } from '../../utils/parse';
import { decodeUpdatedAtCursor, encodeUpdatedAtCursor } from '../../utils/pagination'; // Share cursor helpers for repo list pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
import { TtlCache } from '../../utils/ttlCache';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { OkResponseDto } from '../common/dto/basic-response.dto';
import { isAuthEnabled } from '../../auth/authService'; // Honor auth-disabled mode for repo access enforcement. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import {
  ArchiveRepositoryResponseDto,
  AutomationConfigResponseDto,
  CreateRepoRobotResponseDto,
  CreateRepositoryResponseDto,
  DeleteRepositoryResponseDto,
  DeleteRobotResponseDto,
  GetRepoWebhookDeliveryResponseDto,
  GetRepositoryResponseDto,
  ListRepoInvitesResponseDto,
  ListRepoMembersResponseDto,
  ListRepoRobotsResponseDto,
  RepoProviderActivityResponseDto,
  ListRepoWebhookDeliveriesResponseDto,
  ListRepositoriesResponseDto,
  CreateRepoInviteResponseDto,
  AcceptRepoInviteResponseDto,
  TestRobotResponseDto,
  TestRobotWorkflowResponseDto,
  UnarchiveRepositoryResponseDto,
  UpdateRepoRobotResponseDto,
  UpdateRepositoryResponseDto
} from './dto/repositories-swagger.dto';
import { RepoPreviewConfigResponseDto } from './dto/repo-preview-config.dto';
import { PreviewService } from '../tasks/preview.service';
import { SkillsService } from '../skills/skills.service';
import { SkillSelectionPatchDto, SkillSelectionResponseDto } from '../skills/dto/skill-selection.dto';
import { ModelProviderModelsRequestDto, ModelProviderModelsResponseDto } from '../common/dto/model-provider-models.dto';
import { LogWriterService } from '../logs/log-writer.service'; // Record repo business events in system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
import { listModelProviderModels, ModelProviderModelsFetchError, normalizeSupportedModelProviderKey } from '../../services/modelProviderModels';
import {
  ensureGithubForkRepo,
  ensureGitlabForkProject,
  normalizeRepoWorkflowMode,
  resolveRepoWorkflowMode
} from '../../services/repoWorkflowMode'; // Import fork workflow helpers for controller checks. docs/en/developer/plans/repoctrlfix20260124/task_plan.md repoctrlfix20260124
import { TestRepoRobotWorkflowDto } from './dto/test-repo-robot-workflow.dto';

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

const normalizeRepoUpdatedAt = (value: unknown): string => {
  // Normalize repo.updatedAt into a stable cache key segment without primitive instanceof errors. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  if ((value as any) instanceof Date) return (value as Date).toISOString();
  return String(value ?? '');
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

const normalizeRepoWorkflowModeInput = (value: unknown): 'auto' | 'direct' | 'fork' | null | undefined => {
  // Parse workflow mode inputs for robot create/update + checks. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = normalizeRepoWorkflowMode(value);
  if (!normalized) throw new Error('repoWorkflowMode must be auto/direct/fork or null');
  return normalized;
};

const normalizeArchiveScope = (value: unknown): ArchiveScope => {
  // Keep query parsing tolerant so the Archive page can use `archived=1` while future APIs can use `archived=all`. qnp1mtxhzikhbi0xspbc
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw || raw === '0' || raw === 'false' || raw === 'active') return 'active';
  if (raw === '1' || raw === 'true' || raw === 'archived') return 'archived';
  if (raw === 'all') return 'all';
  return 'active';
};

type ProviderMetaSnapshot = { provider: RepoProvider; visibility: 'public' | 'private' | 'internal' | 'unknown'; webUrl?: string };

const PROVIDER_META_CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_ACTIVITY_CACHE_TTL_MS = 60 * 1000;
// Cache repo provider calls to avoid repeated external API requests on page load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
const providerMetaCache = new TtlCache<string, ProviderMetaSnapshot>(300);
const providerActivityCache = new TtlCache<string, RepoProviderActivityResponseDto>(200);

const buildProviderCacheKey = (parts: Record<string, string | number | undefined | null>): string => {
  // Build stable cache keys for provider meta/activity responses across repeated dashboard refreshes. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  return Object.entries(parts)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .join('&');
};

const assertRepoWritable = (repo: Repository): void => {
  // Reject repo-scoped write operations when the repository is archived to enforce view-only archive semantics. qnp1mtxhzikhbi0xspbc
  if (!repo.archivedAt) return;
  throw new ForbiddenException({
    error: 'Archived repositories are read-only',
    code: 'REPO_ARCHIVED_READ_ONLY'
  });
};

const normalizeRepoMemberRole = (value: unknown, fallback?: RepoRole): RepoRole => {
  // Validate repo member role inputs to avoid persisting invalid RBAC values. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw && fallback) return fallback;
  if (raw === 'owner' || raw === 'maintainer' || raw === 'member') return raw;
  throw new BadRequestException({ error: 'role must be owner, maintainer, or member' });
};

// Centralize auth checks for repo RBAC. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
const ensureRequestUser = (req: Request) => {
  if (req.user) return req.user;
  if (!isAuthEnabled()) {
    // Provide a synthetic admin user when auth is disabled to keep repo APIs usable. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    return { id: 'system', username: 'system', roles: ['admin'] };
  }
  throw new UnauthorizedException({ error: 'Unauthorized' });
};

@AuthScopeGroup('repos') // Scope repository APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('repos')
@ApiTags('Repos')
@ApiBearerAuth('bearerAuth')
export class RepositoriesController {
  // Inject preview service to expose repo preview config endpoints. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly repoAccessService: RepoAccessService,
    private readonly repoMemberService: RepoMemberService,
    private readonly repoRobotService: RepoRobotService,
    private readonly repoAutomationService: RepoAutomationService,
    private readonly repoWebhookDeliveryService: RepoWebhookDeliveryService,
    private readonly userService: UserService,
    private readonly previewService: PreviewService,
    private readonly skillsService: SkillsService,
    // Log repo mutations with a shared audit writer for admin visibility. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    private readonly logWriter: LogWriterService
  ) {}

  // Attach repo-level permissions for UI actions. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  private async attachRepoPermissions(repos: Repository[], user: { id: string; roles?: string[] }) {
    const isAdmin = this.repoAccessService.isAdmin(user);
    if (isAdmin) {
      return repos.map((repo) => ({
        ...repo,
        myRole: 'owner',
        permissions: this.repoAccessService.buildRepoPermissions('owner', true)
      }));
    }

    const repoIds = repos.map((repo) => repo.id);
    const memberships = repoIds.length
      ? await db.repoMember.findMany({
          where: { userId: user.id, repoId: { in: repoIds } },
          select: { repoId: true, role: true }
        })
      : [];
    const roleMap = new Map<string, RepoRole>(
      memberships.map((row) => [String(row.repoId), row.role as RepoRole])
    );

    return repos.map((repo) => {
      const role = roleMap.get(repo.id) ?? null;
      return {
        ...repo,
        myRole: role,
        permissions: this.repoAccessService.buildRepoPermissions(role, false)
      };
    });
  }

  // Enforce per-repo RBAC for read/manage/owner access. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  private async requireRepoRead(req: Request, repoId: string) {
    const user = ensureRequestUser(req);
    await this.repoAccessService.requireRepoRead(user, repoId);
    return user;
  }

  private async requireRepoManage(req: Request, repoId: string) {
    const user = ensureRequestUser(req);
    await this.repoAccessService.requireRepoManage(user, repoId);
    return user;
  }

  private async requireRepoOwner(req: Request, repoId: string) {
    const user = ensureRequestUser(req);
    await this.repoAccessService.requireRepoOwner(user, repoId);
    return user;
  }

  @Get()
  @ApiOperation({
    summary: 'List repositories',
    description: 'List repositories visible to the current user.',
    operationId: 'repos_list'
  })
  // Document cursor pagination for repository lists. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor for fetching the next page of repositories.' })
  @ApiOkResponse({ description: 'OK', type: ListRepositoriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('archived') archivedRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined
  ) {
    try {
      const user = ensureRequestUser(req);
      const scope = normalizeArchiveScope(archivedRaw);
      const limit = parsePositiveInt(limitRaw, 50);
      const cursor = decodeUpdatedAtCursor(cursorRaw);
      if (cursorRaw && !cursor) {
        // Reject invalid cursors so repo pagination remains deterministic. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
        throw new BadRequestException({ error: 'Invalid cursor' });
      }
      const repos = await this.repositoryService.listByArchiveScope(scope, {
        userId: user.id,
        isAdmin: this.repoAccessService.isAdmin(user),
        limit,
        cursor: cursor ?? undefined
      });
      const withPermissions = await this.attachRepoPermissions(repos, user);
      const lastRepo = withPermissions[withPermissions.length - 1];
      const lastUpdatedAt = lastRepo?.updatedAt ? new Date(lastRepo.updatedAt) : null;
      const nextCursor =
        lastRepo && lastUpdatedAt && !Number.isNaN(lastUpdatedAt.getTime()) && withPermissions.length === limit
          ? encodeUpdatedAtCursor({ id: lastRepo.id, updatedAt: lastUpdatedAt })
          : undefined;
      return { repos: withPermissions, ...(nextCursor ? { nextCursor } : {}) };
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

      const user = ensureRequestUser(req);
      const authEnabled = isAuthEnabled();
      const created = await this.repositoryService.createRepository(authEnabled ? user : null, {
        provider,
        name,
        externalId,
        apiBaseUrl,
        webhookSecret,
        branches
      });
      // Seed repo owner membership only when auth is enabled to avoid FK errors in anonymous mode. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (authEnabled) {
        await this.repoMemberService.addMember({ repoId: created.repo.id, userId: user.id, role: 'owner' });
      }

      // Log repo creation metadata without emitting secrets. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository created',
        code: 'REPO_CREATED',
        actorUserId: user.id,
        repoId: created.repo.id,
        meta: {
          provider: created.repo.provider,
          name: created.repo.name,
          enabled: created.repo.enabled,
          branchesCount: Array.isArray(branches) ? branches.length : null,
          webhookSecretProvided: body?.webhookSecret !== undefined
        }
      });

      // Use a relative webhook path; the frontend can prefix with current origin / VITE_API_BASE_URL.
      const webhookPath = `/api/webhook/${created.repo.provider}/${created.repo.id}`;
      const [decorated] = await this.attachRepoPermissions([created.repo], user);

      return {
        repo: decorated,
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
  async get(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

      // Parallelize repo detail hydration to reduce initial repo dashboard latency. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
      const [robots, automationConfig, repoSecretRow, repoScopedCredentialsRow] = await Promise.all([
        this.repoRobotService.listByRepo(repoId),
        this.repoAutomationService.getConfig(repoId),
        this.repositoryService.getByIdWithSecret(repoId),
        this.repositoryService.getRepoScopedCredentials(repoId)
      ]);
      const webhookPath = `/api/webhook/${repo.provider}/${repoId}`;
      const webhookSecret = repoSecretRow?.webhookSecret ?? null;
      const repoScopedCredentials = repoScopedCredentialsRow?.public ?? undefined;

      const [decorated] = await this.attachRepoPermissions([repo], user);
      return { repo: decorated, robots, automationConfig, webhookSecret, webhookPath, repoScopedCredentials };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repo' });
    }
  }

  @Get(':id/skills')
  @ApiOperation({
    summary: 'Get repository skill defaults',
    description: 'Get repo-level default skills for new task groups.',
    operationId: 'repos_skill_defaults_get'
  })
  @ApiOkResponse({ description: 'OK', type: SkillSelectionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getSkillDefaults(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoRead(user, id);
      // Surface repo-level skill defaults for the console UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const selection = await this.skillsService.resolveRepoSkillSelection(id);
      if (!selection) throw new NotFoundException({ error: 'Repo not found' });
      return { selection };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] skill defaults get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repo skill defaults' });
    }
  }

  @Patch(':id/skills')
  @ApiOperation({
    summary: 'Update repository skill defaults',
    description: 'Update repo-level default skills for new task groups.',
    operationId: 'repos_skill_defaults_update'
  })
  @ApiOkResponse({ description: 'OK', type: SkillSelectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateSkillDefaults(@Req() req: Request, @Param('id') id: string, @Body() body: SkillSelectionPatchDto) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      // Persist repo default skill selections for new task groups. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const selectionRaw = body?.selection;
      const selection = selectionRaw === null ? null : Array.isArray(selectionRaw) ? selectionRaw : undefined;
      if (selection === undefined) {
        throw new BadRequestException({ error: 'selection is required' });
      }
      const updated = await this.skillsService.updateRepoSkillSelection(id, selection);
      if (!updated) throw new NotFoundException({ error: 'Repo not found' });
      return { selection: updated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] skill defaults update failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update repo skill defaults' });
    }
  }

  // Provide repo-level preview config discovery for the UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @Get(':id/preview/config')
  @ApiOperation({
    summary: 'Get repository preview config',
    description: 'Detect preview configuration for a repository workspace.',
    operationId: 'repos_preview_config'
  })
  @ApiOkResponse({ description: 'OK', type: RepoPreviewConfigResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async previewConfig(@Req() req: Request, @Param('id') id: string): Promise<RepoPreviewConfigResponseDto> {
    try {
      const user = ensureRequestUser(req);
      const repo = await this.repositoryService.getById(id);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, id);

      return await this.previewService.getRepoPreviewConfig(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] preview config failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch preview config' });
    }
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive repository',
    description: 'Archive a repository and cascade archive to its related tasks/task groups.',
    operationId: 'repos_archive'
  })
  @ApiOkResponse({ description: 'OK', type: ArchiveRepositoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async archive(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const result = await this.repositoryService.archiveRepo(id, req.user ?? null);
      if (!result) throw new NotFoundException({ error: 'Repo not found' });
      // Log repo archive actions with affected record counts. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository archived',
        code: 'REPO_ARCHIVED',
        actorUserId: user.id,
        repoId: result.repo.id,
        meta: {
          tasksArchived: result.tasksArchived,
          taskGroupsArchived: result.taskGroupsArchived
        }
      });
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] archive failed', err);
      throw new InternalServerErrorException({ error: 'Failed to archive repo' });
    }
  }

  @Post(':id/unarchive')
  @ApiOperation({
    summary: 'Unarchive repository',
    description: 'Restore an archived repository and cascade restore to its related tasks/task groups.',
    operationId: 'repos_unarchive'
  })
  @ApiOkResponse({ description: 'OK', type: UnarchiveRepositoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async unarchive(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const result = await this.repositoryService.unarchiveRepo(id, req.user ?? null);
      if (!result) throw new NotFoundException({ error: 'Repo not found' });
      // Log repo restore actions with affected record counts. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository unarchived',
        code: 'REPO_UNARCHIVED',
        actorUserId: user.id,
        repoId: result.repo.id,
        meta: {
          tasksRestored: result.tasksRestored,
          taskGroupsRestored: result.taskGroupsRestored
        }
      });
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] unarchive failed', err);
      throw new InternalServerErrorException({ error: 'Failed to unarchive repo' });
    }
  }

  @Delete(':id')
  // Allow repo owners/admins to remove repositories. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  @ApiOperation({
    summary: 'Delete repository',
    description: 'Delete a repository and related data.',
    operationId: 'repos_delete'
  })
  @ApiOkResponse({ description: 'OK', type: DeleteRepositoryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async delete(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoOwner(user, id);
      const deleted = await this.repositoryService.deleteRepo(id);
      if (!deleted) throw new NotFoundException({ error: 'Repo not found' });
      const [decorated] = await this.attachRepoPermissions([deleted], user);
      // Log repo deletions for audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'Repository deleted',
        code: 'REPO_DELETED',
        actorUserId: user.id,
        repoId: deleted.id,
        meta: { name: deleted.name, provider: deleted.provider }
      });
      return { repo: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] delete failed', err);
      throw new InternalServerErrorException({ error: 'Failed to delete repo' });
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
      const user = ensureRequestUser(req);
      // Provide provider visibility metadata to drive the repo onboarding wizard. 58w1q3n5nr58flmempxe
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

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
      // Ensure repo updatedAt is normalized before building provider cache keys. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
      const repoUpdatedAt = normalizeRepoUpdatedAt(repo.updatedAt);
      const cacheKey = buildProviderCacheKey({
        kind: 'provider-meta',
        repoId,
        repoUpdatedAt,
        provider: repo.provider,
        identity: repoIdentity,
        credentialSource,
        credentialProfileId,
        userId: credentialSource === 'user' ? String(req.user?.id ?? '') : ''
      });

      const meta = await providerMetaCache.getOrSet(cacheKey, PROVIDER_META_CACHE_TTL_MS, async () => {
        const userCredentials = credentialSource === 'user' && req.user ? await this.userService.getModelCredentialsRaw(req.user.id) : null;
        const repoScopedCredentials =
          credentialSource === 'anonymous' ? null : await this.repositoryService.getRepoScopedCredentials(repoId);

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
            // Suppress missing-token warnings when onboarding probes public GitHub repos anonymously. kzxac35mxk0fg358i7zs
            const github = new GithubService({ token, apiBaseUrl, warnIfNoToken: Boolean(token) });
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
      });

      // Cache provider metadata results to avoid repeated external API calls. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
      return meta;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] get provider meta failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch provider metadata' });
    }
  }

  @Get(':id/provider-activity')
  @ApiOperation({
    summary: 'Get provider activity (commits/merges/issues)',
    description:
      'Fetch recent commits, merged MRs/PRs, and issues from the Git provider using anonymous mode for public repos or a selected credential profile for private repos.',
    operationId: 'repos_get_provider_activity'
  })
  @ApiOkResponse({ description: 'OK', type: RepoProviderActivityResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getProviderActivity(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('credentialSource') credentialSourceRaw: string | undefined,
    @Query('credentialProfileId') credentialProfileIdRaw: string | undefined,
    @Query('pageSize') pageSizeRaw: string | undefined,
    @Query('commitsPage') commitsPageRaw: string | undefined,
    @Query('mergesPage') mergesPageRaw: string | undefined,
    @Query('issuesPage') issuesPageRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined
  ) {
    try {
      const user = ensureRequestUser(req);
      // Provide recent provider activity for the repo detail dashboard row (commits/merges/issues). kzxac35mxk0fg358i7zs
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

      const repoIdentity = (repo.externalId ?? '').trim() || (repo.name ?? '').trim();
      if (!repoIdentity) {
        throw new BadRequestException({ error: 'repo identity is required (externalId or name)' });
      }

      const credentialSource = (() => {
        const raw = String(credentialSourceRaw ?? '').trim().toLowerCase();
        if (raw === 'repo') return 'repo';
        if (raw === 'user') return 'user';
        if (raw === 'anonymous') return 'anonymous';
        return 'anonymous';
      })();
      const credentialProfileId = typeof credentialProfileIdRaw === 'string' ? credentialProfileIdRaw.trim() : '';
      const pageSizeFromLimit = parsePositiveInt(limitRaw, 0);
      const pageSize = Math.max(1, Math.min(20, parsePositiveInt(pageSizeRaw, pageSizeFromLimit || 5)));
      const commitsPage = Math.max(1, parsePositiveInt(commitsPageRaw, 1));
      const mergesPage = Math.max(1, parsePositiveInt(mergesPageRaw, 1));
      const issuesPage = Math.max(1, parsePositiveInt(issuesPageRaw, 1));

      // Ensure repo updatedAt is normalized before building provider cache keys. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
      const repoUpdatedAt = normalizeRepoUpdatedAt(repo.updatedAt);
      const cacheKey = buildProviderCacheKey({
        kind: 'provider-activity',
        repoId,
        repoUpdatedAt,
        provider: repo.provider,
        identity: repoIdentity,
        credentialSource,
        credentialProfileId,
        pageSize,
        commitsPage,
        mergesPage,
        issuesPage,
        userId: credentialSource === 'user' ? String(req.user?.id ?? '') : ''
      });

      const response = await providerActivityCache.getOrSet(cacheKey, PROVIDER_ACTIVITY_CACHE_TTL_MS, async () => {
        const userCredentials = credentialSource === 'user' && req.user ? await this.userService.getModelCredentialsRaw(req.user.id) : null;
        const repoScopedCredentials =
          credentialSource === 'anonymous' ? null : await this.repositoryService.getRepoScopedCredentials(repoId);
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
            error: 'repo provider token is required to fetch activity',
            code: 'REPO_PROVIDER_TOKEN_REQUIRED'
          });
        }

        const apiBaseUrl = (repo.apiBaseUrl ?? '').trim() || undefined;
        const activity = await fetchRepoProviderActivity({
          provider: repo.provider,
          repoIdentity,
          token,
          apiBaseUrl,
          pageSize,
          commitsPage,
          mergesPage,
          issuesPage
        });

        // Attach HookCode task-group bindings (and processing tasks) to provider items for the repo dashboard UI. kzxac35mxk0fg358i7zs
        const attachBindings = async (items: Array<{ id: string; taskGroups?: any[] }>) => {
          const commitShas = activity.commits.items.map((i) => String(i.id ?? '').trim()).filter(Boolean);
          const mrIds = activity.merges.items
            .map((i) => Number(i.id))
            .filter((n) => Number.isFinite(n)) as number[];
          const issueIds = activity.issues.items
            .map((i) => Number(i.id))
            .filter((n) => Number.isFinite(n)) as number[];

          if (!commitShas.length && !mrIds.length && !issueIds.length) return;

          const groups = await db.taskGroup.findMany({
            where: {
              repoId,
              archivedAt: null,
              OR: [
                commitShas.length ? { commitSha: { in: commitShas } } : undefined,
                mrIds.length ? { mrId: { in: mrIds } } : undefined,
                issueIds.length ? { issueId: { in: issueIds } } : undefined
              ].filter(Boolean) as any[]
            },
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              kind: true,
              title: true,
              updatedAt: true,
              robotId: true,
              commitSha: true,
              mrId: true,
              issueId: true,
              tasks: {
                where: { status: 'processing', archivedAt: null },
                orderBy: { updatedAt: 'desc' },
                take: 3,
                select: { id: true, status: true, title: true, updatedAt: true }
              }
            }
          });

          const groupsByCommit = new Map<string, any[]>();
          const groupsByMr = new Map<string, any[]>();
          const groupsByIssue = new Map<string, any[]>();

          for (const g of groups) {
            const summary = {
              id: g.id,
              kind: g.kind,
              title: g.title ?? undefined,
              updatedAt: g.updatedAt instanceof Date ? g.updatedAt.toISOString() : String(g.updatedAt ?? ''),
              robotId: g.robotId ?? undefined,
              processingTasks: (g.tasks ?? []).map((t) => ({
                id: t.id,
                status: t.status,
                title: t.title ?? undefined,
                updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt ?? '')
              }))
            };

            if (g.kind === 'commit' && g.commitSha) {
              const key = String(g.commitSha);
              groupsByCommit.set(key, [...(groupsByCommit.get(key) ?? []), summary]);
            }
            if (g.kind === 'merge_request' && typeof g.mrId === 'number') {
              const key = String(g.mrId);
              groupsByMr.set(key, [...(groupsByMr.get(key) ?? []), summary]);
            }
            if (g.kind === 'issue' && typeof g.issueId === 'number') {
              const key = String(g.issueId);
              groupsByIssue.set(key, [...(groupsByIssue.get(key) ?? []), summary]);
            }
          }

          for (const item of items) {
            const id = String(item.id ?? '').trim();
            if (!id) continue;
            const groups = groupsByCommit.get(id) ?? groupsByMr.get(id) ?? groupsByIssue.get(id) ?? [];
            if (groups.length) {
              item.taskGroups = groups;
            }
          }
        };

        const commits = activity.commits.items.map((i) => ({ ...i })) as any[];
        const merges = activity.merges.items.map((i) => ({ ...i })) as any[];
        const issues = activity.issues.items.map((i) => ({ ...i })) as any[];
        await attachBindings([...commits, ...merges, ...issues]);

        return {
          provider: repo.provider,
          commits: { ...activity.commits, items: commits },
          merges: { ...activity.merges, items: merges },
          issues: { ...activity.issues, items: issues }
        };
      });

      // Cache provider activity results to reduce external API calls and heavy binding queries. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
      return response;
    } catch (err) {
      if (err instanceof RepoProviderAuthRequiredError) {
        throw new UnauthorizedException({ error: err.message, code: err.code, providerStatus: err.providerStatus });
      }
      if (err instanceof HttpException) throw err;
      console.error('[repos] get provider activity failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch provider activity' });
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
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined
  ) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

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
    @Req() req: Request,
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string
  ) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patch(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateRepositoryDto) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block mutations for archived repos; the Archive area is view-only. qnp1mtxhzikhbi0xspbc

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
      // Summarize repo update inputs for audit metadata. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      const changedFields = [
        body?.name !== undefined ? 'name' : null,
        body?.externalId !== undefined ? 'externalId' : null,
        body?.apiBaseUrl !== undefined ? 'apiBaseUrl' : null,
        body?.branches !== undefined ? 'branches' : null,
        body?.enabled !== undefined ? 'enabled' : null,
        body?.webhookSecret !== undefined ? 'webhookSecret' : null,
        body?.repoProviderCredential !== undefined ? 'repoProviderCredential' : null,
        body?.modelProviderCredential !== undefined ? 'modelProviderCredential' : null
      ].filter((field): field is string => Boolean(field));

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
      const [decorated] = await this.attachRepoPermissions([updated.repo], user);

      // Log repo updates while avoiding sensitive credential details. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository updated',
        code: 'REPO_UPDATED',
        actorUserId: user.id,
        repoId: updated.repo.id,
        meta: {
          changedFields,
          enabled: enabled,
          branchesCount: Array.isArray(branches) ? branches.length : null
        }
      });

      return {
        repo: decorated,
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

  @Post(':id/model-credentials/models')
  @ApiOperation({
    summary: 'List models for a model provider credential (repo scoped)',
    description: 'Lists models using either a repo-scoped credential profile or an inline apiKey (never returned).',
    operationId: 'repos_list_model_provider_models'
  })
  @ApiOkResponse({ description: 'OK', type: ModelProviderModelsResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async listRepoModelProviderModels(@Param('id') id: string, @Req() req: Request, @Body() body: ModelProviderModelsRequestDto) {
    try {
      const user = ensureRequestUser(req);

      const repoId = String(id ?? '').trim();
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);

      const provider = normalizeSupportedModelProviderKey(body?.provider);
      const profileId = typeof body?.profileId === 'string' ? body.profileId.trim() : '';
      const overrideApiBaseUrl = typeof body?.credential?.apiBaseUrl === 'string' ? body.credential.apiBaseUrl.trim() : '';
      const inlineApiKey = typeof body?.credential?.apiKey === 'string' ? body.credential.apiKey.trim() : '';

      const repoScopedCredentials = profileId ? await this.repositoryService.getRepoScopedCredentials(repoId) : null;
      if (profileId && !repoScopedCredentials) throw new NotFoundException({ error: 'Repo not found' });

      const providerProfiles = profileId ? ((repoScopedCredentials as any)?.modelProvider?.[provider]?.profiles ?? []) : [];
      const storedProfile = profileId ? providerProfiles.find((p: any) => p && String(p.id ?? '').trim() === profileId) : null;
      if (profileId && !storedProfile) {
        throw new BadRequestException({ error: 'profileId does not exist in repo-scoped credentials', code: 'MODEL_PROFILE_NOT_FOUND' });
      }

      const apiKey = inlineApiKey || String(storedProfile?.apiKey ?? '').trim();
      if (!apiKey) {
        throw new BadRequestException({ error: 'credential.apiKey is required', code: 'MODEL_API_KEY_REQUIRED' });
      }

      const apiBaseUrl = overrideApiBaseUrl || String(storedProfile?.apiBaseUrl ?? '').trim() || undefined;

      const result = await listModelProviderModels({
        provider,
        apiKey,
        apiBaseUrl,
        forceRefresh: Boolean(body?.forceRefresh)
      });

      return { models: result.models, source: result.source };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      if (err instanceof ModelProviderModelsFetchError && (err.status === 401 || err.status === 403)) {
        // UX: surface invalid keys explicitly so users can fix credentials instead of seeing fallbacks. b8fucnmey62u0muyn7i0
        throw new BadRequestException({ error: 'Model provider API key is invalid or unauthorized', code: 'MODEL_API_KEY_INVALID' });
      }
      const message = err?.message ? String(err.message) : '';
      if (message.includes('provider must be')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[repos] list model provider models failed', err);
      throw new InternalServerErrorException({ error: 'Failed to list model provider models' });
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
  async listRobots(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async createRobot(@Param('id') id: string, @Req() req: Request, @Body() body: CreateRepoRobotDto) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block robot creation for archived repos to keep archived config immutable. qnp1mtxhzikhbi0xspbc
      // Allow configuring robots without requiring webhook verification (webhooks are optional). 58w1q3n5nr58flmempxe

      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const token = normalizeNullableTrimmedString(body?.token, 'token');
      const repoCredentialSourceRaw = normalizeRepoCredentialSource(body?.repoCredentialSource);
      const repoCredentialProfileId = normalizeNullableTrimmedString(body?.repoCredentialProfileId, 'repoCredentialProfileId');
      const cloneUsername = normalizeNullableTrimmedString(body?.cloneUsername, 'cloneUsername');
      const repoCredentialRemark = normalizeNullableTrimmedString(body?.repoCredentialRemark, 'repoCredentialRemark');
      // Capture explicit workflow mode for robot creation (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
      // De-duplicate repoWorkflowMode input parsing to avoid scope redeclare errors. docs/en/developer/plans/repoctrlfix20260124/task_plan.md repoctrlfix20260124
      const repoWorkflowMode = normalizeRepoWorkflowModeInput(body?.repoWorkflowMode);

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
      // Capture dependency overrides from robot creation payloads. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      // Cast dependency override payloads for service-level validation. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      const dependencyConfig = body?.dependencyConfig as RobotDependencyConfig | null | undefined;
      const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : undefined;
      // Forward robot-level time window inputs to the service for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const timeWindow = body?.timeWindow;

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
        return await this.userService.getModelCredentialsRaw(user.id);
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
        dependencyConfig,
        repoWorkflowMode,
        timeWindow,
        isDefault
      });

      if (robot.isDefault) {
        await this.repoRobotService.setDefaultRobot(repoId, robot.id);
      }

      // Log robot creation for repo audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository robot created',
        code: 'REPO_ROBOT_CREATED',
        actorUserId: user.id,
        repoId,
        meta: {
          robotId: robot.id,
          name: robot.name,
          enabled: robot.enabled,
          isDefault: robot.isDefault,
          repoCredentialSource: robot.repoCredentialSource ?? null,
          modelProvider: robot.modelProvider ?? null
        }
      });

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
        message.includes('token must be null') ||
        message.includes('repoWorkflowMode must be') ||
        message.includes('dependencyConfig') ||
        // Treat timeWindow validation errors as client input problems. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        message.includes('timeWindow')
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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patchRobot(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @Req() req: Request,
    @Body() body: UpdateRepoRobotDto
  ) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block robot updates for archived repos to enforce read-only archive behavior. qnp1mtxhzikhbi0xspbc
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
      // Accept dependency overrides on robot updates. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      // Cast dependency override payloads for service-level validation. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      const dependencyConfig = body?.dependencyConfig as RobotDependencyConfig | null | undefined;
      const defaultBranch = body?.defaultBranch === undefined ? undefined : normalizeDefaultBranch(body?.defaultBranch);
      const defaultBranchRole =
        body?.defaultBranchRole === undefined ? undefined : normalizeDefaultBranchRole(body?.defaultBranchRole);
      // Normalize repo workflow mode patch input for robot updates. docs/en/developer/plans/repoctrlfix20260124/task_plan.md repoctrlfix20260124
      const repoWorkflowMode = normalizeRepoWorkflowModeInput(body?.repoWorkflowMode);
      const promptDefault =
        body?.promptDefault === undefined ? undefined : typeof body?.promptDefault === 'string' ? body.promptDefault.trim() : '';
      if (body?.promptDefault !== undefined && !promptDefault) {
        throw new BadRequestException({ error: 'promptDefault is required' });
      }
      const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
      const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : undefined;
      // Forward robot-level time window updates to the service for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const timeWindow = body?.timeWindow;
      // Summarize robot patch inputs for audit metadata. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      const changedFields = [
        body?.name !== undefined ? 'name' : null,
        body?.token !== undefined ? 'token' : null,
        body?.repoCredentialSource !== undefined ? 'repoCredentialSource' : null,
        body?.repoCredentialProfileId !== undefined ? 'repoCredentialProfileId' : null,
        body?.repoCredentialRemark !== undefined ? 'repoCredentialRemark' : null,
        body?.cloneUsername !== undefined ? 'cloneUsername' : null,
        body?.language !== undefined ? 'language' : null,
        body?.modelProvider !== undefined ? 'modelProvider' : null,
        body?.modelProviderConfig !== undefined ? 'modelProviderConfig' : null,
        body?.dependencyConfig !== undefined ? 'dependencyConfig' : null,
        body?.defaultBranch !== undefined ? 'defaultBranch' : null,
        body?.defaultBranchRole !== undefined ? 'defaultBranchRole' : null,
        body?.repoWorkflowMode !== undefined ? 'repoWorkflowMode' : null,
        body?.promptDefault !== undefined ? 'promptDefault' : null,
        body?.enabled !== undefined ? 'enabled' : null,
        body?.isDefault !== undefined ? 'isDefault' : null,
        body?.timeWindow !== undefined ? 'timeWindow' : null
      ].filter((field): field is string => Boolean(field));

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
          const rawCredentials = await this.userService.getModelCredentialsRaw(user.id);
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
          const rawCredentials = await this.userService.getModelCredentialsRaw(user.id);
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
        // Persist dependency overrides from robot patch requests. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
        dependencyConfig,
        repoWorkflowMode,
        timeWindow,
        isDefault
      });
      if (!robot) throw new NotFoundException({ error: 'Robot not found' });

      if (robot.isDefault) {
        await this.repoRobotService.setDefaultRobot(repoId, robot.id);
      }

      // Log robot updates without leaking credentials. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository robot updated',
        code: 'REPO_ROBOT_UPDATED',
        actorUserId: user.id,
        repoId,
        meta: {
          robotId: robot.id,
          changedFields,
          enabled: robot.enabled,
          isDefault: robot.isDefault,
          repoCredentialSource: robot.repoCredentialSource ?? null,
          modelProvider: robot.modelProvider ?? null
        }
      });

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
        message.includes('token must be null') ||
        message.includes('repoWorkflowMode must be') ||
        message.includes('dependencyConfig') ||
        // Treat timeWindow validation errors as client input problems. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        message.includes('timeWindow')
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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async testRobot(@Param('id') id: string, @Param('robotId') robotId: string, @Req() req: Request) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block robot activation tests for archived repos to keep archived state stable. qnp1mtxhzikhbi0xspbc
      // Support robot token activation tests without depending on webhook verification. 58w1q3n5nr58flmempxe

      const existing = await this.repoRobotService.getByIdWithToken(robotId);
      if (!existing || existing.repoId !== repoId) {
        throw new NotFoundException({ error: 'Robot not found' });
      }

      const userCredentials = await this.userService.getModelCredentialsRaw(user.id);
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

  @Post(':id/robots/:robotId/workflow/test')
  @ApiOperation({
    summary: 'Test robot repo workflow (direct/fork)',
    description: 'Validate the selected repo workflow mode by checking direct access or fork availability.',
    operationId: 'repos_test_robot_workflow'
  })
  @ApiOkResponse({ description: 'OK', type: TestRobotWorkflowResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async testRobotWorkflow(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @Req() req: Request,
    @Body() body: TestRepoRobotWorkflowDto
  ) {
    // Validate robot workflow mode by checking direct access or fork availability. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
    let resolvedMode: 'auto' | 'direct' | 'fork' = 'auto';
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block workflow tests for archived repos to keep archived state stable. qnp1mtxhzikhbi0xspbc

      const existing = await this.repoRobotService.getByIdWithToken(robotId);
      if (!existing || existing.repoId !== repoId) {
        throw new NotFoundException({ error: 'Robot not found' });
      }

      const requestedMode =
        body?.mode === undefined ? undefined : normalizeRepoWorkflowModeInput(body?.mode);
      resolvedMode = resolveRepoWorkflowMode(requestedMode ?? existing.repoWorkflowMode);

      const userCredentials = await this.userService.getModelCredentialsRaw(user.id);
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
          error: 'repo provider token is required for workflow test (configure per-robot, account-level, or repo-scoped credentials)'
        });
      }

      const externalId = (repo.externalId ?? '').trim();
      const repoIdentity = externalId || (repo.name ?? '').trim();
      if (!repoIdentity) {
        throw new BadRequestException({ error: 'repo identity is required for workflow test (externalId or name)' });
      }

      const apiBaseUrl = (repo.apiBaseUrl ?? '').trim() || undefined;

      const pickAutoMode = (canPush: boolean): 'direct' | 'fork' => {
        // Keep auto mode aligned with agent workflow rules. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        if (existing.permission !== 'write') return 'direct';
        return canPush ? 'direct' : 'fork';
      };

      if (repo.provider === 'github') {
        const github = new GithubService({ token, apiBaseUrl });
        let repoInfo: any;
        if (repoIdentity.includes('/')) {
          const [owner, repoName] = repoIdentity.split('/');
          if (!owner || !repoName) throw new BadRequestException({ error: 'invalid github repo identity (expected owner/repo)' });
          repoInfo = await github.getRepository(owner, repoName);
        } else {
          repoInfo = await github.getRepositoryById(repoIdentity);
        }

        const perms = (repoInfo as any)?.permissions ?? null;
        const canPush = Boolean(perms?.admin || perms?.maintain || perms?.push);
        const finalMode = resolvedMode === 'auto' ? pickAutoMode(canPush) : resolvedMode;
        resolvedMode = finalMode;

        if (finalMode === 'direct') {
          if (existing.permission === 'write' && !canPush) {
            return { ok: false, mode: finalMode, message: 'token lacks upstream push permission for direct workflow', robot: existing };
          }
          return { ok: true, mode: finalMode, message: 'direct workflow check ok', robot: existing };
        }

        const fullName = String((repoInfo as any)?.full_name ?? '').trim();
        const [owner, repoName] = fullName.includes('/') ? fullName.split('/') : repoIdentity.split('/');
        if (!owner || !repoName) throw new BadRequestException({ error: 'github repo identity is missing for fork workflow' });
        await ensureGithubForkRepo({ github, upstream: { owner, repo: repoName } });
        return { ok: true, mode: finalMode, message: 'fork workflow check ok', robot: existing };
      }

      if (repo.provider === 'gitlab') {
        const gitlab = new GitlabService({ token, baseUrl: apiBaseUrl });
        const project = await gitlab.getProject(repoIdentity);
        const me = await gitlab.getCurrentUser();
        const member = await gitlab.getProjectMember(project.id, me.id);

        const accessLevel = typeof (member as any)?.access_level === 'number' ? (member as any).access_level : -1;
        const canPush = accessLevel >= 30;
        const finalMode = resolvedMode === 'auto' ? pickAutoMode(canPush) : resolvedMode;
        resolvedMode = finalMode;

        if (finalMode === 'direct') {
          if (existing.permission === 'write' && !canPush) {
            return { ok: false, mode: finalMode, message: 'token lacks upstream push permission for direct workflow', robot: existing };
          }
          return { ok: true, mode: finalMode, message: 'direct workflow check ok', robot: existing };
        }

        await ensureGitlabForkProject({ gitlab, upstreamProject: project.id });
        return { ok: true, mode: finalMode, message: 'fork workflow check ok', robot: existing };
      }

      throw new BadRequestException({ error: `unsupported provider: ${repo.provider}` });
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : 'robot workflow test failed';
      if (message.includes('repoWorkflowMode must be')) {
        throw new BadRequestException({ error: message });
      }
      return { ok: false, mode: resolvedMode, message };
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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async deleteRobot(@Req() req: Request, @Param('id') id: string, @Param('robotId') robotId: string) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block robot deletion for archived repos to prevent modifying archived configuration. qnp1mtxhzikhbi0xspbc
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
      // Log robot deletions for audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'Repository robot deleted',
        code: 'REPO_ROBOT_DELETED',
        actorUserId: user.id,
        repoId,
        meta: {
          robotId: existing.id,
          name: existing.name,
          wasDefault: existing.isDefault
        }
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] delete robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to delete robot' });
    }
  }

  @Get(':id/members')
  // Repo member and invite management endpoints. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  @ApiOperation({
    summary: 'List repo members',
    description: 'List members for a repository.',
    operationId: 'repos_list_members'
  })
  @ApiOkResponse({ description: 'OK', type: ListRepoMembersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async listMembers(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const members = await this.repoMemberService.listMembers(id);
      return { members };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] list members failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repo members' });
    }
  }

  @Patch(':id/members/:userId')
  @ApiOperation({
    summary: 'Update repo member role',
    description: 'Update a repository member role.',
    operationId: 'repos_update_member_role'
  })
  @ApiOkResponse({ description: 'OK', type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateMemberRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: UpdateRepoMemberDto
  ) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const role = normalizeRepoMemberRole(body?.role);
      if (role === 'owner') {
        await this.repoAccessService.requireRepoOwner(user, id);
      }
      await this.repoMemberService.updateMemberRole({ repoId: id, userId, role: role as any });
      // Log membership role changes for audit visibility. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository member role updated',
        code: 'REPO_MEMBER_ROLE_UPDATED',
        actorUserId: user.id,
        repoId: id,
        meta: { memberUserId: userId, role }
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] update member role failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update member role' });
    }
  }

  @Delete(':id/members/:userId')
  @ApiOperation({
    summary: 'Remove repo member',
    description: 'Remove a repository member.',
    operationId: 'repos_remove_member'
  })
  @ApiOkResponse({ description: 'OK', type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async removeMember(@Req() req: Request, @Param('id') id: string, @Param('userId') userId: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const existing = await db.repoMember.findUnique({ where: { repoId_userId: { repoId: id, userId } } });
      if (!existing) throw new NotFoundException({ error: 'Member not found' });
      if (String(existing.role ?? '').toLowerCase() === 'owner') {
        await this.repoAccessService.requireRepoOwner(user, id);
      }
      await this.repoMemberService.removeMember({ repoId: id, userId });
      // Log repo member removals for audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'Repository member removed',
        code: 'REPO_MEMBER_REMOVED',
        actorUserId: user.id,
        repoId: id,
        meta: { memberUserId: userId, previousRole: existing.role }
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] remove member failed', err);
      throw new InternalServerErrorException({ error: 'Failed to remove member' });
    }
  }

  @Get(':id/invites')
  @ApiOperation({
    summary: 'List repo invites',
    description: 'List pending invites for a repository.',
    operationId: 'repos_list_invites'
  })
  @ApiOkResponse({ description: 'OK', type: ListRepoInvitesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async listInvites(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const invites = await this.repoMemberService.listInvites(id);
      return { invites };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] list invites failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch repo invites' });
    }
  }

  @Post(':id/invites')
  @ApiOperation({
    summary: 'Create repo invite',
    description: 'Invite a user to a repository.',
    operationId: 'repos_create_invite'
  })
  @ApiOkResponse({ description: 'OK', type: CreateRepoInviteResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async createInvite(@Req() req: Request, @Param('id') id: string, @Body() body: CreateRepoInviteDto) {
    try {
      if (!isAuthEnabled()) {
        // Disable invite flows when auth is turned off to avoid invalid user references. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        throw new BadRequestException({ error: 'Auth is disabled' });
      }
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      const roleRaw = normalizeRepoMemberRole(body?.role, 'member');
      if (roleRaw === 'owner') {
        await this.repoAccessService.requireRepoOwner(user, id);
      }
      const invite = await this.repoMemberService.createInvite({
        repoId: id,
        invitedByUserId: user.id,
        email: String(body?.email ?? '').trim(),
        role: roleRaw as any
      });
      // Log invite creation without recording email addresses. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository invite created',
        code: 'REPO_INVITE_CREATED',
        actorUserId: user.id,
        repoId: id,
        meta: { inviteId: invite.id, role: invite.role }
      });
      return { invite };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] create invite failed', err);
      throw new InternalServerErrorException({ error: 'Failed to create invite' });
    }
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({
    summary: 'Revoke repo invite',
    description: 'Revoke a pending repository invite.',
    operationId: 'repos_revoke_invite'
  })
  @ApiOkResponse({ description: 'OK', type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async revokeInvite(@Req() req: Request, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    try {
      const user = ensureRequestUser(req);
      await this.repoAccessService.requireRepoManage(user, id);
      await this.repoMemberService.revokeInvite({ repoId: id, inviteId });
      // Log invite revocations for audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'Repository invite revoked',
        code: 'REPO_INVITE_REVOKED',
        actorUserId: user.id,
        repoId: id,
        meta: { inviteId }
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] revoke invite failed', err);
      throw new InternalServerErrorException({ error: 'Failed to revoke invite' });
    }
  }

  @Post('invites/accept')
  @ApiOperation({
    summary: 'Accept repo invite',
    description: 'Accept a repository invite using a token.',
    operationId: 'repos_accept_invite'
  })
  @ApiOkResponse({ description: 'OK', type: AcceptRepoInviteResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async acceptInvite(@Req() req: Request, @Body() body: AcceptRepoInviteDto) {
    try {
      if (!isAuthEnabled()) {
        // Invite acceptance depends on authenticated users. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        throw new BadRequestException({ error: 'Auth is disabled' });
      }
      const user = ensureRequestUser(req);
      const email = String(body?.email ?? '').trim();
      const token = String(body?.token ?? '').trim();
      if (!email || !token) throw new BadRequestException({ error: 'email and token are required' });
      const repoId = await this.repoMemberService.acceptInvite({ token, email, userId: user.id });
      // Log invite acceptance without storing invite tokens or emails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository invite accepted',
        code: 'REPO_INVITE_ACCEPTED',
        actorUserId: user.id,
        repoId,
        meta: { inviteeUserId: user.id }
      });
      return { repoId };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[repos] accept invite failed', err);
      throw new InternalServerErrorException({ error: 'Failed to accept invite' });
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
  async getAutomation(@Req() req: Request, @Param('id') id: string) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoRead(user, repoId);

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
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateAutomation(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateAutomationDto) {
    try {
      const user = ensureRequestUser(req);
      const repoId = id;
      const repo = await this.repositoryService.getById(repoId);
      if (!repo) throw new NotFoundException({ error: 'Repo not found' });
      await this.repoAccessService.requireRepoManage(user, repoId);
      assertRepoWritable(repo); // Block automation updates for archived repos (automation is view-only in Archive). qnp1mtxhzikhbi0xspbc
      // Allow editing automation rules before webhooks are enabled so users can pre-configure triggers. 58w1q3n5nr58flmempxe

      const config = body?.config;
      if (!config || typeof config !== 'object') {
        throw new BadRequestException({ error: 'config is required' });
      }

      const saved = await this.repoAutomationService.updateConfig(repoId, config as any);
      // Summarize automation rule counts for audit metadata. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      const eventEntries = Object.entries(saved?.events ?? {});
      const ruleCounts: Record<string, number> = {};
      let totalRules = 0;
      eventEntries.forEach(([key, value]) => {
        const rules = Array.isArray((value as any)?.rules) ? (value as any).rules.length : 0;
        ruleCounts[key] = rules;
        totalRules += rules;
      });
      // Log automation config updates with rule counts only. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Repository automation updated',
        code: 'REPO_AUTOMATION_UPDATED',
        actorUserId: user.id,
        repoId,
        meta: {
          version: (saved as any)?.version ?? null,
          totalRules,
          ruleCounts
        }
      });
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
