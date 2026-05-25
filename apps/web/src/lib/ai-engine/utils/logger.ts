type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  jobId?: string;
  node?: string;
  provider?: string;
  durationMs?: number;
  costCents?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.AI_ENGINE_LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[ai-engine:${entry.module}]`,
  ];
  if (entry.jobId) parts.push(`[job:${entry.jobId.slice(0, 8)}]`);
  if (entry.node) parts.push(`[node:${entry.node}]`);
  if (entry.provider) parts.push(`[provider:${entry.provider}]`);
  parts.push(entry.message);
  if (entry.durationMs !== undefined) parts.push(`(${entry.durationMs}ms)`);
  if (entry.costCents !== undefined) parts.push(`($${(entry.costCents / 100).toFixed(4)})`);
  return parts.join(' ');
}

function log(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;
  const formatted = formatEntry(entry);
  const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
  console[method](formatted);
  if (entry.data && entry.level !== 'debug') {
    console[method](JSON.stringify(entry.data, null, 2));
  }
}

export function createLogger(module: string) {
  return {
    debug(message: string, data?: Record<string, unknown> & { jobId?: string; node?: string }) {
      log({ level: 'debug', module, message, timestamp: new Date().toISOString(), ...data });
    },
    info(message: string, data?: Record<string, unknown> & { jobId?: string; node?: string; provider?: string; durationMs?: number; costCents?: number }) {
      log({ level: 'info', module, message, timestamp: new Date().toISOString(), ...data });
    },
    warn(message: string, data?: Record<string, unknown> & { jobId?: string; node?: string }) {
      log({ level: 'warn', module, message, timestamp: new Date().toISOString(), ...data });
    },
    error(message: string, data?: Record<string, unknown> & { jobId?: string; node?: string; provider?: string }) {
      log({ level: 'error', module, message, timestamp: new Date().toISOString(), ...data });
    },
  };
}
