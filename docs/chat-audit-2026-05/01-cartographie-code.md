# 01 — Cartographie du code

État réel du code chat au commit `779f134` (2026-05-25).

**Volumétrie globale** : **163 fichiers** code chat + **65 fichiers** `.test.ts` (~40 % coverage estimée).

## Architecture en couches

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT  (apps/web/src/components/chat/)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ ChatWidget   │  │ ChatPanel    │  │ chat-store (Zustand)     │  │
│  │ Launcher     │→ │ MessageList  │← │ - messages[]             │  │
│  │ Deferred mt. │  │ MessageBubble│  │ - language, isOpen       │  │
│  └──────────────┘  └──────────────┘  │ - isSending, leadOffer   │  │
│                                       └──────────────────────────┘  │
│  hooks: use-chat-session, use-chat-send (SSE reader), use-canned    │
└─────────────────────────────────────────────────────────────────────┘
                                ↓ POST /api/chat/message (SSE)
┌─────────────────────────────────────────────────────────────────────┐
│  API ROUTES  (apps/web/src/app/api/chat/)                           │
│  - session, message, feedback, event, theme, canned-pair            │
│  - lead/contact, lead/email, health, session/forget                 │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR  (apps/web/src/lib/chat/services/orchestrator.ts)     │
│                                                                      │
│  sanitize → detectLang → intent (regex+vector) → embed              │
│  → FAQ gateway (threshold) ──── matched ────→ stream canned, exit   │
│         │                                                            │
│         ▼ not matched                                                │
│  rateLimit (IP+session) → moderation inbound (bloquant)             │
│  charter filter inbound → RAG retrieve (topK=4)                     │
│  → load instruction + memory(12 msg) → build LLM prompt             │
│  → provider-router.choose → providerInstance.streamChat             │
│  → humanize jitter (yield chunks)                                   │
│  → charter filter outbound (advisory ⚠️)                            │
│  → moderation outbound (advisory ⚠️ post-stream)                    │
│  → lead-decision (10 règles) → maybeOfferLeadForm                   │
│  → persist message + KPI events                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PROVIDERS  (apps/web/src/lib/chat/providers/)                       │
│  Factory pattern : openai, anthropic, gemini, mistral, qwen,        │
│  deepseek, zhipu, ollama, azure-openai                              │
│  + pricing.ts (cost lookup tables)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│  DATA  (apps/web/src/lib/db/schema.ts)                              │
│  18 tables chat_* + pgvector HNSW + tsvector GIN                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Détail par couche

### 1. Services (`apps/web/src/lib/chat/services/`) — 55 fichiers / 28 tests

**Orchestration / pipeline**
- `orchestrator.ts` — pipeline complet user→assistant (le cœur du système)
- `stream.ts` — générateur SSE (`TextEncoder` + `ReadableStream`)
- `streaming-health.ts` — monitor santé (timeout, latency, token count)

**Intent**
- `intent.ts` — détection regex + score (niveau 1 ADR-001)
- `intent-vector.ts` — cosine vs centroïdes pgvector (niveau 2 ADR-001)
- `intent-recompute.ts` — recompute centroïdes hebdo
- ⚠️ Aucun fichier pour niveau 3 LLM mini (ADR-001 incomplet)

**Sécurité / qualité**
- `sanitize.ts` — redaction PII (phone, email, IBAN, CNI MA, etc.)
- `moderation.ts` — OpenAI Moderation API (input + output)
- `charter-filter.ts` — bloque queries hors charte (racisme, etc.)
- `rate-limit.ts` — IP / session / visitor (visitor jamais appelé — voir I4)

**Providers / routing**
- `provider-router.ts` — sélection + circuit breaker (memory + Redis)
- `embeddings.ts` — adapter embeddings via factory
- ⚠️ Aucun test pour `provider-router.ts` (voir I5)

**RAG (sous-dossier `rag/`)**
- `rag/loaders.ts` — URL (cheerio), MD, PDF (pdfparse), DocX (docx)
- `rag/splitter.ts` — chunks token-aware
- `rag/service.ts` — retrieval HNSW cosine
- `kb-sync.ts` — sync URLs `freshness=volatile` uniquement (pas auto-sync DB)
- ⚠️ Aucun cron `sync-products` / `sync-cities` (ADR-002 incomplet)

**Humanize**
- `humanize.ts` — jitter ms + punct pause (côté serveur, marquage tokens)

**Lead capture (10+ fichiers)**
- `lead-decision.ts` — 10 règles pour déclencher form offer
- `orchestrator-lead-capture.ts` — intégration dans pipeline
- `assistant-reply-lead-trigger.ts` — détection trigger dans réponse LLM
- `lead-webhook.ts` — délégation webhook outbound
- `lead-alerts.ts` — Slack notify
- `lead-sla.ts` — tracking hand-off / résolution
- `frustration-alerts.ts` — détecte 2 user msg frustrés consécutifs
- `phone-detect.ts` — regex phone (inline-contact trigger)

**Canned pairs**
- `canned-pair-service.ts` — sélection visible (page pattern, audience)

**Admin / billing / autres**
- `care-overview.ts` — dashboard care queue
- `ab-engine.ts` — assign A/B variant
- `analytics-funnel.ts` — agrégats KPI funnel
- `weekly-digest.ts` — cron résumé semaine
- `slack-notify.ts` — Slack blocks
- `budget-watch.ts` — cron horaire désactive provider en dépassement
- `billing.ts` — calcul coût message (avec `assertBudget` jamais appelée — C4)
- `session-service.ts` — create/fetch/forget + `attributeConversion` dead code (I1)
- `auth-cron.ts` — refresh API keys vault
- `visitor-cookie.ts` — persistence visitor_id

### 2. Providers (`apps/web/src/lib/chat/providers/`) — 9 fichiers / 1 test

| Provider | Fichier | Stream | Embeddings | Moderation |
|----------|---------|--------|-----------|------------|
| OpenAI | `openai.ts` | ✅ | ✅ | ✅ |
| Anthropic | `anthropic.ts` | ✅ | — | — |
| Google Gemini | `gemini.ts` | ✅ | ✅ | — |
| Mistral | `mistral.ts` | ✅ | — | — |
| Alibaba Qwen | `qwen.ts` | ✅ | — | — |
| DeepSeek | `deepseek.ts` | ✅ | — | — |
| Zhipu (ChatGLM) | `zhipu.ts` | ✅ | — | — |
| Ollama (local) | `ollama.ts` | ✅ | ✅ | — |
| Azure OpenAI | `azure-openai.ts` | ✅ | ✅ | — |

**Tests** : `openai.test.ts` uniquement (les 8 autres providers sans test unitaire — risque
régression).

Pattern : `factory.ts` instancie selon `kind`, type unifié `ChatProvider` dans `types.ts`.
Pricing dans `pricing.ts` (lookup table EUR par modèle).

⚠️ `types.ts` n'expose **aucun** champ `tools[]` dans `ChatStreamRequest` (ADR-002 absent).

### 3. Repositories (`apps/web/src/lib/chat/repos/`) — 15 fichiers / 4 tests

| Repo | Tables | Tests |
|------|--------|-------|
| `session.ts` | `chat_session` | — |
| `message.ts` | `chat_message` (tsvector full-text) | — |
| `lead.ts` | `chat_lead` + dedup logic | ✅ |
| `lead-dedup.ts` | identity_hash + composite unique | ✅ |
| `event.ts` | `chat_conversation_event` append-only | — |
| `provider.ts` | `chat_provider_config` + breaker state | — |
| `instruction.ts` | `chat_instruction_version` | — |
| `intent.ts` | `chat_intent_centroid` | — |
| `knowledge.ts` | `chat_knowledge_source` / `_chunk` / `_embedding` | — |
| `faq.ts` | `chat_faq_entry` HNSW retrieval | — |
| `canned-pair.ts` | `chat_canned_pair` + versions | — |
| `identity-hash.ts` | SHA256 phone+firstName | ✅ |

### 4. Composants UI (`apps/web/src/components/chat/`) — 34 fichiers / 14 tests

**Wrapper / launchers**
- `ChatWidget.tsx`, `ChatWidgetDeferred.tsx` (lazy), `ChatWidgetMount.tsx` (portal)
- `ChatLauncher.tsx` + tests mobile (`ChatLauncher.mobile.test.tsx`)

**Panel principal**
- `ChatPanel.tsx`, `ChatHeader.tsx`, `MessageList.tsx` (virtualisé), `MessageBubble.tsx`,
  `ChatComposer.tsx`

**Lead form (sous-dossier)**
- `LeadFormBubble.tsx`, `lead-form-flow.tsx`, `lead-form-copy.ts` (FR/AR/AR-MA),
  `lead-prefill.ts`, `assistant-reply-lead-trigger.client.ts`

**Hooks**
- `use-chat-session.ts`, `use-chat-send.ts` (SSE), `use-canned-pair.ts`, `use-visual-viewport.ts`

**Store / utilities**
- `chat-store.ts` (Zustand : messages, language, isOpen, isSending, leadOffer)
- `sse-reader.ts` (POST + EventSource-like)
- `humanize.client.ts` (jitter + punct pause côté client)

### 5. API Routes (`apps/web/src/app/api/chat/`) — 13 fichiers / 3 tests

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/chat/session` | POST | Crée session (visitor_id, lang, utm) |
| `/api/chat/session/forget` | POST | RGPD purge messages |
| `/api/chat/message` | POST | SSE stream (orchestrator) |
| `/api/chat/health` | GET | Check providers, DB, cache |
| `/api/chat/feedback` | POST | Thumbs up/down |
| `/api/chat/event` | POST | Log KPI event |
| `/api/chat/theme` | GET | Fetch active preset |
| `/api/chat/canned-pair` | GET | Fetch suggestions |
| `/api/chat/lead/contact` | POST | Capture lead + webhook |
| `/api/chat/lead/email` | POST | Email verification |

**Streaming** : SSE via `TextEncoder` + `ReadableStream` (pas WebSocket, pas long-polling).

### 6. Admin UI (`apps/web/src/app/admin/chat/`) — 25 fichiers / 0 test

Pages list :
- `page.tsx` — overview
- `conversations/` (list + detail)
- `leads/` (list, BUT pas d'édition outcome — dette 1.2 audit 2026-05-17)
- `care/`
- `analytics/`, `audit/`, `kpis/`
- `providers/` (list + new + delete)
- `instructions/` (versions, new, detail)
- `faq/` (list, new, edit)
- `suggestions/` (canned pairs : list, new, edit)
- `sources/` (knowledge sources : list, new)
- `themes/` (presets)
- `system/` (toggle chat_enabled)
- `lang/` (stats détection langue)

⚠️ **0 test sur admin UI** — toute régression silencieuse.

### 7. Schema DB (`apps/web/src/lib/db/schema.ts`) — 18 tables chat_*

| Table | Rôle | Présent |
|-------|------|---------|
| `chat_session` | Sessions visiteur, conversion tracking, AB variant | ✅ |
| `chat_message` | Messages user/assistant, tokens, latency, modération, cost | ✅ |
| `chat_instruction_version` | Versions immuables prompt système | ✅ |
| `chat_theme_preset` | Tokens design, layout, motion, salutations | ✅ |
| `chat_provider_config` | Configs LLM chiffrées + quota mensuel | ✅ |
| `chat_knowledge_source` | Sources URL/MD/PDF/DocX/FAQ/snippet | ✅ |
| `chat_knowledge_chunk` | Chunks texte (ordinal, hash, tokens) | ✅ |
| `chat_knowledge_embedding` | pgvector HNSW 1536 dim | ✅ |
| `chat_conversation_event` | 27 event types append-only | ✅ |
| `chat_feedback` | Thumbs up/down par message | ✅ |
| `chat_rate_limit_bucket` | Rate limiting IP/session/visitor | ✅ |
| `chat_runtime_setting` | Toggles runtime (chat_enabled) | ✅ |
| `chat_lead` | Captures contact in-chat + funnel | ✅ |
| `chat_intent_centroid` | Vecteurs agrégés intent (cascade niveau 2) | ✅ |
| `chat_intent_example` | Dataset phrases labellisées | ✅ |
| `chat_canned_pair` | Q&A scriptées + suggestions pills | ✅ |
| `chat_canned_pair_version` | Historique immutable versions | ✅ |
| `chat_faq_entry` | FAQ + embedding question | ✅ |

**Manquants vs ADRs** :
- ❌ `chat_tool_call_log` (ADR-002 — tools framework)
- ❌ `chat_knowledge_origin` (ADR-002 — trace KB sync DB→source)

### 8. Feature flags (`apps/web/src/lib/feature-flags/`)

- `live-systems.ts` — MODERATION_ENABLED, REDIS_CIRCUIT_BREAKER_ENABLED
- Flags chat définis inline dans `chat/feature-flag.ts`

⚠️ Flag `CHAT_INTENT_USE_LLM_FALLBACK` mentionné dans ADR-001 : **absent**.

## Patterns identifiés

### ✅ Patterns sains
- **Append-only KPI events** (`chat_conversation_event`) — audit-friendly, replay possible
- **Provider abstraction** via factory + interface unifiée (extension simple)
- **Multilingue first-class** : colonnes `*_fr` / `*_ar` / `*_ar_ma` dans tables
- **PII redaction au seuil entrée** (`sanitize.ts` avant persist)
- **Streaming SSE natif** Web standard (vs WebSocket dont la maintenance est plus lourde)
- **Tests vitest** pour logique métier critique (intent, lead-decision, charter)

### ⚠️ Anti-patterns observés
- **Pipeline orchestrator monolithique** (~700 lignes dans `orchestrator.ts`) — difficile à
  faire évoluer sans régression
- **Async fire-and-forget** sur état partagé (breaker Redis — voir C6)
- **Modération outbound non bloquante** — toxique livré au client (C2)
- **Dead code laissé en place** (`attributeConversion`, `_unusedTypeKeeper`)
- **Tests qui mockent tout** — l'orchestrator.test.ts ne teste pas l'intégration réelle
- **Threshold default DB / commentaire code en contradiction** (0.85 vs 0.60 — I3)
- **Aucun test sur admin UI** (25 pages sans test)

## Synthèse cartographie

| Métrique | Valeur |
|----------|--------|
| Fichiers code | 163 |
| Fichiers test | 65 (~40 % coverage) |
| Lignes code estimées | ~12 000 (orchestrator seul ~700) |
| Tables DB | 18 chat_* |
| Routes API | 13 |
| Pages admin | 25 |
| Providers LLM intégrés | 9 |
| ADRs cibles | 4 (1 OK, 2 partiels, 1 absent — voir 03) |
