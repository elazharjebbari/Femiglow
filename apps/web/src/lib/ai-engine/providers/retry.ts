import { ProviderError } from './types';

interface RetryPolicyConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
}

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

function defaultIsRetryable(err: Error): boolean {
  if (err instanceof ProviderError) {
    if (!err.retryable) return false;
    if (err.statusCode && NON_RETRYABLE_STATUS_CODES.has(err.statusCode)) {
      return false;
    }
  }
  return true;
}

export class RetryPolicy {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly exponentialBase: number;

  constructor(config: RetryPolicyConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 1_000;
    this.maxDelayMs = config.maxDelayMs ?? 60_000;
    this.exponentialBase = config.exponentialBase ?? 2;
  }

  async execute<T>(
    fn: () => Promise<T>,
    isRetryable?: (err: Error) => boolean,
  ): Promise<T> {
    const check = isRetryable ?? defaultIsRetryable;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        if (attempt === this.maxRetries || !check(error)) {
          throw error;
        }

        await this.sleep(this.getDelay(attempt));
      }
    }

    throw lastError;
  }

  private getDelay(attempt: number): number {
    const exponential =
      this.baseDelayMs * Math.pow(this.exponentialBase, attempt);
    const capped = Math.min(exponential, this.maxDelayMs);
    const jitter = capped * (0.5 + Math.random() * 0.5);
    return Math.floor(jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
