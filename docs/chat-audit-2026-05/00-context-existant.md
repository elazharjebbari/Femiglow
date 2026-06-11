# 00 — Contexte : documentation existante

Avant l'audit, recensement complet des docs chat. Le système a une **lourde dette
documentaire positive** (~65 fichiers `.md`), répartis sur 3 dossiers de référence + 4
audits épars. La lecture séquentielle est cruciale car certaines docs sont contradictoires
ou obsolètes.

## Carte des sources

```
docs/
├── dossier-chat-v2/                    ⬅ VISION CIBLE (2026-05-13 · v1.0)
│   ├── 00-vision/                       Stratégie conversion, personas, KPIs
│   ├── 01-architecture/                 Architecture + 4 ADRs
│   ├── 02-data/                         Modèle, migrations, RGPD
│   ├── 03-backend/                      Pipeline, intent, retrieval
│   ├── 04-frontend/                     Composants, SSE, A11y
│   ├── 05-design-ui/                   Tokens, wireframes
│   ├── 06-ux-ergonomie/
│   ├── 07-analytics/                    KPIs, dashboards, A/B
│   ├── 08-plan-conception/
│   ├── 09-plan-developpement/           Sprints, DoD
│   ├── 10-plan-action/                  Livrables jour-par-jour
│   ├── 11-runbook/                      Deploy, incidents
│   └── 12-tests/                        MSW, Playwright
│
├── chat-assistant/                     ⬅ ARCHIVE v1 + STATUT IMPL.
│   ├── 00-cahier-des-charges.md
│   ├── 01..15 (architecture, data, backend, frontend, RAG, providers…)
│   ├── 17-implementation-status.md     ⭐ feature-par-feature
│   ├── 20-rapport-amelioration-CHA-225.md
│   ├── 21-mobile-ux-plan.md / 22-mobile-ux-runbook.md
│   └── annexes/ + runbook-lead-dedup.md
│
└── audit/
    ├── chat-systeme-messagerie-audit-detaille-2026-05-17.md    ⭐ audit précédent
    ├── chat-improvements-strategy-2026-05.md
    ├── chat-reverse-engineering-2026-05.md
    └── plan-ceinture-bretelles-declenchement-formulaire-chat-2026-05-17.md
```

## Vision cible (dossier-chat-v2/)

Le projet chat v2 est une **refonte stratégique** visant à transformer le chat d'assistant
de support en **moteur de conversion** triple-langue (FR/AR/Darija).

### KPI cibles chiffrés (00-vision/03-success-metrics.md)

| Niveau | Métrique | Baseline | Cible |
|--------|----------|----------|-------|
| Système | intent_accuracy | 73 % | **92 %** |
| Système | factual_accuracy prix/livraison | 65 % | **≥98 %** |
| Système | dontknow_rate | 30-40 % | **<3 %** |
| Système | canned_share | 0 % | **40 %** |
| Produit | suggestion_click_rate | 0 % | **35 %** |
| Produit | useful_reply_rate | 70 % | 95 % |
| Produit | lead_capture_rate | 45 % | 65 % |
| Business | conversion globale chat | 0,029 % | **0,3 %** (×10) |
| Coût | LLM cost / session | baseline | **−30 %** |

### Funnel cible (00-vision/02-conversion-playbook.md)

```
P0 open_rate    : 12 % → 18 %
P1 engagement   : 35 % → 60 %      ← levier principal (pills)
P2 useful_reply : 70 % → 95 %      ← levier principal (tools + KB)
P3 strong_intent:  8 % → 15 %
P4 lead_capture : 45 % → 65 %
P5 lead_to_order: 22 % → 30 %
```

Produit cumulé : `0,029 % → 0,3 %` (×10). Les **2 leviers les plus rentables** : pills
(engagement) et tools/KB (useful_reply).

## 4 ADRs architecturaux (dossier-chat-v2/01-architecture/adr/)

| ADR | Décision | Statut doc |
|-----|----------|-----------|
| **ADR-001** | Cascade intent 3 niveaux : regex++ → embeddings → LLM mini | proposed |
| **ADR-002** | Hybrid retriever : RAG + tools (`get_product`, `get_delivery_info`, `search_faq`, `check_promo`, `get_order_status`) | proposed |
| **ADR-003** | Canned pairs visuelles + FAQ gateway invisible (bypass LLM) | proposed |
| **ADR-004** | Multi-provider fallback 5 niveaux : nominal → failover → RAG_ONLY → CANNED_ONLY → STATIC | accepted |

Voir [03-adr-vs-realite.md](03-adr-vs-realite.md) pour le détail de chaque ADR confronté au
code actuel.

## Statut implémentation déclaré (chat-assistant/17-implementation-status.md)

### Phases 0-8 — Marquées ✅ DONE (CHA-001 → CHA-150)

| Phase | Domaine | Statut |
|-------|---------|--------|
| 0 | Fondations (feature flag, env, CSP, Drizzle) | ✅ |
| 1 | Data + providers (11 tables, pgvector HNSW, 7 adapters, breaker) | ✅ |
| 2 | Pipeline backend (`/api/chat/message`, sanitize, intent, RAG, humanize, lead-decision) | ✅ |
| 3 | Widget visiteur (Launcher, Panel, MessageList, Composer, virtualisation, RTL) | ✅ |
| 4 | Multilingue + humanize (FR/AR/AR-MA, typewriter, cadence) | ✅ |
| 5 | RAG knowledge (loaders URL/MD/PDF/DOCX, splitter, ingest idempotent) | ✅ |
| 6 | Admin console (10 sections, KPIs, export CSV/JSON) | ✅ |
| 7 | System visualizer (pipeline SVG live, replay) | ✅ |
| 8 | Sécurité/QA/perf (unit tests, E2E Playwright, load k6) | ✅ |

### Phase 9 — EN COURS (CHA-160 → CHA-247) — Édition & Leads

| Sous-phase | Statut | Détail |
|------------|--------|--------|
| 9.A — Data backend lead | ✅ | leadRepo, webhook, lead-decision (7 triggers) |
| 9.B — Frontend lead | 🚧 | LeadFormBubble live ; Storybook + a11y absent |
| 9.C — Tracking | 🚧 | 13 events instrumentés ; Meta CAPI server-side absent |
| 9.0 — Éditorial KB | 🚧 | 13 sources P0 (squelettes), pas de UI ingestion |
| 9.E — Sécurité/qualité | 🚧 | rate-limit + honeypot ; RGPD purge cron + UI oublier absent |

⚠️ Voir [02-audit-critique.md](02-audit-critique.md) — section A : plusieurs items marqués
✅ dans 17-implementation-status.md sont en réalité **partiels ou non implémentés** (ADR-001
niveau 3, ADR-002 tools, ADR-004 levels 2-4).

## Dette critique recensée (chat-assistant/20-rapport-amelioration-CHA-225.md)

| ID | Problème | Effort | Statut au 2026-05-25 |
|----|----------|--------|----------------------|
| 1.1 | `attributeConversion` jamais appelé en runtime → KPI conversion = 0 | 1-2 j | **OUVERT** ⚠️ |
| 1.2 | Pas d'UI admin pour modifier `chat_lead.outcome` | 1 j | OUVERT |
| 1.3 | Pas d'export CSV leads | 0,5 j | OUVERT |
| 1.4 | Pas pagination/tri sur `/admin/chat/leads` | 0,5 j | OUVERT |
| 1.5 | Pas webhook `lead.outcome_changed` | 0,5 j | OUVERT |
| 1.6 | Toggle `lead_form_enabled` non exposé | 0,5 j | OUVERT |
| 1.7 | `handledBy`/`handledAt` jamais peuplés | 0,2 j | OUVERT |
| 2.1 | 5 erreurs TypeScript union drivers (postgres-js vs Neon) | 0,5 j | OUVERT |

**Aucun de ces 8 items n'a été résolu** entre le 2026-05-17 et le 2026-05-25.

## Audit 2026-05-17 — Findings principaux

(Source : `docs/audit/chat-systeme-messagerie-audit-detaille-2026-05-17.md`)

### Findings encore ouverts au 2026-05-25

| # | Finding | Mon avis (2026-05-25) |
|---|---------|----------------------|
| 1 | `attributeConversion` unreachable (CRITIQUE) | **Confirmé ouvert** — voir I1 dans [02-audit-critique.md](02-audit-critique.md) |
| 2 | Lead form outcome read-only | Confirmé ouvert |
| 3 | KB pas enrichie (cron sync absent) | Confirmé ouvert + ADR-002 entièrement absent |
| 4 | Canned pairs UI manquante | **Partiellement résolu** — tables et service existent (`canned-pair-service.ts`, schema `chat_canned_pair`) ; pas vérifié si admin UI complet |
| 5 | Intent cascade incomplet | Confirmé — niveau 3 LLM mini absent |
| 6 | Tools framework declared but not implemented | **Confirmé** — voir C1 dans audit |
| 7 | FAQ gateway = 0 % trafic | **Partiellement résolu** — branche FAQ implémentée dans orchestrator ; threshold mal configuré (voir I3) |

### Recommandations 2026-05-17 non appliquées

- ❌ Fixer `attributeConversion` hook (toujours ouvert)
- ❌ UI outcome lead
- ❌ Export CSV leads
- ❌ Cron KB sync (ADR-002 V3)
- ✅ Tables canned pairs (faites)
- ❌ Dataset annoté intent (500 messages)
- ❌ Tools registry + handlers
- ❌ Dashboards N2/N3 live

**Conclusion contexte** : la documentation est riche et alignée sur une vision claire,
mais la **vélocité d'implémentation** post-audit est faible (0 dette critique résolue en
8 jours). Cela suggère soit un manque de capacité, soit une priorisation différente
(probablement travail sur live-systems-sprint-1 et attribution-traffic-source d'hier).
