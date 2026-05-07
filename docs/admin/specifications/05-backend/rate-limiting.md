# Rate limiting

V1 : implémentation **Postgres-only** (pas de Redis). Suffisant pour
le volume FemiGlow (<10 req/s pic). Évolution v2 vers Upstash si
besoin.

## Stratégie

Algorithme **fixed-window counter** :

1. Calculer la clé : `${route}:${ip}` ou `${route}:${userId}`.
2. Insérer une ligne dans `rate_limit_counters` avec timestamp.
3. Compter les lignes pour la clé sur la fenêtre courante.
4. Si count > seuil → 429.

```sql
CREATE TABLE rate_limit_counters (
  id text PRIMARY KEY,
  scope text NOT NULL,         -- ex: 'login:ip:102.54.…'
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX rate_limit_counters_scope_idx
  ON rate_limit_counters(scope, created_at DESC);
```

Purge automatique : tâche cron quotidienne supprime `created_at < NOW() - INTERVAL '24 hours'`.

## Helper

```ts
// apps/web/src/lib/auth/rate-limit.ts
export async function checkRateLimit(opts: {
  scope: string;
  windowSeconds: number;
  max: number;
}): Promise<{ ok: boolean; retryAfter?: number }> {
  const since = sql`NOW() - (${opts.windowSeconds} || ' seconds')::interval`;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitCounters)
    .where(and(
      eq(rateLimitCounters.scope, opts.scope),
      gt(rateLimitCounters.createdAt, since),
    ));

  if (count >= opts.max) {
    const [oldest] = await db
      .select({ ts: rateLimitCounters.createdAt })
      .from(rateLimitCounters)
      .where(and(
        eq(rateLimitCounters.scope, opts.scope),
        gt(rateLimitCounters.createdAt, since),
      ))
      .orderBy(rateLimitCounters.createdAt)
      .limit(1);
    const retryAfter = Math.ceil(
      (new Date(oldest.ts).getTime() + opts.windowSeconds * 1000 - Date.now()) / 1000,
    );
    return { ok: false, retryAfter };
  }

  await db.insert(rateLimitCounters).values({
    id: createId(),
    scope: opts.scope,
  });
  return { ok: true };
}
```

## Seuils par route

| Route | Scope | Fenêtre | Max | Justification |
|---|---|---|---|---|
| POST `/api/admin/login` | `login:ip:{ip}` | 15 min | 5 | brute-force |
| POST `/api/admin/login` | `login:email:{email}` | 15 min | 5 | brute-force ciblé |
| POST `/api/admin/webhooks/[id]/test` | `whtest:user:{userId}` | 1 min | 10 | éviter de DoS un endpoint externe |
| POST `/api/cron/tick` | (auth Vercel uniquement) | — | — | pas de rate-limit applicatif |
| POST `/api/public/contact` | `contact:ip:{ip}` | 1 h | 10 | éviter spam de leads |
| POST `/api/public/orders` | `order:ip:{ip}` | 1 h | 20 | client légitime peut réessayer |
| POST `/api/public/newsletter` | `newsletter:ip:{ip}` | 1 h | 5 | spam typique |
| Toutes autres routes admin | `admin:user:{userId}` | 1 min | 120 | borne haute (admin légitime) |

## Réponse 429

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 240
Cache-Control: no-store
Content-Type: application/json

{ "error": "rate_limited" }
```

## Bypass administratif

Aucun. Si l'admin elle-même est rate-limited sur login, la procédure
est documentée dans `incident-response.md` (purge SQL manuelle de la
fenêtre).

## Test du système

```ts
// apps/web/src/lib/auth/__tests__/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';
import { resetTestDb } from '@/test/utils/db';

describe('checkRateLimit', () => {
  beforeEach(resetTestDb);

  it('allows up to max', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit({ scope: 's', windowSeconds: 60, max: 5 });
      expect(r.ok).toBe(true);
    }
    const r = await checkRateLimit({ scope: 's', windowSeconds: 60, max: 5 });
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });
});
```

## Tests

| Type | Fichier |
|---|---|
| Unit | `rate-limit.test.ts` |
| MSW | `scenario-rate-limit-login.md`, `scenario-rate-limit-public.md` |
| E2E | `e2e/login-rate-limit.spec.ts` |
