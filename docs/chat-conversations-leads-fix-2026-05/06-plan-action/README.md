# 06 — Plan d'action

Découpage en phases T0→T6, checklist DoD, stratégie de rollback.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`phases.md`](./phases.md) | 7 phases détaillées avec sous-tâches, deliverables, durée estimée |
| [`checklist.md`](./checklist.md) | Definition of Done (DoD) global + par phase |
| [`rollback.md`](./rollback.md) | Stratégie de rollback en cas de problème |

## Vue d'ensemble

```
T0 — Prep (0.5j)         T1 — Backend (1j)        T2 — Tests vitest (1j)
   │                         │                         │
   ▼                         ▼                         ▼
[Branch + flag + doc]   [Migration + queries     [Unit + integration MSW
                         + repos + endpoint]      18+6 tests]
                              │                         │
                              └──────────┬──────────────┘
                                         ▼
                              T3 — Frontend (0.5j)
                                         │
                                         ▼
                              [Pages + composants + a11y]
                                         │
                                         ▼
                              T4 — Tests Playwright (0.5j)
                                         │
                                         ▼
                              [4 specs @chat-purity + smoke]
                                         │
                                         ▼
                              T5 — Backfill + audit (0.5j)
                                         │
                                         ▼
                              [Migration data + audit SQL + monitoring]
                                         │
                                         ▼
                              T6 — Ship + obs 48h (1j)
                                         │
                                         ▼
                              [Staging → Prod → Monitoring → DoD]
```

Total estimé : **5 j-h**, **7 jours calendaires**.

## Owner unique

Recommandé : 1 dev confirmé du projet familier avec :
- Drizzle + Postgres
- Next.js App Router (RSC + Client Components)
- Vitest + Playwright + MSW

Si dev junior, doubler les estimations et ajouter une code review par jour avec le lead.

## Branche & PRs

- Branch : `fix/chat-conversations-leads-pollution` (ou `cha-lead-v2-pollution`)
- 3 PRs successives :
  - **PR1** : Migration + repos + queries (backend pur)
  - **PR2** : Endpoint cleanup + UI audit page
  - **PR3** : Tests Playwright + smoke script

Chaque PR doit être mergeable indépendamment (feature flag off).

## Conditions de go/no-go

Avant chaque transition de phase :

- T0 → T1 : OK si branch créée, flag dispo, doc à jour.
- T1 → T2 : OK si migration appliquée local, code compile, smoke local OK.
- T2 → T3 : OK si 18 vitest unit verts + 6 MSW verts.
- T3 → T4 : OK si pages compile, no a11y regression.
- T4 → T5 : OK si 4 Playwright + smoke local OK.
- T5 → T6 : OK si audit SQL counts cohérents, monitoring dashboard fonctionne.
- Ship prod : OK si T6 J+1 + J+2 checklist 100% OK.
