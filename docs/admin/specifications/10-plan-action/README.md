# 10 — Plan d'action

Cette section traduit toutes les spécifications précédentes en un plan
d'exécution concret : phases temporelles, tâches atomiques (< 4h), DoD,
critères d'acceptation, checklist go-live, plan de rollback.

## Fichiers

| Fichier | Format | Rôle |
|---|---|---|
| `roadmap.md` | md | vue trimestres, jalons macro |
| `phases.md` | md | 6 phases d'exécution avec scope, objectif, gates |
| `taches-atomiques.csv` | csv | ~150 tâches `ADM-001…ADM-150`, < 4h chacune |
| `dependencies.puml` | puml | graphe de dépendances entre tâches |
| `definition-of-done.md` | md | DoD par type de livrable |
| `criteres-acceptation.md` | md | critères d'acceptation par feature |
| `checklist-go-live.md` | md | check-list avant lancement production |
| `plan-rollback.md` | md | procédure de rollback global |

## Principe d'exécution

Chaque tâche atomique est :
- **Petite** : < 4h de travail
- **Testable** : critère d'acceptation explicite
- **Indépendante** ou avec dépendance déclarée
- **Numérotée** : `ADM-NNN` pour traçabilité PR/commit

Format des commits :
```
ADM-042: Implémenter handler login
```

## Cadence

| Cadence | Cérémonie |
|---|---|
| Quotidien | mise à jour Kanban (To do / Doing / Review / Done) |
| Hebdomadaire | revue d'avancement, ajustement priorités |
| Fin de phase | démo + go/no-go vers phase suivante |
| Bimensuel | revue rétrospective |

## Outils

- **Backlog** : GitHub Projects (board lié à `taches-atomiques.csv`)
- **CI** : GitHub Actions (lint, typecheck, vitest, playwright)
- **Review** : 1 reviewer minimum, label `ready-for-merge` requis
