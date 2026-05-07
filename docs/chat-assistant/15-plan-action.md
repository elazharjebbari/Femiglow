# 15 — Plan d'action

> *Phases, tâches atomiques `CHA-001` → `CHA-150`*

---

## 1. Vue d'ensemble

8 phases séquentielles, ~150 tâches atomiques, ~7 semaines pour
une équipe de 2-3 personnes (1 fullstack senior + 1 frontend +
0.5 design).

```
P0 — Fondations           S1       (10 tâches)
P1 — Données & providers  S1-S2    (18 tâches)
P2 — Pipeline backend     S2-S3    (24 tâches)
P3 — Widget visiteur      S3-S4    (22 tâches)
P4 — Multilingue & humanisation  S4 (12 tâches)
P5 — RAG & connaissance   S4-S5    (16 tâches)
P6 — Console admin        S5-S6    (28 tâches)
P7 — Visualisation système S6      (8 tâches)
P8 — Sécurité, qualité, perf, doc S7 (12 tâches)
```

Chaque ticket : `CHA-XXX`, format `<verbe> <objet> [scope]`.
DoD systématique : tests verts, code review, doc à jour.

## 2. Phase 0 — Fondations (S1)

| ID         | Sujet                                                    | Estim |
| ---------- | -------------------------------------------------------- | ----- |
| CHA-001    | Créer feature flag `chat.enabled`                        | 0.5 j |
| CHA-002    | Ajouter dépendances LangChain JS (`@langchain/core`, `@langchain/openai`, `@langchain/google-genai`, `@langchain/anthropic`, `@langchain/mistralai`, `@langchain/ollama`, `@langchain/textsplitters`) | 0.5 j |
| CHA-003    | Configurer `pgvector` dans Drizzle (extension + custom type) | 0.5 j |
| CHA-004    | Créer scripts `seed:chat-instructions`, `seed:chat-themes`, `seed:chat-providers` | 0.5 j |
| CHA-005    | Étendre `lib/observability` avec spans chat              | 0.5 j |
| CHA-006    | Étendre logger avec redact chat                          | 0.25 j |
| CHA-007    | Extension CSP nonce pour widget                          | 0.5 j |
| CHA-008    | Module `lib/chat/secrets.ts` (chiffrement AES-GCM)       | 0.5 j |
| CHA-009    | Charte ESLint chat (interdire `dangerouslySetInnerHTML`, etc.) | 0.25 j |
| CHA-010    | Branche dédiée Storybook (`stories/chat`)                | 0.25 j |

DoD Phase 0 : `pnpm dev` lance sans erreur ; `pnpm typecheck` OK ;
extension Postgres `vector` détectée.

## 3. Phase 1 — Données & providers (S1-S2)

| ID         | Sujet                                                                  | Estim |
| ---------- | ---------------------------------------------------------------------- | ----- |
| CHA-011    | Schémas Drizzle `chat_session`, `chat_message`                         | 1 j   |
| CHA-012    | Schémas `chat_knowledge_source`, `chat_knowledge_chunk`, `chat_knowledge_embedding` | 1 j   |
| CHA-013    | Schémas `chat_provider_config` (chiffrement clés)                       | 0.5 j |
| CHA-014    | Schémas `chat_instruction_version`, `chat_theme_preset`                | 0.5 j |
| CHA-015    | Schémas `chat_conversation_event`, `chat_feedback`, `chat_rate_limit_bucket` | 0.5 j |
| CHA-016    | Migrations + seeds                                                     | 0.5 j |
| CHA-017    | Vue matérialisée `chat_kpi_window`                                     | 0.5 j |
| CHA-018    | Repos Drizzle (`messageRepo`, `sessionRepo`, etc.)                     | 1 j   |
| CHA-019    | Contrats Zod publics et admin (`lib/chat/contracts.ts`)                | 0.5 j |
| CHA-020    | Interface `ChatProvider` (lib/chat/providers/types.ts)                  | 0.25 j |
| CHA-021    | Adapter OpenAI                                                          | 1 j   |
| CHA-022    | Adapter Gemini                                                          | 1 j   |
| CHA-023    | Adapter Anthropic                                                       | 0.75 j |
| CHA-024    | Adapter Mistral                                                         | 0.5 j |
| CHA-025    | Adapter OpenAI-compatible (Qwen, DeepSeek, Zhipu)                       | 1 j   |
| CHA-026    | Adapter Ollama                                                          | 0.5 j |
| CHA-027    | Adapter Azure OpenAI                                                    | 0.5 j |
| CHA-028    | Fabrique `instantiateProvider`, `factory.ts`                            | 0.25 j |

DoD Phase 1 : `db:push` produit toutes les tables ; un test
unitaire instancie chaque provider sans erreur (mocks MSW).

## 4. Phase 2 — Pipeline backend (S2-S3)

| ID         | Sujet                                                                            | Estim |
| ---------- | -------------------------------------------------------------------------------- | ----- |
| CHA-029    | Service `sessionService` (getOrCreate, snapshot, attribute, forget)              | 1 j   |
| CHA-030    | Service `memoryService` (sliding window 12 + summarize)                          | 0.5 j |
| CHA-031    | Service `sanitize` + `redactPii`                                                 | 0.5 j |
| CHA-032    | Service `lang.detect` (heuristique + dictionary)                                 | 0.5 j |
| CHA-033    | Service `moderation` (in / out, providers + heuristique)                         | 1 j   |
| CHA-034    | Service `charterFilter`                                                          | 0.5 j |
| CHA-035    | Service `intent.detect` (heuristique)                                            | 0.5 j |
| CHA-036    | Service `humanize` (côté serveur events + client cadence)                        | 0.5 j |
| CHA-037    | Service `providerRouter` + `circuitBreaker` + `quota`                            | 1 j   |
| CHA-038    | Service `billing` + tarifs                                                       | 0.5 j |
| CHA-039    | Service `events` (datalayer + DB `chat_conversation_event`)                      | 0.5 j |
| CHA-040    | Helper SSE `streamSSE`                                                           | 0.25 j |
| CHA-041    | Orchestrator `streamReply` (LangChain `RunnableSequence`)                        | 1.5 j |
| CHA-042    | Route `GET /api/chat/session`                                                    | 0.5 j |
| CHA-043    | Route `POST /api/chat/session/refresh`                                           | 0.25 j |
| CHA-044    | Route `POST /api/chat/message` (SSE)                                             | 1 j   |
| CHA-045    | Route `POST /api/chat/feedback`                                                  | 0.25 j |
| CHA-046    | Route `POST /api/chat/lead/email` (opt-in reprise)                               | 0.5 j |
| CHA-047    | Route `POST /api/chat/event`                                                     | 0.25 j |
| CHA-048    | Route `GET /api/chat/theme`                                                      | 0.25 j |
| CHA-049    | Middlewares (rate-limit, auth, audit)                                            | 0.75 j |
| CHA-050    | Crons Vercel (purge, refresh KPI, reindex)                                       | 0.5 j |
| CHA-051    | Tests unit services                                                              | 1 j   |
| CHA-052    | Tests integration MSW (orchestrator)                                             | 1 j   |

DoD Phase 2 : `curl -N` sur `/api/chat/message` produit des
events SSE réels avec un provider mocké.

## 5. Phase 3 — Widget visiteur (S3-S4)

| ID         | Sujet                                                  | Estim |
| ---------- | ------------------------------------------------------ | ----- |
| CHA-053    | Tokens & thèmes CSS variables (preset par défaut)      | 0.5 j |
| CHA-054    | Composant `ChatLauncher`                               | 0.75 j |
| CHA-055    | Composant `ChatPanel` desktop                          | 1 j   |
| CHA-056    | Composant `ChatPanel` mobile (full screen)             | 0.75 j |
| CHA-057    | Composant `ChatHeader`                                 | 0.25 j |
| CHA-058    | Composant `MessageList` + virtualisation               | 0.75 j |
| CHA-059    | Composant `MessageBubble` (rôles + sources popover)    | 0.5 j |
| CHA-060    | Composant `TypingIndicator`                            | 0.25 j |
| CHA-061    | Composant `ChatComposer` (textarea + enter handlers)   | 0.5 j |
| CHA-062    | Composant `SuggestionsRail`                            | 0.25 j |
| CHA-063    | Composant `EmptyState` (salutation contextuelle)       | 0.25 j |
| CHA-064    | Composant `ChatMarkdown` (sanitize allowlist)          | 0.5 j |
| CHA-065    | Store Zustand `chatStore`                              | 1 j   |
| CHA-066    | Hooks `use-chat-*`                                     | 0.5 j |
| CHA-067    | Persistance `localStorage` + `sessionStorage`          | 0.25 j |
| CHA-068    | Lecteur SSE client                                     | 0.5 j |
| CHA-069    | Animations framer-motion (panel, bulles)               | 0.5 j |
| CHA-070    | A11y (focus trap optionnel, aria-live, raccourcis)     | 0.75 j |
| CHA-071    | RTL (logique direction selon `language`)               | 0.5 j |
| CHA-072    | Page-context (salutation par page, time window)        | 0.5 j |
| CHA-073    | Stories Storybook (all components)                     | 1 j   |
| CHA-074    | Tests unitaires composants + jest-axe                  | 1 j   |

DoD Phase 3 : sur `/`, je peux ouvrir, écrire, recevoir, fermer ;
sans CLS visible ; clavier total OK.

## 6. Phase 4 — Multilingue & humanisation (S4)

| ID         | Sujet                                                              | Estim |
| ---------- | ------------------------------------------------------------------ | ----- |
| CHA-075    | Dictionnaire darija FR-script + AR-script (versionné)              | 0.5 j |
| CHA-076    | Détection langue côté client (mirror serveur)                      | 0.25 j |
| CHA-077    | Bascule RTL automatique avec annonce système                       | 0.5 j |
| CHA-078    | Cadenceur `humanize.client.ts` (jitter, pauses ponctuation)        | 0.75 j |
| CHA-079    | Voyant typing avec délai minimum 600 ms                            | 0.25 j |
| CHA-080    | Salutations contextuelles (preset + page)                          | 0.5 j |
| CHA-081    | Polices arabes (preload `IBM Plex Sans Arabic` à la demande)       | 0.25 j |
| CHA-082    | Tests langue (matrice 14 cas)                                      | 0.5 j |
| CHA-083    | Tests humanisation (durée minimum, pauses)                         | 0.25 j |
| CHA-084    | Réglage admin de la cadence dans `theme.motion`                    | 0.5 j |
| CHA-085    | Code-switching FR/AR/Darija (instruction prompt)                   | 0.25 j |
| CHA-086    | Annexe prompts par langue (`annexes/prompts-systeme.md`) intégrée  | 0.25 j |

DoD Phase 4 : 14 cas langue passent verts ; chargement police arabe
< 200 ms après bascule.

## 7. Phase 5 — RAG & connaissance (S4-S5)

| ID         | Sujet                                                       | Estim |
| ---------- | ----------------------------------------------------------- | ----- |
| CHA-087    | Loader `url` (fetch + html→md)                              | 0.5 j |
| CHA-088    | Loader `markdown`, `snippet`, `faq`                         | 0.5 j |
| CHA-089    | Loader `pdf` (pdfjs-dist)                                   | 0.5 j |
| CHA-090    | Loader `docx` (mammoth)                                     | 0.5 j |
| CHA-091    | Splitter (recursive char + semantic)                        | 0.5 j |
| CHA-092    | Cleaner HTML (drop nav/footer)                              | 0.5 j |
| CHA-093    | Pipeline ingestion + idempotence (hash)                     | 1 j   |
| CHA-094    | Repository `chat_knowledge_chunk` + `chat_knowledge_embedding` | 0.25 j |
| CHA-095    | Search vector pgvector (HNSW + seuils)                      | 0.75 j |
| CHA-096    | Re-rank heuristique (cosine + lang + freshness + keyword)   | 0.5 j |
| CHA-097    | Service `ragService.retrieve`                               | 0.5 j |
| CHA-098    | Service `ragService.ingest` (job queue Vercel)              | 0.5 j |
| CHA-099    | Reindex global (cron mensuel)                               | 0.5 j |
| CHA-100    | Audit qualité (gold questions, hit@k)                       | 0.5 j |
| CHA-101    | Tests unit splitter / rerank                                | 0.5 j |
| CHA-102    | Tests integration ingest + retrieve                         | 0.5 j |

DoD Phase 5 : `pnpm tsx scripts/chat-rag-demo.ts ./fixtures/page-kit.md`
ingère et retourne 4-6 chunks pertinents pour 5 questions
exemples.

## 8. Phase 6 — Console admin (S5-S6)

| ID         | Sujet                                                | Estim |
| ---------- | ---------------------------------------------------- | ----- |
| CHA-103    | Layout `/admin/chat`                                  | 0.5 j |
| CHA-104    | Page Vue d'ensemble (cartes KPIs)                    | 1 j   |
| CHA-105    | Page Conversations — liste + filtres                  | 1 j   |
| CHA-106    | Page Conversations — recherche plein texte            | 0.75 j |
| CHA-107    | Page Conversations — détail (messages + sources + actions) | 1 j   |
| CHA-108    | Page KPIs — toutes sections, sélecteur fenêtre        | 1.5 j |
| CHA-109    | Page Instructions — liste + édition + diff           | 1 j   |
| CHA-110    | Page Instructions — sandbox de test                  | 0.5 j |
| CHA-111    | Page Instructions — activation + audit               | 0.5 j |
| CHA-112    | Page Sources — liste + filtres                        | 0.5 j |
| CHA-113    | Page Sources — édition + ingestion live              | 1 j   |
| CHA-114    | Page Sources — inspection chunks                      | 0.5 j |
| CHA-115    | Page Providers — liste + état                         | 0.5 j |
| CHA-116    | Page Providers — édition (clé masquée + test)         | 1 j   |
| CHA-117    | Page Providers — politique de fallback (graphique)    | 0.5 j |
| CHA-118    | Page Themes — édition + aperçu live                   | 1.5 j |
| CHA-119    | Page Themes — gestion salutations / suggestions       | 0.5 j |
| CHA-120    | Page Lang dictionaries — édition versionnée           | 0.5 j |
| CHA-121    | Page Audit — filtres + export                         | 0.5 j |
| CHA-122    | Page Experiments (V2 stub)                            | 0.5 j |
| CHA-123    | Routes `/api/admin/chat/*`                            | 1 j   |
| CHA-124    | Permissions RBAC                                      | 0.5 j |
| CHA-125    | Audit log middleware                                  | 0.25 j |
| CHA-126    | Export CSV / JSON                                     | 0.5 j |
| CHA-127    | Hot reload `revalidateTag('chat-config')`             | 0.25 j |
| CHA-128    | Stories Storybook admin (tables, panneaux)            | 0.5 j |
| CHA-129    | Tests unit admin (routes + permissions)               | 1 j   |
| CHA-130    | Tests E2E admin (3 scénarios majeurs)                 | 1 j   |

DoD Phase 6 : un admin peut piloter complètement le chat sans
toucher au code.

## 9. Phase 7 — Visualisation système (S6)

| ID         | Sujet                                                         | Estim |
| ---------- | ------------------------------------------------------------- | ----- |
| CHA-131    | Composant `<PipelineGraph>` SVG                                | 1 j   |
| CHA-132    | Composant `<PipelineNode>` + `<PipelineEdge>` + pulses         | 0.5 j |
| CHA-133    | Composant `<ProviderHealthCard>`                               | 0.5 j |
| CHA-134    | Composant `<KnowledgeMapCard>`                                 | 0.5 j |
| CHA-135    | SSE `/api/admin/chat/visualisation/stream`                     | 1 j   |
| CHA-136    | Mode replay (depuis traces OTel + logs)                        | 1 j   |
| CHA-137    | Mode coulisses public (panneau simplifié 6 étapes)             | 0.75 j |
| CHA-138    | Export PNG / SVG / Mermaid                                     | 0.5 j |

DoD Phase 7 : pulse animé visible en live entre nœuds, replay
fluide, mode coulisses sans fuite.

## 10. Phase 8 — Sécurité, qualité, perf, doc (S7)

| ID         | Sujet                                                       | Estim |
| ---------- | ----------------------------------------------------------- | ----- |
| CHA-139    | Tests sécurité (prompt injection suite, PII, fuite système) | 1 j   |
| CHA-140    | Tests E2E visiteur FR / AR / Darija / RTL / rate-limit      | 1 j   |
| CHA-141    | Tests E2E admin (instructions, conversations, providers, system) | 1 j   |
| CHA-142    | Tests régression visuelle Storybook                         | 0.5 j |
| CHA-143    | Tests charge k6 (burst + soak)                              | 0.5 j |
| CHA-144    | Lighthouse CI : pas de régression `/`, `/kit`               | 0.5 j |
| CHA-145    | Bundle audit `size-limit` (35 kB)                           | 0.25 j |
| CHA-146    | Audit accessibilité manuel (NVDA + VoiceOver)               | 0.5 j |
| CHA-147    | Pénétration test interne (prompt injection, data leakage)   | 0.5 j |
| CHA-148    | Mise à jour documentation (chap. 16 runbook)                | 0.5 j |
| CHA-149    | Préparation politique confidentialité (chap. dédié chat)    | 0.5 j |
| CHA-150    | Plan post-launch (KPIs à monitorer, owner, fréquence)       | 0.25 j |

DoD Phase 8 : tous tests verts, audit RGPD signé, runbook validé,
go / no-go.

## 11. Dépendances inter-tâches

```
CHA-002 → CHA-021..028
CHA-011..018 → CHA-029..049
CHA-019..028 → CHA-041 (orchestrator)
CHA-029..050 → CHA-052
CHA-053..074 → CHA-130 (E2E)
CHA-075..086 → CHA-140 (E2E darija)
CHA-087..102 → CHA-097 (RAG live)
CHA-103..130 → CHA-141 (E2E admin)
CHA-131..138 → CHA-141 (E2E system)
CHA-139..150 → release-candidate
```

## 12. Profil de l'équipe

| Rôle                    | Charge       |
| ----------------------- | ------------ |
| Tech lead full stack    | 7 sem × 100 % |
| Frontend / UX dev       | 5 sem × 100 % |
| Designer (Figma + token) | 2 sem × 50 % |
| Product / Édito (charte, salutations, prompts) | 1.5 sem × 50 % |
| QA / sécurité           | 1.5 sem × 100 % |

## 13. Jalons

| Jalon                            | Date cible (S = sprint) |
| -------------------------------- | ----------------------- |
| Démo backend (provider + RAG)    | fin S3                  |
| Démo widget visiteur (FR seul)   | fin S4                  |
| Démo widget visiteur multi-langue | fin S5                  |
| Démo console admin complète      | fin S6                  |
| Démo visualisation système       | fin S6                  |
| RC interne                       | mi-S7                   |
| Go / No-Go production            | fin S7                  |

## 14. Risques projet

| Risque                                       | Mitigation                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| LangChain JS breaking change                 | Lock version, abstraire derrière `lib/chat/orchestrator.ts`                                 |
| pgvector indispo sur la version de Neon      | Vérifier en P0 ; alternative : `Qdrant` géré ou `Chroma` léger                              |
| Retards édition prompts FR/AR/Darija         | Embarquer Product/Édito dès S2, pas en fin de chantier                                      |
| Coût providers en preview                    | Ollama local sur preview, pas d'OpenAI pour les tests automatisés                           |
| Perf widget en mobile bas-de-gamme           | Bundle audit hebdomadaire, lazy import strict                                               |
| Drift charte                                 | Snapshot Storybook + revue éditoriale hebdo                                                 |

## 15. Définition de Done globale

Le système est livrable lorsque :

- Tous les tickets CHA-001 à CHA-150 sont en `done` ;
- Les KPIs `00-cahier-des-charges.md §8` sont vérifiés sur preview ;
- L'audit RGPD interne est signé ;
- Le runbook est complet et testé ;
- Le coût provider mensuel projeté est sous budget ;
- Aucune régression Lighthouse sur les pages publiques.

## 16. Lecture suivante

- [16 — Runbook](16-runbook.md) pour les opérations courantes.
- [12 — Tests](12-tests.md) pour les scénarios à valider.
- [00 — Cahier des charges](00-cahier-des-charges.md) §8 pour les
  critères d'acceptation.

---

## 17. Phase 9 — Stratégie éditoriale & capture leads (CHA-160 → CHA-247)

> Phase greffée *post-V1* — refonte d'instruction (Kolenda + plafond
> tokens), rédaction KB P0, et ajout d'un formulaire de capture de
> contact in-chat.
>
> Sources : [18 — Stratégie d'instructions & KB](18-instructions-knowledge-strategy.md)
> · [19 — Lead capture form](19-lead-capture-form.md).

### Phase 9.0 — Éditorial (S1, ~5,5 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-160 | Rédiger 13 sources KB P0 (`apps/web/content/chat-knowledge/*.md`) | 1,5 j |
| CHA-161 | Étendre `intent.ts` (8 nouveaux intents + tests) | 0,5 j |
| CHA-162 | Créer instruction `default` v2 FR/AR/AR-MA via admin | 0,25 j |
| CHA-163 | Brancher `parameters.maxTokens=220` côté provider OpenAI | 0,25 j |
| CHA-164 | Ingester KB en sandbox (`pnpm chat:ingest`) puis prod | 0,25 j |
| CHA-165 | Service `shouldOfferLeadForm(session, history)` | 0,5 j |
| CHA-166 | Émettre event `chat_lead_form_offered` côté orchestrator | 0,25 j |
| CHA-167 | Dashboard `/admin/chat` — KPI éditoriaux | 1 j |
| CHA-168 | Runner sandbox `pnpm chat:scenarios` + 16 yaml | 1 j |
| CHA-169 | Doc `06-multilingue-humanisation.md` — diff v1→v2 | 0,25 j |

### Phase 9.A — Data & backend lead (S1, ~3 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-200 | Schéma Drizzle `chat_lead` + migration | 0,5 j |
| CHA-201 | Repo `leadRepo` + tests | 0,5 j |
| CHA-202 | Helper `lib/phone.ts` (libphonenumber-js) + tests | 0,25 j |
| CHA-203 | Étendre enum `chat_conversation_event.type` | 0,25 j |
| CHA-204 | Contrat Zod `chatLeadContactInput` | 0,25 j |
| CHA-205 | Route POST `/api/chat/lead/contact` + tests MSW | 0,75 j |
| CHA-206 | Service `lead-webhook.ts` (HMAC, retry × 3, cron) | 0,75 j |
| CHA-207 | Service `lead-decision.ts` (7 triggers) + tests | 0,5 j |
| CHA-208 | Branchement orchestrator → SSE `lead-form-offer` | 0,5 j |

### Phase 9.B — Frontend lead (S2, ~3,25 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-210 | Composant `LeadFormBubble.tsx` (UI + a11y + RTL) | 1 j |
| CHA-211 | `lead-form-copy.ts` (FR/AR/AR-MA × 7 reasons) | 0,25 j |
| CHA-212 | Store Zustand `leadOffer` | 0,25 j |
| CHA-213 | SSE handler `lead-form-offer` | 0,25 j |
| CHA-214 | Intégration `MessageList` | 0,25 j |
| CHA-215 | Stories Storybook 9 états | 0,75 j |
| CHA-216 | Tests jest-axe (a11y) | 0,5 j |

### Phase 9.C — Tracking (S2, ~2,25 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-220 | Ajouter 13 events au catalogue + seed | 0,5 j |
| CHA-221 | Instrumenter widget : open/close/sent/received/complete | 0,5 j |
| CHA-222 | Instrumenter `LeadFormBubble` : view/focus/dismiss/submit | 0,25 j |
| CHA-223 | Mapper `generate_lead` côté Meta CAPI server-side | 0,5 j |
| CHA-224 | Tests datalayer e2e (3 scénarios) | 0,5 j |

### Phase 9.D — Admin & analyse (S3, ~3 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-230 | Page `/admin/chat/leads` (liste + filtres) | 1 j |
| CHA-231 | Drawer détail lead + actions outcome | 0,5 j |
| CHA-232 | Page settings webhook | 0,5 j |
| CHA-233 | Carte « Funnel leads » sur `/admin/chat` | 0,5 j |
| CHA-234 | Vue matérialisée `chat_lead_funnel` | 0,25 j |
| CHA-235 | Action « Renvoyer webhook » + audit log | 0,25 j |

### Phase 9.E — Sécurité & qualité (S3, ~2,5 j)

| ID | Sujet | Estim |
| --- | --- | --- |
| CHA-240 | Rate-limit endpoint lead | 0,25 j |
| CHA-241 | Honeypot frontend + check serveur | 0,25 j |
| CHA-242 | Cron purge RGPD (`outcome='discarded'` > 30 j) | 0,25 j |
| CHA-243 | Bouton admin « Oublier ce lead » | 0,25 j |
| CHA-244 | Tests Playwright e2e — happy path soumission | 0,5 j |
| CHA-245 | Tests Playwright e2e — dismissal | 0,25 j |
| CHA-246 | Tests Playwright e2e — RTL arabe | 0,25 j |
| CHA-247 | Audit a11y final (jest-axe + axe-playwright) | 0,5 j |

**Total Phase 9 : ~19,5 j (≈ 4 semaines à 1 fullstack + 0,5 frontend).**
