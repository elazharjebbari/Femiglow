# 03 — Plan d'action par phase

## Vue d'ensemble

3 sprints sur 4 semaines + 2 sem observation post-déploiement.

| Sprint | Sujet | Durée | Risque adressé |
|---|---|---|---|
| **Sprint 1 — Quick wins P0** | 5 fixes critiques < 1 j | 1-2 j-h | Bloque schedule prod, Moderation absente, SSE coupé |
| **Sprint 2 — Structurel** | Redis + batching + dashboard + retry policy | 5-7 j-h | State multi-lambda, perf Meta CAPI, observabilité |
| **Sprint 3 — Roadmap** | Multi-provider fallback + idempotency + monitoring | 8-12 j-h | Résilience long-terme, scaling |

## Phases d'exécution

| Phase | Sujet | Effort | Sprint |
|---|---|---|---|
| C0 | Préparation : flags + Redis setup + docs | ½ j | 1 |
| **QW1** | Cron Vercel `social-publish-scheduler` | 10 min | 1 ⚡ |
| **QW2** | OpenAI Moderation câblée dans orchestrator | ½ j | 1 ⚡ |
| **QW3** | `maxDuration` sur SSE + ingest | 10 min | 1 ⚡ |
| **QW4** | Cap `attemptCount` publishing + dead letter | 1 h | 1 ⚡ |
| **QW5** | `serverFire` persiste en `tracking_events_log` | 1 h | 1 ⚡ |
| **S1** | Redis Upstash : dédup tracking + breaker chat | 1-2 j | 2 |
| **S2** | Batching Meta CAPI (Redis queue + cron flush) | 1 j | 2 |
| **S3** | Carrousels Insta multi-media + adapter cleanup | 1 j | 2 |
| **S4** | Mappings provider harmonisés (taxonomy unifiée) | ½ j | 2 |
| **S5** | Dashboard `/admin/content-studio/health` | 1 j | 2 |
| **R1** | Multi-provider chat fallback (Anthropic) | 2 j | 3 |
| **R2** | Streaming health monitoring (SSE drops, latence) | 1 j | 3 |
| **R3** | Idempotency keys end-to-end tracking | 2 j | 3 |
| **R4** | Dashboard santé live unifié (KPIs cross-system) | 2 j | 3 |
| **F1** | Rollout progressif Canary → Ramp → Full | 7 j | observation |

Total estimé : **15-18 j-h dev** + 7 j rollout.

---

## SPRINT 1 — Quick Wins P0 (1-2 j)

### Phase C0 — Préparation (½ j)

#### C0.1 — Feature flags
Créer `apps/web/src/lib/feature-flags/live-systems.ts` :

```ts
export const LIVE_REDIS_STATE: 'v1' | 'v2' =
  process.env.NEXT_PUBLIC_LIVE_REDIS_STATE === 'true' ? 'v2' : 'v1';

export const LIVE_CHAT_MODERATION: 'off' | 'on' =
  process.env.LIVE_CHAT_MODERATION === 'on' ? 'on' : 'off';

export const LIVE_CHAT_FALLBACK: 'off' | 'anthropic' =
  process.env.LIVE_CHAT_FALLBACK === 'anthropic' ? 'anthropic' : 'off';

export const LIVE_CAPI_BATCHING: 'off' | 'on' =
  process.env.LIVE_CAPI_BATCHING === 'on' ? 'on' : 'off';
```

Tests : 8 tests vitest sur les 4 flags.

#### C0.2 — Redis Upstash setup
- Créer compte Upstash (free tier)
- Ajouter `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` dans `.env` + Vercel env
- Installer `@upstash/redis` + `@upstash/ratelimit`
- Créer `lib/redis/client.ts` singleton + mock pour tests

#### C0.3 — Baseline metrics
Exécuter en prod et archiver :
```sql
-- Posts schedulés non partis (cause #1)
SELECT COUNT(*), MIN(scheduled_for), MAX(scheduled_for)
FROM scheduled_jobs
WHERE status = 'scheduled' AND scheduled_for < NOW();

-- Events dispatched par provider (24h)
SELECT providers_dispatched, COUNT(*)
FROM tracking_events_log
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY providers_dispatched;

-- Tracking events NULL traffic_source (24h, devrait être 0 post-attribution-fix)
SELECT COUNT(*) FROM tracking_events_log
WHERE traffic_source IS NULL AND received_at > NOW() - INTERVAL '24 hours';
```

#### Critères acceptation C0
- [ ] 4 flags dispo + 8 tests verts
- [ ] Redis Upstash provisionné + helpers OK
- [ ] Baseline SQL exécuté + archivé
- [ ] Git tag `live-systems-baseline-2026-05-24`

---

### Phase QW1 — Cron Vercel scheduler (10 min) ⚡ P0

**Fichier** : `apps/web/vercel.json`

**Diagnostic** : la route `app/api/cron/content-studio/social-publish-scheduler/route.ts` existe et fonctionne, mais aucun cron Vercel ne l'invoque → **100% des posts schedulés restent en attente.**

**Patch** :
```json
{
  "crons": [
    {
      "path": "/api/cron/content-studio/social-publish-scheduler",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Test manuel post-deploy** :
1. Créer un post schedulé pour T+10 min via admin
2. Attendre — il doit partir
3. Vérifier `audit_log` : status `published`

**Critères acceptation** :
- [ ] `vercel.json` patché
- [ ] Cron visible dans dashboard Vercel
- [ ] Post test schedulé bien parti

---

### Phase QW2 — OpenAI Moderation (½ j) ⚡ P0

**Fichiers** :
- Existant : `apps/web/src/lib/chat/providers/openai.ts:190-221` — `moderate()` exposé mais jamais appelé
- À créer : `apps/web/src/lib/chat/moderation.ts` — wrapper avec fail-soft + retry
- À modifier : `apps/web/src/lib/chat/orchestrator.ts` — câbler avant + après LLM

**Architecture** :
```ts
// lib/chat/moderation.ts
export async function moderateText(text: string): Promise<{
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  source: 'openai' | 'heuristic_fallback';
}> {
  if (LIVE_CHAT_MODERATION !== 'on') {
    return { flagged: false, categories: [], scores: {}, source: 'heuristic_fallback' };
  }
  try {
    const result = await openai.moderations.create({ input: text });
    const r = result.results[0];
    return {
      flagged: r?.flagged ?? false,
      categories: Object.keys(r?.categories ?? {}).filter((k) => r.categories[k]),
      scores: r?.category_scores ?? {},
      source: 'openai',
    };
  } catch (err) {
    logger.warn('chat.moderation.failed', { error: err.message });
    return { flagged: false, categories: [], scores: {}, source: 'heuristic_fallback' };
  }
}
```

**Câblage dans orchestrator** :
1. Avant LLM call : `moderateText(userMessage)` — si flagged → message scripté + log
2. Après LLM stream : `moderateText(fullResponse)` — si flagged → tronque + log + admin alert

**Tests** :
- 8 tests vitest sur `moderation.ts` : flag granted/denied, fail-soft, fallback heuristic
- 2 tests intégration orchestrator (input modéré + output modéré)

**Critères acceptation** :
- [ ] `moderation.ts` + 8 tests verts
- [ ] Orchestrator câble input + output
- [ ] Fail-soft documenté (Moderation API down → continue avec log warn)
- [ ] Flag `LIVE_CHAT_MODERATION=on` activable en Canary

---

### Phase QW3 — `maxDuration` sur SSE + ingest (10 min) ⚡ P0

**Fichiers** :
- `apps/web/src/app/api/chat/message/route.ts`
- `apps/web/src/app/api/track/route.ts`

**Diagnostic** : sans `export const maxDuration = N;`, Vercel applique le default Hobby (10s) / Pro (60s). Un SSE long peut être tronqué silencieusement.

**Patch** :
```ts
// app/api/chat/message/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // SSE chat — 30s suffisant pour stream complet

// app/api/track/route.ts
export const maxDuration = 10; // ingest synchrone — 10s suffisant
```

**Critères acceptation** :
- [ ] `maxDuration` configuré sur 2 routes critiques
- [ ] Tests E2E vérifient que SSE long (15-25s) ne plante pas
- [ ] Logs Vercel ne montrent plus de "Function timeout" sur ces routes

---

### Phase QW4 — Cap `attemptCount` publishing (1 h) ⚡ P0

**Fichiers** :
- `apps/web/src/lib/social-publishing/retry-policy.ts` (créer)
- `apps/web/drizzle/migrations/XXXX_publishing_attempt_cap.sql` (créer)
- Code adapters publishing (modifier pour respecter cap)

**Diagnostic** : actuellement aucun cap sur `attempt_count`. Un admin qui retry manuellement crée potentiellement une boucle infinie via cron auto-retry.

**Patch DB** :
```sql
ALTER TABLE scheduled_jobs
  ADD CONSTRAINT attempt_count_max CHECK (attempt_count <= 10);
-- Note : ALTER existante puis ajout d'une nouvelle migration Drizzle.
```

**Helper retry** :
```ts
// lib/social-publishing/retry-policy.ts
const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // 1min → 6h

export function nextRetryAt(attemptCount: number): Date | null {
  if (attemptCount >= MAX_ATTEMPTS) return null; // dead letter
  const minutes = BACKOFF_MINUTES[attemptCount] ?? 360;
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isDeadLetter(attemptCount: number): boolean {
  return attemptCount >= MAX_ATTEMPTS;
}
```

**Câblage dans adapters** :
- Avant retry : check `isDeadLetter()` → if true, set `status='dead'` + audit_log alerte
- Set `next_retry_at = nextRetryAt(currentCount + 1)` après chaque échec

**Tests** : 5 tests retry-policy + 2 tests adapter (dead letter trigger).

**Critères acceptation** :
- [ ] Migration Drizzle appliquée
- [ ] Helper `retry-policy.ts` + tests
- [ ] Adapters câblent le cap
- [ ] Dead letter audit_log alerte visible

---

### Phase QW5 — `serverFire` persiste en `tracking_events_log` (1 h) ⚡ P0

**Fichier** : `apps/web/src/lib/tracking/server/server-fire.ts`

**Diagnostic** : `serverFire` dispatch les events providers (Meta/GA4/etc.) mais ne les persiste pas dans `tracking_events_log` → asymétrie observabilité.

**Patch** :
```ts
// après dispatchToProviders
await logEvent({
  id: createId('tev'),
  eventId: input.eventName + ':' + input.pageId + ':' + Date.now(),
  eventName: input.eventName,
  eventCategory: getEventCategory(input.eventName),
  pageRoute: input.pageRoute,
  anonymousId: extractAnonymousId(input.cookies) ?? 'server_fire',
  sessionId: extractSessionId(input.cookies) ?? 'server_fire',
  consentSnapshot: { /* server default */ },
  payload: input.params ?? {},
  // ... attribution déjà résolue par enrichEvent server-side
  providersDispatched: dispatch.dispatched,
  providersResults: dispatch.results,
  source: 'server_fire', // ⭐ nouveau champ pour distinguer
});
```

**Schema add** : `tracking_events_log.source` text column ('client_fire' | 'server_fire').

**Tests** : 3 tests intégration vérifient persistance.

**Critères acceptation** :
- [ ] `serverFire` persiste 100% des events
- [ ] `tracking_events_log.source` discriminant
- [ ] `/admin/analytics` voit aussi les server-fire

---

## SPRINT 2 — Structurel (5-7 j)

### Phase S1 — Redis dédup + breaker chat (1-2 j)

**Objectif** : remplacer toutes les `Map` JavaScript locales par Redis.

#### S1.1 — Helper `lib/redis/dedup.ts`
```ts
export async function isDuplicate(eventId: string, ttlSec = 60): Promise<boolean> {
  const set = await redis.set(`dedup:event:${eventId}`, '1', {
    nx: true,
    ex: ttlSec,
  });
  return set !== 'OK'; // déjà existant → duplicate
}
```

#### S1.2 — Helper `lib/redis/circuit-breaker.ts`
État breaker en Redis hash :
- `cb:chat:openai` → `{ failures: N, opened_at: ts, half_open_at: ts }`

#### S1.3 — Migration consommateurs
- `lib/tracking/server/dedup.ts` → utilise Redis
- `lib/chat/services/provider-router.ts` → breaker via Redis
- Fallback mémoire si Redis down (avec warning loggé)

**Tests** : 20+ tests (unit + intégration Redis local).

**Critères acceptation** :
- [ ] Dédup tracking 100% cohérent (test multi-process simulé)
- [ ] Breaker chat persiste 5 lambdas
- [ ] Fallback mémoire si Redis down (graceful)

### Phase S2 — Batching Meta CAPI (1 j)

**Objectif** : passer de 1 fetch/event à 1 fetch/N events.

#### S2.1 — Buffer Redis
À chaque event dispatché vers Meta : `redis.rpush('capi:meta:buffer', JSON.stringify(payload))`

#### S2.2 — Cron flush
`app/api/cron/tracking/capi-flush/route.ts` exécuté toutes les minutes :
- `redis.lpop('capi:meta:buffer', 50)` (Meta CAPI accepte max 50/batch)
- POST batch CAPI
- Retry on fail (re-push 5x max)

`vercel.json` :
```json
{ "path": "/api/cron/tracking/capi-flush", "schedule": "*/1 * * * *" }
```

**Tests** : 10 tests batch + retry + ordering.

**Critères acceptation** :
- [ ] Buffer Redis fonctionnel
- [ ] Cron flush actif en prod
- [ ] Latence ingest /api/track P95 < 100ms (mesure post-deploy)
- [ ] Meta CAPI calls divisés par ~50

### Phase S3 — Carrousels Insta multi-media (1 j)

**Fichier** : `apps/web/src/lib/social-publishing/content-builder.ts`

**Patch** :
```ts
export function buildSocialContent(post: ContentPost, platform: Platform): SocialContent {
  const mediaByPlatform: Record<Platform, MediaSpec[]> = {
    instagram: post.media.slice(0, 10), // carousel jusqu'à 10
    facebook: post.media.slice(0, 10),
    tiktok: post.media.slice(0, 1),     // 1 video
    twitter: post.media.slice(0, 4),    // 4 max
  };
  return { /* ... */, media: mediaByPlatform[platform] };
}
```

**Tests** : 8 tests par plateforme (caps, ordering, mime types).

**Critères acceptation** :
- [ ] Insta carrousel 2-10 images ✓
- [ ] Adapter `meta_graph` retiré du registry (null actuel)
- [ ] Test E2E publish carrousel sur compte test

### Phase S4 — Mappings provider harmonisés (½ j)

**Fichier** : `apps/web/src/lib/tracking/event-mapper.ts` (créer)

Source de vérité unique :
```ts
const EVENT_MAPPINGS: Record<string, Record<Provider, string | 'skip'>> = {
  view_item: { meta: 'ViewContent', ga4: 'view_item', tiktok: 'ViewContent' },
  generate_lead: { meta: 'Lead', ga4: 'generate_lead', tiktok: 'CompletePayment' /* tiktok n'a pas Lead, approx */ },
  // ...
};

export function mapEventName(name: string, provider: Provider): string | null {
  return EVENT_MAPPINGS[name]?.[provider] === 'skip' ? null : EVENT_MAPPINGS[name]?.[provider] ?? null;
}
```

Refactor des 4 fichiers `lib/tracking/providers/*.ts` pour utiliser ce helper.

**Tests** : 15 tests mapping (chaque event × chaque provider).

### Phase S5 — Dashboard publishing health (1 j)

**Fichier** : `apps/web/src/app/admin/content-studio/health/page.tsx` (créer)

Affiche :
- Jobs in flight (status='processing')
- Dead letters (status='dead')
- Success rate par adapter (24h, 7j)
- Latence P50/P95
- Liste audit récent (last 20)

Polling 30s. Alerte UI rouge si dead letters > 0.

**Tests** : 5 tests UI + 5 tests query DB.

---

## SPRINT 3 — Roadmap (8-12 j)

### Phase R1 — Multi-provider chat fallback (2 j)

Architecture :
- Primary : OpenAI gpt-4o-mini
- Fallback (breaker open) : Anthropic claude-3-haiku
- Dégradé ultime : message scripté "Je suis indisponible, laissez-moi vos coordonnées"

Implémentation :
- `lib/chat/providers/anthropic.ts` (nouveau adapter)
- `lib/chat/services/provider-router.ts` : si `cb:chat:openai` open → route vers Anthropic
- Tests : 15 tests (primary OK, primary down, both down)

### Phase R2 — Streaming health monitoring (1 j)

Instrumentation :
- Compte chunks par minute, latence inter-chunk, drops connection
- Stocke en Redis `chat:stream:metrics:<minute>`
- Dashboard admin `/admin/chat/health`
- Alerte si drop rate > 5%

### Phase R3 — Idempotency keys end-to-end (2 j)

Tous les `/api/*` POST acceptent un header `idempotency-key`. Garantie via Redis :
- `KEY idem:<endpoint>:<key>` → stockage 24h
- Replay → retourne le résultat caché (pas de double traitement)

Impacte : `/api/track`, `/api/chat/message`, `/api/content-studio/jobs`, etc.

### Phase R4 — Dashboard santé live unifié (2 j)

`/admin/live-health` :
- KPIs cross-system : chat success rate, publishing success rate, tracking dispatch rate
- Alertes globales (Sentry feed)
- Latence par endpoint
- Breakers open count

---

## Phase F1 — Rollout (7 j)

Voir [`05-runbook-rollout.md`](./05-runbook-rollout.md) pour le détail.

Stratégie : Canary 10% (24h) → Ramp 50% (3j) → Full 100% (J+7).

Gates : NULL rate, latency P95, breaker opens, dead letters.

---

## Synthèse des critères de "done"

- [ ] Sprint 1 : 5 quick wins mergés + 5 baseline mesures archivées
- [ ] Sprint 2 : Redis externalisé partout, batching CAPI actif, dashboard publishing OK
- [ ] Sprint 3 : Multi-provider fallback chat, idempotency keys, dashboard santé live
- [ ] Rollout : Canary OK + Ramp OK + Full sans incident
- [ ] J+30 : tous KPIs cibles atteints (cf. README)
