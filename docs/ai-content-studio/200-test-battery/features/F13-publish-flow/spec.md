# F13 -- Publish Flow

## Feature ID
F13

## Source Files
- Publish section UI: `apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` (inline `PublishSection` component)
- Generation result wrapper: `apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` (exports `GenerationResult`)
- Existing tests: `apps/web/src/components/admin/content-studio-v2/ai-engine/PublishSection.test.tsx`

## Description

The Publish Flow enables operators to publish AI-generated content directly to
social platforms or schedule it for later publication. It is embedded within the
`GenerationResult` component and only renders when a `bridgeResult` (containing
a `draftId`) is available -- indicating the Content Studio bridge successfully
created a draft in the library.

The full GenerationResult component also displays the generated content (script,
caption, hashtags, images, quality scores, cost breakdown) and provides navigation
actions (regenerate, use, view in library).

## GenerationResult Component

### Props

```typescript
interface GenerationResultProps {
  result: GenerationResultData;
  contentStudioUrl?: string | null;
  bridgeResult?: BridgeResultData | null;
  onUse?: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}
```

### GenerationResultData Shape

```typescript
interface GenerationResultData {
  script?: {
    hook?: string;
    scenes?: ScriptScene[];  // { type: string; text: string; duration?: string }
    cta?: string;
  };
  caption?: string;
  hashtags?: string[];
  images?: string[];        // array of image URLs
  qualityScores?: Record<string, number>;
  costBreakdown?: { label: string; amountCents: number }[];
  totalCostCents?: number;
}
```

### BridgeResultData Shape

```typescript
interface BridgeResultData {
  ideaId: string;
  briefId: string;
  draftId: string;  // used by PublishSection
}
```

### Content Sections

1. **Script** (CollapsibleSection, default open):
   - Hook: eyebrow label, paragraph text
   - Scenes: list of scene cards with Badge for type, duration, text
   - CTA: accent-colored text with bold weight

2. **Caption** (always visible):
   - Header with "Caption" label and CopyButton
   - Full text with `white-space: pre-wrap`
   - CopyButton uses `navigator.clipboard.writeText()`

3. **Hashtags** (always visible):
   - Badge components with accent tone, `#` prefix

4. **Images** (CollapsibleSection, default open):
   - Grid layout: `repeat(auto-fill, minmax(140px, 1fr))`
   - Each image: 1:1 aspect ratio, rounded, border

5. **Quality Scores**:
   - QualityBar sub-component for each score dimension
   - Progress bar with percentage
   - Color thresholds: >= 80% green, >= 60% amber, < 60% red

6. **Cost Breakdown**:
   - HTML table with label and amount columns
   - Amounts formatted as `(amountCents / 100).toFixed(2) + " MAD"`
   - Total row with bold styling and top border

### Quality Score Labels

```typescript
const QUALITY_LABELS = {
  brand_alignment: 'Alignement marque',
  engagement_potential: 'Potentiel engagement',
  clarity: 'Clarte du message',
  visual_coherence: 'Coherence visuelle',
  cta_strength: 'Force du CTA',
  overall: 'Score global',
};
```

### Action Buttons (bottom row)

| Button | Variant | Icon | Behavior |
|---|---|---|---|
| Regenerer | ghost | RefreshCw | Calls `onRegenerate()`, shows spinner if `regenerating=true` |
| Voir dans la Bibliotheque | ghost | BookOpen | Link to `contentStudioUrl` (only if defined) |
| Utiliser ce contenu | primary | ArrowRight (right) | Calls `onUse()` |

## PublishSection Component

### Props

```typescript
function PublishSection({ draftId }: { draftId: string })
```

### Internal State

```typescript
type PublishMode = 'now' | 'schedule';
type PublishState = 'idle' | 'publishing' | 'success' | 'error';

const [mode, setMode] = useState<PublishMode>('now');
const [scheduledAt, setScheduledAt] = useState('');
const [publishState, setPublishState] = useState<PublishState>('idle');
const [publishMessage, setPublishMessage] = useState('');
```

### Mode Selector

Two toggle buttons in a row:

| Button | Icon | Label | Active State |
|---|---|---|---|
| Now | Send (13px) | "Publier maintenant" | Accent border/bg/color, bold |
| Schedule | Calendar (13px) | "Planifier" | Accent border/bg/color, bold |

Default mode: `'now'`

### Schedule Date Picker

Only visible when `mode === 'schedule'`:
- Label: "Date et heure de publication" (eyebrow)
- Input type: `datetime-local`
- Min value: current date/time (`new Date().toISOString().slice(0, 16)`)
- Max width: 280px

### Publish Button

- Variant: primary
- Icon: Send (14px)
- Text: "Publier" (now mode) or "Planifier la publication" (schedule mode)
- Disabled when: `publishState === 'publishing'` OR (schedule mode AND `scheduledAt` empty)
- Loading: shows spinner when `publishState === 'publishing'`

### Publish Validation

```typescript
const canPublish =
  publishState !== 'publishing' &&
  (mode === 'now' || (mode === 'schedule' && scheduledAt.trim().length > 0));
```

### API Contract

**POST** `/api/admin/ai-engine/publish`

Request body (now mode):
```json
{
  "draftId": "cd_test001",
  "mode": "now"
}
```

Request body (schedule mode):
```json
{
  "draftId": "cd_test001",
  "mode": "schedule",
  "scheduledAt": "2026-12-25T10:00:00.000Z"
}
```

### Success State

Green banner with CheckCircle icon:
- Now mode: "Contenu publie avec succes."
- Schedule mode: "Contenu planifie pour le {localized date}."

### Error State

Red banner with AlertTriangle icon:
- Displays the error message from the API response
- Parses `data.message`, `data.error`, or falls back to `Erreur HTTP {status}`

## CopyButton Sub-Component

- Uses `navigator.clipboard.writeText(text)`
- Initial state: Copy icon + "Copier"
- After copy: Check icon + "Copie" (green color)
- Resets to initial after 2000ms via `setTimeout`
- Graceful error handling (noop catch)

## CollapsibleSection Sub-Component

- Renders a bordered container with clickable header
- Toggle between open/closed via local `useState`
- Icons: ChevronDown (open), ChevronRight (closed)
- Content area only rendered when `open === true`

## Dependencies

- lucide-react: ChevronDown, ChevronRight, Copy, Check, RefreshCw, ArrowRight,
  Sparkles, ImageIcon, BookOpen, Send, Calendar, CheckCircle, AlertTriangle
- Button, Badge primitives from CS v2 design system
- next/link for library deep link
