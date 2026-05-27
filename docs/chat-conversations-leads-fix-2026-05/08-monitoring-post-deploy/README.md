# 08 — Monitoring post-deploy

Plan d'observabilité après le ship.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`dashboards.md`](./dashboards.md) | Dashboards admin à observer (Vercel, Sentry, Plausible, /admin/chat/audit) |
| [`alerts.md`](./alerts.md) | Règles d'alertes à configurer |
| [`kpis.md`](./kpis.md) | KPIs métier à tracker mensuel |

## Principes

1. **Visibilité passive** : la santé du système doit être visible sans effort.
2. **Alerting actionable** : si une alerte se déclenche, il faut savoir quoi faire.
3. **Trend over snapshot** : observer l'évolution sur 7-30j est plus utile qu'un point à T.
4. **Pas de fausse alerte** : seuils calibrés sur baseline réelle, pas sur intuition.

## Outils disponibles

| Outil | Usage | Cible |
|---|---|---|
| Sentry | Erreurs runtime | 0 erreur SSR sur `/admin/chat/*` |
| Vercel logs | Logs structurés | Pattern `chat.session.create kind=*` |
| Plausible | Events custom | `admin_chat_*` events |
| `/admin/chat/audit` | Vue interne admin | Distribution kind/source temps réel |
| `/admin/live-health` | Dashboard santé live | Inclure section chat purity |

## Cadence d'observation

- **48h post-ship** : monitoring actif (Lead checke toutes les 2-4h)
- **J+7** : check hebdo (Lead vérifie dashboard 5 min)
- **J+30** : revue mensuelle (équipe revoit KPIs et trend)
- **Trimestriel** : audit cohérence cross-table + nettoyage si besoin
