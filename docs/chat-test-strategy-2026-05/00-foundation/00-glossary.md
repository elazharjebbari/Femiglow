# Glossaire & conventions de vocabulaire

Document fondateur. Le vocabulaire ici est **stable et non négociable** ; tout le dossier
y fait référence.

## Acteurs

| Terme | Définition |
|-------|------------|
| **Visiteur** | Personne anonyme ou identifiée qui interagit avec le widget chat sur le site public |
| **Lead** | Visiteur ayant soumis ses coordonnées via le `LeadFormBubble` (firstName + phone + consent) |
| **Opérateur** | Membre interne (admin, ops, support) qui utilise la console `/admin/chat/` |
| **Admin** | Sous-catégorie d'opérateur avec rôle élevé (provider management, system toggles) |
| **System** | Le système chat en lui-même (orchestrator + providers + DB + Redis + cron) |

## Concepts cœur

| Terme | Définition |
|-------|------------|
| **Session** | Une session conversationnelle (`chat_session`). Liée à un `visitor_id`. |
| **Message** | Une entrée `chat_message` user ou assistant. |
| **Intent** | Catégorie sémantique d'un message visiteur (`pricing`, `shipping`, `purchase-intent`…) |
| **Instruction** | Prompt système (`chat_instruction_version`) injecté au LLM |
| **Canned pair** | Suggestion pré-écrite (pill cliquable) + sa réponse scriptée |
| **FAQ entry** | Question canonique + embedding + réponse scriptée (bypass LLM) |
| **RAG** | Retrieval-Augmented Generation — récupération de chunks pertinents via pgvector HNSW |
| **Tool** | (Promesse ADR-002) Fonction typée qu'un LLM peut appeler (`get_product`, `get_delivery_info`…) |
| **Centroid** | Vecteur agrégé d'embeddings labellisés pour un intent donné |
| **Breaker** | Circuit breaker provider (3 fails / 30 s → OPEN) |
| **Service level** | (Promesse ADR-004) Niveau de dégradation 0–4 (nominal → STATIC) |

## Couches techniques

| Terme | Définition |
|-------|------------|
| **Orchestrator** | `apps/web/src/lib/chat/services/orchestrator.ts` — pipeline complet |
| **Provider** | Adapter LLM (`openai`, `anthropic`, `gemini`, `mistral`, `qwen`, `deepseek`, `zhipu`, `ollama`, `azure-openai`) |
| **Repo** | Couche d'accès DB (Drizzle queries) |
| **Service** | Logique métier sans état persistant DB |
| **Component** | Composant React (UI) |
| **Hook** | React hook custom (`use-chat-send`, `use-chat-session`…) |
| **Route handler** | `app/api/chat/**/route.ts` (Next.js App Router) |

## Tests — vocabulaire

| Terme | Définition | Fichier suffixe |
|-------|------------|-----------------|
| **Unit** | Test d'une fonction pure / classe isolée | `*.test.ts` |
| **Integration** | Test d'une route API + orchestrator + DB test (sans UI) | `*.integration.test.ts` |
| **Component** | Test d'un composant React avec RTL + MSW | `*.test.tsx` |
| **E2E** | Test bout-en-bout via Playwright (vrai serveur + vrai navigateur) | `*.spec.ts` (dans `apps/web/e2e/`) |
| **Smoke** | Sous-ensemble rapide pour valider qu'un déploiement est vivant | `smoke-*.spec.ts` |
| **Load** | Test de charge (k6) | `k6/*.js` |
| **Visual regression** | Capture pixel-diff (Playwright `toHaveScreenshot`) | `visual-*.spec.ts` |
| **a11y** | Test d'accessibilité (jest-axe / axe-playwright) | tags `@a11y` |

## Tags Playwright officiels

(Utilisés dans `apps/web/e2e/**` via `test.describe.parallel` ou `@tag` dans titres)

| Tag | Sémantique |
|-----|------------|
| `@smoke` | Validation rapide post-deploy (≤ 5 min total) |
| `@critical` | Bloque release si fail |
| `@a11y` | Inclut axe-playwright |
| `@visual` | Capture visuelle |
| `@admin` | Concerne `/admin/chat/` (auth requise) |
| `@visitor` | Concerne le widget public |
| `@multilang` | Couvre FR + AR + AR-MA |
| `@mobile` | Viewport mobile (375×812) |
| `@desktop` | Viewport desktop (1280×800) |
| `@flaky-quarantine` | **Temporaire** — test mis en quarantaine, suivi obligatoire |

## Statuts documentaires

| Statut | Sémantique |
|--------|------------|
| **DRAFT** | En cours d'écriture, peut changer |
| **REVIEWED** | Relu par 1+ personne, prêt pour exécution |
| **FROZEN** | Référence stable, modifications requièrent ADR |
| **DEPRECATED** | Conservé pour historique, ne plus suivre |

## Sigles

| Sigle | Sens |
|-------|------|
| **RTL** | (1) React Testing Library, (2) Right-To-Left (locales AR) |
| **POM** | Page Object Model (Playwright) |
| **DoD** | Definition of Done |
| **SLA** | Service Level Agreement |
| **SLO** | Service Level Objective |
| **SLI** | Service Level Indicator |
| **PII** | Personally Identifiable Information |
| **WCAG** | Web Content Accessibility Guidelines |
| **CWV** | Core Web Vitals (LCP, FID/INP, CLS) |
| **TTI** | Time To Interactive |
| **MSW** | Mock Service Worker |
| **SUT** | System Under Test |
| **AAA** | Arrange / Act / Assert (pattern test) |
| **TTL** | Time To Live |
