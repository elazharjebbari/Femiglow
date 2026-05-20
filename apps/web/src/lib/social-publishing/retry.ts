export interface RetryPolicy {
  attempts?: number;
  delaysMs?: number[];
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (event: { attempt: number; delayMs: number; error: unknown }) => void | Promise<void>;
}

const DEFAULT_DELAYS_MS = [100, 300, 900, 1500];

export function normalizeRetryPolicy(policy: RetryPolicy = {}): Required<Pick<RetryPolicy, 'attempts' | 'delaysMs'>> & RetryPolicy {
  const attempts = Math.max(1, Math.min(policy.attempts ?? 3, 5));
  const delaysMs = policy.delaysMs?.length ? policy.delaysMs : DEFAULT_DELAYS_MS;
  return { ...policy, attempts, delaysMs };
}

export async function withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy = {}): Promise<T> {
  const normalized = normalizeRetryPolicy(policy);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= normalized.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const canRetry = normalized.shouldRetry ? normalized.shouldRetry(err, attempt) : false;
      if (!canRetry || attempt >= normalized.attempts) throw err;
      const delayMs = normalized.delaysMs[Math.min(attempt - 1, normalized.delaysMs.length - 1)] ?? 100;
      await normalized.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed');
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
