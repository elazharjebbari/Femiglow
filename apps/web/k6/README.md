# Tests de charge k6

Scripts de tests de charge pour l'environnement **preview**
(staging.femiglow.ma) uniquement. **Ne jamais lancer ces scripts contre
la production** sans coordination avec l'équipe (pression Postgres,
quotas Vercel, alertes Sentry).

## Installation

```bash
brew install k6   # macOS
# ou : https://k6.io/docs/get-started/installation
```

## Scripts

| Fichier | Cible | Trafic | Vérifications |
|---|---|---|---|
| `cron-tick.js` | `POST /api/cron/tick` | 200 req/s × 60s | p95 < 1.5s, error rate < 1% |
| `admin-login.js` | `POST /api/admin/login` | 50 req/s × 30s | p95 < 800ms, status 401/429 |

## Lancer

```bash
# cron-tick (depuis apps/web)
export BASE_URL=https://staging.femiglow.ma
export CRON_SECRET="$(op read 'op://FemiGlow Ops/cron-secret/staging')"
k6 run k6/cron-tick.js

# admin-login (preview only)
k6 run -e BASE_URL=https://staging.femiglow.ma k6/admin-login.js
```

## Critères d'acceptation Phase 5

- `cron-tick.js` → ✅ thresholds verts
- `admin-login.js` → ✅ thresholds verts ET majorité de réponses
  passées de 401 → 429 dans la deuxième moitié du run (le rate-limit
  prend le relais).

## Inventaire des résultats

À chaque exécution, archive le rapport HTML (`--out json=...`) dans
`docs/admin/runs/k6/YYYY-MM-DD/` pour comparaison historique.
