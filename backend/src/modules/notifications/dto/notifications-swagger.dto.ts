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
