# Plan de développement — overview

> Chaque phase a son fichier YAML détaillé. Format :

```yaml
phase: M5.X
name: <human readable>
duration_estimate_days: <range>
depends_on: [M5.Y, ...]
gate_test: <path to ultimate test>
tickets:
  - id: M5.X.1
    title: ...
    description: ...
    estimate_days: 1
    blocking: [M5.X.0]
    deliverable: <description>
    docs: [path1, path2]
    tests:
      - jest: <file>
      - playwright: <file>
      - msw: <file>
```

## Phases

| Phase | Fichier | Durée estimée |
|---|---|---|
| M5.1 | [01-phase-m5.1-transactional.yaml](01-phase-m5.1-transactional.yaml) | 6-10 jours |
| M5.2 | [02-phase-m5.2-user-events.yaml](02-phase-m5.2-user-events.yaml) | 6-10 jours |
| M5.3 | [03-phase-m5.3-audiences.yaml](03-phase-m5.3-audiences.yaml) | 10-15 jours |
| M5.4 | [04-phase-m5.4-campaigns.yaml](04-phase-m5.4-campaigns.yaml) | 4-7 jours |
| M5.5 | [05-phase-m5.5-automation.yaml](05-phase-m5.5-automation.yaml) | 10-15 jours |
| M5.6 | [06-phase-m5.6-polish.yaml](06-phase-m5.6-polish.yaml) | 4-7 jours |

**Total** : 40-65 jours-développeur.

## Ordre de livraison recommandé

```
M5.1 ──┐
       ├──→ M5.6 (polish global à la fin)
M5.2 ──┘
   │
   └──→ M5.3 ──→ M5.4 ──→ M5.5
```

M5.1 et M5.2 peuvent être faits en parallèle (équipe à 2). M5.6 attend
tout le reste pour polish coherent.

## Convention tickets

Chaque ticket a :
- **id** : `M5.X.N` (incrémental)
- **estimate** : ≤ 1 jour (sinon découper)
- **deliverable** clair (PR mergeable, démontrable)
- **tests** obligatoires (au moins 1 jest + 1 playwright si UI)
- **gate** : ne pas marquer `done` sans tests verts

## Tracking

Tickets exportés en CSV dans [10-plan-action/02-tickets.csv](../10-plan-action/02-tickets.csv) pour import dans
n'importe quel tracker (Linear, GitHub Projects, Notion).
