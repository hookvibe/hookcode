import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookEventSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repoId!: string;

  @ApiProperty({ enum: ['gitlab', 'github'] })
  provider!: 'gitlab' | 'github';

  @ApiPropertyOptional({ nullable: true })
  eventName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  mappedEventType?: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  payloadHash?: string | null;

  @ApiPropertyOptional({ nullable: true })
  signatureVerified?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  errorLayer?: string | null;

  @ApiProperty({ type: String, isArray: true })
  matchedRuleIds!: string[];

  @ApiProperty({ type: String, isArray: true })
  matchedRobotIds!: string[];

  @ApiProperty({ type: String, isArray: true })
  taskIds!: string[];

  @ApiProperty({ type: String, isArray: true })
  taskGroupIds!: string[];

  @ApiPropertyOptional({ nullable: true })
  replayOfEventId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  replayMode?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class WebhookEventDetailDto extends WebhookEventSummaryDto {
  @ApiPropertyOptional()
  payload?: unknown;

  @ApiPropertyOptional()
  response?: unknown;

  @ApiPropertyOptional()
  debugTrace?: unknown;

  @ApiPropertyOptional()
  dryRunResult?: unknown;

  @ApiPropertyOptional({ type: WebhookEventSummaryDto, isArray: true })
  replays?: WebhookEventSummaryDto[];
}

export class ListWebhookEventsResponseDto {
  @ApiProperty({ type: WebhookEventSummaryDto, isArray: true })
  events!: WebhookEventSummaryDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class GetWebhookEventResponseDto {
  @ApiProperty({ type: WebhookEventDetailDto })
  event!: WebhookEventDetailDto;
}

export class ReplayWebhookEventResponseDto {
  @ApiProperty({ type: WebhookEventDetailDto })
  event!: WebhookEventDetailDto;
}
