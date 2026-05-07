# 17 — État d'implémentation (CHA-001 → CHA-150)

> Snapshot de la livraison. Mis à jour à la fin de chaque PR. Voir
> aussi `15-plan-action.md` (cible) et `16-runbook.md` (ops).

---

## Phase 0 — Foundations (CHA-001 → CHA-010) ✅

- Feature flag `CHAT_ENABLED` + `assertChatEnabled()`
- Variables d'environnement validées (`env.ts`)
- CSP étendue `connect-src` providers + `/api/chat/*`
- Schéma Drizzle initial chargé

## Phase 1 — Data layer & providers (CHA-011 → CHA-028) ✅

- 11 tables Drizzle (sessions, messages, events, feedback, sources,
  chunks, embeddings, instructions, providers, themes, rate-limit)
- Index pgvector HNSW dim=1536, GIN tsvector full-text
- AES-256-GCM secrets pour les clés provider (`secrets.ts`)
- Adapters LangChain : OpenAI, Gemini, Anthropic, Mistral, Ollama
- Routeur multi-provider avec circuit breaker + fallback

## Phase 2 — Backend pipeline (CHA-029 → CHA-052) ✅

- `/api/chat/session` (open/close), `/api/chat/message` (SSE),
  `/api/chat/feedback`, `/api/chat/lead/email`, `/api/chat/theme`
- Sanitize + redaction PII (email/phone-FR/MA/IBAN/CB/CNI/postal)
- Charter filter inbound + outbound (jailbreak, médical, marques tierces,
  prix, profanité)
- `intent.detect` 8 intents
- `humanize` server config + cadenceur client
- Rate limit 60 IP / 30 session / 90 visitor (token bucket DB)
- Cron purge 90j archive + 365j anonymise + reset compteurs mensuels
- Billing assertBudget pré-call

## Phase 3 — Visitor widget (CHA-053 → CHA-074) ✅

- ChatLauncher, ChatPanel, ChatComposer, MessageList, MessageBubble
- ChatWidgetMount monte sur la home et persiste la position
- Store Zustand `chat-store.ts` avec persist localStorage
- SSE reader streaming → store → MessageBubble

## Phase 4 — Multilingual & humanization (CHA-075 → CHA-086) ✅

- Dictionnaire darija FR + AR + MSA (versionné `2026-05-06`)
- `detectLanguage` heuristique (≥3 char arabe → ar, ≥2 darija → ar-MA)
- Cadenceur cadenced humanizeStream avec jitter + punct + min typing
- RTL bascule via `dir="rtl"` quand language=`ar`

## Phase 5 — RAG knowledge (CHA-087 → CHA-102) ✅

- Loaders : URL (HTML cleaned), Markdown, FAQ, PDF (pdfjs-dist), DOCX (mammoth)
- Splitter section-aware H1-H3 + RecursiveCharacterTextSplitter
- Repos : `sourceRepo`, `chunkRepo`, `embeddingRepo`
- `ragService.ingest` idempotent (SHA-256 raw_hash)
- `ragService.retrieve` cosine + rerank heuristique
- Sources rendered dans `<SourcesPopover>` sous chaque réponse

## Phase 6 — Admin console (CHA-103 → CHA-130) ✅

- Sous-nav 10 sections (overview, conversations, kpis, instructions,
  sources, providers, themes, lang, audit, system)
- Vue d'ensemble avec 8 KPIs (sessions, messages user/agent, conversions,
  feedback ±, coût, latence p50/p95)
- Liste conversations + recherche full-text
- Detail conversation avec event log
- KPIs avec fenêtres (today/yesterday/7d/30d/90d/all)
- Instructions list + create + activate (`revalidateTag('chat-config')`)
- Sources list + create (synchronous ingest)
- Providers list (avec quota/consumed/breaker)
- Themes list (tokens JSON pretty-print)
- Page Langues (dictionnaires read-only)
- Page Audit (200 events filtrés par type)
- Export CSV/JSON conversations + KPIs
- Auth gate `requireAdminApi()` sur tous les `/api/admin/chat/*`

## Phase 7 — System visualizer (CHA-131 → CHA-138) ✅

- `<PipelineGraph>` SVG 8 nœuds + `<animateMotion>` sur edges
- `<SystemDashboard>` client component avec providers + knowledge cards
- SSE `/api/admin/chat/visualisation/stream` (poll DB events)
- Replay `/api/admin/chat/visualisation/replay?sessionId=...`
- Export `/api/admin/chat/visualisation/export?format=svg|mermaid`
- Toggle Live ↔ Replay dans le dashboard

## Phase 8 — Security/QA/perf/doc (CHA-139 → CHA-150) ✅

- Tests unitaires : `feature-flag`, `secrets`, `sanitize`, `detect`,
  `charter-filter` (anti-prompt-injection), `intent`, `humanize`,
  `humanize.client`
- E2E Playwright : visiteur (`chat-visitor.spec.ts`) FR + Darija + AR ;
  admin (`chat-admin.spec.ts`) avec sous-nav + system + instruction
- Charge k6 : `chat-message.js` (10 RPS nominal + 50 RPS burst)
- Doc à jour (`17-implementation-status.md`, addendum runbook)

## Phase 9 — Stratégie éditoriale & capture leads (CHA-160 → CHA-247) 🚧

> Plan complet : [`15-plan-action.md` §17](15-plan-action.md#17-phase-9--stratégie-éditoriale--capture-leads-cha-160--cha-247).
> Stratégie : [`18-instructions-knowledge-strategy.md`](18-instructions-knowledge-strategy.md).
> Spec lead form : [`19-lead-capture-form.md`](19-lead-capture-form.md).

### Phase 9.A — Data & backend lead

- [x] CHA-200 — Schéma Drizzle `chat_lead` + migration
- [x] CHA-201 — Repo `leadRepo`
- [x] CHA-202 — Helper `lib/phone.ts` (libphonenumber-js)
- [x] CHA-203 — Étendre enum `chat_conversation_event.type`
- [x] CHA-204 — Contrat Zod `chatLeadContactInput`
- [x] CHA-205 — Route POST `/api/chat/lead/contact`
- [x] CHA-206 — Service `lead-webhook.ts` (HMAC + retry)
- [x] CHA-207 — Service `lead-decision.ts` (7 triggers)
- [x] CHA-208 — Branchement orchestrator → SSE `lead-form-offer`

### Phase 9.B — Frontend lead

- [x] CHA-210 — `LeadFormBubble.tsx`
- [x] CHA-211 — `lead-form-copy.ts`
- [x] CHA-212 — Store Zustand `leadOffer`
- [x] CHA-213 — SSE handler `lead-form-offer`
- [x] CHA-214 — Intégration `MessageList`
- [ ] CHA-215 — Stories Storybook 9 états
- [ ] CHA-216 — Tests jest-axe a11y

### Phase 9.C — Tracking

- [x] CHA-220 — 13 events au catalogue (+ enum DB)
- [x] CHA-221 — Instrumentation widget (open/close/sent/received/complete)
- [x] CHA-222 — Instrumentation `LeadFormBubble`
- [ ] CHA-223 — Meta CAPI server-side `generate_lead`
- [ ] CHA-224 — Tests datalayer e2e

### Phase 9.0 — Éditorial

- [x] CHA-160 — 13 sources KB P0 — squelette posé, contenu produit à compléter
- [x] CHA-161 — Extension `intent.ts` (8 nouveaux intents) + tests
- [x] CHA-162 — Instruction `default` v2 FR/AR/AR-MA — script `seed-chat-instructions-v2.ts`
- [x] CHA-163 — `parameters.maxTokens=220` câblé via `chat_provider_config.parameters`
- [ ] CHA-164 — Ingestion KB en sandbox + prod (manuel admin)
- [x] CHA-165 — `shouldOfferLeadForm`
- [x] CHA-166 — Event `chat_lead_form_offered`
- [ ] CHA-167 — KPI éditoriaux dashboard
- [ ] CHA-168 — Runner `pnpm chat:scenarios`
- [ ] CHA-169 — Diff doc multilingue v1→v2

### Phase 9.D — Admin & analyse — backlog

### Phase 9.E — Sécurité & qualité

- [x] CHA-240 — Rate-limit endpoint lead
- [x] CHA-241 — Honeypot frontend + check serveur
- [ ] CHA-242 — Cron purge RGPD
- [ ] CHA-243 — Bouton admin « Oublier ce lead »
- [ ] CHA-244..247 — Tests Playwright e2e + a11y final

## Travaux à reprendre (V2)

- Storybook stories pour chacun des composants (CHA-073, CHA-128)
- Édition d'instructions multi-version diff (CHA-110)
- Édition theme preset complète (CHA-119) — actuellement read-only
- Tests Lighthouse CI + `size-limit` budget JS (CHA-144, CHA-145)
- Audit a11y axe-core complet (CHA-146)
- Pénétration test (CHA-147) — externalisé
- Visual regression Chromatic (CHA-142)
