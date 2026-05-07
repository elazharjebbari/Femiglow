import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '@/lib/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  request_id?: string;
  admin_id?: string;
  route?: string;
  ip_hash?: string;
}

interface LogPayload {
  ts: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const PII_KEYS = new Set([
  'email',
  'phone',
  'password',
  'authorization',
  'cookie',
  'session',
  'token',
  'secret',
  // Chat-spécifique (cf. docs/chat-assistant/13-securite-rgpd-moderation.md).
  'apikey',
  'api_key',
  'apikeyencrypted',
  'apikeyiv',
  'visitorid',
  'visitor_id',
  'fingerprinthash',
  'fingerprint_hash',
  'contentraw',
  'content_raw',
  'contentsafe',
  'content_safe',
  'plaintext',
]);

function redact(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

const requestStorage = new AsyncLocalStorage<LogContext>();

export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
  return requestStorage.run(ctx, fn);
}

export function getLogContext(): LogContext {
  return requestStorage.getStore() ?? {};
}

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[env.LOG_LEVEL]) return;
  const ctx = getLogContext();
  const payload: LogPayload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
    ...(redact(fields) as Record<string, unknown>),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, fields: Record<string, unknown> = {}) => emit('debug', event, fields),
  info: (event: string, fields: Record<string, unknown> = {}) => emit('info', event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit('warn', event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit('error', event, fields),
};
