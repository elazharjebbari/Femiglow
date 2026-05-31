# 06 — Visualisations

> *12 types de charts détaillés, choix de stack, placement*

---

## 1. Vue d'ensemble

12 visualisations distinctes, toutes en SVG custom (pas recharts).
Conformes à la charte GTM (cf. doc `gtm/15-ui-ux-improvements`)
et au design system existant.

| #   | Composant                  | Question business                                    | Onglet      |
| --- | -------------------------- | ---------------------------------------------------- | ----------- |
| 01  | `<KpiCard>` (×6)           | Chiffres clés + variation vs période précédente      | Overview    |
| 02  | `<EventsTimeSeries>`       | Comment évolue le volume jour par jour ?             | Overview    |
| 03  | `<ActivityHeatmap>`        | Quels créneaux concentrent l'activité ?               | Overview    |
| 04  | `<TopEventsTable>`         | Quels events sont les plus fréquents ?               | Overview    |
| 05  | `<PagesTopTable>`          | Quelles pages sont les plus visitées ?               | Pages       |
| 06  | `<PagesTreemap>`           | Quelle est la répartition pages × engagement ?       | Pages       |
| 07  | `<ComponentsTopTable>`     | Quels composants déclenchent le plus ?               | Composants  |
| 08  | `<DeadComponentsList>`     | Quels composants sont silencieux ?                   | Composants  |
| 09  | `<SectionsBarChart>`       | Sur quelles sections les visiteurs s'attardent-ils ? | Sections    |
| 10  | `<SectionsDwellTable>`     | Top sections par durée moyenne                       | Sections    |
| 11  | `<FunnelSankey>`           | Quel est le tunnel de conversion ?                   | Funnel      |
| 12  | `<FunnelDropoffTable>`     | Où sont les drop-offs principaux ?                   | Funnel      |

## 2. `<KpiCard>` — carte KPI

```
┌─────────────────────────────┐
│ TOTAL EVENTS                │
│                             │
│ 12 437                      │
│                             │
│ ↗ +14 % vs 7 jours préc.    │
└─────────────────────────────┘
```

**Comportement** :
- Animation count-up 600 ms (off en reduced-motion)
- Variation calculée en backend (% change)
- Couleur variation : sauge profond `#3F5B41` si positif **et**
  désiré (events ↑, conversions ↑), pétale rouge `#8C3A3A` si
  négatif **ou** indésirable (bounce ↑)
- Tooltip natif `title` avec valeur exacte

**KPIs V1** (6) :

| Label                       | Métrique                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| Total events                | `sum(insights_event_daily.count)` sur la fenêtre                    |
| Sessions uniques            | `sum(insights_event_daily.unique_sessions)`                         |
| Pages vues                  | `sum(insights_page_daily.page_views)`                               |
| Conversions                 | `sum(insights_event_daily.conversion_count)`                        |
| Events / session            | `total_events / unique_sessions`                                    |
| Bounce rate                 | `bounce_count / total_sessions`                                     |

## 3. `<EventsTimeSeries>` — line chart

3 séries superposées :
- events totaux (encre, ligne pleine 1.5 px)
- sessions uniques (sauge, ligne pleine 1.5 px)
- conversions (champagne, ligne pleine 1.5 px)

**Axes** :
- X : dates (60 derniers jours max)
- Y : compte (auto-scale, 5 ticks max)

**Interactions** :
- Hover sur un point → tooltip avec date + 3 valeurs
- Clic sur un point → drill-down vers ce jour (V2)

**Format X** : `dd/MM` français.

## 4. `<ActivityHeatmap>` — grille 24 × 7

```
       0  1  2 …                     22 23
Lun   ░░ ░░ ░░ ░░ ░░ ░░ ▒▒ ▓▓ ▓▓ … ▒▒ ░░
Mar   ░░ ░░ ░░ ░░ ░░ ░░ ▒▒ ▓▓ ██ … ▒▒ ░░
…
Dim   ░░ ░░ ░░ ░░ ░░ ░░ ▒▒ ▒▒ ▓▓ … ▒▒ ░░
```

- Couleur unique sauge `#A8C4A6`, opacité 0.05 → 1.0 selon volume
- Cellules 16×22 px
- `<title>` natif : "Lun 14h : 327 events"
- Légende discrète à droite : "Faible — Élevé"

## 5. `<TopEventsTable>` — tableau triable

| Event              | Volume  | % du total | Variation 7j vs 7j | Conversion ? |
| ------------------ | ------- | ---------- | ------------------ | ------------ |
| `page_view`        | 4 320   | 35 %       | +12 %               | non          |
| `chat_widget_open` | 1 870   | 15 %       | +24 %               | non          |
| `purchase`         | 42      | 0.3 %      | +5 %                | **oui**      |
| …                  | …       | …          | …                  | …            |

**Tri** : par défaut volume desc. Cliquable sur en-tête.
**Pagination** : 50 lignes max, page 1 visible, V2 pagination si
> 50.

## 6. `<PagesTopTable>` — top 30 pages

| Route               | Visites | Sessions | Engagement (scroll 75) | Conversions | Bounce % |
| ------------------- | ------- | -------- | ---------------------- | ----------- | -------- |
| `/`                 | 8 240   | 5 100    | 42 %                   | 12          | 38 %     |
| `/kit`              | 3 410   | 2 800    | 67 %                   | 31          | 22 %     |
| `/journal/manuc-jp` | 1 220   | 940      | 58 %                   | 4           | 31 %     |
| …                   | …       | …        | …                      | …           | …        |

Click sur une route → ouvre `<PageDetailDrawer>` avec :
- Liste des events sur cette page (top 20)
- Mini time-series du `page_view`
- Bouton "Voir conversions de cette page"

## 7. `<PagesTreemap>` — treemap

```
┌────────────────────────┬──────────────┬──────────┐
│   /                    │              │          │
│                        │   /kit       │ /journal │
│                        │              │          │
├────────────────────────┴──────────────┼──────────┤
│  /panier            │  /commander       │  /maison │
└──────────────────────────────────────────────────┘
```

- Surface proportionnelle au volume `page_views`
- Couleur unifiée crème/sauge selon engagement
- `<title>` natif avec route + chiffres

## 8. `<ComponentsTopTable>` — top 50 composants

| Composant                  | Page principale  | Events totaux | Top event                 | % engagement |
| -------------------------- | ---------------- | ------------- | ------------------------- | ------------ |
| cta-recevoir-rituel        | /kit             | 4 200         | `add_to_cart`              | 18 %         |
| chat-widget-launcher       | /                | 1 800         | `chat_widget_open`         | 12 %         |
| journal-card-3             | /journal         | 920           | `select_content`           | 8 %          |
| …                          | …                | …             | …                         | …            |

## 9. `<DeadComponentsList>` — composants morts

```
3 composants n'ont déclenché aucun event sur les 30 derniers jours :

  • cta-newsletter-footer  (présent sur 12 pages)
  • carrousel-witness-2    (page maison)
  • banner-soldes          (probablement archivé)
```

Aide à nettoyer la base : composant orphelin → soit le brancher,
soit l'archiver.

## 10. `<SectionsBarChart>` — barres horizontales

```
section-rituel         ████████████████  4m 32s
section-kit-detail     █████████████     3m 18s
section-journal-extrait ██████████        2m 24s
section-temoignages    █████              1m 12s
section-faq            ███                 38s
```

Barres horizontales, longueur prop. à `avg_dwell_seconds`.
`<title>` natif avec valeur exacte.

## 11. `<SectionsDwellTable>` — top sections

| Section              | Page          | Vues     | Durée moyenne | Sessions uniques |
| -------------------- | ------------- | -------- | ------------- | ---------------- |
| section-rituel       | /             | 4 200    | 4m 32s         | 1 280            |
| section-kit-detail   | /kit          | 3 800    | 3m 18s         | 920              |
| …                    | …             | …        | …             | …                |

## 12. `<FunnelSankey>` — sankey simplifié

```
┌──── view_item ────┐
│                    │
└─── add_to_cart ───┐
                     │
                     └─── begin_checkout ───┐
                                              │
                                              └─── purchase
                          drop-off
                          ↓
                          (-58 %)
```

5 étapes, largeur de bande proportionnelle au volume, drop-offs
visibles entre chaque étape.

**Implémentation V1** : layout fixe horizontal, calculé en JS,
rendu SVG simple (pas de lib sankey).

## 13. `<FunnelDropoffTable>`

| Étape              | Volume  | Drop-off          | Conversion vs étape précédente |
| ------------------ | ------- | ----------------- | ------------------------------ |
| view_item          | 12 400  | —                 | —                              |
| add_to_cart        | 4 800   | -7 600 (-61 %)    | 38.7 %                         |
| begin_checkout     | 2 100   | -2 700 (-56 %)    | 43.7 %                         |
| add_payment_info   | 1 580   | -520 (-25 %)      | 75.2 %                         |
| purchase           | 1 240   | -340 (-21 %)      | 78.5 %                         |

Une ligne par étape avec drop-off chiffré et taux de conversion
inter-étape.

## 14. Choix de stack

### 14.1 SVG custom > recharts

| Aspect                | Recharts (95 kB gzip) | SVG custom (5 kB gzip)         |
| --------------------- | --------------------- | ------------------------------ |
| Bundle                | gros                  | trivial                         |
| Animation native       | oui                    | manuelle (CSS keyframes)       |
| Charge React          | recursive components  | un seul `<svg>`                 |
| A11y                  | configurable          | par défaut                       |
| Personnalisation       | difficile             | totale                          |
| Compromis            | fonctionnalités riches  | layout manuel                  |

### 14.2 Pas de lib externe au-delà de SWR

- SWR : déjà utilisé, ~ 14 kB gzip
- `react-virtuoso` : peut-être pour les tables > 50 lignes (V2)

### 14.3 Helpers communs

```ts
// lib/analytics/insights/client/chart-helpers.ts
export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (v: number) => r0 + ((v - d0) / Math.max(1e-6, d1 - d0)) * (r1 - r0);
}

export function formatNumber(v: number): string {
  return v.toLocaleString('fr-FR');
}

export function formatPercent(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)} %`;
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
```

## 15. Tests visuels

Stories Storybook (V2 nice-to-have) :
- chaque chart × 5 fixtures (vide, 1 point, 30 points, 60 points, 365 points)
- chaque KPI × 5 variations (positive, négative, zéro, undefined, null)

## 16. Lecture suivante

- [05 — UI / UX & design](05-ui-ux-design.md) pour la charte.
- [09 — Tests](09-tests.md) pour les tests des composants.
