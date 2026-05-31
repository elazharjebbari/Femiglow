# 06 — Plan d'action

## Fichiers

| Fichier | Contenu |
|---|---|
| [`phases.md`](./phases.md) | 7 phases T0→T6 détaillées |
| [`checklist.md`](./checklist.md) | DoD global + par phase |
| [`rollback.md`](./rollback.md) | Stratégie de rollback en 3 niveaux |

## Vue d'ensemble

```
T0 — Prep (0.5j)     T1 — Backend (1j)        T2 — Templates (1j)
   │                     │                          │
   ▼                     ▼                          ▼
[Branch+flag+         [Migration SQL +          [Refonte 4 templates
 juriste contact]     helpers + endpoints]      + validation juriste]
                          │                          │
                          └──────────┬───────────────┘
                                     ▼
                       T3 — Anonymisation+cleanup (0.5j)
                                     │
                                     ▼
                       T4 — Tests (1j)
                                     │
                                     ▼
                       T5 — Backfill data + audit (0.5j)
                                     │
                                     ▼
                       T6 — Ship (0.5j)
```

Total estimé : **5 j-h sur 7 jours calendaires**.

## PRs

- **PR1** — T0+T1+T3 (backend + flag + cleanup + anonym marketing)
- **PR2** — T2+T4 (templates refonte + tests)
- **PR3** — T5+T6 (data + ship)

Chaque PR doit pouvoir être mergée indépendamment (feature flag off).

## Conditions GO/NO-GO

| Phase → suivante | GO si |
|---|---|
| T0 → T1 | branch créée, flag dispo, juriste contacté |
| T1 → T2 | migration appliquée local, code compile, smoke ok |
| T2 → T3 | juriste a validé templates anonymisés |
| T3 → T4 | grep "souheila" = 0, cleanup OK |
| T4 → T5 | tests vitest + Playwright verts |
| T5 → T6 | audit SQL : 0 drift, 0 ICE/RC visible |
| T6 ship | staging validé manuel + monitoring ready |
