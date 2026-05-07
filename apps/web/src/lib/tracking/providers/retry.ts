export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  body: string;
  attempts: number;
  durationMs: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<FetchResult> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 200;
  const max = opts.maxDelayMs ?? 2_000;
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastBody = '';
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { ...init, signal: opts.signal });
      lastStatus = res.status;
      lastBody = await res.text();
      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          body: lastBody,
          attempts: i + 1,
          durationMs: Date.now() - startedAt,
        };
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return {
          ok: false,
          status: res.status,
          body: lastBody,
          attempts: i + 1,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      lastBody = err instanceof Error ? err.message : String(err);
      lastStatus = 0;
    }
    if (i < attempts - 1) {
      const delay = Math.min(max, base * Math.pow(2, i)) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return {
    ok: false,
    status: lastStatus,
    body: lastBody,
    attempts,
    durationMs: Date.now() - startedAt,
  };
}
