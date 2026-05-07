# 04 — UI Design System Analytics

> Tokens, primitives partagées et règles de composition pour les 5 onglets `/admin/analytics/*`. Tout ici est **dérivé du système admin existant** (`stone-*` + brand FemiGlow) — aucun nouveau token global. Le but : un dashboard sobre, dense, lisible, accessible.

## 1. Principes UX

| # | Principe | Conséquence concrète |
|---|---|---|
| 1 | **Lecture en F** | KPI cards en haut (zone scan), graph principal au centre, tableaux/listes en bas. |
| 2 | **Densité maîtrisée** | 4 KPI par rangée max sur desktop, 2 sur tablet, 1 sur mobile. Pas de placeholder vide. |
| 3 | **Information avant décoration** | Pas d'icônes décoratives. Une seule icône par card (catégorie sémantique). Pas de gradients. |
| 4 | **États systématiques** | Chaque composant data-driven a 4 états : loading, empty, error, ready. Pas de fallback silencieux. |
| 5 | **Filters non-modal** | Les filtres restent dans un sticky header sous les Tabs. Jamais de modal qui cache le contenu. |
| 6 | **Brand sans bruit** | UI chrome stone neutre, **couleurs brand réservées aux courbes**. Le dashboard ne doit pas concurrencer le site public. |
| 7 | **Live = signal**, pas spectacle | Indicateur live = pastille pulsante 8 px + horodatage relatif. Pas d'animation décorative. |
| 8 | **Accessible par défaut** | Tous les graphs doublent leur sortie d'un tableau ARIA `<table role="table">` masqué visuellement (sr-only). |

## 2. Tokens admin (rappel + extensions)

> Les tokens admin existent déjà (cf. `apps/web/src/components/admin/*`) — on les **réutilise** sans en créer de nouveaux globaux. Ce qui suit est la **carte de référence** pour le dashboard.

### 2.1 Couleurs UI

| Rôle | Tailwind | Hex | Usage |
|---|---|---|---|
| Surface base | `bg-stone-50` | `#FAFAF9` | Fond de page |
| Surface card | `bg-white` | `#FFFFFF` | Cards KPI, panneaux |
| Border subtle | `border-stone-200` | `#E7E5E4` | Bordure card, divider |
| Border strong | `border-stone-300` | `#D6D3D1` | Bordure focus |
| Text primary | `text-stone-900` | `#1C1917` | Valeurs KPI, titres |
| Text secondary | `text-stone-600` | `#57534E` | Labels, axes |
| Text muted | `text-stone-400` | `#A8A29E` | Aide, placeholders |
| Success | `text-emerald-600` `bg-emerald-50` | — | Variation positive |
| Warning | `text-amber-600` `bg-amber-50` | — | Alerte douce |
| Danger | `text-rose-600` `bg-rose-50` | — | Variation négative, error |

### 2.2 Couleurs courbes (palette brand)

| Catégorie | Tailwind ref | Hex | Quand l'utiliser |
|---|---|---|---|
| **Sauge** | `--brand-sauge` | `#7E9885` | Sessions, sessions_unique, métrique principale |
| **Ciel** | `--brand-ciel` | `#A6BFD8` | Conversions, achats |
| **Champagne** | `--brand-champagne` | `#D9C39A` | CTA / engagement |
| **Pétale** | `--brand-petale` | `#D7AAB1` | Live, alertes positives |
| **Encre** | `--brand-encre` | `#1B1B1B` | Total / overlay |
| **Brume** | `--brand-brume` | `#9C9890` | Comparaison période précédente (en pointillés) |

> **Règle** : 1 graph = 4 séries max. Au-delà, on passe en stacked bar ou on regroupe dans « Autre ».

### 2.3 Typographie

| Usage | Classe | Notes |
|---|---|---|
| Valeur KPI | `font-display text-3xl font-medium tabular-nums` | Cormorant pour le chiffre, tabular pour alignement |
| Variation (delta) | `text-sm font-medium tabular-nums` | Toujours préfixée par `↑` `↓` `→` |
| Label KPI | `text-sm uppercase tracking-wide text-stone-500` | |
| Titre section | `font-display text-xl text-stone-900` | |
| Texte standard | `text-sm text-stone-700` | |
| Code / event_name | `font-mono text-xs text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded` | |

### 2.4 Espacement & rythmique

- Grille principale : `grid-cols-12 gap-6` (24 px gutter).
- Padding card : `p-5` (20 px).
- Section vertical rhythm : `space-y-8` entre blocs majeurs, `space-y-4` interne.
- Mobile : `grid-cols-1 gap-4`, padding `p-4`.

### 2.5 Élévation

| Niveau | Classe | Usage |
|---|---|---|
| 0 (flat) | `border border-stone-200` | Cards par défaut |
| 1 (soft) | `border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]` | Card hover, sticky header |
| 2 (popover) | `border border-stone-200 shadow-[0_8px_24px_rgba(0,0,0,0.08)]` | DatePicker, dropdowns |

> **Pas de `shadow-lg` ni d'ombre Tailwind par défaut** : trop bleutée, casse le ton stone.

## 3. Primitives partagées

> Toutes dans `apps/web/src/components/admin/analytics/primitives/`. Aucune ne dépend d'un onglet spécifique.

### 3.1 `<AnalyticsTabs>`

Wrapper sur la nav `/admin/analytics`. URL-driven.

```tsx
// /admin/analytics/layout.tsx
<AnalyticsTabs current={pathname}>
  <Tab href="/admin/analytics" label="Vue d'ensemble" />
  <Tab href="/admin/analytics/live" label="Live" badge={<LivePulse />} />
  <Tab href="/admin/analytics/funnel" label="Funnel" />
  <Tab href="/admin/analytics/cta" label="CTA" />
  <Tab href="/admin/analytics/checkout" label="Checkout" />
</AnalyticsTabs>
```

**Style** : barre horizontale `border-b border-stone-200`, items `py-3 px-4 text-sm`, active = `border-b-2 border-stone-900 text-stone-900`, inactive = `text-stone-500 hover:text-stone-900`. Le badge Live est une pastille `w-2 h-2 bg-rose-500 rounded-full animate-pulse`.

**Mobile** : devient un `<select>` natif si `< sm` pour gain de place.

### 3.2 `<FilterBar>`

Sticky sous les tabs, contient 3 selects (period, device, traffic) + bouton « Reset ».

```tsx
<FilterBar
  filters={filters}                  // AnalyticsFilters
  onChange={(next) => setFilters(next)}
  options={{ traffic: trafficSources }}
  showCustomRange                    // active le picker "Custom"
/>
```

**Layout** : `sticky top-14 bg-stone-50/95 backdrop-blur border-b border-stone-200 py-3 z-20`. Items en `flex flex-wrap gap-3`. Chaque select = un `<Select>` admin.

**Persistence** : `useAnalyticsFilters()` hook → URL params + localStorage `fg_analytics_filters` (TTL 30 jours).

**Defaults** : Mobile · Aujourd'hui · Tout traffic (cf. `02-data-model.md` §3.4).

**Comportement custom** : sélection "Custom" → ouvre un `<DateRangePicker>` (popover). Apply met à jour `?from=...&to=...` dans l'URL.

**A11y** : chaque select a un label visible (`text-xs uppercase`) au-dessus, pas seulement un placeholder. `aria-controls="analytics-content"` pour annoncer le rafraîchissement.

### 3.3 `<KpiCard>`

L'atome principal de la Vue d'ensemble.

```tsx
<KpiCard
  label="Sessions"
  value={12340}
  format="number"                    // "number" | "currency" | "percent" | "duration"
  delta={{ value: 0.124, direction: 'up' }}
  comparisonLabel="vs 7j précédents"
  icon={<UsersIcon />}                // optional, sémantique
  loading={false}
  href="/admin/analytics?period=7d"  // optional, click-through
/>
```

**Anatomy** :

```
┌─────────────────────────────────────┐
│ [icon]  SESSIONS                    │  ← label uppercase tracking-wide
│                                     │
│  12 340                             │  ← font-display text-3xl tabular-nums
│  ↑ 12,4 %  vs 7j précédents         │  ← delta + comparison
└─────────────────────────────────────┘
```

**Loading** : Skeleton avec `animate-pulse` sur 3 lignes (label / valeur / delta).
**Empty** : Valeur affiche `—`, delta masqué.
**Format helpers** : `formatNumber`, `formatPercent`, `formatDuration` (mm:ss), `formatCurrency` (réutilise `formatPrice` existant).

### 3.4 `<ChartFrame>`

Wrapper standard pour tous les graphs Recharts. Gère titre, légende, états, exports.

```tsx
<ChartFrame
  title="Sessions par jour"
  description="Évolution sur la période sélectionnée"
  loading={isLoading}
  empty={data.length === 0}
  error={error}
  actions={<ExportCsvButton data={data} filename="sessions-7d.csv" />}
>
  <ResponsiveContainer width="100%" height={320}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
      <XAxis dataKey="bucket" tickFormatter={formatBucket} stroke="#A8A29E" />
      <YAxis stroke="#A8A29E" />
      <Tooltip content={<AnalyticsTooltip />} />
      <Line type="monotone" dataKey="sessions" stroke="var(--brand-sauge)" strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
</ChartFrame>
```

**États** :
- `loading` → Skeleton de hauteur `h-80` avec barres animées.
- `empty` → Illustration SVG sobre + texte « Aucune donnée pour cette plage ».
- `error` → Encadré `bg-rose-50 border-rose-200` avec message + bouton « Réessayer ».

**Tooltip custom** (`<AnalyticsTooltip>`) : pas de tooltip Recharts par défaut (gris foncé moche). On rend `<div className="rounded border border-stone-200 bg-white px-3 py-2 shadow-md">` avec valeurs alignées tabular.

**Export CSV** : tous les graphs ont un menu `…` → "Exporter CSV" qui sérialise les données affichées (post-filtre).

### 3.5 `<DataTable>`

Tableau standardisé pour listes (top pages, top CTA, top sources). Pagination côté serveur via URL `?page=`.

```tsx
<DataTable
  columns={[
    { key: 'page_route', label: 'Page', cell: (r) => <code>{r.page_route}</code> },
    { key: 'sessions', label: 'Sessions', align: 'right', format: 'number' },
    { key: 'cr', label: 'CR', align: 'right', format: 'percent', bar: true },
  ]}
  rows={rows}
  total={total}
  page={page}
  pageSize={20}
  loading={isLoading}
  empty={<EmptyState message="Aucune page tracée." />}
/>
```

**Bar inline** : si `column.bar = true`, on affiche une mini-barre horizontale derrière la valeur (`bg-sauge/10`, width = value/max). Lecture ultra-rapide du leader.

**Tri** : entête cliquable, indicateur `↑` / `↓`. `?sort=cr&dir=desc` dans l'URL.

### 3.6 `<FunnelStepper>` (spécifique funnel mais primitive)

Représentation horizontale ou verticale du funnel.

```tsx
<FunnelStepper
  orientation="horizontal"  // "horizontal" | "vertical"
  steps={[
    { label: 'Vues kit', value: 12340, share: 1.0 },
    { label: 'Add to cart', value: 1234, share: 0.10, drop: 0.90 },
    { label: 'Checkout init', value: 567, share: 0.046, drop: 0.54 },
    { label: 'Achat', value: 89, share: 0.007, drop: 0.84 },
  ]}
  showDrop                 // affiche les % d'abandon
/>
```

Dérive d'une lecture **funnel chart** classique (largeur trapézoïdale) en mode horizontal, ou **stairs** en mode vertical (pour le détail step-by-step).

### 3.7 `<LivePulse>` & `<LiveBadge>`

Petits composants pour signaler l'actif.

```tsx
<LivePulse />            // pastille rouge pulsante 8 px
<LiveBadge value={42} />  // "42 en ligne · maintenant"
```

`LivePulse` = `<span className="relative inline-flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" /></span>`.

### 3.8 `<EmptyState>` & `<ErrorState>`

Composants d'état génériques. Acceptent `title`, `message`, `action` (bouton optionnel). Illustrations SVG inline (pas d'images externes).

### 3.9 `<Skeleton>`

Réutilisé. `<Skeleton className="h-4 w-32" />`. Animation `animate-pulse`.

### 3.10 `<ExportCsvButton>` & `<ExportPngButton>`

- CSV : sérialise une `data: Array<Record>` en RFC 4180, BOM UTF-8 pour Excel FR.
- PNG : `html2canvas` lazy-loaded sur le `ChartFrame` ciblé.

## 4. Layouts par onglet

### 4.1 Vue d'ensemble (`/admin/analytics`)

```
┌────────────────────────────────────────────────────────────┐
│  AnalyticsTabs                                              │
├────────────────────────────────────────────────────────────┤
│  FilterBar (Period · Device · Traffic · Custom · Reset)     │
├────────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  ┌────┐ ┌────┐                │
│  │KPI │ │KPI │ │KPI │ │KPI │  │KPI │ │KPI │  ← 6 KPI cards │
│  └────┘ └────┘ └────┘ └────┘  └────┘ └────┘                │
│                                                            │
│  ┌──────────────────────────────────────┐ ┌──────────────┐ │
│  │   Chart : Sessions / jour            │ │ Top sources  │ │
│  │   (8 cols)                           │ │ (4 cols)     │ │
│  └──────────────────────────────────────┘ └──────────────┘ │
│                                                            │
│  ┌──────────────────────┐ ┌──────────────────────────────┐ │
│  │ Chart : CR / jour    │ │ DataTable : Top pages        │ │
│  │ (6 cols)             │ │ (6 cols)                     │ │
│  └──────────────────────┘ └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Live (`/admin/analytics/live`)

```
┌───────────────────────────────────────────────────────────────┐
│ AnalyticsTabs                                                  │
├───────────────────────────────────────────────────────────────┤
│ FilterBar (réduite : seulement window 1h/2h/3h)                │
├───────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐  ← Online users · Conv 1h · CTA hits  │
│ │BIG  │ │BIG  │ │BIG  │    (cards XL avec LivePulse)          │
│ └─────┘ └─────┘ └─────┘                                        │
│                                                                │
│ ┌──────────────┐ ┌────────────────┐ ┌────────────────────┐    │
│ │ Par page     │ │ Par source     │ │ Par device         │    │
│ │ (DataTable   │ │ (DonutChart)   │ │ (DonutChart)       │    │
│ │  rolling)    │ │                │ │                    │    │
│ └──────────────┘ └────────────────┘ └────────────────────┘    │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Datalayer event flow (live stream, last 50 events)        │  │
│ │ scroll-up, format : [hh:mm:ss] event_name · page · device│  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Funnel TOF/MOF/BOF live (sliding 1h window)               │  │
│ └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Funnel (`/admin/analytics/funnel`)

```
┌────────────────────────────────────────────────────────────┐
│ AnalyticsTabs                                              │
├────────────────────────────────────────────────────────────┤
│ FilterBar                                                  │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ FunnelStepper horizontal (5 stages)                    │ │
│ │ View · Engage · CTA · Checkout · Purchase              │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────┐ ┌──────────────────────────────┐    │
│ │ Drop-off rates     │ │ Funnel × pages (Sankey)       │    │
│ │ (BarChart)         │ │ flux page → step                │    │
│ └────────────────────┘ └──────────────────────────────┘    │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ DataTable : par page, view → cta → purchase rates       │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 4.4 CTA (`/admin/analytics/cta`)

```
┌────────────────────────────────────────────────────────────┐
│ FilterBar                                                  │
├────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ← CTA total · click rate ·     │
│ │KPI │ │KPI │ │KPI │ │KPI │   conversion rate · revenue   │
│ └────┘ └────┘ └────┘ └────┘                                │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ DataTable : CTA components × impressions / clicks /    │ │
│ │ purchase_within_7d / CR / page_route                   │ │
│ │ (sortable, exportable)                                 │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────┐ ┌──────────────────────────────┐  │
│ │ Top messages         │ │ Top pages → achat            │  │
│ │ (par button label)   │ │ (page_route → CR)            │  │
│ └──────────────────────┘ └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 4.5 Checkout (`/admin/analytics/checkout`)

```
┌────────────────────────────────────────────────────────────┐
│ FilterBar                                                  │
├────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ← View cart · Begin · Submit · │
│ │KPI │ │KPI │ │KPI │ │KPI │   Purchase / abandons         │
│ └────┘ └────┘ └────┘ └────┘                                │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ FunnelStepper checkout fin                              │ │
│ │ View → Begin → Shipping → Payment → Submit → Purchase  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────┐ ┌──────────────────────────────┐  │
│ │ Form errors          │ │ Time to submit (histogram)    │  │
│ │ (top 10 par champ)   │ │ Distribution P25/P50/P75/P95 │  │
│ └──────────────────────┘ └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## 5. Responsive

| Breakpoint | Comportement |
|---|---|
| `< sm` (mobile) | Tabs → `<select>` natif. KPI grid `grid-cols-1`. Charts hauteur réduite à `h-56`. Sticky FilterBar passe en accordéon. |
| `sm–md` (tablet) | KPI `grid-cols-2`. Charts pleine largeur. FilterBar wrap. |
| `≥ lg` (desktop) | Layout cible (12 cols). |

## 6. Dark mode

Hors scope V1. La structure est compatible (variables CSS tokenisées), mais on **ne livre pas de variantes dark** dans les composants. Dette assumée.

## 7. États & interactions

### 7.1 Loading

- **Au-dessus du fold (KPI cards)** : Skeleton pendant `< 200 ms`, sinon Suspense fallback.
- **Charts** : Skeleton avec barres animées, hauteur identique au chart final pour éviter le layout shift.
- **Tableaux** : Skeleton 5 rows.
- **SSE Live** : pas de loading (la première frame remplit).

### 7.2 Erreur

- Tout fetch échoué affiche `<ErrorState>` dans le composant concerné. Pas de bandeau global.
- 401/403 → redirect vers `/admin` (handled by middleware admin).
- 500 → message « Une erreur est survenue, réessayez. » + `Sentry.captureException` (déjà en place côté API).

### 7.3 Empty

- KPI : valeur `—`, label inchangé, delta masqué.
- Charts : SVG d'illustration sobre + texte. Pas de "Aucune donnée."
- Live : "En attente d'événements…" + LivePulse.

### 7.4 Hover / focus

- Cards : `hover:border-stone-300` (subtle).
- Liens : `focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 focus:ring-offset-stone-50`.
- Boutons : variants admin existants (réutilisés).

## 8. Accessibilité

| Élément | Règle |
|---|---|
| Toutes les cards KPI | `role="group"` + `aria-labelledby` pointant vers le label |
| Tous les charts | Sortie tabulaire `<table role="table" className="sr-only">` clone des données |
| Couleurs courbes | Contraste vérifié (≥ 3:1 sur fond blanc) ; **jamais comme seul indicateur** — toujours doublé d'un label |
| FilterBar | Live-region `aria-live="polite"` pour annoncer "Données mises à jour" |
| Live (SSE) | Pas d'auto-scroll perturbant ; nouveau event = highlight 800 ms puis fade |
| Touch targets | ≥ 44 × 44 px sur mobile (boutons, selects) |
| Reduced motion | `@media (prefers-reduced-motion)` désactive `animate-pulse` et `animate-ping` |

## 9. Performance

| Mesure | Cible | Levier |
|---|---|---|
| LCP `/admin/analytics` | < 1.5 s | RSC, queries paralléllisées via `Promise.all`, matviews |
| Bundle JS analytics | < 80 KB gzipped | Recharts treeshaké, pas de lodash, primitives partagées |
| CLS | 0 | Skeleton hauteur fixe |
| Time to interactive Live | < 800 ms | SSE = pas de polling initial |
| Mémoire long-running Live | < 50 MB | Buffer max 100 events côté client, FIFO |

## 10. Anti-patterns à éviter

- ❌ Émojis dans les labels KPI ("📈 Sessions"). Bannis.
- ❌ Tooltips Recharts par défaut (gris foncé) → toujours custom.
- ❌ Couleurs sémantiques (rouge = mauvais) hors variation : on ne colore pas un KPI en rouge parce qu'il baisse.
- ❌ `Math.random()` ou `Date.now()` dans le rendu RSC (hydration mismatch).
- ❌ Auto-refresh agressif (< 3 s) — sauf SSE Live.
- ❌ Tableaux avec scroll horizontal sans indicateur visuel.
- ❌ Modal qui contient toutes les actions filtres.

## 11. Inventaire fichiers à créer

```
apps/web/src/components/admin/analytics/
├── primitives/
│   ├── AnalyticsTabs.tsx
│   ├── FilterBar.tsx
│   ├── KpiCard.tsx
│   ├── ChartFrame.tsx
│   ├── AnalyticsTooltip.tsx
│   ├── DataTable.tsx
│   ├── FunnelStepper.tsx
│   ├── LivePulse.tsx
│   ├── LiveBadge.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   ├── ExportCsvButton.tsx
│   ├── ExportPngButton.tsx
│   └── index.ts
├── hooks/
│   ├── useAnalyticsFilters.ts
│   ├── useAnalyticsSSE.ts
│   └── useAnalyticsExport.ts
├── overview/
│   ├── OverviewKpiGrid.tsx
│   ├── OverviewSessionsChart.tsx
│   ├── OverviewTopSources.tsx
│   └── OverviewTopPages.tsx
├── live/
│   ├── LiveKpiBig.tsx
│   ├── LiveByPage.tsx
│   ├── LiveBySource.tsx
│   ├── LiveByDevice.tsx
│   ├── LiveEventStream.tsx
│   └── LiveFunnel.tsx
├── funnel/
│   ├── FunnelGlobal.tsx
│   ├── FunnelDropOff.tsx
│   ├── FunnelByPageSankey.tsx
│   └── FunnelDataTable.tsx
├── cta/
│   ├── CtaKpiGrid.tsx
│   ├── CtaTable.tsx
│   ├── CtaTopMessages.tsx
│   └── CtaTopPages.tsx
└── checkout/
    ├── CheckoutKpiGrid.tsx
    ├── CheckoutFunnel.tsx
    ├── CheckoutFormErrors.tsx
    └── CheckoutTimeToSubmit.tsx
```

## 12. Aperçus mockup ASCII

### KpiCard

```
┌─────────────────────┐
│ ⚪  SESSIONS         │
│                     │
│ 12 340              │
│ ↑ 12,4 %  vs 7j     │
└─────────────────────┘
```

### FilterBar

```
┌───────────────────────────────────────────────────────────────────────┐
│ PÉRIODE          DEVICE         TRAFIC           [Reset]              │
│ [Aujourd'hui▾]   [Mobile▾]      [Tout traffic▾]                       │
└───────────────────────────────────────────────────────────────────────┘
```

### FunnelStepper horizontal

```
┌──────┐──┐┌─────┐──┐┌────┐──┐┌────┐──┐┌──┐
│      │  ││     │  ││    │  ││    │  ││  │
│ View │ →│Engage│ →│ CTA│ →│Chk │ →│Buy│
│12 340│  ││ 6789│  ││1234│  ││ 567│  ││ 89│
│ 100% │  ││ 55% │  ││ 10%│  ││4.6%│  ││0.7│
└──────┘──┘└─────┘──┘└────┘──┘└────┘──┘└──┘
   ↘ -45%    ↘ -82%     ↘ -54%     ↘ -84%
```

### LiveEventStream

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚫ Live · 42 en ligne                       last 50 events ▾ pause │
├────────────────────────────────────────────────────────────────────┤
│ 14:23:51  view_item              /kit                  mobile · FR │
│ 14:23:48  cta_click              /kit#hero-cta         mobile · FR │
│ 14:23:42  scroll_depth_75        /kit                  mobile · FR │
│ 14:23:31  add_to_cart            /kit                  mobile · FR │
│ ...                                                                │
└────────────────────────────────────────────────────────────────────┘
```

## 13. Dépendances UI runtime

| Package | Version | Pourquoi |
|---|---|---|
| `recharts` | ^2.13 | Charting (SVG, RSC-compatible) |
| `react-day-picker` | ^9.x | DateRangePicker custom range |
| `swr` | déjà installé | Polling Live + cache client |
| `html2canvas` | lazy-loaded | Export PNG ChartFrame |
| `papaparse` | déjà installé (export CSV existant) | Sérialisation CSV |

> Pas de Tremor (trop opinion sur la couleur), pas de visx (trop bas niveau pour le ratio temps/feature), pas d'ApexCharts (canvas, accessibilité moindre).

## 14. Référence tokens (extrait `tailwind.config.ts`)

```ts
// Aucun changement requis — les tokens existent déjà.
// Référence pour rappel :
extend: {
  colors: {
    sauge: { DEFAULT: '#7E9885', /* échelles */ },
    ciel: { DEFAULT: '#A6BFD8' },
    champagne: { DEFAULT: '#D9C39A' },
    petale: { DEFAULT: '#D7AAB1' },
    encre: { DEFAULT: '#1B1B1B' },
    brume: { DEFAULT: '#9C9890' },
  },
  fontFamily: {
    display: ['var(--font-cormorant)', 'serif'],
    sans: ['var(--font-inter)', 'sans-serif'],
  },
}
```

> Si `brume` n'est pas dans `tailwind.config` (cf. flag promo phase), on l'ajoute en **migration de tokens** (PR isolée, hors scope analytics, mais pré-requis pour les courbes de comparaison).

---

**Suite** : `05-onglets-specs.md` — specs détaillées (KPI list, queries, edge cases) par onglet.
