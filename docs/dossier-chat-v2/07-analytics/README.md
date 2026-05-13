# Analytics — KPIs, événements, dashboards, A/B

> Une métrique sans propriétaire est une décoration. Cette section définit l'arbre des KPIs, leur capture, leurs dashboards, et la doctrine A/B testing.

## Principes

1. **North Star unique** : `chat_to_purchase_conversion_rate`. Tout converge vers elle.
2. **N1-N2-N3-N4 pyramid** : on remonte des metrics granulaires vers le NS.
3. **Capture systématique** : tout event a un type, un owner, une rétention.
4. **PII séparée** : les events analytics ne contiennent jamais de PII brute (hashing si besoin).
5. **A/B comme outil de doute** : on ne déploie pas une UX "parce qu'on aime" — on teste.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`kpi-tree.md`](kpi-tree.md) — arbre N1→N4 avec définitions et propriétaires
- [`event-taxonomy.csv`](event-taxonomy.csv) — catalogue d'events (nom, props, owner, rétention)
- [`dashboards.md`](dashboards.md) — spec dashboards Grafana / Vercel Analytics / interne
- [`ab-testing.md`](ab-testing.md) — doctrine A/B + 5 expérimentations prioritaires

## Stack analytics

| Outil | Usage |
|---|---|
| Vercel Analytics | RUM (LCP, FID, CLS) + page views |
| Microsoft Clarity | Heatmaps + session replay (gratuit, RGPD-OK) |
| Postgres (`chat_conversation_event`) | Source of truth pour events business |
| Sentry | Errors + performance backend |
| Custom dashboard `/dashboard/chat-v2/analytics` | KPIs business avec drill-down |
| GrowthBook (futur V7) | Feature flags + A/B engine |

## Source of truth vs convenience

| Métrique | SoT | Dashboards (replicas) |
|---|---|---|
| Conversion rate | Postgres `chat_lead` ∪ `orders` | Custom + Grafana |
| Cost per message | Postgres `chat_message.cost` | Custom |
| First token latency | Postgres `chat_message.first_token_ms` | Custom + Sentry Performance |
| Provider error rate | Sentry | Custom (real-time) |
| Page view → chat open | Vercel + custom | Vercel Analytics |
| Heatmap pills | Clarity | Clarity Dashboard |

## Loi N°1 : Pas de KPI orphelin

Chaque ligne du `kpi-tree.md` a :
- Définition mathématique.
- Source SQL.
- Propriétaire (Yasmine, Karim, Selma, dev).
- Cible et seuils.
- Fréquence de revue.

Si on perd le propriétaire, le KPI est mis en quarantaine 1 release, sinon supprimé.
