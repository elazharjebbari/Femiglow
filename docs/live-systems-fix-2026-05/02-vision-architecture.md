# 02 — Vision & Architecture cible

## Principes directeurs

### Principe #1 — Externaliser le state critique

Tous les mécanismes qui dépendent d'un **état partagé entre requêtes** (dédup, circuit breakers, rate limits, idempotency keys) doivent être stockés **hors process Node.js**.

Pourquoi : Vercel scale horizontalement les lambdas. Une `Map` JavaScript locale au process est cassée dès qu'on a 2+ instances. Le code croit dédupliquer, en réalité chaque lambda a sa propre vue.

**Solution choisie** : Redis Upstash (free tier suffisant pour le volume FemiGlow, 10k commandes/jour gratuites).

### Principe #2 — Observabilité = source de vérité

Aucun event live ne doit "disparaître" silencieusement. Chaque action critique doit avoir :
- Un log structuré (logger existant)
- Une row DB persistée (`tracking_events_log` ou table dédiée)
- Une métrique exposable (compteur incrémenté)

Pourquoi : l'audit a montré que `serverFire` SSR ne loggue pas → impossible de savoir si l'event est parti. Inversement, les tests `overview.test.ts` injectaient `trafficSource` à la main → masquaient le bug en local.

### Principe #3 — Failover gracieux > erreur 500

Chaque dépendance externe doit avoir un comportement défini si elle échoue :
- **OpenAI down** → fallback vers Anthropic / message dégradé scripté
- **Postiz down** → queue pending, retry exponentiel, alerte admin
- **Meta CAPI down** → batch buffer, retry batch suivant
- **Redis down** → fallback memory (avec warning, accepter dérive temporaire)

Pourquoi : un crash dans `/api/chat/message` casse l'UX visiteur. Un crash dans `/api/track` ne doit JAMAIS bloquer la navigation.

### Principe #4 — Idempotence end-to-end

Chaque opération externalisable doit pouvoir être rejouée sans effet de bord. Clés d'idempotence systématiques (`event_id`, `post_id`, `message_id`).

Pourquoi : les retries automatiques sont indispensables au scale, mais ils créent des doublons si l'idempotence n'est pas garantie.

---

## Architecture cible — Système par système

### Système 1 — Chat live OpenAI

```
┌────────────────────────────────────────────────────────────────┐
│  VISITEUR — widget chat                                        │
└──────────────────────────┬─────────────────────────────────────┘
                           │ POST /api/chat/message (SSE)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Orchestrator (apps/web/src/lib/chat/orchestrator.ts)          │
│  ──────────────────────────────────────────────                │
│  1. charterFilter (existant, heuristique 30 mots-clés)         │
│  2. ⭐ NOUVEAU : openaiModerate(input) — input safety          │
│     │ fail-soft : si Moderation API down → log warn + continue │
│  3. provider-router :                                          │
│     • Primary : OpenAI (gpt-4o-mini)                           │
│     • ⭐ NOUVEAU Fallback : Anthropic (claude-3-haiku)         │
│     • Circuit breaker stocké en Redis (clé `cb:chat:openai`)   │
│  4. RAG + tools (FAQ vector + intents + lead capture)          │
│  5. Stream SSE vers client                                     │
│  6. ⭐ NOUVEAU : openaiModerate(output) — output safety        │
│  7. Persist message + audit log                                │
└────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Redis Upstash                                                 │
│    cb:chat:openai → { failures: N, openedAt: ts }              │
│    cb:chat:anthropic → idem                                    │
│    chat:session:<id>:rate → rolling window                     │
└────────────────────────────────────────────────────────────────┘
```

**Garanties** :
- ✅ Moderation appliquée à 100% des messages (input + output)
- ✅ Fallback Anthropic activé si OpenAI cassé > 30s
- ✅ Rate limit par session externalisé (cohérent multi-lambda)
- ✅ `maxDuration` configuré sur `/api/chat/message` (30s pour SSE)
- ✅ Streaming health monitoré (drops, latence inter-chunk)

### Système 2 — Live publishing social

```
┌──────────────────────────────────────────────────────────────────┐
│  ADMIN — content-studio (/admin/content-studio)                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ POST /api/content-studio/jobs
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  JobRouter (apps/web/src/lib/social-publishing/...)              │
│  ─────────────────────────────────────────────                   │
│  Mode `now` :       executeJob() → adapter → publish immédiat    │
│  Mode `schedule` :  INSERT scheduled_jobs + scheduledFor → cron  │
│  Mode `draft` :     INSERT draft → admin valide plus tard        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
┌────────────────────┐      ┌────────────────────────────────────┐
│  Adapters (3)      │      │  ⭐ FIX : Cron Vercel              │
│  • postiz_provider │      │  vercel.json:                      │
│  • meta_graph      │      │    crons: [{ path: "/api/cron/    │
│    (null actuel)   │      │      content-studio/scheduler",   │
│  • dry_run         │      │      schedule: "*/5 * * * *" }]   │
└────────────────────┘      └────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  buildSocialContent (refactor — multi-media)                     │
│  ──────────────────────────────────────────                      │
│  AVANT : media[0] seulement → carrousel Insta = 1 image          │
│  APRÈS : media[] complet, mapping par plateforme                 │
│    • Insta : carrousel jusqu'à 10 images                         │
│    • TikTok : 1 vidéo + cover                                    │
│    • Facebook : multi-image OR vidéo                             │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Retry policy (⭐ FIX cap attemptCount)                          │
│  ────────────────────────────────────────                        │
│  attempt_count CHECK ≤ 5 (DB constraint + code guard)            │
│  backoff exponentiel : 1min, 5min, 15min, 1h, 6h                 │
│  Dead letter : attempt 6+ → status='dead', alerte admin          │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Audit trail (existant) — content_publishing_audit               │
│  ⭐ NOUVEAU : Dashboard /admin/content-studio/health             │
│    • Jobs in flight                                              │
│    • Dead letters (alertes)                                      │
│    • Success rate par adapter (24h)                              │
│    • Latence P95                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Garanties** :
- ✅ Cron Vercel `*/5 * * * *` actif → scheduled posts partent en prod
- ✅ Carrousels Insta full média (10 images max)
- ✅ `attemptCount` capé à 5, dead letter explicite
- ✅ Dashboard santé temps réel
- ✅ Adapter `meta_graph` retiré du registry tant que pas implémenté

### Système 3 — Live tracking real-time

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT (web) — TrackingClient.emit()                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │ POST /api/track
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  /api/track route                                                │
│  ────────────────                                                │
│  1. Dedup check (⭐ Redis maintenant — cassé en mémoire)         │
│     KEY `dedup:event:<event_id>` TTL 60s                         │
│  2. enrichEvent (déjà fait dans sprint attribution-fix)          │
│  3. dispatchToProviders → batching                               │
│  4. logEvent persiste                                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  dispatchToProviders (refactor batching)                         │
│  ────────────────────────────────────                            │
│  AVANT : 1 fetch HTTP par event par provider (Meta, GA4, etc.)   │
│  APRÈS : buffer en Redis sortie via cron */1 * * * *             │
│    KEY `capi:meta:buffer` (LIST de events)                       │
│    Cron flush : pop N events, batch POST CAPI, retry on fail     │
│    Garanties : ≤ 50 events / batch (Meta limit)                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  serverFire SSR (kit/page.tsx, server-fire.ts)                   │
│  ────────────────────────────────────────                        │
│  AVANT : provider dispatch only, PAS de persist en events_log    │
│  APRÈS : ⭐ persiste TOUS les server-fire dans events_log        │
│    → observabilité unifiée (1 source de vérité)                  │
└──────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Mappings provider unifiés (⭐ taxonomy.ts source de vérité)     │
│  ─────────────────────────────────────────────────────           │
│  AVANT : Meta skip / GA4 nom canonique / TikTok 'CustomEvent'    │
│  APRÈS : `mapEventName(name, provider)` helper unique            │
│    Fallback policy uniforme (drop OR rename par config admin)    │
└──────────────────────────────────────────────────────────────────┘
```

**Garanties** :
- ✅ Dédup events 100% cohérent multi-lambda
- ✅ Batching Meta CAPI → coût ÷ 50, match rate ↑
- ✅ `serverFire` events visibles dans `/admin/analytics`
- ✅ Mappings provider documentés et uniformes
- ✅ Latence ingest P95 < 100ms (vs P95 ~500ms actuel sur le batch synchrone)

---

## Stack technique

### Nouvelles dépendances

| Package | Usage | Coût |
|---|---|---|
| `@upstash/redis` | Redis serverless pour state externalisé | Free tier (10k req/jour) |
| `@upstash/ratelimit` | Rate limiting cohérent multi-lambda | Inclus Upstash |
| `@anthropic-ai/sdk` | Fallback chat provider | Pay-per-use, ~$0.25/M tokens claude-haiku |

### Composants à créer/modifier

| Fichier | Action | Phase |
|---|---|---|
| `lib/redis/client.ts` | Nouveau singleton Upstash | C0 |
| `lib/redis/dedup.ts` | Migration `dedup.ts` → Redis | T1 |
| `lib/redis/circuit-breaker.ts` | Migration breaker chat → Redis | C2 |
| `lib/redis/rate-limit.ts` | Migration rate-limit → Redis | C2 |
| `lib/chat/moderation.ts` | Nouveau wrapper OpenAI Moderation | C1 |
| `lib/chat/providers/anthropic.ts` | Nouveau adapter Anthropic | C3 |
| `lib/chat/orchestrator.ts` | Câbler moderation + fallback | C1, C3 |
| `lib/social-publishing/content-builder.ts` | Refactor multi-media | P2 |
| `lib/social-publishing/retry-policy.ts` | Nouveau helper cap + backoff | P1 |
| `lib/tracking/server/dispatcher-batch.ts` | Nouveau batching Meta CAPI | T2 |
| `lib/tracking/server/server-fire.ts` | Ajouter `logEvent` après dispatch | T3 |
| `lib/tracking/event-mapper.ts` | Nouveau mapping unifié | T4 |
| `app/admin/content-studio/health/page.tsx` | Nouveau dashboard santé | P3 |
| `vercel.json` | Ajouter cron scheduler | P0 ⚡ |
| `app/api/cron/content-studio/social-publish-scheduler/route.ts` | Déjà existant — vérifier | P0 |

### Schéma DB additions

```sql
-- Cap attemptCount sur scheduled_jobs (P1)
ALTER TABLE scheduled_jobs ADD CONSTRAINT attempt_count_max
  CHECK (attempt_count <= 5);

-- Status 'dead' pour dead letter queue
-- (déjà supporté si status est text — vérifier enum)
```

Aucune migration majeure — l'essentiel passe par du nouveau code + config.

---

## Anti-patterns à éviter

❌ **NE PAS** continuer à utiliser des `Map` JavaScript en mémoire pour du state partagé
❌ **NE PAS** ajouter des `try/catch` qui swallow les erreurs sans logger
❌ **NE PAS** créer de retry sans cap (boucle infinie potentielle)
❌ **NE PAS** câbler un nouveau provider sans circuit breaker + fallback
❌ **NE PAS** dispatch CAPI synchrone à l'ingest (latence inacceptable au scale)
❌ **NE PAS** modifier le schema sans migration Drizzle + rollback script

✅ **OUI** externaliser systématiquement (Redis, DB)
✅ **OUI** logger les warnings sur les fail-soft
✅ **OUI** cap + backoff exponentiel sur tout retry
✅ **OUI** circuit breaker par dépendance externe
✅ **OUI** batching + queue pour les dispatchs externes
✅ **OUI** feature flags pour rollout progressif
