# F15 -- Trends (Veille & Tendances)

## Feature ID
F15

## Source File
`apps/web/src/app/admin/content-studio-v2/ai-engine/trends/page.tsx`

## URL
`/admin/content-studio-v2/ai-engine/trends`

## Description

The Trends page provides a trend intelligence dashboard that surfaces social media
and cultural trends scored for brand relevance to FemiGlow. Each trend is analyzed
across four dimensions (brand relevance, viral potential, time sensitivity, content
feasibility) and receives a composite score. Operators can filter by category, refresh
trend data, and directly create content from a specific trend.

## Data Fetching

### API Contract

**GET** `/api/admin/ai-engine/trends?limit=30&minScore=0.3[&refresh=true][&categories={cat}]`

Response:
```typescript
interface TrendsResponse {
  trends: ScoredTrend[];
  meta: { count: number; minScore: number; timestamp: string };
}
```

### ScoredTrend Shape

```typescript
interface ScoredTrend {
  id: string;
  source: string;           // seasonal, evergreen, reddit, google_trends, tiktok, instagram, manual
  category: string;          // ingredient, routine, aesthetic, cultural, seasonal, product, celebrity, meme, news
  title: string;
  description: string;
  originalUrl?: string;
  brandRelevance: number;    // 0.0 - 1.0
  viralPotential: number;    // 0.0 - 1.0
  timeSensitivity: number;   // 0.0 - 1.0
  contentFeasibility: number; // 0.0 - 1.0
  compositeScore: number;    // 0.0 - 1.0 (weighted aggregate)
  suggestedFormats: string[];
  suggestedHooks: string[];
  opportunityWindow: string;
  riskAssessment: 'low' | 'medium' | 'high';
  detectedAt: string;        // ISO 8601
  status: string;
}
```

### Fetch Behavior

- Fetches on mount with default params: `limit=30`, `minScore=0.3`
- Loading state: 4 placeholder skeleton cards (160px height)
- Empty state: centered TrendingUp icon with "Aucune tendance detectee" message
  and "Lancer une collecte" refresh button
- Refresh: `fetchTrends(true)` adds `refresh=true` param
- Category filter: adds `categories={selectedCategory}` param

## UI Sections

### Header

- Eyebrow: "AI Engine"
- Title: "Veille & Tendances" (`cs-display`, `--cs-text-2xl`)
- Actions:
  - "Actualiser" button (ghost, RefreshCw icon, spins during refresh)
  - "Dashboard" link to `/admin/content-studio-v2/ai-engine`

### Category Filters

Horizontal pill buttons derived from unique categories in the trends data.

- "Toutes" button (always first, active when no filter selected)
- Dynamic category buttons from `[...new Set(trends.map(t => t.category))]`
- Toggle behavior: click same category to deselect, click different to switch
- Active pill: colored background matching `CATEGORY_COLORS`, white text
- Inactive pill: transparent background, border, secondary text

### Category Mappings

| Value | French Label | Color |
|---|---|---|
| ingredient | Ingredient | #8B5CF6 |
| routine | Routine | #3B82F6 |
| aesthetic | Esthetique | #EC4899 |
| cultural | Culturel | #F59E0B |
| seasonal | Saisonnier | #10B981 |
| product | Produit | #6366F1 |
| news | Actualite | #EF4444 |
| celebrity | Celebrite | (default accent) |
| meme | Meme | (default accent) |

### Source Mappings

| Value | French Label |
|---|---|
| seasonal | Saisonnier |
| evergreen | Permanent |
| reddit | Reddit |
| google_trends | Google Trends |
| tiktok | TikTok |
| instagram | Instagram |
| manual | Manuel |

### Trend Cards

Each trend is rendered as an `<article>` element with:

**Header row:**
- Category badge (colored pill with category label)
- Source label (text, muted color)
- Risk indicator (AlertTriangle icon + label, only for medium/high risk)
- Composite score (large number in a gradient box, right-aligned)

**Title & Description:**
- Title: `cs-display` font, `--cs-text-base`, weight 500
- Description: secondary color, 1.5 line height

**Score Bars (2x2 grid):**

| Label | Key | Color |
|---|---|---|
| Marque | brandRelevance | var(--cs-accent) |
| Viralite | viralPotential | #EC4899 |
| Urgence | timeSensitivity | #F59E0B |
| Faisabilite | contentFeasibility | #10B981 |

Each ScoreBar shows: label (80px width), progress bar, numeric value (0-100).

**Footer row:**
- Suggested formats as gray pills
- Opportunity window with Clock icon
- External link icon (if `originalUrl` exists)
- "Creer un contenu" button with Sparkles icon

### Create Content Link

Each trend card links to the create page with pre-filled parameters:
```
/admin/content-studio-v2/ai-engine/create?trend={encodeURIComponent(title)}&category={category}
```

### Risk Assessment

| Level | French Label | Color |
|---|---|---|
| low | Faible | var(--cs-success) |
| medium | Moyen | var(--cs-warning) |
| high | Eleve | var(--cs-danger) |

Risk indicator only displayed for medium and high risk trends.

### Composite Score Display

- Rendered in a 56x56px gradient box (category color 15% to 30% opacity)
- Score as integer percentage: `Math.round(compositeScore * 100)`
- Monospace font, large size, category-colored text

## Loading State

4 skeleton placeholder cards (160px each) with elevated background and border.

## Empty State

- Large TrendingUp icon (32px, muted)
- Message: "Aucune tendance detectee pour le moment."
- "Lancer une collecte" ghost button (triggers refresh)

## Refresh Behavior

- "Actualiser" button in header triggers `fetchTrends(true)`
- Sets `refreshing=true` state (separate from initial `loading`)
- RefreshCw icon gets `animate-spin` class during refresh
- Button disabled while refreshing

## Dependencies

- lucide-react: TrendingUp, RefreshCw, Sparkles, Clock, Target, Zap,
  AlertTriangle, ExternalLink, Filter
- Button primitive from CS v2 design system
- next/link for navigation
