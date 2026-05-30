# 08 — Fiche système : Live tracking real-time

## Périmètre

Dispatch en temps réel des events tracking vers les providers externes :
- **Meta CAPI** (Pixel + Conversions API)
- **Google Analytics 4** (Measurement Protocol)
- **Google Ads** (Enhanced Conversions)
- **TikTok Events API**
- **Snap Conversions API**
- **Pinterest Conversions API**

> NB : ce système est complémentaire au sprint **attribution-fix-2026-05** déjà mergé. L'attribution (`trafficSource` / `trafficMedium`) est résolue, mais le **dispatch temps réel et la performance** restent à améliorer.

## Fichiers clés

| Path | Rôle |
|---|---|
| `lib/tracking/server/dispatcher.ts` | Dispatch principal vers providers |
| `lib/tracking/server/dispatcher-batch.ts` | ⭐ NOUVEAU batching Meta CAPI |
| `lib/tracking/server/dedup.ts` | Déduplication (in-memory actuellement, Redis cible) |
| `lib/tracking/server/server-fire.ts` | Server-side dispatch (kit/page.tsx, webhooks) |
| `lib/tracking/server/enricher.ts` | Enrichissement (UA, device, locale) |
| `lib/tracking/server/enrich-event.ts` | Attribution (déjà refactoré sprint précédent) |
| `lib/tracking/providers/meta.ts` | Adapter Meta CAPI |
| `lib/tracking/providers/google-ads.ts` | Adapter Google Ads |
| `lib/tracking/providers/gtm.ts` | Adapter GTM |
| `lib/tracking/event-mapper.ts` | ⭐ NOUVEAU mapping unifié |
| `lib/redis/dedup.ts` | ⭐ NOUVEAU helper dédup Redis |
| `app/api/track/route.ts` | Endpoint ingest principal |
| `app/api/cron/tracking/capi-flush/route.ts` | ⭐ NOUVEAU cron flush Meta CAPI |

## Risques actuels (audit)

| # | Risque | Sévérité | Phase fix |
|---|---|---|---|
| T-1 | Dédup in-memory cassé multi-lambda | 🟡 P1 | S1 |
| T-2 | Pas de batching Meta CAPI (1:1 fetch) | 🟡 P1 | S2 |
| T-3 | `serverFire` ne loggue pas en DB | 🟡 P1 | QW5 |
| T-4 | Mappings provider inconsistants | 🟡 P1 | S4 |
| T-5 | Pas de `maxDuration` `/api/track` | 🟢 P2 | QW3 |

## Architecture cible

```
┌────────────────────────────────────────────────────────────────┐
│  CLIENT (web) — TrackingClient.emit()                          │
└──────────────────────┬─────────────────────────────────────────┘
                       │ POST /api/track (batch ≤20 events)
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  /api/track route  ⭐ maxDuration=10s                          │
│                                                                 │
│  Pour chaque event:                                             │
│  1. ⭐ Dedup check via Redis                                    │
│     KEY dedup:event:<event_id> TTL 60s                          │
│     Skip si déjà vu (réponse 200 sans dispatch)                 │
│  2. enrichEvent (résolution attribution — déjà fait)            │
│  3. ⭐ dispatchToProviders avec batching                        │
│     ├─ Meta CAPI : push redis LIST → flush cron */1            │
│     ├─ GA4 : synchrone (Measurement Protocol léger)             │
│     ├─ Google Ads : synchrone (Enhanced Conversions)            │
│     ├─ TikTok : push redis LIST → flush cron */1                │
│     ├─ Snap : push redis LIST → flush cron */1                  │
│     └─ Pinterest : push redis LIST → flush cron */1             │
│  4. logEvent persiste row tracking_events_log                   │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  Cron flush /api/cron/tracking/capi-flush                       │
│  Schedule: */1 * * * * (toutes les minutes)                     │
│                                                                 │
│  Pour chaque provider (Meta, TikTok, Snap, Pinterest) :         │
│  1. redis.lpop('capi:<provider>:buffer', 50) (max batch)        │
│  2. Si N events > 0 : batch POST API                            │
│  3. Si fail → re-push events (jusqu'à 5 retries)                │
│  4. Si retries épuisés → log + drop                             │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  serverFire ⭐ persiste en tracking_events_log                  │
│  (kit/page.tsx SSR, webhooks Stripe, etc.)                      │
│                                                                 │
│  AVANT : dispatch only → event invisible en /admin/analytics    │
│  APRÈS : dispatch + logEvent(source='server_fire')              │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  Mappings unifiés via lib/tracking/event-mapper.ts              │
│  ────────────────────────────────────────────────               │
│  AVANT (inconsistant) :                                         │
│    • Meta : skip si non mappé                                   │
│    • GA4 : envoie nom canonique                                 │
│    • TikTok : envoie 'CustomEvent' littéral                     │
│  APRÈS (source vérité) :                                        │
│    mapEventName(name, provider) → string | 'skip' | 'as-is'    │
└────────────────────────────────────────────────────────────────┘
```

## Détails par phase

### QW3 — maxDuration ingest (10 min)

```ts
// app/api/track/route.ts
export const maxDuration = 10;
```

Évite les coupures Vercel sur des batches lourds (POST 20 events × enrichEvent async).

### QW5 — serverFire persiste (1 h)

**Fichier** : `lib/tracking/server/server-fire.ts`

**Avant** :
```ts
export async function serverFire(input): Promise<void> {
  const dispatch = await dispatchToProviders(...);
  // ❌ pas de logEvent
}
```

**Après** :
```ts
export async function serverFire(input): Promise<void> {
  const enriched = await enrichEvent(...);
  const dispatch = await dispatchToProviders(input, enriched);

  // ⭐ Persist
  await logEvent({
    id: createId('tev'),
    eventId: input.eventId ?? createId('evt'),
    eventName: input.eventName,
    eventCategory: getEventCategory(input.eventName),
    pageRoute: input.pageRoute,
    anonymousId: extractAnonymousId(input.cookies) ?? 'server-fire',
    sessionId: extractSessionId(input.cookies) ?? 'server-fire',
    consentSnapshot: serverDefaultConsent(),
    payload: input.params ?? {},
    trafficSource: enriched.trafficSource,
    trafficMedium: enriched.trafficMedium,
    providersDispatched: dispatch.dispatched,
    providersResults: dispatch.results,
    source: 'server_fire', // ⭐ nouveau champ
  });
}
```

**Migration DB** :
```sql
ALTER TABLE tracking_events_log
  ADD COLUMN source TEXT DEFAULT 'client_fire';

CREATE INDEX tracking_events_log_source_idx
  ON tracking_events_log(source);
```

### S1 — Dedup Redis (1-2 j)

**Avant** :
```ts
// lib/tracking/server/dedup.ts
const seen = new Map<string, number>(); // ❌ in-memory
```

**Après** :
```ts
// lib/redis/dedup.ts
import { redis } from './client';

const DEDUP_TTL_SEC = 60;

export async function isDuplicate(eventId: string): Promise<boolean> {
  const key = `dedup:event:${eventId}`;
  // SET NX = "set if not exists"
  // Si la clé n'existait pas → return 'OK', isDuplicate = false
  // Si la clé existait déjà → return null, isDuplicate = true
  const result = await redis.set(key, '1', { nx: true, ex: DEDUP_TTL_SEC });
  return result !== 'OK';
}

// Fallback memory si Redis down (avec warning)
const memoryFallback = new Map<string, number>();

export async function isDuplicateSafe(eventId: string): Promise<boolean> {
  try {
    return await isDuplicate(eventId);
  } catch (err) {
    logger.warn('dedup.redis.failed_fallback_memory', { error: err.message });
    return isDuplicateMemoryFallback(eventId);
  }
}
```

**Tests** : 12 vitest (NX behavior, TTL expiry, fallback memory, perf).

### S2 — Batching Meta CAPI (1 j)

**Buffer push** dans `dispatchToProviders` :

```ts
// lib/tracking/providers/meta.ts (refactor)
import { LIVE_CAPI_BATCHING } from '@/lib/feature-flags/live-systems';

export async function dispatchToMeta(event, attribution): Promise<DispatchResult> {
  const payload = buildMetaPayload(event, attribution);
  if (LIVE_CAPI_BATCHING === 'on') {
    // Batched mode : push to Redis buffer, sync flush via cron
    await redis.rpush('capi:meta:buffer', JSON.stringify(payload));
    return { dispatched: 'meta', mode: 'buffered' };
  }
  // Direct mode (fallback) : 1 fetch per event
  return dispatchMetaDirect(payload);
}
```

**Cron flush** : `app/api/cron/tracking/capi-flush/route.ts`

```ts
export async function GET() {
  for (const provider of ['meta', 'tiktok', 'snap', 'pinterest'] as const) {
    await flushBatch(provider);
  }
  return NextResponse.json({ ok: true });
}

async function flushBatch(provider: ProviderName): Promise<void> {
  const events: string[] = [];
  // Pop up to 50 (Meta CAPI batch limit)
  for (let i = 0; i < 50; i++) {
    const item = await redis.lpop(`capi:${provider}:buffer`);
    if (!item) break;
    events.push(item);
  }
  if (events.length === 0) return;

  try {
    await postBatchToProvider(provider, events.map((e) => JSON.parse(e)));
    logger.info('capi.batch.flushed', { provider, count: events.length });
  } catch (err) {
    // Retry strategy : re-push avec count
    for (const e of events) {
      const parsed = JSON.parse(e);
      parsed._retry = (parsed._retry ?? 0) + 1;
      if (parsed._retry > 5) {
        logger.warn('capi.batch.dropped_after_retries', { provider, eventId: parsed.event_id });
        continue;
      }
      await redis.rpush(`capi:${provider}:buffer`, JSON.stringify(parsed));
    }
  }
}
```

**vercel.json** :
```json
{
  "crons": [
    { "path": "/api/cron/tracking/capi-flush", "schedule": "*/1 * * * *" }
  ]
}
```

**Tests** : 12 vitest (batching, retry, ordering, drop after max).

### S4 — Mappings unifiés (½ j)

**Fichier nouveau** : `lib/tracking/event-mapper.ts`

```ts
type ProviderName = 'meta' | 'ga4' | 'google_ads' | 'tiktok' | 'snap' | 'pinterest';

const EVENT_MAP: Record<string, Partial<Record<ProviderName, string | 'skip'>>> = {
  view_item: {
    meta: 'ViewContent',
    ga4: 'view_item',
    tiktok: 'ViewContent',
    snap: 'VIEW_CONTENT',
    pinterest: 'pagevisit',
  },
  generate_lead: {
    meta: 'Lead',
    ga4: 'generate_lead',
    google_ads: 'conversion',
    tiktok: 'CompleteRegistration', // approx
    snap: 'SIGN_UP',
    pinterest: 'lead',
  },
  begin_checkout: {
    meta: 'InitiateCheckout',
    ga4: 'begin_checkout',
    tiktok: 'InitiateCheckout',
    snap: 'START_CHECKOUT',
    pinterest: 'checkout',
  },
  purchase: {
    meta: 'Purchase',
    ga4: 'purchase',
    google_ads: 'conversion',
    tiktok: 'CompletePayment',
    snap: 'PURCHASE',
    pinterest: 'checkout',
  },
  // ...
};

export function mapEventName(
  name: string,
  provider: ProviderName,
): { name: string | null; skip: boolean } {
  const mapped = EVENT_MAP[name]?.[provider];
  if (mapped === undefined) return { name: null, skip: true };
  if (mapped === 'skip') return { name: null, skip: true };
  return { name: mapped, skip: false };
}
```

Refactor `providers/meta.ts`, `ga4.ts`, `tiktok.ts`, etc. pour utiliser ce helper.

**Tests** : 25+ tests (chaque event × chaque provider).

## Tests existants — couverture & trous

Existant :
- `lib/tracking/server/__tests__/dispatcher.test.ts`
- `lib/tracking/server/dispatcher.attribution.test.ts`
- `lib/tracking/server/dedup.test.ts`
- `lib/tracking/providers/__tests__/`
- `e2e/tracking-*.spec.ts`

Récent (sprint attribution) :
- `lib/tracking/taxonomy.test.ts` + edge-cases (48 + 41 tests)
- `lib/tracking/server/enrich-event.test.ts` + robustness (16 + 15 tests)
- MSW handlers tracking

**Trous à combler** :
- ❌ Dedup Redis (n'existe pas encore)
- ❌ Batching Meta CAPI (n'existe pas encore)
- ❌ `serverFire` persistance non testée
- ❌ Mappings unifiés (mappings éparpillés actuellement)
- ❌ Cron flush capi non testé

## Top 3 améliorations recommandées (priorité)

1. **QW5 serverFire persist** (1 h) — débloque observabilité
2. **S2 Batching Meta CAPI** (1 j) — réduit latence + coût + booste match rate
3. **S1 Redis dedup** (1-2 j) — élimine doublons multi-lambda

## Impact mesurable post-déploiement

| Métrique | Baseline | Cible J+7 |
|---|---|---|
| Latence `/api/track` P95 | ~500ms (synchrone Meta) | < 100ms (Meta batché) |
| Meta CAPI calls/jour | ~10k (1:1) | ~200 (1:50) |
| Coût Meta API | $X | $X / 50 |
| Match rate Meta (EMQ) | Y% | Y% + 2-5% (timing batch optimisé) |
| Events server-fire visibles analytics | 0% | 100% |
| Dédup hits cohérence | Aléatoire (multi-lambda) | 100% |
