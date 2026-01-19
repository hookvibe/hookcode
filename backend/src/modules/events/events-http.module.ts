import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsModule } from './events.module';

@Module({
  // HTTP wiring for the global SSE event stream. kxthpiu4eqrmu0c6bboa
  imports: [EventsModule],
  controllers: [EventsController]
})
export class EventsHttpModule {}

