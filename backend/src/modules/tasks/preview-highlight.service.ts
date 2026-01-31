import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EventStreamService } from '../events/event-stream.service';
import type { PreviewHighlightCommand, PreviewHighlightEvent } from './preview.types';

@Injectable()
export class PreviewHighlightService {
  constructor(private readonly eventStream: EventStreamService) {}

  buildTopic(taskGroupId: string): string {
    // Scope highlight events per task group to minimize SSE fan-out. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    return `preview-highlight:${taskGroupId}`;
  }

  publishHighlight(
    taskGroupId: string,
    instanceName: string,
    command: PreviewHighlightCommand
  ): { requestId: string; subscribers: number } {
    // Attach request IDs and publish highlight commands via the shared SSE stream. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const requestId = command.requestId || randomUUID();
    const payload: PreviewHighlightEvent = {
      taskGroupId,
      instanceName,
      command: { ...command, requestId },
      issuedAt: new Date().toISOString()
    };
    const topic = this.buildTopic(taskGroupId);
    const subscribers = this.eventStream.getTopicSubscriberCount(topic);
    this.eventStream.publish({ topic, event: 'preview.highlight', data: payload });
    return { requestId, subscribers };
  }
}
