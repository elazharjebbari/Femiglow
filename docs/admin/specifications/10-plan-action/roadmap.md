# Roadmap

## Vue trimestrielle

```
2026 Q2 (Mai–Juin)        2026 Q3 (Juil–Sep)        2026 Q4 (Oct–Déc)
────────────────────      ──────────────────────    ─────────────────────
P1 Fondations             P5 Hardening              Stabilisation
P2 Auth + Leads           P6 Go-live                Suivi métriques
P3 Webhooks                                          Itérations mineures
P4 Tests + a11y
```

## Jalons macro

| ID | Jalon | Date cible | Critère |
|---|---|---|---|
| M1 | Repo bootstrappé | 2026-05-10 | CI verte sur `main` |
| M2 | Schéma DB v1 | 2026-05-17 | migrations appliquées Neon prod |
| M3 | Auth opérationnelle | 2026-05-31 | login + session 8h fonctionnels |
| M4 | Console leads MVP | 2026-06-21 | liste + détail + transitions statut |
| M5 | Webhooks MVP | 2026-07-19 | enqueue + retry exponentiel + UI |
| M6 | Couverture tests cible | 2026-08-16 | 80 % unit, E2E vert sur preview |
| M7 | Hardening sécu | 2026-09-13 | scan OWASP top 10 sans bloc |
| M8 | **Go-live production** | 2026-09-30 | tous les critères de go-live OK |
| M9 | Post-launch +30j | 2026-10-30 | KPI nominaux 30 jours consécutifs |

## Estimation effort

| Phase | Effort estimé | Tâches atomiques |
|---|---|---|
| P1 — Fondations | ~40h | ADM-001 à ADM-020 |
| P2 — Auth + Leads | ~80h | ADM-021 à ADM-060 |
| P3 — Webhooks | ~70h | ADM-061 à ADM-095 |
| P4 — Tests + a11y | ~60h | ADM-096 à ADM-125 |
| P5 — Hardening | ~30h | ADM-126 à ADM-140 |
| P6 — Go-live | ~20h | ADM-141 à ADM-150 |
| **Total** | **~300h** | **150 tâches** |

À ~4h/tâche en moyenne, ~150 tâches → ~5 mois calendaires à 1 dev plein
temps avec marge revue/QA. Le planning ci-dessus laisse une marge de
~3 semaines pour les imprévus.

## Hors scope v1 (backlog v2+)

- Multi-utilisateur admin (rôles fin)
- Export CSV des leads
- Import en masse
- 2FA admin (TOTP)
- Recherche full-text PostgreSQL
- Notifications email automatisées
- Mode hors ligne

À ouvrir comme epics dédiés une fois la v1 stabilisée 30 jours.
