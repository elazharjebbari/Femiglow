# 08 — Monitoring post-deploy

## Fichiers

| Fichier | Contenu |
|---|---|
| [`dashboards.md`](./dashboards.md) | Dashboards à observer (Vercel, Sentry, Plausible, /admin/legal/audit) |
| [`alerts.md`](./alerts.md) | Sentry rules + custom metrics + alerts |
| [`kpis.md`](./kpis.md) | KPIs business + techniques à tracker mensuel |

## Cadence

- **48h post-ship** : monitoring actif (Lead checke toutes 2-4h)
- **J+7** : check hebdo (5 min)
- **J+30** : revue mensuelle équipe
- **Trimestriel** : audit cohérence cross-table + nettoyage si besoin

## Outils

| Outil | Usage |
|---|---|
| Sentry | Erreurs runtime `/legal/*` |
| Vercel logs | Pattern `legal.vars.*`, `legal.cleanup.e2e` |
| Plausible | Events custom `admin_legal_*` |
| `/admin/legal/audit` (si créé) | Vue interne admin temps réel |
| Email `legal@femiglow-maroc.com` | Demandes utilisateurs |
