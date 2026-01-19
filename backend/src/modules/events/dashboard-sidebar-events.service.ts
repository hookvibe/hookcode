import { Injectable } from '@nestjs/common';
import { DashboardSidebarTokenService } from './dashboard-sidebar-token.service';
import { EventStreamService } from './event-stream.service';

/**
 * DashboardSidebarEventsService:
 * - Business context: Backend / Dashboard.
 * - Purpose: poll a cheap change token and broadcast `dashboard.sidebar.changed` via the shared SSE stream. kxthpiu4eqrmu0c6bboa
 */
@Injectable()
export class DashboardSidebarEventsService {
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private lastToken: string | null = null;

  constructor(
    private readonly eventStream: EventStreamService,
    private readonly tokenService: DashboardSidebarTokenService
  ) {}

  ensureStarted(): void {
    if (this.timer) return;
    this.schedule(0);
  }

  maybeStop(): void {
    if (this.eventStream.getTopicSubscriberCount('dashboard') > 0) return;
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.polling = false;
    this.lastToken = null;
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.pollOnce(), delayMs);
  }

  private async pollOnce(): Promise<void> {
    this.timer = null;

    // Do not query the DB when nobody subscribes to the dashboard topic. kxthpiu4eqrmu0c6bboa
    if (this.eventStream.getTopicSubscriberCount('dashboard') === 0) {
      this.schedule(30_000);
      return;
    }

    if (this.polling) {
      this.schedule(2_000);
      return;
    }

    this.polling = true;
    try {
      const { token, hasActiveTasks } = await this.tokenService.computeToken({ tasksLimit: 3, taskGroupsLimit: 50 });
      if (token && token !== this.lastToken) {
        this.lastToken = token;
        this.eventStream.publish({
          topic: 'dashboard',
          event: 'dashboard.sidebar.changed',
          data: { token }
        });
      }

      this.schedule(hasActiveTasks ? 5_000 : 15_000);
    } catch (err) {
      console.error('[events] dashboard sidebar token poll failed', err);
      this.schedule(30_000);
    } finally {
      this.polling = false;
    }
  }
}
