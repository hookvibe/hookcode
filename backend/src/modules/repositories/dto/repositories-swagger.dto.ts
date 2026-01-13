import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClaudeCodeCredentialsPublicDto,
  CodexCredentialsPublicDto,
  GeminiCliCredentialsPublicDto
} from '../../users/dto/model-credentials.dto';
import { OkResponseDto } from '../../common/dto/basic-response.dto';

export class RepositoryBranchSwaggerDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  note?: string | null;

  @ApiPropertyOptional()
  isDefault?: boolean;
}

export class RepositorySwaggerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['gitlab', 'github'] })
  provider!: 'gitlab' | 'github';

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  externalId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  webhookVerifiedAt?: string | null;

  @ApiPropertyOptional({ type: RepositoryBranchSwaggerDto, isArray: true })
  branches?: RepositoryBranchSwaggerDto[];

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class RepoScopedRepoProviderCredentialPublicSwaggerDto {
  @ApiProperty()
  hasToken!: boolean;

  @ApiPropertyOptional({ nullable: true })
  cloneUsername?: string | null;
}

export class RepoScopedModelProviderCredentialsPublicSwaggerDto {
  @ApiProperty({ type: CodexCredentialsPublicDto })
  codex!: CodexCredentialsPublicDto;

  @ApiProperty({ type: ClaudeCodeCredentialsPublicDto })
  claude_code!: ClaudeCodeCredentialsPublicDto;

  @ApiProperty({ type: GeminiCliCredentialsPublicDto })
  gemini_cli!: GeminiCliCredentialsPublicDto;
}

export class RepoScopedCredentialsPublicSwaggerDto {
  @ApiProperty({ type: RepoScopedRepoProviderCredentialPublicSwaggerDto })
  repoProvider!: RepoScopedRepoProviderCredentialPublicSwaggerDto;

  @ApiProperty({ type: RepoScopedModelProviderCredentialsPublicSwaggerDto })
  modelProvider!: RepoScopedModelProviderCredentialsPublicSwaggerDto;
}

export class RepoRobotSwaggerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repoId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['read', 'write'] })
  permission!: 'read' | 'write';

  @ApiProperty()
  hasToken!: boolean;

  @ApiPropertyOptional({ nullable: true })
  repoCredentialProfileId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  cloneUsername?: string | null;

  @ApiPropertyOptional({ nullable: true })
  repoTokenUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  repoTokenUsername?: string | null;

  @ApiPropertyOptional({ nullable: true })
  repoTokenUserName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  repoTokenUserEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  repoTokenRepoRole?: string | null;

  @ApiPropertyOptional()
  repoTokenRepoRoleDetails?: unknown;

  @ApiPropertyOptional({ nullable: true })
  promptDefault?: string | null;

  @ApiPropertyOptional({ nullable: true })
  language?: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelProvider?: string | null;

  @ApiPropertyOptional()
  modelProviderConfig?: unknown;

  @ApiPropertyOptional({ nullable: true })
  defaultBranch?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ['main', 'dev', 'test'] })
  defaultBranchRole?: 'main' | 'dev' | 'test' | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  activatedAt?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastTestAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastTestOk?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  lastTestMessage?: string | null;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ListRepositoriesResponseDto {
  @ApiProperty({ type: RepositorySwaggerDto, isArray: true })
  repos!: RepositorySwaggerDto[];
}

export class CreateRepositoryResponseDto {
  @ApiProperty({ type: RepositorySwaggerDto })
  repo!: RepositorySwaggerDto;

  @ApiProperty()
  webhookSecret!: string;

  @ApiProperty()
  webhookPath!: string;
}

export class GetRepositoryResponseDto {
  @ApiProperty({ type: RepositorySwaggerDto })
  repo!: RepositorySwaggerDto;

  @ApiProperty({ type: RepoRobotSwaggerDto, isArray: true })
  robots!: RepoRobotSwaggerDto[];

  @ApiPropertyOptional()
  automationConfig?: unknown;

  @ApiPropertyOptional({ nullable: true })
  webhookSecret?: string | null;

  @ApiProperty()
  webhookPath!: string;

  @ApiPropertyOptional({ type: RepoScopedCredentialsPublicSwaggerDto })
  repoScopedCredentials?: RepoScopedCredentialsPublicSwaggerDto;
}

export class UpdateRepositoryResponseDto {
  @ApiProperty({ type: RepositorySwaggerDto })
  repo!: RepositorySwaggerDto;

  @ApiPropertyOptional({ nullable: true })
  webhookSecret?: string | null;

  @ApiPropertyOptional({ type: RepoScopedCredentialsPublicSwaggerDto })
  repoScopedCredentials?: RepoScopedCredentialsPublicSwaggerDto;
}

export class ListRepoRobotsResponseDto {
  @ApiProperty({ type: RepoRobotSwaggerDto, isArray: true })
  robots!: RepoRobotSwaggerDto[];
}

export class CreateRepoRobotResponseDto {
  @ApiProperty({ type: RepoRobotSwaggerDto })
  robot!: RepoRobotSwaggerDto;
}

export class UpdateRepoRobotResponseDto {
  @ApiProperty({ type: RepoRobotSwaggerDto })
  robot!: RepoRobotSwaggerDto;
}

export class TestRobotResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ type: RepoRobotSwaggerDto })
  robot?: RepoRobotSwaggerDto;
}

export class DeleteRobotResponseDto extends OkResponseDto {}

export class AutomationConfigResponseDto {
  @ApiProperty()
  config!: unknown;
}

export class RepoWebhookDeliverySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repoId!: string;

  @ApiProperty({ enum: ['gitlab', 'github'] })
  provider!: 'gitlab' | 'github';

  @ApiPropertyOptional({ nullable: true })
  eventName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  deliveryId?: string | null;

  @ApiProperty({ enum: ['accepted', 'skipped', 'rejected', 'error'] })
  result!: 'accepted' | 'skipped' | 'rejected' | 'error';

  @ApiProperty()
  httpStatus!: number;

  @ApiPropertyOptional({ nullable: true })
  code?: string | null;

  @ApiPropertyOptional({ nullable: true })
  message?: string | null;

  @ApiProperty({ type: String, isArray: true })
  taskIds!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class RepoWebhookDeliveryDetailDto extends RepoWebhookDeliverySummaryDto {
  @ApiPropertyOptional()
  payload?: unknown;

  @ApiPropertyOptional()
  response?: unknown;
}

export class ListRepoWebhookDeliveriesResponseDto {
  @ApiProperty({ type: RepoWebhookDeliverySummaryDto, isArray: true })
  deliveries!: RepoWebhookDeliverySummaryDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class GetRepoWebhookDeliveryResponseDto {
  @ApiProperty({ type: RepoWebhookDeliveryDetailDto })
  delivery!: RepoWebhookDeliveryDetailDto;
}
