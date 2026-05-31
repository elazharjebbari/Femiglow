# Chat — Stratégie de tests robuste & UI-first (2026-05-25)

Plan de tests **exhaustif** du système chat FemiGlow, conçu selon les standards d'une
grande agence tech (Accenture / Cognizant / TCS / Capgemini / Infosys). Orientation
**UI-first** + couches MSW solides + suites vitest/Playwright avec scénarios métier
réalistes.

> **Objectif** : garantir une qualité minimale **très supérieure** au chat actuel
> (40 % coverage, gaps modération outbound, fallback ADR-004 non câblé — voir
> [chat-audit-2026-05/](../chat-audit-2026-05/)).

## Principes directeurs

| Principe | Application |
|----------|-------------|
| **UI-first** | 70 % des assertions valident le comportement vu par l'opérateur (visiteur/admin), pas l'implémentation interne |
| **Réalisme métier** | Scénarios écrits en Gherkin, dérivés des personas + funnel conversion |
| **Robustesse > volume** | Couvrir les cas d'erreur, les bords, le réseau dégradé, le timing — pas multiplier les tests faciles |
| **Non régressif** | Chaque ticket = test associé avant merge. Tests = single source of truth de la spec |
| **Modulaire** | POM (Page Object Model) Playwright, MSW handlers factorisés, factories partageables |
| **Maintenable** | DRY mais pas DRYer-than-it-needs. Données de test générées (Faker + seeds déterministes) |
| **Fiabilité** | Zéro test flaky en CI. Retry uniquement sur infra (network), pas sur logique |
| **Haute qualité** | Custom matchers domain-specific, screenshots et traces persistés, coverage gates par couche |

## Couches de tests

```
                          ╔══════════════════════════╗
                          ║   Playwright (E2E UI)     ║  ~30 specs (visiteur + admin)
                          ║   Scénarios métier réels   ║  Réseau réaliste, multi-tabs
                          ╚══════════════════════════╝
                       ╔═══════════════════════════════╗
                       ║   Component Tests (vitest+RTL)  ║  ~120 specs (Composants UI)
                       ║   Avec MSW pour APIs           ║  Interactions, a11y, edge cases
                       ╚═══════════════════════════════╝
                    ╔══════════════════════════════════════╗
                    ║   Integration (vitest + MSW + DB test) ║  ~80 specs (API routes + orch.)
                    ║   Pipeline orchestrator end-to-end     ║
                    ╚══════════════════════════════════════╝
                 ╔══════════════════════════════════════════════╗
                 ║   Unit (vitest)                                  ║  ~250 specs (logique pure)
                 ║   Services, repos, helpers, matchers              ║
                 ╚══════════════════════════════════════════════╝
```

**Distribution cible** ~480 specs (cf. [00-foundation/01-test-pyramid.md](00-foundation/01-test-pyramid.md)) :
- Unit : 250 (52 %)
- Integration : 80 (17 %)
- Component : 120 (25 %)
- E2E : 30 (6 %)

Note : on ne se fixe **pas un nombre** ; ces chiffres sont indicatifs. La règle d'or :
**chaque comportement métier doit avoir au moins 1 test à la couche la plus haute possible**
qui le valide bout-en-bout.

## Structure du dossier

```
docs/chat-test-strategy-2026-05/
├── README.md                         ← VOUS ÊTES ICI
├── 00-foundation/                    Conventions, tooling, gates qualité
├── 01-architecture-test/             MSW, POM, factories, matchers, anti-flakiness
├── 02-functional-areas/              60 fonctionnalités, 1 sous-dossier par feature
│   ├── _index/                       Matrice exhaustive + grilles transverses
│   ├── F01-widget-init/              ← Pattern détaillé (description, scenarios, tests…)
│   ├── F02 … F60                     idem
├── 03-business-scenarios/            8 parcours métier réalistes
├── 04-execution-plan/                Roadmap phases + boucle correction
└── 05-runbook/                       Exécution opérationnelle
```

## Comment lire / utiliser ce dossier

| Tu es… | Commence par… | Puis… | Référence |
|--------|---------------|-------|-----------|
| **PO / Product** | [README](README.md) | [04-execution-plan/](04-execution-plan/) | [03-business-scenarios/](03-business-scenarios/) |
| **Tech-lead** | [README](README.md) | [01-architecture-test/](01-architecture-test/) | [00-foundation/](00-foundation/) |
| **Dev (test author)** | [00-foundation/02-test-conventions.md](00-foundation/02-test-conventions.md) | [02-functional-areas/F0X/](02-functional-areas/) | [01-architecture-test/02-msw-handlers-catalog.md](01-architecture-test/02-msw-handlers-catalog.md) |
| **QA / SDET** | [00-foundation/01-test-pyramid.md](00-foundation/01-test-pyramid.md) | [03-business-scenarios/](03-business-scenarios/) | [05-runbook/](05-runbook/) |
| **DevOps / SRE** | [05-runbook/02-ci-pipeline.md](05-runbook/02-ci-pipeline.md) | [05-runbook/04-coverage-monitoring.md](05-runbook/04-coverage-monitoring.md) | [00-foundation/03-quality-gates.md](00-foundation/03-quality-gates.md) |

## Fonctionnalités couvertes (60)

Inventaire exhaustif dans [02-functional-areas/_index/00-matrix.csv](02-functional-areas/_index/00-matrix.csv).
Catégorisation rapide :

| Catégorie | IDs | Compteur |
|-----------|-----|----------|
| Widget UI (visiteur) | F01–F13 | 13 |
| API routes | F14–F22 | 9 |
| Orchestrator pipeline | F23–F36 | 14 |
| Admin console | F37–F52 | 16 |
| Cross-cutting | F53–F60 | 8 |

## Quality gates (cf. [00-foundation/03-quality-gates.md](00-foundation/03-quality-gates.md))

| Métrique | Seuil bloquant CI |
|----------|-------------------|
| Coverage line (services + repos) | ≥ 85 % |
| Coverage line (components) | ≥ 75 % |
| Coverage line (orchestrator pipeline) | ≥ 95 % |
| Coverage branch (lead-decision, intent, charter) | ≥ 95 % |
| Playwright pass rate (CI) | 100 % (zero flaky) |
| A11y violations (axe) sur widget + admin | 0 critique, 0 sérieux |
| P95 latency `/api/chat/message` (load test) | ≤ 4 s |
| MSW handlers — fraîcheur du contrat | Auto-régénération depuis Zod schemas |
| Tests retry max | 1 (network seul, jamais logique) |

## Outils utilisés

| Outil | Rôle | Version recommandée |
|-------|------|---------------------|
| **vitest** | Unit + integration + component | ≥ 1.6 |
| **@testing-library/react** | Component testing (interactions visibles) | ≥ 16 |
| **@testing-library/user-event** | User interactions réalistes | ≥ 14 |
| **MSW** | Mock Service Worker (REST + SSE) | ≥ 2.4 |
| **Playwright** | E2E browser + traces + video | ≥ 1.46 |
| **axe-playwright** + **jest-axe** | Accessibility | latest |
| **@faker-js/faker** | Génération données | ≥ 9 |
| **drizzle-kit + postgres-test-containers** | DB de test isolée | latest |
| **PlantUML** | Diagrammes séquence/état | server local ou cli |
| **Allure / HTML reporter Playwright** | Reporting visuel | latest |

## Lien avec l'audit précédent

Cette stratégie de tests **adresse directement** les findings de
[`docs/chat-audit-2026-05/02-audit-critique.md`](../chat-audit-2026-05/02-audit-critique.md) :

| Finding audit | Test associé (matrice) |
|---------------|------------------------|
| C1 — Tools framework absent | F58, F60 (déclaration intentionnelle, tests désactivés tant que non implémenté) |
| C2 — Modération outbound advisory | F27 (tests prouvent le bug ; passent une fois fix livré) |
| C3 — Fallback 5 niveaux | F31, F35, BS04, BS09 |
| C4 — Budget guard non appelé | F35, BS09 |
| C5 — SSE event non contractuel | F08, F15 |
| C6 — Race breaker memory↔Redis | F31 (sous tests concurrents) |
| I1 — `attributeConversion` dead code | F34 (négatif explicite + roadmap) |
| I3 — FAQ threshold contradictoire | F28, F47 |
| I4 — Visitor rate-limit | F36, BS09 |
| R2 — FAQ branch hors modération | F28, BS02 |
| R3 — Memory window sans cap tokens | F30, F35 |
| R5 — SSE writer swallow errors | F08, F32 |

## Métadonnées

- **Auteur** : Claude (audit indépendant)
- **Date** : 2026-05-25
- **Commit audité** : `779f134`
- **Cible code review** : `apps/web/src/{lib,components,app}/chat/**` + `apps/web/src/lib/db/schema.ts`
- **Statut document** : v1.0 — DRAFT
- **Lien dossier audit pré-requis** : [chat-audit-2026-05/](../chat-audit-2026-05/)
