import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

type Subscriber = {
  id: string;
  res: Response;
  topics?: Set<string>;
};

/**
 * EventStreamService:
 * - Business context: Backend / Realtime notifications (SSE).
 * - Purpose: provide a single, reusable SSE hub to push topic-scoped events to frontend clients.
 *
 * Notes:
 * - We intentionally keep this service transport-focused (subscribe/publish/heartbeat).
 * - Producers (dashboard polling, etc.) live in separate services and call `publish()`.
 * - Change record: introduce a reusable SSE hub for future push-based features. kxthpiu4eqrmu0c6bboa
 */
@Injectable()
export class EventStreamService {
  private readonly subscribers = new Map<string, Subscriber>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  subscribe(res: Response, options?: { topics?: string[] }): () => void {
    const id = randomUUID();
    const topics = options?.topics?.length ? new Set(options.topics) : undefined;
    this.subscribers.set(id, { id, res, topics });
    this.ensureHeartbeat();

    return () => {
      this.subscribers.delete(id);
      if (this.subscribers.size === 0) this.stopHeartbeat();
    };
  }

  getTopicSubscriberCount(topic: string): number {
    let count = 0;
    for (const sub of this.subscribers.values()) {
      if (!sub.topics || sub.topics.has(topic)) count += 1;
    }
    return count;
  }

  publish(params: { topic: string; event: string; data: unknown }): void {
    const payload = `event: ${params.event}\ndata: ${JSON.stringify(params.data)}\n\n`;
    for (const sub of this.subscribers.values()) {
      if (sub.topics && !sub.topics.has(params.topic)) continue;
      try {
        sub.res.write(payload);
      } catch (err) {
        // Drop broken connections eagerly to avoid leaking memory. kxthpiu4eqrmu0c6bboa
        this.subscribers.delete(sub.id);
      }
    }
    if (this.subscribers.size === 0) this.stopHeartbeat();
  }

  private ensureHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      const payload = ':keep-alive\n\n';
      for (const sub of this.subscribers.values()) {
        try {
          sub.res.write(payload);
        } catch {
          this.subscribers.delete(sub.id);
        }
      }
      if (this.subscribers.size === 0) this.stopHeartbeat();
    }, 25_000);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
