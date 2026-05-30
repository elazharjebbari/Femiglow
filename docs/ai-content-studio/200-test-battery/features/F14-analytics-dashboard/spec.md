# F14 -- Analytics Dashboard

## Feature ID
F14

## Source File
`apps/web/src/app/admin/content-studio-v2/ai-engine/analytics/page.tsx`

## URL
`/admin/content-studio-v2/ai-engine/analytics`

## Description

The Analytics Dashboard provides operators with a comprehensive view of AI Engine
usage, costs, quality metrics, node health, and job history. It fetches data from
a single analytics API endpoint and renders four sections: KPI cards, node health
summary, cost breakdown charts (by provider and by node), and a recent jobs table.

## Data Fetching

### API Contract

**GET** `/api/admin/ai-engine/analytics?period={day|week|month}&includeNodeMetrics=true`

Response shape (`AnalyticsData`):
```typescript
interface AnalyticsData {
  overview: {
    generationsToday: number;
    generationsWeek: number;
    generationsMonth: number;
    costTodayCents: number;
    costWeekCents: number;
    costMonthCents: number;
    avgQualityScore: number;   // 0.0 - 1.0
    successRate: number;        // percentage 0 - 100
    errorRate: number;          // percentage 0 - 100
  };
  nodeMetrics: NodeMetric[];    // per-node health data
  costByProvider: Array<{ provider: string; costCents: number; count: number }>;
  costByNode: Array<{ nodeName: string; costCents: number; count: number }>;
  recentJobs: Array<{
    id: string;
    status: string;            // completed, failed, pending, running
    platform: string;
    format: string;
    contentType: string;
    totalCostCents: string;    // string, parsed with parseFloat
    durationMs: number | null;
    createdAt: string;         // ISO 8601
  }>;
}
```

### NodeMetric Shape
```typescript
interface NodeMetric {
  nodeId: string;
  label: string;
  provider: string;
  avgLatencyMs: number;
  avgCostCents: number;
  totalInvocations: number;
  errorCount: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'error';
}
```

### Fetch Behavior

- Fetches on mount and when `period` changes via `useEffect`
- Loading state shows shimmer skeleton placeholders (4 animated divs)
- Error state shows red banner with "Impossible de charger les analytiques"
  and a "Reessayer" button
- Period selector triggers re-fetch when changed

## UI Sections

### Header

- Back arrow linking to `/admin/content-studio-v2/ai-engine`
- Eyebrow: "AI Engine"
- Title: "Analytiques" (`cs-display`, `--cs-text-xl`)
- Right side: PeriodSelector, Actualiser button, Graphe link, Configuration link

### Period Selector

Three-button segmented control:
| Period | Label | Value |
|---|---|---|
| Day | "Dernieres 24h" | `day` |
| Week | "7 jours" | `week` |
| Month | "30 jours" | `month` |

Default: `month`

Active button styling: elevated background, hair border, bold, shadow.
Inactive: transparent background, muted color.

### KPI Cards (4-column responsive grid)

Grid: `repeat(auto-fit, minmax(200px, 1fr))`

| Card | Icon | Label | Value | Sub-text |
|---|---|---|---|---|
| Generations | Activity | "Generations aujourd'hui" | `overview.generationsToday` | "{week} cette semaine / {month} ce mois" |
| Cost | DollarSign | "Cout total (mois)" | `{costMonthCents/100} MAD` | "{costTodayCents/100} MAD aujourd'hui" |
| Quality | Star | "Qualite moyenne" | `{avgQualityScore*100}%` | "Score moyen sur le mois" |
| Success | CheckCircle2 | "Taux de succes" | `{successRate}%` | "{errorRate}% taux d'erreur" |

Each KPI card has a 36px icon circle, uppercase label with letter-spacing,
large display value, and smaller sub-text.

### Node Health Summary

Conditionally rendered when `nodeMetrics.length > 0`.

- Header: Activity icon + "Sante des noeuds du pipeline" + link to Graph view
- Nodes rendered as compact cards in flex-wrap layout
- Each node card shows:
  - Left border colored by status (green/amber/red)
  - Node label (bold)
  - Invocation count, average cost, error count (if > 0)
- Empty state: message about no data for period

### Cost Charts (2-column grid)

Two BarChart components side by side:

**Cost by Provider**:
- TrendingUp icon, heading "Cout par fournisseur"
- Provider colors: openai=accent, anthropic=saffron, google=sage, elevenlabs=violet, ollama=clay
- Format: `{cents/100} MAD`
- Shows count of API calls per provider

**Cost by Node**:
- TrendingUp icon (sage), heading "Cout par noeud"
- NODE_LABELS maps internal IDs to French labels
- Different color per node type
- Empty state: "Aucune donnee de cout disponible"

### BarChart Component

Each bar shows:
- Label (left), count "N appels" + formatted value (right)
- Horizontal progress bar with proportional width (relative to max)
- Smooth transition animation

### Recent Jobs Table

- Header: Activity icon + "Generations recentes" + badge "{count} resultats"
- Columns: Statut, Plateforme, Format, Type, Cout, Duree, Date
- Status column uses Badge component with tone mapping:
  - completed -> success, "Termine"
  - failed -> danger, "Echoue"
  - pending -> neutral, "En attente"
  - running -> warning, "En cours"
- Cost formatted as `(parseFloat(totalCostCents) / 100).toFixed(2) + " MAD"`
- Duration formatted: null -> "-", <1000 -> "Xms", >=1000 -> "X.Xs"
- Date formatted relative: <1min -> "maintenant", <60min -> "il y a Xm",
  <24h -> "il y a Xh", else -> "DD Mon"

## Loading State

Four shimmer skeleton placeholders with increasing heights (60, 100, 200, 300px).
Uses CSS animation `cs-shimmer 1.6s ease-in-out infinite` with linear gradient.

## Error State

- Red bordered section with AlertTriangle icon
- "Impossible de charger les analytiques" heading
- Error message text
- "Reessayer" ghost button calling `fetchAnalytics(period)`

## Dependencies

- lucide-react: ArrowLeft, Activity, DollarSign, Star, CheckCircle2, AlertTriangle,
  RefreshCw, Clock, TrendingUp, GitBranch
- Button, Badge primitives from CS v2 design system
- next/link for navigation
