# F16 -- Graph Visualization

## Feature ID
F16

## Source File
`apps/web/src/app/admin/content-studio-v2/ai-engine/graph/page.tsx`

## URL
`/admin/content-studio-v2/ai-engine/graph`

## Description

The Graph Visualization page renders a DAG (Directed Acyclic Graph) representation
of the LangGraph content generation pipeline. It shows all 18 nodes organized into
6 logical row sections, with edges showing data flow and conditional routing between
nodes. Each node displays real-time health metrics and can be expanded to show
detailed performance data.

## Data Fetching

### API Contract

**GET** `/api/admin/ai-engine/analytics?includeNodeMetrics=true`

Uses the same analytics endpoint as F14 but with `includeNodeMetrics=true`.
The response shape is `AnalyticsWithNodes` (identical to `AnalyticsData`).

### Fetch Behavior

- Single fetch on mount
- Loading state: 3 shimmer skeleton placeholders (60px, 500px, 200px)
- Error state: red banner with "Impossible de charger la vue du graphe"
  and "Reessayer" button
- No period selector (shows all-time data)

## Graph Topology

### Nodes (18 total)

| ID | Label | Row | Position |
|---|---|---|---|
| START | Debut | opening | 1 |
| parseBrief | Analyse du brief | opening | 2 |
| enrichKnowledge | Enrichissement savoir | opening | 3 |
| enrichTrends | Enrichissement tendances | opening | 4 |
| generateScript | Generation script | opening | 5 |
| generateVideo | Generation video | video_branch | 1 |
| generateVoiceover | Voix off | video_branch | 2 |
| generateMusic | Musique | video_branch | 3 |
| generateSubtitles | Sous-titres | video_branch | 4 |
| generateImages | Generation images | image_branch | 1 |
| generateCaption | Generation caption | post_composition | 1 |
| compose | Composition | post_composition | 2 |
| transcodeExport | Transcodage / Export | post_composition | 3 |
| qualityCheck | Controle qualite | quality_gates | 1 |
| moderate | Moderation | quality_gates | 2 |
| reviewGate | Revue humaine | quality_gates | 3 |
| generateVariants | Generation variantes | terminal | 1 |
| END | Fin | terminal | 2 |

### Layout Rows

| Row ID | Label | Nodes |
|---|---|---|
| opening | Sequence d'ouverture | START, parseBrief, enrichKnowledge, enrichTrends, generateScript |
| video_branch | Branche video (reel / story) | generateVideo, generateVoiceover, generateMusic, generateSubtitles |
| image_branch | Branche image (carousel / image / texte) | generateImages |
| post_composition | Post-composition | generateCaption, compose, transcodeExport |
| quality_gates | Controle et validation | qualityCheck, moderate, reviewGate |
| terminal | Finalisation | generateVariants, END |

### Edges (24 total)

**Linear edges:**
- START -> parseBrief -> enrichKnowledge -> enrichTrends -> generateScript
- generateVideo -> generateVoiceover -> generateMusic -> generateSubtitles -> generateCaption
- generateImages -> generateCaption
- generateCaption -> compose -> transcodeExport -> qualityCheck
- generateVariants -> END

**Conditional edges (dashed):**
- generateScript -> generateVideo (reel / story)
- generateScript -> generateImages (carousel / image)
- generateScript -> generateCaption (texte)
- qualityCheck -> moderate (passe)
- qualityCheck -> generateScript (reessai)
- qualityCheck -> END (echec)
- moderate -> reviewGate (valide)
- moderate -> generateScript (signale)
- moderate -> END (bloque)
- reviewGate -> generateVariants (approuve)
- reviewGate -> END (approuve direct)
- reviewGate -> generateScript (rejete)

## UI Components

### SummaryBar

Horizontal bar at the top showing aggregated metrics:
- Total nodes count
- Healthy nodes count (green dot)
- Degraded nodes count (amber dot, only if > 0)
- Error nodes count (red dot, only if > 0)
- Total invocations
- Total errors

### NodeCard

Interactive card for each pipeline node. Two modes:

**Collapsed (default):**
- Node label (bold)
- Status indicator dot (10px circle, absolute positioned, top-right)
- Quick metrics: latency (Clock icon), cost (DollarSign icon), error rate (AlertCircle, if > 0)
- Chevron indicator (down when expanded, right when collapsed)

**Expanded (on click):**
- Status badge (Sain/Degrade/Erreur)
- Provider name
- Average latency (formatted as seconds)
- Average cost (formatted in MAD)
- Total invocations count
- Error count with percentage

**START/END nodes:**
- Pill-shaped (border-radius full)
- Sunken background
- No click interaction
- No metrics displayed

### Node Status Colors

| Status | Border Color | Dot Color | Badge Tone |
|---|---|---|---|
| healthy | var(--cs-success) | green | success |
| degraded | var(--cs-warning) | amber | warning |
| error | var(--cs-danger) | red | danger |

### EdgeArrow

Horizontal arrow between nodes in the same row:
- Solid line for direct edges (gray)
- Dashed line for conditional edges (accent colored)
- Arrow head triangle at the end
- Optional label above the line (positioned absolutely)

### VerticalConnector

Vertical connector between row sections:
- Solid gray line (2px width, 16px height)
- Arrow head (down or up direction)
- Optional label to the left

### BranchLabel

Pill-shaped label indicating conditional branching:
- GitBranch icon (10px) + text
- Accent background, accent text, monospace font
- Examples: "reel / story", "carousel / image", "texte"

### ConditionalEdgesLegend

Documentation section showing all conditional routing rules:

| From Node | Routes |
|---|---|
| Generation script | reel/story -> Video, carousel/image -> Images, texte -> Caption |
| Controle qualite | passe -> Moderation, reessai -> Script, echec -> Fin |
| Moderation | valide -> Revue humaine, signale -> Script, bloque -> Fin |
| Revue humaine | approuve -> Variantes, approuve direct -> Fin, rejete -> Script |

Each group rendered as a card with colored dots next to monospace route labels.

### Legend

Bottom section showing:
- Status indicators: Sain (green), Degrade (amber), Erreur (red)
- Edge types: solid line = direct, dashed line = conditional
- Instruction: "Cliquer un noeud pour voir les details"

## Node Interaction

- Clicking a non-terminal node toggles its expanded state
- Only one node can be expanded at a time (clicking a new node closes the previous)
- Clicking the same node again collapses it
- Keyboard support: `role="button"`, `tabIndex={0}`, Enter/Space activates
- Expanded node gets a glow shadow effect: `0 0 0 3px ${statusColor}33`

## Header Navigation

- Back arrow to `/admin/content-studio-v2/ai-engine`
- Title: "Visualisation du graphe LangGraph"
- Right side: Actualiser button, Analytiques link, Configuration link

## Dependencies

- lucide-react: ArrowLeft, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Zap, Clock, DollarSign, AlertCircle, Cpu, GitBranch
- Button, Badge primitives from CS v2 design system
- next/link for navigation
