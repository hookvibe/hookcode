import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Body,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { db } from '../../db';
import type { ApprovalRequestStatus } from '../../policyEngine/types';
import { ApprovalQueueService } from '../../policyEngine/approvalQueue.service';
import { decodeCreatedAtCursor } from '../../utils/pagination';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RepoAccessService } from '../repositories/repo-access.service';
import {
  ApprovalActionRequestDto,
  ApprovalActionResponseDto,
  ListApprovalsResponseDto
} from './dto/approvals-swagger.dto';

const normalizeApprovalStatus = (value: unknown): ApprovalRequestStatus | undefined => {
  const raw = normalizeString(value);
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected' || raw === 'changes_requested') return raw;
  return undefined;
};

@AuthScopeGroup('tasks')
@Controller('approvals')
@ApiTags('Approvals')
@ApiBearerAuth('bearerAuth')
export class ApprovalsController {
  constructor(
    private readonly approvalsService: ApprovalQueueService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  private async listManageableRepoIds(user: { id: string; roles?: string[] }): Promise<string[] | null> {
    if (this.repoAccessService.isAdmin(user)) return null;
    const rows = await db.repoMember.findMany({
      where: { userId: user.id, role: { in: ['owner', 'maintainer'] } },
      select: { repoId: true }
    });
    return rows.map((row) => String(row.repoId));
  }

  @Get()
  @ApiOperation({
    summary: 'List approval requests',
    description: 'List approval requests visible to the current user.',
    operationId: 'approvals_list'
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'repoId', required: false })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiOkResponse({ description: 'OK', type: ListApprovalsResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('status') statusRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('taskId') taskIdRaw: string | undefined
  ) {
    try {
      this.requireUser(req);
      const limit = parsePositiveInt(limitRaw, 20);
      const cursor = decodeCreatedAtCursor(cursorRaw);
      if (cursorRaw && !cursor) throw new BadRequestException({ error: 'Invalid cursor' });

      const status = normalizeApprovalStatus(statusRaw);
      if (normalizeString(statusRaw) && !status) throw new BadRequestException({ error: 'Invalid status' });

      const repoId = normalizeString(repoIdRaw) || undefined;
      const taskId = normalizeString(taskIdRaw) || undefined;

      if (repoId) {
        await this.repoAccessService.requireRepoManage(req.user!, repoId);
      }

      const allowedRepoIds = repoId ? undefined : await this.listManageableRepoIds(req.user!);
      return this.approvalsService.listApprovalRequests({
        limit,
        cursor,
        status,
        repoId,
        taskId,
        allowedRepoIds
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[approvals] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to list approvals' });
    }
  }

  private async requireApprovalManage(req: Request, approvalId: string) {
    this.requireUser(req);
    const approval = await this.approvalsService.getApprovalRequest(approvalId);
    if (!approval) throw new NotFoundException({ error: 'Approval request not found' });
    if (approval.repoId) {
      await this.repoAccessService.requireRepoManage(req.user!, approval.repoId);
    }
    return approval;
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve once',
    description: 'Approve a pending approval request and return the task to the queue.',
    operationId: 'approvals_approve'
  })
  @ApiOkResponse({ description: 'OK', type: ApprovalActionResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async approve(@Req() req: Request, @Param('id') id: string, @Body() body: ApprovalActionRequestDto) {
    try {
      await this.requireApprovalManage(req, id);
      const taskId = await this.approvalsService.approveOnce(id, req.user!.id, { note: body?.note, action: 'approve' });
      if (!taskId) throw new NotFoundException({ error: 'Approval request not found' });
      const approval = await this.approvalsService.getApprovalRequest(id);
      if (!approval) throw new NotFoundException({ error: 'Approval request not found' });
      return { approval };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[approvals] approve failed', err);
      throw new InternalServerErrorException({ error: 'Failed to approve request' });
    }
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject approval',
    description: 'Reject a pending approval request and fail the task.',
    operationId: 'approvals_reject'
  })
  @ApiOkResponse({ description: 'OK', type: ApprovalActionResponseDto })
  async reject(@Req() req: Request, @Param('id') id: string, @Body() body: ApprovalActionRequestDto) {
    try {
      await this.requireApprovalManage(req, id);
      const taskId = await this.approvalsService.rejectApproval(id, req.user!.id, { note: body?.note, status: 'rejected' });
      if (!taskId) throw new NotFoundException({ error: 'Approval request not found' });
      const approval = await this.approvalsService.getApprovalRequest(id);
      if (!approval) throw new NotFoundException({ error: 'Approval request not found' });
      return { approval };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[approvals] reject failed', err);
      throw new InternalServerErrorException({ error: 'Failed to reject request' });
    }
  }

  @Post(':id/request-changes')
  @ApiOperation({
    summary: 'Request changes',
    description: 'Request changes for a pending approval request and fail the current task attempt.',
    operationId: 'approvals_request_changes'
  })
  @ApiOkResponse({ description: 'OK', type: ApprovalActionResponseDto })
  async requestChanges(@Req() req: Request, @Param('id') id: string, @Body() body: ApprovalActionRequestDto) {
    try {
      await this.requireApprovalManage(req, id);
      const taskId = await this.approvalsService.rejectApproval(id, req.user!.id, { note: body?.note, status: 'changes_requested' });
      if (!taskId) throw new NotFoundException({ error: 'Approval request not found' });
      const approval = await this.approvalsService.getApprovalRequest(id);
      if (!approval) throw new NotFoundException({ error: 'Approval request not found' });
      return { approval };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[approvals] request changes failed', err);
      throw new InternalServerErrorException({ error: 'Failed to request changes' });
    }
  }

  @Post(':id/approve-always')
  @ApiOperation({
    summary: 'Approve and create allow rule',
    description: 'Approve a pending request and create a matching allow rule for future tasks.',
    operationId: 'approvals_approve_always'
  })
  @ApiOkResponse({ description: 'OK', type: ApprovalActionResponseDto })
  async approveAlways(@Req() req: Request, @Param('id') id: string, @Body() body: ApprovalActionRequestDto) {
    try {
      await this.requireApprovalManage(req, id);
      const taskId = await this.approvalsService.approveAlways(id, req.user!.id, { note: body?.note });
      if (!taskId) throw new NotFoundException({ error: 'Approval request not found' });
      const approval = await this.approvalsService.getApprovalRequest(id);
      if (!approval) throw new NotFoundException({ error: 'Approval request not found' });
      return { approval };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[approvals] approve always failed', err);
      throw new InternalServerErrorException({ error: 'Failed to approve request' });
    }
  }
}
