# 30.7 — Retry strategy

## Politique de retry par scénario

| Erreur | Retry ? | Max attempts | Base delay | Backoff |
|---|---|---|---|---|
| Network error (ECONNRESET, ETIMEDOUT) | ✅ | 3 | 500ms | exponentiel × 2 |
| 429 Rate Limit | ✅ | 3 | depuis `Retry-After` ou 1s | linéaire |
| 500 / 502 / 503 / 504 | ✅ | 3 | 500ms | exponentiel × 2 |
| 401 (auth expired) | ✅ 1× | 1 | 0ms | après refresh token |
| 400 (bad request) | ❌ | — | — | — |
| 403 (forbidden) | ❌ | — | — | — |
| 404 (not found) | ❌ | — | — | — |

## Implémentation

```typescript
// lib/tracking/providers/retry.ts (existant — à enrichir)

interface RetryOpts {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (status: number, attempt: number) => boolean;
  signal?: AbortSignal;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOpts = {},
): Promise<{ ok: boolean; status: number; body: string; attempts: number; latencyMs: number }> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    shouldRetry = (status) => status === 429 || status >= 500,
    signal,
  } = opts;

  const startedAt = Date.now();
  let attempts = 0;
  let lastResp: Response | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await fetch(url, { ...init, signal });
      lastResp = res;

      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          body: await res.text(),
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      }

      // Retryable error?
      if (attempts < maxAttempts && shouldRetry(res.status, attempts)) {
        const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
        const delay = retryAfter ?? (baseDelayMs * Math.pow(2, attempts - 1));
        await sleep(delay);
        continue;
      }

      // Non-retryable
      return {
        ok: false,
        status: res.status,
        body: await res.text(),
        attempts,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      // Network error
      if (attempts < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempts - 1));
        continue;
      }
      throw err;
    }
  }

  return {
    ok: false,
    status: lastResp?.status ?? 0,
    body: lastResp ? await lastResp.text() : '',
    attempts,
    latencyMs: Date.now() - startedAt,
  };
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

## Dead-letter queue (V2 — out of scope)

Pour les erreurs persistantes après 3 retries :
- Persister dans `tracking_events_log.providers_results[kind].dead_letter = true`
- Job batch quotidien (`scripts/retry-dead-letters.ts`) qui retente
- Limite : 7 jours après l'event (au-delà, drop silencieusement)

## Backoff jitter

Pour éviter le thundering herd quand plusieurs providers rate en même temps :

```typescript
const delay = baseDelayMs * Math.pow(2, attempts - 1);
const jittered = delay + Math.random() * delay * 0.3; // ±30%
await sleep(jittered);
```

## Timeout global

Aucun retry ne doit faire dépasser le timeout global de `/api/track` :
- p99 cible : < 500ms
- timeout serveur : 5s

Si un provider met > 2s, on le timeout côté code (`AbortController` avec
signal). Log et continue les autres.

```typescript
const ac = new AbortController();
setTimeout(() => ac.abort(), 2000);
const result = await adapter.dispatch(provider, { ...ctx, signal: ac.signal });
```
