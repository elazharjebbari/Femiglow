# 60.5 — Dashboard mockups (admin analytics)

## Dashboard "Conversions" — `/admin/tracking/analytics/conversions`

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Conversions tracking · [● 7j] [○ 30j] [○ 90j]                           ║
║                                                                          ║
║  ┌─ KPIs globaux ───────────────────────────────────────────────────┐   ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │   ║
║  │  │   147    │ │   89     │ │   ~5.2k  │ │   18%    │             │   ║
║  │  │  Purchase│ │  Lead    │ │  Total€  │ │  Conv.   │             │   ║
║  │  │   7j     │ │   7j     │ │   MAD    │ │  rate    │             │   ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Conversions par catégorie (7 derniers jours)                            ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │                            ▆▆ ▆▆                                  │   ║
║  │  ▆▆       ▆▆           ▆▆ ▆▆ ▆▆                         ▆▆ ▆▆ ▆▆   │   ║
║  │  ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆     │   ║
║  │  L  M  M  J  V  S  D  L  M  M  J  V  S  D                        │   ║
║  │                                                                  │   ║
║  │  ▆ Purchase  ▆ Lead  ▆ Contact                                    │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Par event (ordered by count)                                            ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Event                Count   GAds cat.   Server OK  Notes        │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ purchase             147     Purchase    98.6%      ✅            │   ║
║  │ lead_capture         89      Lead        99.1%      ✅            │   ║
║  │ generate_lead        12      Lead        100%       ✅            │   ║
║  │ chat_lead_form_submit 23     Lead        95.7%      ⚠ 1 fail      │   ║
║  │ phone_call_initiated 5       Contact     100%       ✅            │   ║
║  │ contact_form_submit  3       Contact     100%       ✅            │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  [Voir détail Google Ads ▸]    [Voir détail Meta ▸]                      ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Dashboard "Funnel" — `/admin/tracking/analytics/funnel`

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Funnel de conversion · 7 derniers jours                                 ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │                                                                  │   ║
║  │  page_view (/kit)          ████████████████████  4521 (100%)    │   ║
║  │     ▼                                                            │   ║
║  │  form_start                █████████████  2937 (65%)             │   ║
║  │     ▼                                                            │   ║
║  │  lead_capture              ████████   1421 (31%)                 │   ║
║  │     ▼                                                            │   ║
║  │  begin_checkout            █████  789 (17%)                      │   ║
║  │     ▼                                                            │   ║
║  │  add_shipping_info         ████  632 (14%)                       │   ║
║  │     ▼                                                            │   ║
║  │  add_payment_info          ███  478 (10%)                        │   ║
║  │     ▼                                                            │   ║
║  │  purchase                  ██  147 (3.2%)                        │   ║
║  │                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Drop-off le plus important : begin_checkout → add_shipping_info (20%)   ║
║  Action recommandée : revoir l'UX du step shipping                       ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Dashboard "Health par provider" — `/admin/tracking/analytics/providers`

(Déjà décrit dans `50-ui-ux-design/wireframes-observability.md` — pour rappel.)

## Modal de détail event

Au clic sur une ligne d'event dans la table conversions :

```
╔══════════════════════════════════════════════════════════════════════════╗
║  purchase · 147 events sur 7 derniers jours                       [×]    ║
║                                                                          ║
║  Total dispatch :                                                        ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Provider     Dispatched  Success  Failed  Latency P50            │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ meta         147          145      2       240ms                 │   ║
║  │ google_ga4   147          147      0       180ms                 │   ║
║  │ google_ads   147          143      4       380ms                 │   ║
║  │ tiktok       147          147      0       420ms                 │   ║
║  │ snap         147          147      0       510ms                 │   ║
║  │ pinterest    147           0       147     —    (provider down)  │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Échecs récents (5)                                                      ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Time   Provider     Order ID    Error                            │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ 12m   meta         o_abc123    HTTP 400 — invalid event_id      │   ║
║  │ 1h    google_ads   o_def456    HTTP 401 — token expired         │   ║
║  │ 2h    google_ads   o_ghi789    HTTP 429 — quota exceeded         │   ║
║  │ ...                                                              │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  [Voir tous les logs ▸]                                                  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Charts library

Utiliser **Recharts** (déjà dans le projet) :
- `<BarChart>` pour conversions par jour
- `<LineChart>` pour latency over time
- `<FunnelChart>` (npm `recharts` ne l'a pas, custom via `<BarChart layout="vertical">`)

Responsive : `<ResponsiveContainer width="100%" height={300}>`.

## Data refresh

- Auto-refresh 30s (cohérent avec providers analytics)
- Pas de WebSocket / SSE (overkill pour data agrégée)
- Cache HTTP `Cache-Control: private, max-age=10` côté API
