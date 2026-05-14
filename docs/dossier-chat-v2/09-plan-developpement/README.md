# Plan de développement — Sprints, tickets, Definition of Done

> L'exécution opérationnelle : sprints de 2 semaines, breakdown ticket par ticket, templates standards, DoD strict. Compatible Linear / Jira / GitHub Projects.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`sprint-breakdown.csv`](sprint-breakdown.csv) — tous les tickets par sprint V5/V6/V7
- [`ticket-templates.md`](ticket-templates.md) — templates Feature / Bug / Tech-debt / Spike
- [`definition-of-done.md`](definition-of-done.md) — DoD par type de ticket

## Cadence

| Élément | Durée |
|---|---|
| Sprint | 2 semaines (du lundi au vendredi de la semaine suivante) |
| Daily standup | 15 min, 9h30 |
| Sprint planning | 2h, lundi sprint start |
| Sprint demo | 1h, vendredi sprint end |
| Retro | 1h, vendredi sprint end |
| 1:1 dev ↔ PO | hebdo 30 min |

## Vélocité estimée

- Dev senior : ~25 points / sprint.
- Dev intermédiaire : ~18 points / sprint.
- Total équipe : ~43 points / sprint.

## Découpage V5/V6/V7

- V5 : 2 sprints (4 semaines) = ~86 points.
- V6 : 2-3 sprints (5 semaines) = ~110 points.
- V7 : 4 sprints (8 semaines) = ~170 points.

Total = ~366 points sur 4 mois.

## Outils

- **Linear** : tickets + projects + roadmap.
- **GitHub PR** : code review, CI/CD.
- **Notion** : docs longue forme (specs détaillées).
- **Slack** : daily standup + alerts.
- **Vercel preview deployments** : review chaque PR live.

## Conventions

- Branches : `feature/chat-v2-<lot>-<short-name>` (ex. `feature/chat-v2-v51-migrations`).
- Commits : Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- PR : taille max 500 lignes (sinon split).
- Code review : au moins 1 reviewer, dev senior pour les PR architecture.
