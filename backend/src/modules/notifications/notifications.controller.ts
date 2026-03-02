import { BadRequestException, Controller, Get, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { decodeCreatedAtCursor } from '../../utils/pagination';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { NotificationsService } from './notifications.service';
import { ListNotificationsResponseDto, NotificationUnreadCountDto, NotificationsReadAllResponseDto } from './dto/notifications-swagger.dto';

// Normalize unread filter values from query params. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
const normalizeUnread = (value: unknown): boolean | undefined => {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
};

@AuthScopeGroup('account')
@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth('bearerAuth')
// Expose per-user notification APIs for the console UI. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'List notifications for the current user with cursor pagination.',
    operationId: 'notifications_list'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default 20).' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor.' })
  @ApiQuery({ name: 'unread', required: false, description: 'Filter unread only (true/false).' })
  @ApiOkResponse({ description: 'OK', type: ListNotificationsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('unread') unreadRaw: string | undefined
  ) {
    this.requireUser(req);

    const limit = parsePositiveInt(limitRaw, 20);
    const cursor = decodeCreatedAtCursor(cursorRaw);
    if (cursorRaw && !cursor) throw new BadRequestException({ error: 'Invalid cursor' });

    const unread = normalizeUnread(unreadRaw);
    if (normalizeString(unreadRaw) && unread === undefined) {
      throw new BadRequestException({ error: 'Invalid unread filter' });
    }

    return this.notificationsService.listNotifications({
      userId: req.user!.id,
      limit,
      cursor,
      unreadOnly: unread === true
    });
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Return the number of unread notifications for the current user.',
    operationId: 'notifications_unread_count'
  })
  @ApiOkResponse({ description: 'OK', type: NotificationUnreadCountDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async unreadCount(@Req() req: Request) {
    this.requireUser(req);
    const count = await this.notificationsService.getUnreadCount(req.user!.id);
    return { count };
  }

  @Post('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications for the current user as read.',
    operationId: 'notifications_read_all'
  })
  @ApiOkResponse({ description: 'OK', type: NotificationsReadAllResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async readAll(@Req() req: Request) {
    this.requireUser(req);
    return this.notificationsService.markAllRead(req.user!.id);
  }
}
