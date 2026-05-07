# Moteur de webhooks

Cœur du système d'intégration. Garantit que **chaque événement
métier** déclenche **au moins une tentative** d'émission vers chaque
endpoint configuré, et **persiste** la trace complète de chaque tentative.

## Vue d'ensemble

```
[Route handler publique]    [Cron tick toutes les 60s]
    └─ enqueue() ──────────────────────┐
                                       ▼
                          [Table webhook_deliveries]
                                       │
                                       ▼
                          [dispatch() : SELECT FOR UPDATE SKIP LOCKED]
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
         endpoint A               endpoint B               endpoint C
        (HTTP POST)              (HTTP POST)              (HTTP POST)
              │                        │                        │
              ▼                        ▼                        ▼
      met à jour ligne         met à jour ligne         met à jour ligne
       avec status final         (retry si échec)         (retry si échec)
```

## Cycle de vie d'une livraison

| Statut | Description | Transitions possibles |
|---|---|---|
| `pending` | À émettre / à retenter | → `delivered`, `failed`, `dead` |
| `delivered` | 2xx reçu | (terminal) |
| `failed` | Échec, retry à venir | → `pending` (auto par cron), `dead` (max attempts atteint) |
| `dead` | Abandonné après N tentatives | (terminal) |

## Schéma table

Voir [`../06-data/schema.sql`](../06-data/schema.sql) pour le DDL exact.
Champs essentiels :

| Colonne | Type | Note |
|---|---|---|
| `id` | text PK | cuid2 |
| `endpoint_id` | text FK | webhook_endpoints.id |
| `event_name` | text | enum |
| `payload` | jsonb | corps de l'événement |
| `idempotency_key` | text | cuid2 unique par tentative initiale |
| `status` | text | pending / delivered / failed / dead |
| `attempt` | int | 0..max_attempts |
| `max_attempts` | int | 5 par défaut |
| `scheduled_at` | timestamptz | créé à enqueue() |
| `next_attempt_at` | timestamptz | NULL si terminal |
| `last_attempt_at` | timestamptz | mis à jour à chaque essai |
| `http_status` | int | NULL si pas encore tenté |
| `duration_ms` | int | dernière tentative |
| `response_body` | text | tronqué à 1024 |
| `signature` | text | HMAC SHA-256 hex |
| `created_at` / `updated_at` | timestamptz | |

Index : `(status, next_attempt_at)`, `(endpoint_id, created_at DESC)`.

## enqueue()

```ts
// apps/web/src/lib/webhooks/enqueue.ts
export async function enqueueEvent(input: {
  eventName: EventName;
  payload: Record<string, unknown>;
  leadId?: string;
}): Promise<void> {
  const endpoints = await db.query.webhookEndpoints.findMany({
    where: and(
      eq(webhookEndpoints.active, true),
      isNull(webhookEndpoints.deletedAt),
      sql`${input.eventName} = ANY(${webhookEndpoints.events})`,
    ),
  });

  if (endpoints.length === 0) return;

  const idempotencyKey = createId(); // cuid2
  const canonicalBody = canonicalJson({
    id: idempotencyKey,
    type: input.eventName,
    createdAt: new Date().toISOString(),
    data: input.payload,
  });

  const rows = await Promise.all(
    endpoints.map(async (endpoint) => {
      const secret = await decryptSecret(endpoint.encryptedSecret);
      const signature = await signHmac(secret, canonicalBody);
      return {
        id: createId(),
        endpointId: endpoint.id,
        eventName: input.eventName,
        payload: JSON.parse(canonicalBody),
        idempotencyKey,
        signature,
        status: 'pending' as const,
        attempt: 0,
        maxAttempts: 5,
        scheduledAt: new Date(),
        nextAttemptAt: new Date(),
      };
    }),
  );

  await db.insert(webhookDeliveries).values(rows);
}
```

Note : `enqueue()` n'envoie **rien** elle-même. Elle insère uniquement.
Le cron tick (toutes les 60s) consomme la file. Pour les routes
publiques où la latence importe, on peut optionnellement déclencher
un dispatch immédiat (best-effort, fire-and-forget) après commit, mais
le contrat fondamental reste : la persistence en DB est la garantie.

## dispatch()

```ts
// apps/web/src/lib/webhooks/dispatch.ts
const BATCH_SIZE = 50;
const MAX_DURATION_MS = 50_000; // budget cron

export async function dispatchBatch() {
  const start = Date.now();
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  while (Date.now() - start < MAX_DURATION_MS) {
    const batch = await db.execute(sql`
      SELECT * FROM webhook_deliveries
      WHERE status = 'pending'
        AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `);

    if (batch.length === 0) break;

    for (const row of batch) {
      const result = await attemptDelivery(row);
      processed++;
      if (result === 'failed') failed++;
      if (result === 'dead') deadLettered++;
    }
  }

  return { processed, failed, deadLettered };
}
```

`FOR UPDATE SKIP LOCKED` permet à plusieurs invocations cron parallèles
(cas Vercel : 2 régions actives) de ne **jamais** se marcher dessus —
chaque ligne n'est verrouillée qu'une fois.

## attemptDelivery()

```ts
async function attemptDelivery(row: WebhookDeliveryRow) {
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, row.endpointId),
  });
  if (!endpoint || !endpoint.active || endpoint.deletedAt) {
    await markDead(row.id, 'endpoint_disabled');
    return 'dead';
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-FemiGlow-Signature': `sha256=${row.signature}`,
    'X-FemiGlow-Event': row.eventName,
    'X-FemiGlow-Delivery': row.id,
    'X-FemiGlow-Timestamp': new Date().toISOString(),
    'Idempotency-Key': row.idempotencyKey,
    'User-Agent': 'FemiGlow-Webhook/1.0',
  });
  for (const h of endpoint.customHeaders ?? []) {
    headers.set(h.key, h.value);
  }

  const t0 = performance.now();
  let httpStatus: number | null = null;
  let responseBody = '';

  try {
    const res = await fetchWithTimeout(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(row.payload),
      timeoutMs: 10_000,
    });
    httpStatus = res.status;
    responseBody = (await res.text()).slice(0, 1024);
  } catch (e) {
    responseBody = `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 1024);
  }

  const durationMs = Math.round(performance.now() - t0);
  const success = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
  const isLast = row.attempt + 1 >= row.maxAttempts;

  if (success) {
    await db.update(webhookDeliveries)
      .set({
        status: 'delivered',
        attempt: row.attempt + 1,
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
        httpStatus,
        durationMs,
        responseBody,
      })
      .where(eq(webhookDeliveries.id, row.id));
    return 'delivered';
  }

  if (isLast) {
    await db.update(webhookDeliveries)
      .set({
        status: 'dead',
        attempt: row.attempt + 1,
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
        httpStatus,
        durationMs,
        responseBody,
      })
      .where(eq(webhookDeliveries.id, row.id));
    return 'dead';
  }

  const nextDelay = computeBackoff(row.attempt + 1);
  await db.update(webhookDeliveries)
    .set({
      status: 'pending',
      attempt: row.attempt + 1,
      lastAttemptAt: new Date(),
      nextAttemptAt: new Date(Date.now() + nextDelay),
      httpStatus,
      durationMs,
      responseBody,
    })
    .where(eq(webhookDeliveries.id, row.id));
  return 'failed';
}
```

## Politique de retry

```ts
// apps/web/src/lib/webhooks/retry-policy.ts
const SCHEDULE_MS = [
  60 * 1000,         // attempt 1 → 1 min
  5 * 60 * 1000,     // attempt 2 → 5 min
  30 * 60 * 1000,    // attempt 3 → 30 min
  3 * 60 * 60 * 1000, // attempt 4 → 3 h
  12 * 60 * 60 * 1000, // attempt 5 → 12 h (puis dead)
];

export function computeBackoff(nextAttempt: number): number {
  // jitter ±20 % pour éviter thundering herd
  const base = SCHEDULE_MS[Math.min(nextAttempt - 1, SCHEDULE_MS.length - 1)];
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}
```

Total avant dead-letter : ~15h45 (couvre largement la fenêtre 12h
typique d'incidents transitoires).

## Signature HMAC

```ts
// apps/web/src/lib/webhooks/signing.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signHmac(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

export function verifyHmac(secret: string, body: string, signature: string): boolean {
  const expected = signHmac(secret, body);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
```

Body canonical = `JSON.stringify` avec clés triées (cf. `canonicalJson()`).

## Idempotence côté consommateur

Le consommateur **doit** :

1. Lire `Idempotency-Key`.
2. Si déjà traité → renvoyer 200 sans rejouer le métier.
3. Vérifier la signature HMAC.
4. Traiter & renvoyer 2xx.

Documenté dans `docs/admin/integrations/consumer-guide.md` (futur).

## Replay manuel

Bouton "Renvoyer" sur une livraison `failed` ou `dead` → POST
`/api/admin/webhook-deliveries/[id]/retry` :

```ts
await db.update(webhookDeliveries)
  .set({
    status: 'pending',
    attempt: 0,
    nextAttemptAt: new Date(),
  })
  .where(and(
    eq(webhookDeliveries.id, id),
    inArray(webhookDeliveries.status, ['failed', 'dead']),
  ));
```

Conservation de l'`idempotency_key` initial → si le consommateur l'a
déjà traité, il renverra 200 idempotent.

## Tests

| Type | Fichier |
|---|---|
| Unit | `enqueue.test.ts`, `dispatch.test.ts`, `signing.test.ts`, `retry-policy.test.ts`, `attempt-delivery.test.ts` |
| MSW (consommateurs simulés) | `scenario-delivery-success.md`, `scenario-delivery-retry.md`, `scenario-delivery-final-fail.md`, `scenario-delivery-replay.md`, `scenario-delivery-timeout.md`, `scenario-delivery-5xx.md`, `scenario-delivery-4xx.md` |
| Integration | test DB avec `pgTAP` ou Vitest+testcontainers |
| E2E | `e2e/webhook-flow.spec.ts` (publication d'un lead → delivery visible) |
