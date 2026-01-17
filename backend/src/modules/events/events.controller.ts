import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AllowQueryToken } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DashboardSidebarEventsService } from './dashboard-sidebar-events.service';
import { EventStreamService } from './event-stream.service';

@Controller('events')
@ApiTags('Events')
@ApiBearerAuth('bearerAuth')
export class EventsController {
  constructor(
    private readonly eventStream: EventStreamService,
    private readonly dashboardSidebarEvents: DashboardSidebarEventsService
  ) {}

  private parseTopics(value: unknown): string[] | undefined {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return undefined;
    const topics = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!topics.length) return undefined;
    return Array.from(new Set(topics));
  }

  @Get('stream')
  @AllowQueryToken()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'SSE: global event stream',
    description: 'Stream topic-scoped events via Server-Sent Events (EventSource). Supports ?token= for headerless clients.',
    operationId: 'events_stream'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async stream(@Req() req: Request, @Res() res: Response) {
    // Keep the SSE channel generic so other modules can push events without adding new polling endpoints. kxthpiu4eqrmu0c6bboa
    const topics = this.parseTopics(req.query?.topics);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const unsubscribe = this.eventStream.subscribe(res, { topics });

    // Ensure the dashboard producer loop is running when clients subscribe to it. kxthpiu4eqrmu0c6bboa
    if (!topics || topics.includes('dashboard')) {
      this.dashboardSidebarEvents.ensureStarted();
    }

    // Send a lightweight ready event so the client can confirm the stream is alive.
    try {
      res.write(`event: ready\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch {
      // ignore
    }

    req.on('close', () => {
      unsubscribe();
      // Stop the dashboard poller when no dashboard subscribers remain. kxthpiu4eqrmu0c6bboa
      this.dashboardSidebarEvents.maybeStop();
    });

    return;
  }
}

