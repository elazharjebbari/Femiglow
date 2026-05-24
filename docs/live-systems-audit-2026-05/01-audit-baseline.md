# Audit systèmes live FemiGlow — Mai 2026

Auteur : audit technique automatisé · Date : 2026-05-24 · Périmètre : code only, mode read-only.

## Sommaire exécutif (TL;DR)

Trois systèmes « live » audités : (1) **Chat OpenAI** (orchestrator SSE multi-provider avec FAQ vector + RAG + lead capture), (2) **Live publishing social** (Postiz + dry-run, idempotent, retry borné, mode `now`/`schedule`/`draft`), (3) **Tracking real-time** (dispatcher fan-out CAPI Meta/GA4/TikTok/Snap/Pinterest, dédup en mémoire 60 s, server-fire SSR).

**Top 3 risques bloquants** :
1. **Cron scheduler social ABSENT de `vercel.json`** → les posts planifiés en mode `schedule` ne partiront jamais en prod (la route existe mais n'est jamais déclenchée). Voir `apps/web/vercel.json:5-65` et `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts:1`.
2. **Modération OpenAI déclarée mais jamais appelée** dans l'orchestrator chat. Le seul garde-fou est `charterFilter` (heuristique de mots-clés, ~30 entrées). Risque de réponse off-charte non détectée. Voir `apps/web/src/lib/chat/services/orchestrator.ts:73-450`.
3. **Dédup tracking + circuit breaker chat in-memory** → ne tient pas dans un environnement multi-instance Vercel : sur scale-out un même `event_id` peut être dispatché 2× vers Meta CAPI, et un provider down peut être ré-essayé en boucle par chaque instance. Voir `apps/web/src/lib/tracking/server/dedup.ts:8` et `apps/web/src/lib/chat/services/provider-router.ts:27`.

**Top 3 quick wins (< 1 j chacun)** :
- Ajouter l'entrée cron `/api/cron/content-studio/social-publish-scheduler` (schedule `*/2 * * * *`) à `vercel.json`.
- Appeler `adapter.moderate(text)` en sortie d'orchestrator avant le `charterFilter.outbound` et bloquer si `flagged: true`.
- Plafonner `attemptCount` côté `executeJob` (refuser retry au-delà de 5) et exposer un compteur Prometheus / log dédié — sinon un job retryé manuellement peut tourner ad infinitum.

---

## 1. Cartographie des systèmes « live »

```
┌──────────────────────────────────────────────────────────────────────┐
│                       UTILISATEUR / VISITEUR                          │
└─────┬──────────────────────┬────────────────────────┬─────────────────┘
      │                      │                        │
      ▼ chat                  ▼ navigation             ▼ admin publish
┌────────────┐         ┌──────────────┐         ┌──────────────────┐
│ ChatWidget │         │ datalayer +  │         │ Content Studio   │
│  + SSE     │         │ providers    │         │ posts/[id]/      │
│ reader     │         │ tsx          │         │ publish-now      │
└─────┬──────┘         └──────┬───────┘         └────────┬─────────┘
      │ POST                  │ POST /api/track          │ POST publish-now
      ▼                       ▼                          ▼
┌──────────────────┐  ┌────────────────────┐   ┌─────────────────────┐
│ /api/chat/       │  │ /api/track         │   │ admin-service.ts    │
│ message (SSE)    │  │ batch ingest       │   │ executeJob() + lock │
└─────┬────────────┘  └────────┬───────────┘   └─────────┬───────────┘
      │ orchestrator           │ dispatcher              │
      ▼                        ▼                         ▼
┌──────────────────┐  ┌────────────────────┐   ┌─────────────────────┐
│ provider-router  │  │ providers/registry │   │ adapters/{postiz|   │
│ + breaker        │  │ meta/google/tiktok │   │   dry-run}          │
│ + RAG + FAQ      │  │ /snap/pinterest    │   │ withRetry(3)        │
└─────┬────────────┘  └────────┬───────────┘   └─────────┬───────────┘
      │ streamChat()           │ fetchWithRetry          │ Postiz HTTP
      ▼                        ▼                         ▼
   OpenAI / Anthropic    Meta CAPI / GA4 MP /        Postiz API
   / Gemini / Mistral    TikTok / Snap / Pin         (upload + draft)
```

**Scope d'audit (3 systèmes, 4 angles)** :

| Système                  | Entrée principale                                   | Out                          | Mode live                |
|--------------------------|-----------------------------------------------------|------------------------------|--------------------------|
| Chat live OpenAI         | `POST /api/chat/message` SSE                        | tokens → widget              | streaming temps réel     |
| Live publishing social   | `POST /api/admin/content-studio/posts/[id]/publish-now` + cron scheduler | Postiz/Meta             | `now` / `schedule` / `draft` |
| Live tracking real-time  | `POST /api/track` (client) + `serverFire()` (SSR)   | CAPI Meta/GA4/TikTok/…       | fan-out fire-and-forget  |

---

## 2. Système 1 — Chat live OpenAI

### 2.1 Flow technique

```
ChatWidget.tsx ──useChatSend──┐
                              ▼
                     readSseStream(POST /api/chat/message)
                              │
                              ▼
              /api/chat/message/route.ts (SSE handler)
                    ├─ assertChatEnabled (feature-flag)
                    ├─ rateLimit.consume('session') + ('ip')
                    └─ streamReply(orchestrator)
                              │
                              ▼
                         orchestrator.ts
   1. sanitizeAndRedact (PII regex)
   2. detectLanguage (heuristique FR/AR/AR-MA)
   3. detectIntent (regex pondéré) + classifyByEmbedding (fallback vector)
   4. charterFilter.inbound (jailbreak / médical)
   5. embedTexts (1 fois, partagé FAQ + intent)
   6. faqRepo.matchByEmbedding (FAQ L3 — court-circuite LLM si match)
   7. ragService.retrieve (top-4 chunks)
   8. providerRouter.choose('chat') — breaker + quota EUR
   9. adapter.streamChat() → yield ChatStreamChunk
  10. charterFilter.outbound (post-stream, soft)
  11. messageRepo.update + eventRepo.append
  12. maybeBuildLeadOfferAndCaptureInline (lead capture embarquée)
```

### 2.2 Composants & fichiers clés

- API route SSE : `apps/web/src/app/api/chat/message/route.ts:1` (115 LOC).
- Orchestrator : `apps/web/src/lib/chat/services/orchestrator.ts:1` (626 LOC, *coeur du système*).
- Helper SSE serveur : `apps/web/src/lib/chat/services/stream.ts:1`.
- Lecteur SSE client : `apps/web/src/components/chat/sse-reader.ts:1`, hook `apps/web/src/components/chat/hooks/use-chat-send.ts:1`.
- Adapter OpenAI/compat : `apps/web/src/lib/chat/providers/openai.ts:1` (utilisé aussi par DeepSeek/Qwen/Zhipu/Azure).
- Router + breaker : `apps/web/src/lib/chat/services/provider-router.ts:1`.
- Charter (modération maison) : `apps/web/src/lib/chat/services/charter-filter.ts:1`.
- Sanitize PII : `apps/web/src/lib/chat/services/sanitize.ts:1`.
- Rate-limit (token bucket DB) : `apps/web/src/lib/chat/services/rate-limit.ts:1`.
- RAG + FAQ : `apps/web/src/lib/chat/rag/service.ts:1`, `apps/web/src/lib/chat/repos/faq.ts:1`.
- Lead capture inline : `apps/web/src/lib/chat/services/lead-decision.ts:1`, `apps/web/src/lib/chat/services/phone-detect.ts:1`.

### 2.3 Robustesse A — qualité des résultats

- `apps/web/src/lib/chat/services/orchestrator.ts:289-298` : le prompt système n'inclut PAS de protocole anti-hallucination explicite (« si tu ne sais pas, dis-le ») ; on dépend de la qualité du `instruction.body` admin. Si l'admin écrit un prompt mou, modèle libre de fabriquer.
- `apps/web/src/lib/chat/providers/openai.ts:80-85` : `temperature: 0.7` par défaut. Acceptable pour le ton « humain », mais favorise les hallucinations sur questions factuelles (prix, dispo). Aucune logique pour passer en `temperature: 0` sur intents `pricing`/`shipping`/`order-status`.
- `apps/web/src/lib/chat/rag/service.ts:200` : `minScore: 0.55` global pour la cosine similarity. Pour `text-embedding-3-small` c'est plutôt laxiste, peut remonter des chunks faiblement pertinents qui contamineront la réponse. À calibrer par `freshness` (volatile vs evergreen).
- `apps/web/src/lib/chat/rag/service.ts:226-246` : rerank purement heuristique (keyword boost + length penalty). Aucun cross-encoder. Sur 4 chunks, le rerank apporte peu — on pourrait l'enlever ou le remplacer par un BM25 léger.
- `apps/web/src/lib/chat/services/charter-filter.ts:142-188` : si la réponse mentionne un terme médical SANS disclaimer, on log mais on streame quand même. Le visiteur voit le contenu off-charte avant que l'event `error/charter-out` soit consultable en admin. Pas de rewrite automatique.
- `apps/web/src/lib/chat/providers/openai.ts:190-221` : `moderate(text)` existe (OpenAI Moderation API) mais N'EST APPELÉ NULLE PART dans l'orchestrator. **Le seul filtre est `charterFilter` (heuristique de mots-clés)**. Pas de détection d'incitation à la haine, auto-mutilation, contenu sexuel via Moderation API.
- `apps/web/src/lib/chat/lang/detect.ts:22-60` : heuristique purement caractères arabes + dictionnaire darija. Sur un message « 50/50 » FR/AR (ex. « Salam combien c'est ? »), le ratio fait tomber sur `fr`. Le `instruction.bodyAr`/`bodyArMa` ne sera donc pas utilisé. Multilingue suffisant pour 80 % des cas, peu robuste sur code-switching.

### 2.4 Robustesse B — résilience erreurs

- `apps/web/src/lib/chat/providers/openai.ts:47` : `timeoutMs: 30_000` par défaut. OK pour cold-start, mais pas de configuration par-rôle (embedding doit être plus court).
- `apps/web/src/lib/chat/providers/openai.ts:308-339` : mapping HTTP→`ProviderError` complet (timeout/auth/rate-limit/context-too-large/network). `retryable` flag correctement positionné.
- `apps/web/src/lib/chat/services/provider-router.ts:27-29` : **breaker in-memory** (Map locale). Sur Vercel scale-out, chaque lambda a sa propre Map → un provider down côté instance A continue d'être hammered côté instance B. `FAILURE_THRESHOLD = 3`, `cooldown 30s`. Documenté comme limitation V1 (`provider-router.ts:7-8`).
- `apps/web/src/lib/chat/services/provider-router.ts:78-97` : sur breaker ouvert ou quota épuisé, on passe au candidat suivant. **MAIS si tous les providers `chat` sont down, on throw `ProviderError('unknown', 'no provider available')` → l'orchestrator yield `error/no-provider`**. Pas de fallback statique (message d'erreur tournée vers l'utilisateur en FR/AR).
- `apps/web/src/lib/chat/services/orchestrator.ts:101-108`, `:264-275` : embedding ET RAG sont en cascade silencieuse — si provider embedding down, on continue avec regex-only + sans RAG. Bonne pratique.
- `apps/web/src/lib/chat/services/orchestrator.ts:170-176` : `notifyFrustrationSpike` lancé en `void` (fire-and-forget) — bien.
- `apps/web/src/lib/chat/services/rate-limit.ts:48-54` : INSERT ON CONFLICT UPDATE atomique au niveau DB. **Si la DB est lente, ce gate ajoute de la latence en première ligne** (avant même le LLM). Pas de cache local court (ex. 1 s) pour amortir.
- `apps/web/src/app/api/chat/message/route.ts:67-92` : rate-limit dans try/catch large, échec → continue silencieusement. C'est un trou : un attaquant peut faire tomber le rate-limit en bombardant la DB.
- `apps/web/src/app/api/chat/message/route.ts:1-22` : **pas de `export const maxDuration`** → défaut Vercel (10 s hobby, 60 s pro). Une réponse OpenAI longue (300 tokens × ~50 ms = 15 s) sera coupée brutalement, le SSE meurt sans `end` event.
- `apps/web/src/lib/chat/providers/openai.ts:58-66` : `withTimeout` annule via AbortController. Mais le compteur `timeoutMs` court depuis l'envoi : **un stream qui produit 5 s puis stall ne déclenche pas le timeout**, le client lit du `\n\n` jusqu'à la coupure Vercel. Pas d'idle timeout.

### 2.5 Robustesse C — cohérence multi-canaux

- Le chat ne fonctionne que côté web. Pas de version admin/mobile native. `apps/web/src/components/chat/ChatWidgetMount.tsx` mount conditionnel, désactivé sur `/admin/*` via `Header.chat-aware.test.tsx`.
- Côté admin (`apps/web/src/app/api/admin/chat/*`), c'est uniquement de la configuration (instructions, providers, FAQ, leads) — pas d'envoi de message. OK.
- `apps/web/src/lib/chat/services/orchestrator.ts:289-298` : mémoire conversation = derniers 12 messages quel que soit la longueur. Un visiteur qui revient après 24 h récupère le contexte. Mais pas de résumé/compaction → pour les sessions longues (> 30 tours), tokens vite saturés. **Pas de garde sur la taille max du prompt en tokens.**

### 2.6 Robustesse D — performance

- **First-token target**: pas d'instrumentation explicite. `apps/web/src/lib/chat/services/orchestrator.ts:342-363` mesure `firstTokenMs` côté serveur (persisté dans `chat_messages.first_token_ms`). Pas de P50/P95 agrégé visible — on dépend d'`/admin/chat/analytics`.
- `apps/web/src/lib/chat/services/orchestrator.ts:98-108` : `embedTexts` est **synchrone bloquant** avant le LLM. Un OpenAI embedding down qui timeout après 30 s retarde le first-token de 30 s avant fallback (les calls FAQ + RAG suivent le même chemin). Le `Promise.race` ou un timeout court (5 s) serait bienvenu.
- `apps/web/src/lib/chat/services/orchestrator.ts:188-251` : la cascade FAQ remonte une réponse pré-écrite en `~400ms` au lieu de `2-4s` LLM. Très bon. Mais l'envoi du chunk se fait en UN SEUL chunk (`reply` entier) → pas d'effet typing humain — incohérent avec le cadenceur `humanizeStream` côté client.
- `apps/web/src/components/chat/hooks/use-chat-send.ts:70-93` : `humanizeStream` côté client ajoute jitter + pauses. Si le serveur stream slow (500 ms entre chunks), le cadenceur ne peut pas accélérer → effet « lent » composé.
- `apps/web/src/components/chat/sse-reader.ts:33-49` : reader correct ; pas de buffer overflow handling sur un chunk géant (rare avec OpenAI).
- Pas de mesure de tail latency sur OpenAI ; en cas de pic latence (P99 = 15 s OpenAI), pas de fallback automatique vers Anthropic/Mistral même si `chat` provider secondaire actif (le router choisit le premier dispo, pas le plus rapide).

### 2.7 Tests existants — couverture + trous

- E2E live : `apps/web/e2e/chat-live-openai.spec.ts:1` (1 test, max_tokens=8, skip par défaut sans `OPENAI_LIVE_TEST=1`). Très minimal mais valide le bout-en-bout.
- E2E mock : `apps/web/e2e/chat-visitor.spec.ts`, `chat-lead-capture.spec.ts`, `chat-mobile-ux.spec.ts`, `chat-admin.spec.ts`, `chat-form-trigger-safety-net.spec.ts` — bonne couverture UX.
- Unitaires : orchestrator (`orchestrator.test.ts`, `orchestrator-lead-capture.test.ts`), provider-router, rate-limit, sanitize, charter-filter, lang/detect, intent — solides.
- **Trous identifiés** :
  - Pas de test simulant **`adapter.moderate()` appelé** — confirme que la moderation n'est pas câblée.
  - Pas de test sur les **timeouts pendant le stream** (provider qui stalle après 5 chunks).
  - Pas de test du **breaker en environnement multi-instance** (forcément, c'est in-process).
  - Pas de test sur le **comportement quand `maxDuration` Vercel coupe la SSE** (le client reçoit-il l'event `error` ou un simple ECONNRESET ?).

### 2.8 Top 3 améliorations recommandées

1. **Câbler la modération OpenAI** (high, ~0.5 j) — appeler `adapter.moderate()` côté inbound (avant LLM) + outbound (sur `aggregated`), bloquer si `flagged`. Émettre event `moderation_flagged`.
2. **Externaliser le breaker / dedup en DB (ou Upstash Redis)** (high, ~2 j) — table `chat_provider_breaker(provider_id, opened_at, failure_count)` lue/écrite atomiquement. Évite hammering multi-lambda.
3. **Idle timeout sur le stream + `export const maxDuration = 60` sur `/api/chat/message`** (medium, ~0.5 j) — détecter un stall > 15 s, abort + yield `error/stalled`. Sécurise les SSE longues.

---

## 3. Système 2 — Live publishing social

### 3.1 Flow technique

```
Admin UI ──POST publish-now/draft-on-provider/schedule──┐
                                                         ▼
                                          admin-service.ts
                                                │
                                                ▼
                              ┌─ publishContentPostNow
                              ├─ sendContentPostToDraft
                              └─ scheduleContentPost
                                                │
                                                ▼
                              getPostPublishability (capability check)
                                                │
                                                ▼
                              createPublishJob (idempotency key)
                                                │
                                                ▼
                              executeJob → tryAcquirePublishJobLock
                                                │
                                                ▼
                              publishWithAdapter(adapter, req)
                                          └─ withRetry(3, delays 100/300/900/1500ms)
                                                │
                                                ▼
                              adapter.publish() — PostizSocialPublishingAdapter
                                          ├─ uploadMedia (Postiz)
                                          ├─ createDraft (Postiz, type=now/schedule/draft)
                                          └─ extractPostizPostId
                                                │
                                                ▼
                              recordPublishAttempt + createPublication
                                                │
                                                ▼
                              updatePostPlanning (post → published/failed)
                                                │
                                                ▼ (échec non-draft seulement)
                              sendSocialAlert (Slack webhook)


  Cron (THÉORIQUE) ──POST /api/cron/content-studio/social-publish-scheduler──┐
                                                                              ▼
                                                              runScheduledPublishJobs
                                                                  └─ listScheduledJobsDue
                                                                  └─ executeJob (par job)
```

### 3.2 Composants & fichiers clés

- Service admin : `apps/web/src/lib/social-publishing/admin-service.ts:1` (606 LOC, *coeur*).
- Worker scheduler : `apps/web/src/lib/social-publishing/worker.ts:1`.
- Service retry + adapter dispatch : `apps/web/src/lib/social-publishing/service.ts:1`.
- Retry helper : `apps/web/src/lib/social-publishing/retry.ts:1`.
- State machine : `apps/web/src/lib/social-publishing/state-machine.ts:1`.
- Adapter Postiz : `apps/web/src/lib/social-publishing/adapters/postiz.ts:1` (405 LOC).
- Adapter dry-run : `apps/web/src/lib/social-publishing/adapters/dry-run.ts:1`.
- Repository (lock, attempts, publications) : `apps/web/src/lib/social-publishing/repository.ts:1`.
- Errors + redact secrets : `apps/web/src/lib/social-publishing/errors.ts:1`.
- Alertes Slack : `apps/web/src/lib/social-publishing/alerts.ts:1`.
- Route cron : `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts:1`.

### 3.3 Robustesse A — qualité des résultats

- `apps/web/src/lib/social-publishing/admin-service.ts:166-227` : `getPostPublishability` vérifie status post + status draft + format capability + caption length + média HTTPS + tags ≤ 25. Bonne batterie de checks. Si erreur, on retourne `errors[]` ; la route bloque proprement avant création de job.
- `apps/web/src/lib/social-publishing/adapters/postiz.ts:320-353` : `validateRequest` re-fait certains checks de capability — défense en profondeur. OK.
- `apps/web/src/lib/social-publishing/adapters/postiz.ts:30-36` : capabilities Postiz hard-codées (caption 2200 chars Instagram, 63206 Facebook). Aligné avec doc Postiz. Aucune lecture dynamique des limites côté provider (acceptable, ces limites sont stables).
- `apps/web/src/lib/social-publishing/admin-service.ts:153-159` : `mapPostizProviderToPlatform` ne reconnaît que `instagram` et `facebook`. **Si Postiz expose plus tard `tiktok` ou `linkedin`, la sync silencieuse ignore — pas d'avertissement admin**.
- `apps/web/src/lib/social-publishing/admin-service.ts:565-590` : `buildSocialContent` n'inclut qu'un seul média (`media[0]`). Pour un carrousel Instagram (`format='carousel'`), c'est faux — on publie 1 seule image sans le dire. Voir `admin-service.ts:576`.
- `apps/web/src/lib/social-publishing/adapters/postiz.ts:180-217` : `parsePostizAnalytics` extrait métriques par label case-insensitive (likes/reactions, comments/replies, shares/retweets…). Tolérant aux variations de schéma. Engagement rate recalculé localement.

### 3.4 Robustesse B — résilience erreurs

- `apps/web/src/lib/social-publishing/retry.ts:8` : `DEFAULT_DELAYS_MS = [100, 300, 900, 1500]` — backoff modeste mais pas exponentiel jitter. `attempts: 3` cap dans `service.ts`. OK pour Postiz.
- `apps/web/src/lib/social-publishing/service.ts:21-55` : retry uniquement si `result.error.retryable`. Codes retryables = `provider_rate_limited` (429), `provider_unavailable` (5xx). 401/403/422 → no retry (bonne pratique).
- `apps/web/src/lib/social-publishing/admin-service.ts:413-431` : `tryAcquirePublishJobLock` utilise un UPDATE atomique avec `where status IN (queued, failed) AND lockedAt IS NULL`. **Empêche le double-publish entre 2 invocations concurrentes**. Excellent.
- `apps/web/src/lib/social-publishing/repository.ts:226-227` : `createPublishJob` court-circuite via `findPublishJobByIdempotencyKey` — **idempotence garantie au niveau service** (le même `idempotencyKey` ne crée jamais 2 jobs). Bonne pratique.
- `apps/web/src/lib/social-publishing/admin-service.ts:604-606` : idempotency key par défaut = `content-studio:{postId}:{accountId}:{suffix}` (`now`/`draft`/`<scheduledAt>`). Stable et déterministe.
- `apps/web/src/lib/social-publishing/admin-service.ts:407-432` : si lock non acquis (job déjà publishing ou terminé), on renvoie `invalid_request, "Job not available for execution"`. Pas de retry automatique avec backoff — l'admin doit cliquer « Réessayer ».
- `apps/web/src/lib/social-publishing/repository.ts:432-452` : **pas de cap sur `attemptCount`**. Un job retryé manuellement 50 fois par un admin frustré écrit 50 attempts en DB.
- `apps/web/src/lib/social-publishing/admin-service.ts:517-528` : `sendSocialAlert` Slack en void/no-await — OK fire-and-forget.
- `apps/web/src/lib/social-publishing/admin-service.ts:500-502` : si publish échoue, le post passe `status='failed'` sauf si `publishMode='draft'`. **Mais** le post n'a pas de re-queue automatique vers `queued` — l'admin doit cliquer « Réessayer » via `/publish-jobs/[id]/retry`. Cohérent avec philosophie « 4-eyes ».
- **CRITIQUE : `vercel.json:5-65` ne contient PAS d'entrée cron pour `/api/cron/content-studio/social-publish-scheduler`**. La route existe (`apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts:1`), mais aucun déclencheur n'est configuré. **Conséquence : les jobs `mode=schedule` créés via `scheduleContentPost` ne seront JAMAIS exécutés en prod**. Découvert en comparant `vercel.json` vs. la liste des cron files (voir détail §6 plan d'action).
- `apps/web/src/lib/social-publishing/worker.ts:22-66` : `runScheduledPublishJobs` traite jusqu'à 5 jobs par tick (cap 20). Pas de parallélisme. Acceptable si scheduler tournait toutes les 2 min (donc max 150 jobs/h).
- `apps/web/src/lib/social-publishing/adapters/postiz.ts:294-318` : `validateSchedule` accepte une tolérance de 60 s sur les dates passées (round-trip). Bien.

### 3.5 Robustesse C — cohérence multi-canaux

- Endpoint unique = admin web (`/api/admin/content-studio/posts/[id]/{publish-now|schedule|draft-on-provider|cancel|reschedule}`). Pas d'API publique exposée pour clients tiers. OK pour le périmètre actuel.
- `apps/web/src/lib/social-publishing/admin-service.ts:48-52` : `adapters` registry n'inclut que `dry_run` et `postiz` ; `meta_graph` est `null` (déclaré mais non implémenté). Si admin crée un compte `meta_graph` directement en DB → `adapterFor` throw `Provider meta_graph non disponible`. Bonne défense.
- `apps/web/src/lib/social-publishing/repository.ts:121-131` : `redactSecrets` appliqué récursivement avant persistance attempts/publications/events. Aucun token ne fuite en DB ni en log.

### 3.6 Robustesse D — performance

- `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts:8` : `maxDuration = 60`. Pour 5 jobs × ~5 s/job (upload + draft) = 25 s, on a marge.
- `apps/web/src/lib/content-studio/postiz.ts` (non lu intégralement) : `uploadPostizMediaFromUrl` et `createPostizDraft` ont leur propre retry (`{ attempts: 3 }`) — empilement avec `withRetry` du service = 9 tentatives au pire. Voir `apps/web/src/lib/social-publishing/adapters/postiz.ts:71` et `:101`. Risque amplification charge sur Postiz si rate-limit.
- Latence publish-now mesurée jamais explicitement (`recordPublishAttempt` stocke `durationMs` mais pas de KPI agrégé).

### 3.7 Tests existants — couverture + trous

- Unitaires : `service.test.ts`, `admin-service.test.ts`, `state-machine.test.ts`, `retry.test.ts`, `errors.test.ts`, `repository.test.ts`, `worker.test.ts`, `alerts.test.ts`, `draft.integration.test.ts`, `weekly-failure-digest.test.ts` — couverture étendue.
- Adapters : `dry-run.test.ts`, `postiz.test.ts` — pattern matrix sur capabilities et erreurs.
- E2E : `content-studio-social-publishing.spec.ts` (204 LOC), `content-studio-social-publishing-draft.spec.ts` (242 LOC).
- **Trous identifiés** :
  - Pas de test « scheduler cron jamais déclenché » (impossible à tester côté code, mais aucune alerte non plus).
  - Pas de test sur **carrousel multi-média** — `buildSocialContent` ne prend que `media[0]` ; aucun test ne révèle ça.
  - Pas de test « 50 retries manuels » → attempt count explose.

### 3.8 Top 3 améliorations recommandées

1. **Ajouter le cron `/api/cron/content-studio/social-publish-scheduler`** dans `vercel.json` avec schedule `*/2 * * * *` (toutes les 2 min) — **bloquant prod** (high, < 0.25 j).
2. **Cap `attemptCount` et exposer KPI** (medium, ~0.5 j) — refuser retry si `attemptCount >= 5`, retourner `invalid_state` propre. Logger `social.publish.attempts_exhausted`.
3. **Support carrousel multi-média** (medium, ~1 j) — étendre `getPrimaryAsset` → `getAllAssets` quand `format='carousel'`, propager dans `SocialPublishContent.media[]`, adapter Postiz envoie 2-10 images. Sinon les carrousels publient 1 image silencieusement.

---

## 4. Système 3 — Live tracking real-time

### 4.1 Flow technique

```
Client (browser) ──POST /api/track (batch ≤ 50 events)─┐
                                                        ▼
                                       /api/track/route.ts
                                       ├─ checkRateLimit (60/min/IP)
                                       ├─ batchSchema parse (Zod)
                                       ├─ enrichRequest (UA hash, IP anon, device, locale)
                                       ├─ per-event:
                                       │   ├─ getValidator → params.parse
                                       │   ├─ isDuplicateEventId (in-mem, 60s)
                                       │   ├─ consent gate
                                       │   ├─ dispatchToProviders ──┐
                                       │   ├─ ATTRIBUTION_V2 enrich  │
                                       │   └─ logEvent (DB persist) ◄┤
                                       │                              │
                                       │                              ▼
                                       │             dispatchToProviders
                                       │             ├─ resolveEventMapping (DB version)
                                       │             ├─ shouldDispatchByAttribution (gate)
                                       │             └─ adapter.dispatch() — parallel
                                       │                  ├─ meta CAPI       fetchWithRetry(3, expo)
                                       │                  ├─ google_ga4 MP    fetchWithRetry
                                       │                  ├─ google_ads      (client-only)
                                       │                  ├─ tiktok          fetchWithRetry
                                       │                  ├─ snap            fetchWithRetry
                                       │                  ├─ pinterest       fetchWithRetry
                                       │                  ├─ gtm             (config only)
                                       │                  └─ custom          fetchWithRetry
                                       └─ bridgeWebTrackingToUserEvent (fire-and-forget)


SSR Server Component ──serverFire()──┐
                                      ▼
                            apps/web/src/lib/tracking/server/server-fire.ts
                            (consent gate cookies, dispatchToProviders direct)
                            ⚠️ NE PERSISTE PAS en `tracking_events_log`


Stripe Webhook ──serverEmit()──┐
                                ▼
                       apps/web/src/lib/tracking/server/server-emit.ts
                       (logEvent DB, NE DISPATCHE PAS)
```

### 4.2 Composants & fichiers clés

- API ingest client : `apps/web/src/app/api/track/route.ts:1` (327 LOC).
- Dispatcher : `apps/web/src/lib/tracking/server/dispatcher.ts:1` (136 LOC).
- Dedup in-memory : `apps/web/src/lib/tracking/server/dedup.ts:1` (cache LRU 50 000 / 60 s).
- Server-fire (SSR) : `apps/web/src/lib/tracking/server/server-fire.ts:1`.
- Server-emit (webhooks) : `apps/web/src/lib/tracking/server/server-emit.ts:1`.
- Adapters : `apps/web/src/lib/tracking/providers/{meta,google,tiktok,snap,pinterest,google-ads,gtm,custom}.ts`.
- Retry helper : `apps/web/src/lib/tracking/providers/retry.ts:1`.
- Registry : `apps/web/src/lib/tracking/providers/registry.ts:1`.
- Enrich event (attribution v2) : `apps/web/src/lib/tracking/server/enrich-event.ts:1`.
- Mapping resolver : `apps/web/src/lib/tracking/mappings/resolver.ts`.

### 4.3 Robustesse A — qualité des résultats

- `apps/web/src/lib/tracking/providers/meta.ts:69-80` : `enrichPurchase` enrichit `value`/`currency` depuis la DB orders avant d'envoyer à Meta. Si invalid après enrich → skip dispatch avec `error: 'purchase_value_currency_invalid'`. Excellent — élimine la dégradation ROAS observée dans `meta-quality-audit-2026-05`.
- `apps/web/src/lib/tracking/providers/meta.ts:13-24` : `buildUserData` hash external_id, IP, UA. Mais `client_ip_address: ctx.ipAnonymized` envoie une **IP déjà anonymisée** (cf. `apps/web/src/lib/tracking/server/enricher.ts` → `anonymizeIp`). **Meta préfère l'IP brute pour la résolution identitaire — l'anonymisation côté serveur dégrade le match rate.** À confirmer côté RGPD (acceptable car FR + AR consent), mais à expliciter dans la doc.
- `apps/web/src/lib/tracking/providers/google.ts:11` : mapping fallback = nom canonique de l'event si non résolu. Pour GA4 c'est acceptable. **Mais pour Meta**, `apps/web/src/lib/tracking/providers/meta.ts:62-64` skippe via `event_unmapped` → events custom non mappés ne partent jamais. Inconsistance entre providers.
- `apps/web/src/lib/tracking/providers/tiktok.ts:10` : fallback = `'CustomEvent'` littéral. Toutes les events non mappés deviennent `CustomEvent` indistinguables. Sous-optimal.
- `apps/web/src/lib/tracking/server/dispatcher.ts:44-58` : la résolution `event_mapping_versions` est tentée par provider en parallèle (`Promise.all`). Si la table DB renvoie une erreur, on log mais on continue (best-effort). Bonne défense.

### 4.4 Robustesse B — résilience erreurs

- `apps/web/src/lib/tracking/providers/retry.ts:16-66` : retry exponentiel (200/400/800/2000ms cap) + jitter 100 ms aléatoire. 3 tentatives. 4xx (sauf 429) = no retry. **Bonne pratique**.
- `apps/web/src/lib/tracking/providers/retry.ts:50-53` : sur exception réseau, `lastStatus = 0`, on retry. OK.
- `apps/web/src/lib/tracking/server/dispatcher.ts:105-124` : try/catch autour de chaque `adapter.dispatch()`. **Une exception adapter ne fait pas tomber le batch entier**. `Promise.allSettled` final → garanti pas de "all-or-nothing".
- `apps/web/src/lib/tracking/server/dedup.ts:1-30` : **dedup in-memory par lambda Vercel**. Sur un déploiement multi-instance, un `event_id` peut être dispatché 2× si le batch arrive sur 2 lambdas différentes. L'idempotence dépend ensuite uniquement de Meta/TikTok eux-mêmes (Meta dédup par `event_id` ✓, TikTok dédup par `event_id` ✓ mais documenté flou pour Snap/Pinterest).
- `apps/web/src/app/api/track/route.ts:134-146` : `checkRateLimit` 60 RPM par IP. Strict ; un visiteur qui scroll vite (50 `scroll_depth` en 30 s) peut être rate-limited.
- `apps/web/src/app/api/track/route.ts:198-224` : `dispatchToProviders` enveloppé dans `.catch()` qui renvoie `{dispatched:[], results:{}}` — le `logEvent` continue. **Conséquence : un event peut être persisté en DB avec `providersResults: {}` même si le dispatch a totalement échoué**. C'est intentionnel (KPIs client conservés) mais brouille les diagnostics.
- `apps/web/src/lib/tracking/server/server-fire.ts:113-174` : `serverFire` est **explicitement fire-and-forget** (try/catch englobant), retourne `'skipped'` + log. Acceptable pour SSR.
- `apps/web/src/lib/tracking/server/server-fire.ts:1-22` : **`serverFire` NE PERSISTE PAS l'event en `tracking_events_log`**. Conséquence : les events SSR (ex. `view_item` sur `/kit`) dispatchés vers Meta n'apparaissent pas dans la table de log côté FemiGlow. **Asymétrie observabilité** — on doit aller dans Meta Events Manager pour les voir. Le commentaire `:14-17` explicite ce choix mais ce n'est pas évident côté admin.
- Pas de queue durable. Si Meta retourne 503 3 fois, `result.status='failed'` est persisté et on perd l'event (pas de retry différé en cron).

### 4.5 Robustesse C — cohérence multi-canaux

- **3 entrées distinctes pour la même finalité analytique** :
  1. `POST /api/track` (client) → dispatch + log
  2. `serverFire` (SSR) → dispatch only
  3. `serverEmit` (webhooks) → log only, pas de dispatch
  - **Pas de fonction unifiée `trackEvent({channel: 'client'|'ssr'|'webhook'})`**. Risque d'oubli (un nouveau webhook devrait-il dispatcher vers Meta CAPI ? Pas évident).
- `apps/web/src/lib/tracking/providers/google-ads.ts:25` : `'client_only_provider'` → Google Ads n'a pas de CAPI server-side. Cohérent avec spec. Le snippet client gère.
- `apps/web/src/lib/tracking/providers/google.ts:64-75` : `clientSnippet()` renvoie `null` car GA4 est bootstrapé via GTM (commentaire explicite). Évite double config. Bon.

### 4.6 Robustesse D — performance

- `apps/web/src/lib/tracking/server/dispatcher.ts:61-124` : tous les adapters lancés en parallèle via `Promise.allSettled`. Bonne perf — latence = max(latence adapter), pas sum.
- `apps/web/src/lib/tracking/providers/retry.ts:54-57` : backoff cap 2 s, 3 essais → pire cas ~6 s par event. Sur un batch de 10 events × 6 s = 60 s si tout fail. **`/api/track` n'a pas de `maxDuration`** → Vercel défaut 10/60s coupe.
- `apps/web/src/app/api/track/route.ts:1-24` : pas d'`export const maxDuration`. Risque de timeout silencieux sur batchs lents.
- Dedup LRU 50 000 entries × 60 s. Si trafic > 50 000 events/min sur une instance → éviction prématurée → faux non-duplicates.
- Pas de batching côté Meta CAPI (Meta accepte jusqu'à 1000 events par request). Chaque event individuel = 1 fetch HTTP. **À volume soutenu (> 100 events/s par instance), c'est inefficace**.

### 4.7 Tests existants — couverture + trous

- Unitaires : `dispatcher.attribution.test.ts`, `dedup.test.ts`, `server-fire.test.ts`, `server-emit.test.ts`, `enrich-event.test.ts`, `enrich-event.robustness.test.ts`, `enricher.test.ts`, `validator.test.ts`, `request-signals.test.ts`, `stripe-webhook.test.ts`.
- Adapters : `meta.test.ts`, `tiktok.test.ts`, `snap.test.ts`, `custom.test.ts`, `event-mapping.test.ts`, `hashing.test.ts`, `_enrich-purchase.test.ts`, `client-snippets.test.ts`, `cross-provider.test.ts`.
- Integration : `apps/web/src/test/integration/tracking-providers.test.ts`.
- E2E : `tracking-api.spec.ts`, `tracking-admin.spec.ts`, `tracking-attribution.spec.ts`, `tracking-attribution-phase2.spec.ts`.
- **Trous identifiés** :
  - Pas de test « dedup cross-lambda » (impossible côté unit).
  - Pas de test « Meta CAPI batching » (puisque pas implémenté).
  - Pas de mesure perf E2E (« 10k events en 1 min sans drop »).
  - Pas de test « serverFire NE persiste pas » documenté comme tel (le comportement est silencieux).

### 4.8 Top 3 améliorations recommandées

1. **Persister les events `serverFire` dans `tracking_events_log`** (medium, ~0.5 j) — fusionner `serverFire` et `serverEmit` en un helper `trackServerEvent({dispatch: true, persist: true})`. Symétrie observabilité client/SSR.
2. **Dedup en DB (`tracking_event_dedup`) ou Upstash** (medium, ~1 j) — UNIQUE constraint sur `event_id` avec TTL 1h via cron purge. Élimine la dérive multi-lambda.
3. **Batching Meta CAPI (rolling 1 s, ≤ 1000 events)** (high impact, ~2 j) — réduit latence + coût API + match rate (Meta préfère batch). Spécifiquement pour `view_item` à fort volume.

---

## 5. Synthèse priorisée

| # | Système    | Priorité | Quick win                                                    | Effort | Impact     |
|---|------------|----------|--------------------------------------------------------------|--------|------------|
| 1 | Publishing | P0       | Ajouter cron `social-publish-scheduler` dans `vercel.json`   | 0.25 j | Bloquant prod |
| 2 | Chat       | P0       | Câbler `adapter.moderate()` inbound + outbound               | 0.5 j  | Compliance |
| 3 | Chat       | P0       | `maxDuration = 60` sur `/api/chat/message` + idle timeout    | 0.5 j  | Stabilité SSE |
| 4 | Tracking   | P1       | `maxDuration = 30` sur `/api/track`                          | 0.1 j  | Stabilité batch |
| 5 | Publishing | P1       | Cap `attemptCount ≤ 5` côté `executeJob`                     | 0.5 j  | Robustesse |
| 6 | Tracking   | P1       | Persister `serverFire` dans `tracking_events_log`            | 0.5 j  | Observabilité |
| 7 | Chat       | P1       | Breaker provider externalisé en DB / Upstash                 | 2 j    | Robustesse multi-lambda |
| 8 | Tracking   | P1       | Dedup partagée (DB ou Upstash) avec UNIQUE + TTL cron        | 1 j    | Anti-doublon Meta |
| 9 | Publishing | P2       | Support carrousel multi-média (`media[]` au lieu de `[0]`)   | 1 j    | Qualité publication |
|10 | Tracking   | P2       | Batching Meta CAPI 1 s / 1000 events                         | 2 j    | Coût + match rate |

---

## 6. Plan d'action recommandé

### Sprint 1 — Quick wins (1 semaine)

- **Cron social scheduler** : modifier `apps/web/vercel.json` pour ajouter `{ "path": "/api/cron/content-studio/social-publish-scheduler", "schedule": "*/2 * * * *" }`. Tester en preview.
- **Modération OpenAI** : injecter un appel `adapter.moderate(sanitized.contentSafe)` dans `orchestrator.ts` après `charterFilter.inbound`, et un appel sur `aggregated` après le stream. Bloquer si `flagged`, émettre event `moderation_flagged`.
- **`maxDuration = 60`** sur `/api/chat/message` + `30` sur `/api/track`. Test E2E pour vérifier que le SSE se ferme proprement.
- **Cap attemptCount** : ajout d'un check `if (job.attemptCount >= 5) throw HttpError('invalid_state', ...)` dans `executeJob` et `retryPublishJob`.

### Sprint 2 — Chantiers structurants (2-3 semaines)

- **Breaker chat externalisé** : table `chat_provider_breaker` lue/écrite atomiquement, ou Upstash Redis avec TTL. Migrer `provider-router.ts`.
- **Dedup tracking partagée** : table `tracking_event_dedup(event_id PRIMARY KEY, expires_at)` avec ON CONFLICT DO NOTHING. Purge horaire en cron.
- **Persister `serverFire`** : intégrer un appel `logEvent` après `dispatchToProviders` (avec `consentSnapshot` issu du cookie). Backfill optionnel.
- **Carrousel social** : étendre `getPrimaryAsset` → `getAssetsForDraft`, retourner tableau ordonné, adapter Postiz envoie multi-image.
- **Unification helpers tracking** : créer `lib/tracking/track.ts` exposant `trackServerEvent({dispatch, persist, source})` qui remplace `serverFire` et `serverEmit`.

### Sprint 3 — Roadmap (1 mois+)

- **Batching Meta CAPI** + cache de mapping en mémoire / Redis (le resolver mapping fait 8 round-trips DB par event aujourd'hui).
- **Queue durable pour retry tracking** (BullMQ ou pg-boss) — events échoués 3× envoyés en `tracking_dead_letter` à re-fire en différé.
- **Compaction conversation chat** : résumer les messages > 12 quand on dépasse 4k tokens (via LLM cheap). Évite la dérive coût + latence.
- **Cross-encoder pour rerank RAG** : remplacer le rerank heuristique par un `bge-reranker-base` (peut tourner sur Vercel Edge inférence).
- **Observabilité unifiée** : exporter les KPIs latence/dispatch (`chat.first_token_ms`, `tracking.dispatch.latency_ms`, `social.publish.duration_ms`) en Prometheus / OpenTelemetry.

---

## 7. Annexes

### A. Fichiers clés par système

**Chat live OpenAI** :
- `apps/web/src/app/api/chat/message/route.ts`
- `apps/web/src/lib/chat/services/orchestrator.ts` (coeur)
- `apps/web/src/lib/chat/services/provider-router.ts`
- `apps/web/src/lib/chat/services/stream.ts`
- `apps/web/src/lib/chat/services/charter-filter.ts`
- `apps/web/src/lib/chat/services/sanitize.ts`
- `apps/web/src/lib/chat/services/rate-limit.ts`
- `apps/web/src/lib/chat/services/lead-decision.ts`
- `apps/web/src/lib/chat/services/phone-detect.ts`
- `apps/web/src/lib/chat/services/intent.ts`
- `apps/web/src/lib/chat/providers/openai.ts`
- `apps/web/src/lib/chat/providers/factory.ts`
- `apps/web/src/lib/chat/rag/service.ts`
- `apps/web/src/lib/chat/lang/detect.ts`
- `apps/web/src/components/chat/sse-reader.ts`
- `apps/web/src/components/chat/hooks/use-chat-send.ts`

**Live publishing social** :
- `apps/web/src/lib/social-publishing/admin-service.ts` (coeur)
- `apps/web/src/lib/social-publishing/service.ts`
- `apps/web/src/lib/social-publishing/worker.ts`
- `apps/web/src/lib/social-publishing/retry.ts`
- `apps/web/src/lib/social-publishing/state-machine.ts`
- `apps/web/src/lib/social-publishing/repository.ts`
- `apps/web/src/lib/social-publishing/errors.ts`
- `apps/web/src/lib/social-publishing/alerts.ts`
- `apps/web/src/lib/social-publishing/adapters/postiz.ts`
- `apps/web/src/lib/social-publishing/adapters/dry-run.ts`
- `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts`
- `apps/web/src/app/api/admin/content-studio/posts/[id]/{publish-now,schedule,draft-on-provider,cancel,reschedule}/route.ts`

**Live tracking real-time** :
- `apps/web/src/app/api/track/route.ts`
- `apps/web/src/lib/tracking/server/dispatcher.ts` (coeur)
- `apps/web/src/lib/tracking/server/server-fire.ts`
- `apps/web/src/lib/tracking/server/server-emit.ts`
- `apps/web/src/lib/tracking/server/dedup.ts`
- `apps/web/src/lib/tracking/server/enrich-event.ts`
- `apps/web/src/lib/tracking/providers/registry.ts`
- `apps/web/src/lib/tracking/providers/retry.ts`
- `apps/web/src/lib/tracking/providers/meta.ts`
- `apps/web/src/lib/tracking/providers/google.ts`
- `apps/web/src/lib/tracking/providers/tiktok.ts`
- `apps/web/src/lib/tracking/providers/snap.ts`
- `apps/web/src/lib/tracking/providers/pinterest.ts`
- `apps/web/src/lib/tracking/providers/google-ads.ts`

### B. Dépendances externes

| Système    | Provider externe       | API                              | Auth                      | Failure mode actuel               |
|------------|------------------------|----------------------------------|---------------------------|-----------------------------------|
| Chat       | OpenAI                 | /v1/chat/completions (SSE)       | Bearer key (chiffrée DB)  | Breaker in-memory 30s             |
| Chat       | Anthropic / Gemini / Mistral / DeepSeek / Qwen | adapters dédiés    | idem                      | idem                              |
| Publishing | Postiz                 | upload + draft + analytics       | API key                   | Retry 3× (service + adapter)      |
| Publishing | (futur) Meta Graph     | non implémenté                   | OAuth 2.0                 | adapter = null                    |
| Publishing | Slack (alerts)         | webhook                          | URL secrète               | Fire-and-forget, 5 s timeout      |
| Tracking   | Meta CAPI              | graph.facebook.com/v19.0/events  | access_token + pixel_id   | fetchWithRetry expo, 3×           |
| Tracking   | GA4 Measurement Protocol | google-analytics.com/mp/collect | api_secret + measurement_id | idem                            |
| Tracking   | TikTok Events API      | business-api.tiktok.com          | access-token + pixel_id   | idem                              |
| Tracking   | Snap Conversions       | adapter `snap.ts`                | access_token              | idem                              |
| Tracking   | Pinterest Conversions  | adapter `pinterest.ts`           | access_token              | idem                              |
| Tracking   | Google Ads             | client-only (gtag)               | conversion_id             | n/a (pas de CAPI)                 |

### C. KPIs de monitoring à instrumenter

**Chat** :
- `chat.first_token_ms` P50/P95/P99 par provider.
- `chat.faq_hit_rate` (events `faq_hit` / messages user).
- `chat.rag_hit_rate` (sources retournées non vides / messages user).
- `chat.breaker_open` count par provider (sur 5 min).
- `chat.rate_limit_hit` par scope.
- `chat.moderation_flagged` (une fois câblé).
- `chat.lead_form_offered` / `chat.lead_form_submitted` ratio.

**Publishing** :
- `social.publish.duration_ms` P50/P95 par platform.
- `social.publish.failed` rate par provider/error_code.
- `social.publish.attempt_count_distribution`.
- `social.scheduler.due_jobs` / `executed_jobs` par tick.
- `social.alert.sent` count.

**Tracking** :
- `tracking.dispatch.latency_ms` P50/P95 par provider.
- `tracking.dispatch.failed_rate` par provider/event_name.
- `tracking.dedup.cache_size` + `hit_rate`.
- `tracking.attribution_skip.rate` par channel.
- `tracking.bot_ua.skip_rate`.
- `tracking.consent_denied.skip_rate`.
- `tracking.serverFire.fired_rate` (une fois persisté en DB).
