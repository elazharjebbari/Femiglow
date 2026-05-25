# Refonte robustesse — Systèmes live FemiGlow (Mai 2026)

> **Référence audit** : [`../live-systems-audit-2026-05/01-audit-baseline.md`](../live-systems-audit-2026-05/01-audit-baseline.md)
> **Sprint** : `fix/live-systems-robustness`
> **Effort total** : ~3-4 semaines dev + 2 sem observation post-déploiement
> **Approche** : 3 sprints — Quick wins P0 → Structurel → Roadmap stratégique

## TL;DR

L'audit a identifié **3 risques bloquants P0** + **7 findings critiques** sur 3 systèmes live :

| Système | Risque P0 | Impact |
|---|---|---|
| **Publishing social** | Cron `social-publish-scheduler` absent de `vercel.json` | **Tous les posts scheduled ne partent jamais en prod** |
| **Chat OpenAI** | OpenAI Moderation API jamais appelée | Risque légal + réputation à grande échelle |
| **Tracking real-time** | Dédup + breaker chat in-memory cassés en multi-lambda | Dérive observabilité + perte protection au scale |

Plus 7 findings secondaires (carrousels Insta 1 image, pas de batching Meta CAPI, `serverFire` ne logue pas, etc.).

## Vision du fix

> **Tous les systèmes "live" doivent être observables, idempotents, retry-safe, et résilients au scale-out Vercel.**

3 piliers structurants :
1. **State externalisé** (Redis Upstash) pour dédup + circuit breakers
2. **Observabilité unifiée** — chaque event live est traçable, monitoré, alertable
3. **Failover gracieux** — chaque service externe (OpenAI, Postiz, Meta CAPI) a un fallback documenté

## Sommaire du dossier

| Doc | Sujet | Statut |
|---|---|---|
| `README.md` | Index + TL;DR | ✅ |
| `02-vision-architecture.md` | Architecture cible + diagrammes par système | ✅ |
| `03-plan-action-phases.md` | Sprint 1 + 2 + 3 détaillés avec critères acceptation | ✅ |
| `04-tests-strategy.md` | Vitest + Playwright + MSW + smoke tests | ✅ |
| `05-runbook-rollout.md` | Feature flags + monitoring + rollback procedures | ✅ |
| `06-system-chat-openai.md` | Fiche complète chat — Moderation, fallback, streaming | ✅ |
| `07-system-publishing.md` | Fiche complète publishing — Cron, carrousels, retry | ✅ |
| `08-system-tracking.md` | Fiche complète tracking — Batching, dedup Redis, serverFire | ✅ |

## Métriques cibles (J+30)

| KPI | Baseline | Cible |
|---|---|---|
| Posts scheduled qui partent | 0% | **100%** |
| Chat messages modérés | 0% (heuristique only) | **100%** (OpenAI Moderation) |
| Tracking events dédupés cross-lambda | Aléatoire | **100%** (Redis) |
| Carrousels Insta multi-image | 1 image | **N images** |
| Meta CAPI calls par event | 1:1 | **1:N** (batching ≥10) |
| `serverFire` events loggés en DB | 0% | **100%** |
| Chat fallback provider (cassé OpenAI) | crash | **Anthropic / message dégradé** |

## Quick navigation

- **Démarrer aujourd'hui** : lire [03-plan-action-phases.md § Sprint 1 Quick Wins](./03-plan-action-phases.md) — 5 fixes < 1 j chacun
- **Planifier 2-3 semaines** : lire [03-plan-action-phases.md § Sprint 2 Structurel](./03-plan-action-phases.md) — 5 chantiers structurants
- **Roadmap trimestre** : lire [03-plan-action-phases.md § Sprint 3 Roadmap](./03-plan-action-phases.md) — 4 initiatives stratégiques

## Rollback global

Tous les changements derrière feature flags (`NEXT_PUBLIC_LIVE_V2_*`). Rollback < 60 sec via Vercel env vars. Le détail par système dans `05-runbook-rollout.md`.

## Lien avec les autres sprints

- Sprint **attribution-fix-2026-05** (déjà mergé) : pose les helpers `enrichEvent`/taxonomy unifiée — réutilisés par tracking real-time.
- Sprint **wizard-kit-optim-2026-05** : indépendant.
- Sprint **kit-landing-reorder-2026-05** : indépendant.
