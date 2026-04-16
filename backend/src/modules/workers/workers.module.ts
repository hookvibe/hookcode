import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { WorkersService } from './workers.service';

@Module({
  imports: [LogsModule],
  providers: [WorkersService],
  exports: [WorkersService]
})
export class WorkersModule {}
