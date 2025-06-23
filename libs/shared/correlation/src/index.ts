import { randomUUID } from 'crypto';
import { Request } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function generateCorrelationId(): string {
  return randomUUID();
}

export function getCorrelationId(request?: Request): string {
  if (request && request.headers[CORRELATION_ID_HEADER]) {
    return request.headers[CORRELATION_ID_HEADER] as string;
  }
  return generateCorrelationId();
}

// AsyncLocalStorage to maintain correlation ID across async boundaries
export const correlationStore = new AsyncLocalStorage<{
  correlationId: string;
}>();

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStore.run({ correlationId }, fn);
}

export function getCurrentCorrelationId(): string | undefined {
  return correlationStore.getStore()?.correlationId;
}

// Helper to add correlation header to HTTP requests
export function addCorrelationHeader(
  headers: Record<string, string> = {}
): Record<string, string> {
  const correlationId = getCurrentCorrelationId();
  if (correlationId) {
    headers[CORRELATION_ID_HEADER] = correlationId;
  }
  return headers;
}

// Helper for logging with correlation ID
export interface CorrelationContext {
  correlationId: string;
  [key: string]: unknown;
}

export function getCorrelationContext(
  additionalContext?: Record<string, unknown>
): CorrelationContext {
  const correlationId = getCurrentCorrelationId() || 'no-correlation-id';
  return {
    correlationId,
    ...additionalContext,
  };
}
