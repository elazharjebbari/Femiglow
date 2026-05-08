# 05 — UI / UX & design

> *Charte console, tokens, layout, états vide/loading/erreur*

---

## 1. Principes

| Principe                                | Traduction concrète                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| **Densité maîtrisée**                   | 6 KPIs en haut, 2-3 graphes en dessous, pas de surcharge            |
| **Lecture orientée action**             | Chaque graphe répond à une question, pas une exploration libre      |
| **Cohérence avec admin existant**       | Stone-50/200, fonts Inter, focus rings, layout 1280px max           |
| **Touches FemiGlow**                     | Sauge sur séries primaires, champagne sur signaux nobles            |
| **Aucun bruit**                          | Pas de chrome inutile (border, ombres) — palette retenue            |

## 2. Layout

```
┌──────────────── /admin/analytics/insights ────────────────────────┐
│                                                                  │
│  Header                                                          │
│  ─ Analytics Insights                  [Refresh status] [Manual] │
│                                                                  │
│  Filters bar                                                     │
│  [Window: 7j ▾] [Env: all ▾] [Device: all ▾] [Locale: all ▾]    │
│                                                                  │
│  Sub-tabs                                                        │
│  Overview · Pages · Composants · Sections · Funnel               │
│                                                                  │
│  Content (selon onglet)                                          │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐                     │
│  │ KPI1 │ KPI2 │ KPI3 │ KPI4 │ KPI5 │ KPI6 │                     │
│  └──────┴──────┴──────┴──────┴──────┴──────┘                     │
│  ┌──────────────────────────────────────────┐                     │
│  │ Time-series                                │                     │
│  └──────────────────────────────────────────┘                     │
│  ┌──────────────────┐  ┌─────────────────────┐                    │
│  │ Heatmap          │  │ Top events           │                   │
│  └──────────────────┘  └─────────────────────┘                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Tokens

| Token                              | Couleur     | Usage                                    |
| ---------------------------------- | ----------- | ---------------------------------------- |
| `--insights-bg`                     | `#FBF8F1`   | Fond global (déjà admin)                 |
| `--insights-card-bg`                | `#FFFFFF`   | Cartes KPI, panneaux                      |
| `--insights-border`                 | `#E5E2DD`   | Hairlines                                 |
| `--insights-text-primary`           | `#2C2A28`   | Titres, valeurs                          |
| `--insights-text-secondary`         | `#6B6863`   | Labels, légendes                         |
| `--insights-series-primary`         | `#2C2A28`   | Série principale (events totaux)         |
| `--insights-series-sessions`        | `#A8C4A6`   | Sessions / engagement                    |
| `--insights-series-conversions`     | `#C8A876`   | Conversions (signal noble)               |
| `--insights-series-bounce`          | `#E2B6B2`   | Bounce rate (à minimiser)                |
| `--insights-positive-variation`     | `#3F5B41`   | +X % en sauge profond                    |
| `--insights-negative-variation`     | `#8C3A3A`   | -X % en pétale rouge                     |
| `--insights-loading-pulse`          | `#F2F1ED`   | Skeleton shimmer                          |

## 4. Typographie

| Usage                              | Police                  | Taille / poids       |
| ---------------------------------- | ----------------------- | -------------------- |
| Titres de panneaux                  | Inter SemiBold          | 14 px / 600          |
| KPI valeurs                        | Inter Tabular           | 28 px / 600          |
| KPI labels                         | Inter                    | 11 px / 500 uppercase |
| Variations (% +/-)                 | Inter Tabular            | 12 px / 500          |
| Légendes graphes                    | Inter                    | 11 px / 400          |
| Tableaux                           | Inter                    | 13 px / 400          |
| Tooltips                           | Inter                    | 12 px / 500          |

## 5. États

### 5.1 Empty state

```
┌────────────────────────────────────┐
│                                    │
│   Aucune donnée pour cette         │
│   fenêtre.                         │
│                                    │
│   La maison observe en silence.    │
│   Étend la période pour voir       │
│   plus loin.                        │
│                                    │
│   [Étendre à 30 jours]             │
└────────────────────────────────────┘
```

Tonalité éditoriale FemiGlow (pas "No data found").

### 5.2 Loading

Skeleton shimmer, pas de spinner. Mêmes dimensions que le contenu
final pour éviter le CLS.

### 5.3 Error

Bannière rouge sobre, bouton "Réessayer", message technique replié
en `<details>` pour debug.

### 5.4 First run

```
┌────────────────────────────────────┐
│ ⏳ Premier calcul en cours          │
│                                    │
│ La maison agrège tes événements    │
│ pour la première fois. Cela peut   │
│ prendre quelques minutes.          │
│                                    │
│ Reviens d'ici 5 minutes ou         │
│ rafraîchis manuellement.           │
└────────────────────────────────────┘
```

## 6. Animations

| Élément                      | Animation                                       |
| ---------------------------- | ----------------------------------------------- |
| KPI valeur                   | Count-up 600 ms ease-out cubic                  |
| Bars / lines drawing         | Draw 320 ms ease-out (stroke-dasharray)         |
| Tooltip apparition           | Fade 120 ms                                     |
| Filtres bar update           | Replace via SWR (pas de transition propre)      |
| Skeleton                     | Pulse 1.4 s ease-in-out infinite                 |

Toutes désactivées en `prefers-reduced-motion`.

## 7. Responsive

| Breakpoint | Layout                                                |
| ---------- | ----------------------------------------------------- |
| < 768 px   | Onglets en accordéon, KPIs 2 par ligne, charts 100 %  |
| 768-1024   | Onglets horizontaux, KPIs 3 par ligne                 |
| ≥ 1024 px  | Layout standard, KPIs 6 par ligne                     |

## 8. A11y

- Tous les SVG ont `role="img"` + `aria-label` parlant
- `<title>` enfant pour screen readers (Heatmap, etc.)
- Tableaux avec `scope="col"`, `scope="row"`, navigation clavier
- Filtres : `<label>` associé, focus rings stone-900 ring-2
- Tabs : ARIA tablist + flèches ←/→ (pattern réutilisé GTM)
- Empty / Error states : annoncés `role="status"` ou `role="alert"`
- Contrastes WCAG AA strict (vérifiés `jest-axe` en CI)

## 9. Lecture suivante

- [04 — Frontend](04-frontend.md) pour l'arborescence composants.
- [06 — Visualisations](06-visualisations.md) pour le détail chart-by-chart.
