# Assistant conversationnel FemiGlow — Spécification

Spécification complète du module **Assistant conversationnel**
(« la maison à l'écoute ») intégré à l'application FemiGlow
(Next.js 14, App Router) qui couvre :

- un **widget de chat** persistant sur l'ensemble du site, à la fois
  discret au repos et facile à atteindre, conforme à la charte de la
  maison (sauge, crème, encre, champagne rare),
- une **couche d'orchestration LangChain** (LangChain.js) totalement
  *model-agnostic* — OpenAI, Google Gemini, Anthropic, Mistral,
  Qwen / DeepSeek / Zhipu, Ollama local — sélectionnable par
  l'admin sans redéploiement,
- une **base de connaissance** (RAG) construite sur les pages, le
  Journal, le Kit, les conditions de la maison, les FAQ, et tout
  document additionnel injecté par l'admin,
- une **expérience humaine** (français, arabe classique, darija
  marocain) avec simulation de cadence de frappe, accusés de
  lecture, voyants d'écriture, salutations contextuelles, ton
  « initiée » conforme au lexique FemiGlow,
- une **boucle de conversion** subtile — pas de forcing, pas de
  collant — par déclencheurs comportementaux (intention exprimée,
  hésitation, abandon panier) et par micro-gestes commerciaux
  (rituel proposé, échantillon, prise de contact),
- une **console admin** `/admin/chat` pilotant l'instruction système,
  les sources de connaissance, les paramètres modèle, le style du
  widget, les KPIs d'engagement et de conversion, la recherche et
  la gestion des conversations,
- une **interface graphique** explicative du fonctionnement du
  système (flux de données, étapes RAG, providers actifs,
  guard-rails), accessible côté admin et côté visiteur en mode
  « les coulisses ».

Le module se branche sur l'infrastructure existante (Neon Postgres,
Drizzle, iron-session, MSW, Vercel) et réutilise les conventions
des modules `tracking`, `admin`, `media` (audit, rate-limit, CSP
nonce, secrets chiffrés, schémas Zod portables CMS).

## Sommaire

| #   | Document                                                                                  | Contenu                                                                                  |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 00  | [Cahier des charges](00-cahier-des-charges.md)                                            | Exigences fonctionnelles, non-fonctionnelles, KPIs, RGPD, scope, hors-scope              |
| 01  | [Architecture](01-architecture.md)                                                        | Vue d'ensemble, flux temps réel, agent LangChain, RAG, model router, séquences           |
| 02  | [Couche data](02-data.md)                                                                 | Schéma Drizzle (`chat_*`), migrations, indexes, retention, vector store                  |
| 03  | [Backend](03-backend.md)                                                                  | Routes API publiques + admin, services LangChain, streaming SSE, queues, audit           |
| 04  | [Frontend](04-frontend.md)                                                                | Widget, store Zustand, hooks, persistance locale, accessibilité, RTL                     |
| 05  | [UI / UX & design](05-ui-ux-design.md)                                                    | Charte du chat, tokens, animations, états, micro-interactions, position, responsive      |
| 06  | [Multilingue & humanisation](06-multilingue-humanisation.md)                              | FR / AR / darija, détection langue, cadence frappe, voyants, salutations contextuelles   |
| 07  | [Techniques de conversion](07-conversion-techniques.md)                                   | Psychologie commerciale, déclencheurs, scénarios, garde-fous anti-forcing                |
| 08  | [Console admin](08-admin-console.md)                                                      | Instructions, sources, KPIs, gestion conversations, design, audits, exports              |
| 09  | [Base de connaissance & RAG](09-knowledge-base-rag.md)                                    | Sources, ingestion, chunking, embeddings, retrieval, re-ranking, fraîcheur               |
| 10  | [Providers & modèles](10-providers-models.md)                                             | Adapter pattern, OpenAI / Gemini / Anthropic / Qwen / DeepSeek / Ollama, fallback        |
| 11  | [Visualisation du système](11-visualisation-systeme.md)                                   | Interface graphique des flux, des étapes RAG, des providers actifs, des guard-rails      |
| 12  | [Stratégie de tests](12-tests.md)                                                         | Vitest unit, MSW provider mocks, Playwright E2E, contract tests, snapshots conversation  |
| 13  | [Sécurité, RGPD & modération](13-securite-rgpd-moderation.md)                             | PII redaction, modération, prompt injection, jailbreak, droit à l'oubli                  |
| 14  | [Observabilité & performance](14-observabilite-perf.md)                                   | Logs structurés, traces, métriques, budgets, alerting                                    |
| 15  | [Plan d'action](15-plan-action.md)                                                        | Phases, tâches atomiques `CHA-001` → `CHA-150`                                           |
| 16  | [Runbook](16-runbook.md)                                                                  | Opérations courantes : ajout provider, debug conversation, hot-reload prompt, incidents  |

### Annexes

- [Prompts système (FR / AR / darija)](annexes/prompts-systeme.md)
- [Glossaire éditorial du chat](annexes/glossaire-editorial.md)
- [Exemples de payloads et events](annexes/payloads-exemples.md)
- [Matrice de scénarios de tests](annexes/matrice-scenarios.md)

## Conventions transverses

### Identifiants Postgres

| Préfixe | Table                              | Usage                                        |
| ------- | ---------------------------------- | -------------------------------------------- |
| `cs_`   | `chat_session`                     | session de chat (visiteur, panier, langue)   |
| `cm_`   | `chat_message`                     | message (rôle, contenu, latence, tokens)     |
| `ck_`   | `chat_knowledge_source`            | source de connaissance (URL, fichier, FAQ)   |
| `kc_`   | `chat_knowledge_chunk`             | chunk indexé pour RAG                        |
| `ke_`   | `chat_knowledge_embedding`         | embedding (vecteur) lié au chunk             |
| `cp_`   | `chat_provider_config`             | configuration provider (OpenAI, Gemini…)     |
| `ci_`   | `chat_instruction_version`         | version d'instruction système (immutable)    |
| `ct_`   | `chat_theme_preset`                | preset de style du widget                    |
| `cv_`   | `chat_conversation_event`          | événement (open, close, conversion…)         |
| `cf_`   | `chat_feedback`                    | retour utilisateur (👍 / 👎 / texte)         |
| `cr_`   | `chat_rate_limit_bucket`           | seau de rate-limit par IP / session          |

### Préfixes API

| Préfixe                               | Authentification                | Usage                                          |
| ------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `/api/chat/session`                   | publique (cookie session)       | création / reprise de session visiteur         |
| `/api/chat/message`                   | publique (cookie session)       | envoi / réception streaming SSE                |
| `/api/chat/feedback`                  | publique (cookie session)       | dépôt feedback message                         |
| `/api/admin/chat/instructions`        | admin (iron-session)            | CRUD instructions système versionnées          |
| `/api/admin/chat/sources`             | admin                           | CRUD sources de connaissance                   |
| `/api/admin/chat/providers`           | admin                           | CRUD configurations providers                  |
| `/api/admin/chat/themes`              | admin                           | CRUD presets de style du widget                |
| `/api/admin/chat/conversations`       | admin                           | recherche, lecture, export, modération         |
| `/api/admin/chat/kpis`                | admin                           | métriques agrégées par fenêtre temporelle      |
| `/api/admin/chat/visualisation`       | admin                           | flux temps réel des étapes du pipeline         |

### Voix éditoriale

- **Français** : tutoiement uniquement dans le widget, vouvoiement
  proscrit (charte « maison »). Pas d'emojis. Pas d'exclamations.
  Pas d'urgence ni de réduction. Lexique : « rituel » (jamais
  « produit »), « initiée » (jamais « cliente »), « maison »
  (jamais « marque »), « gestes » (jamais « étapes »).
- **Arabe classique** (`ar-SA`) : registre soutenu mais accessible,
  pas de calques publicitaires. Préfère « طقس » (rituel) à
  « منتج » (produit) chaque fois que possible.
- **Darija marocaine** (`ar-MA`) : transcription en caractères
  arabes par défaut (alif, qaf marocain, ch / ش, g / ݣ). Tutoiement
  naturel (« نتي » / « نت »). Glissement code-switching FR/AR
  toléré quand le visiteur l'amorce.

### Sécurité

- Aucun prompt système, aucune clé d'API, aucun nom de modèle
  fournisseur ne fuit côté client. Le client reçoit un identifiant
  opaque de variant (`provider:openai-gpt-4o-mini` est masqué en
  `variant:abc123`).
- Toutes les clés providers sont chiffrées au repos
  (`pgcrypto` + KMS via secret d'env), déchiffrées à la volée.
- Modération obligatoire : entrée (Llama Guard / OpenAI Moderation
  / heuristique fallback) et sortie (filtre PII + filtre lexique
  charte FemiGlow).
- CSP : aucun `unsafe-inline`, le widget est hydraté avec un nonce.
  Les SSE passent par un endpoint same-origin (`/api/chat/message`).

### Consentement et confidentialité

- Le widget peut s'ouvrir et fonctionner en mode `essential` sans
  consentement analytics (la conversation est nécessaire à
  l'usage du service).
- Les KPIs comportementaux fins (replays, heatmap du widget) ne
  s'activent qu'avec `consent.granted` côté analytics.
- Droit à l'oubli : un endpoint admin permet la purge complète
  d'une session (messages + embeddings dérivés).
- Aucune donnée n'est envoyée chez un provider tiers sans que
  l'admin ait coché la case « envoi externe accepté » dans la
  configuration du provider concerné.

### Préfixe de tickets : `CHA-XXX`

Environ **150 tâches atomiques** réparties en **8 phases** (cf.
[15-plan-action.md](15-plan-action.md)).

## État du document

- Version : 1.0
- Date : 2026-05-06
- Auteur : équipe FemiGlow
- Statut : à valider avant kick-off implémentation
- Dépendances amont : `docs/preparation/`, `docs/tracking/`,
  `docs/admin-config/`, `docs/components-cms/`
