import type { Request, Response } from 'express';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { LogWriterService } from './log-writer.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
// Capture write failures for audit logging to avoid duplicating success logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly logWriter: LogWriterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const method = String(req?.method || '').toUpperCase();
    const shouldLog = WRITE_METHODS.has(method);

    if (!shouldLog) return next.handle();

    const startedAt = Date.now();
    const actorUserId = (req as any)?.user?.id as string | undefined;
    const routePath = req?.route?.path ? String(req.route.path) : req?.originalUrl || req?.url || '';
    const params = req?.params ? { ...req.params } : undefined;
    const isRepoRoute = routePath.includes('/repos');
    const isTaskRoute = routePath.includes('/tasks');
    const isTaskGroupRoute = routePath.includes('/task-groups');
    // Derive entity ids from route patterns to avoid mislabeling audit logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    const repoId = params?.repoId ?? (isRepoRoute ? params?.id : undefined);
    const taskId = params?.taskId ?? (isTaskRoute ? params?.id : undefined);
    const taskGroupId = params?.taskGroupId ?? (isTaskGroupRoute ? params?.id : undefined);

    return next.handle().pipe(
      catchError((err) => {
        const durationMs = Date.now() - startedAt;
        const statusCode = (err as any)?.status ?? res?.statusCode;
        void this.logWriter.logOperation({
          level: 'error',
          message: `HTTP ${method} ${routePath} failed`,
          code: 'HTTP_WRITE_FAILED',
          actorUserId,
          repoId,
          taskId,
          taskGroupId,
          meta: {
            method,
            routePath,
            statusCode,
            durationMs,
            params,
            error: err instanceof Error ? err.message : String(err)
          }
        });
        return throwError(() => err);
      })
    );
  }
}
