import { Module } from '@nestjs/common';
import { DashboardSidebarEventsService } from './dashboard-sidebar-events.service';
import { DashboardSidebarTokenService } from './dashboard-sidebar-token.service';
import { EventStreamService } from './event-stream.service';

@Module({
  // Providers for reusable SSE event streaming and dashboard change detection. kxthpiu4eqrmu0c6bboa
  providers: [EventStreamService, DashboardSidebarTokenService, DashboardSidebarEventsService],
  exports: [EventStreamService, DashboardSidebarEventsService]
})
export class EventsModule {}

