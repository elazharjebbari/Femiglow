# 50.5 — Wireframes Observabilité

## Page `/admin/tracking/analytics/providers`

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Console FemiGlow > Tracking > Analytics > Providers                     ║
║                                                                          ║
║  Performance des providers · [● 24h] [○ 7d] [○ 30d]                      ║
║                                                                          ║
║  ┌─ KPIs globaux ───────────────────────────────────────────────────┐   ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │   ║
║  │  │   1247   │ │   23     │ │  98.4%   │ │  220ms   │             │   ║
║  │  │  Events  │ │   Conv.  │ │ Success  │ │ Latency  │             │   ║
║  │  │   24h    │ │   24h    │ │   24h    │ │    P50   │             │   ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Par provider                                                            ║
║  ┌────────────────────────────────────────────────────────────────────┐ ║
║  │ Provider      Total  Success%  P50    P95    Errors  Status        │ ║
║  ├────────────────────────────────────────────────────────────────────┤ ║
║  │ meta          1247   98.2%     245ms  720ms  2       ✅ OK         │ ║
║  │ google_ga4    1247   99.7%     180ms  450ms  0       ✅ OK         │ ║
║  │ google_ads    1247   97.1%     350ms  890ms  1       ✅ OK         │ ║
║  │ tiktok         234   96.8%     420ms  1.2s   5       ⚠ Warning     │ ║
║  │ snap           234   94.0%     510ms  1.5s   14      ⚠ Warning     │ ║
║  │ pinterest      234    0.0%     —      —      234     ❌ Error      │ ║
║  └────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ Conversions par jour (7 derniers jours) ───────────────────────┐   ║
║  │                                                                 ▆▆ │   ║
║  │                                                          ▆▆ ▆▆ ▆▆ │   ║
║  │  ▆▆     ▆▆            ▆▆       ▆▆                  ▆▆   ▆▆ ▆▆ ▆▆ │   ║
║  │  ▆▆  ▆▆ ▆▆ ▆▆      ▆▆ ▆▆ ▆▆  ▆ ▆▆  ▆               ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ │   ║
║  │  ▆▆  ▆▆ ▆▆ ▆▆ ▆▆ ▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆  ▆▆ ▆ ▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ ▆▆ │   ║
║  │  L  M  M  J  V  S  D  L  M  M  J  V  S  D                       │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Erreurs récentes (drill-down sur clic provider)                         ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Provider      Event              Erreur                  Time     │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ pinterest     purchase           HTTP 401 — token expired 2 m    │   ║
║  │ pinterest     purchase           HTTP 401 — token expired 5 m    │   ║
║  │ snap          add_to_cart        Network timeout          12 m   │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Status badges

| Statut | Couleur | Condition |
|---|---|---|
| ✅ OK | emerald-100 / emerald-900 | success_rate ≥ 95% |
| ⚠ Warning | amber-100 / amber-900 | success_rate 70-94% OR errors_24h > 10 |
| ❌ Error | rose-100 / rose-900 | success_rate < 70% OR last_event > 24h |
| ⏸ Disabled | stone-100 / stone-600 | status='disabled' en DB |

## Drill-down "Erreurs récentes"

Au clic sur une ligne provider, le tableau du bas se filtre sur ce provider :

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Pinterest · 234 events sur 24h                          [Tous] [×]      ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │ Event              Erreur                          Time   Status │   ║
║  ├──────────────────────────────────────────────────────────────────┤   ║
║  │ purchase           HTTP 401 — token expired       2 m    ❌      │   ║
║  │ purchase           HTTP 401 — token expired       5 m    ❌      │   ║
║  │ purchase           HTTP 401 — token expired       8 m    ❌      │   ║
║  │ ...                                                              │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                          ║
║  Actions :                                                               ║
║  [Voir provider config]   [Refresh token]   [Désactiver provider]       ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Refresh auto

- SWR `refreshInterval: 30000` (30s)
- Indicateur discret "Actualisation dans 22s" en bas à droite
- Bouton "Actualiser maintenant" en haut à droite

## Mobile

Sur mobile (< 768px), le tableau devient une liste de cards stackées :

```
╔════════════════════════════╗
║  meta              ✅ OK    ║
║  1247 events · 98.2%        ║
║  P50 245ms · P95 720ms      ║
║  Errors: 2                  ║
╚════════════════════════════╝
╔════════════════════════════╗
║  google_ga4        ✅ OK    ║
║  ...                        ║
╚════════════════════════════╝
```
