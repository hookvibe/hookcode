import { Controller, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/auth.decorator';
import { WebhookService } from './webhook.service';

@Controller('webhook')
@Public()
@ApiTags('Webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('gitlab/:repoId')
  @ApiOperation({
    summary: 'GitLab webhook',
    description: 'Receive GitLab webhook events.',
    operationId: 'webhook_gitlab'
  })
  @ApiBody({ schema: { type: 'object' } })
  gitlab(@Req() req: Request, @Res() res: Response) {
    return this.webhookService.handleGitlabWebhook(req, res);
  }

  @Post('github/:repoId')
  @ApiOperation({
    summary: 'GitHub webhook',
    description: 'Receive GitHub webhook events.',
    operationId: 'webhook_github'
  })
  @ApiBody({ schema: { type: 'object' } })
  github(@Req() req: Request, @Res() res: Response) {
    return this.webhookService.handleGithubWebhook(req, res);
  }
}
