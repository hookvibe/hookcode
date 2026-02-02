import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

// Backfill missing error/message fields so clients always see a readable explanation. docs/en/developer/plans/im5mpw0g5827wu95w4ki/task_plan.md im5mpw0g5827wu95w4ki
const applyMessageFallback = (payload: Record<string, unknown>): Record<string, unknown> => {
  const message = payload.message;
  const error = payload.error;
  const code = payload.code;

  if (message === undefined || message === null || isBlank(message)) {
    if (typeof error === 'string' && error.trim()) {
      payload.message = error.trim();
    } else if (typeof code === 'string' && code.trim()) {
      payload.message = `Error code: ${code.trim()}`;
    }
  }

  if (error === undefined || error === null || isBlank(error)) {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      payload.error = payload.message.trim();
    }
  }

  return payload;
};

const normalizeHttpExceptionPayload = (response: unknown, status: number): Record<string, unknown> => {
  if (isRecord(response)) {
    return applyMessageFallback({ ...response });
  }
  const statusText = HttpStatus[status] ?? 'Error';
  const message = typeof response === 'string' && response.trim() ? response.trim() : statusText;
  return applyMessageFallback({ statusCode: status, error: statusText, message });
};

@Catch(HttpException)
export class HttpErrorMessageFilter implements ExceptionFilter {
  // Ensure HttpException payloads always include a readable message fallback for code-only failures. docs/en/developer/plans/im5mpw0g5827wu95w4ki/task_plan.md im5mpw0g5827wu95w4ki
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const payload = normalizeHttpExceptionPayload(exception.getResponse(), status);

    response.status(status).json(payload);
  }
}
