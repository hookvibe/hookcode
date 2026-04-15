import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Swagger DTOs for notification APIs. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  level!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional({ nullable: true })
  repoId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  taskId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  taskGroupId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Primary notification target; in-app links use hash URLs and external targets keep absolute URLs.' })
  linkUrl?: string | null; // Expose the notification destination in the public API contract. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9

  @ApiPropertyOptional()
  meta?: Record<string, any>;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  readAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ListNotificationsResponseDto {
  @ApiProperty({ type: NotificationEntryDto, isArray: true })
  notifications!: NotificationEntryDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class NotificationUnreadCountDto {
  @ApiProperty()
  count!: number;
}

export class NotificationsReadAllResponseDto {
  @ApiProperty()
  updated!: number;

  @ApiProperty({ format: 'date-time' })
  readAt!: string;
}
