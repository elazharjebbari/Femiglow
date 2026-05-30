# F10 -- Content Creation (Create Page)

## Feature ID
F10

## Source File
`apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx`

## URL
`/admin/content-studio-v2/ai-engine/create`

## Description

The Content Creation page is the primary entry point for AI-powered content generation.
It implements a multi-phase wizard that guides the operator through a creative brief
form, displays pipeline progress, optionally pauses for human review (HITL), and
presents the final result with publish options.

### Phases

| Phase | Trigger | Exit Condition |
|---|---|---|
| `brief` | Page load (default) | Operator clicks "Generer" with valid form |
| `generating` | `handleGenerate()` called | All pipeline steps complete |
| `review` | API returns `status: 'review'` | Operator submits decision |
| `reviewing` | Review decision submitted | API response resolves |
| `result` | API returns final content | Operator navigates away or regenerates |
| `error` | Any API or network error | Operator clicks Retry or Reset |

## UI Components

### Brief Form

The brief form is a two-column CSS Grid layout (`grid-template-columns: 1fr 1fr`)
containing 7 fields. It uses custom `SelectField`, `TextAreaField`, and `InputField`
components with FemiGlow Content Studio v2 design tokens.

#### Fields

| Field | Component | Required | Options / Constraints |
|---|---|---|---|
| Objectif | `<select>` | Yes | awareness, engagement, conversion, education, loyalty, ugc |
| Plateforme | `<select>` | Yes | instagram, tiktok, facebook, youtube, linkedin, pinterest |
| Format | `<select>` | Yes | reel, carousel, story, single_image, text_post, infographic |
| Ton | `<select>` | Yes | empowering, educational, playful, luxurious, authentic, urgent |
| Message cle | `<textarea>` (3 rows) | Yes | Free text, validated via `.trim().length > 0` |
| Focus produit | `<input>` | No | Free text, optional |
| Reference tendance | `<input>` | No | Free text, optional, pre-filled via URL param `?trend=` |

#### Validation Logic

```typescript
const isFormValid = form.objective && form.platform && form.format && form.tone && form.keyMessage.trim();
```

The "Generer" button is **disabled** (`disabled={!isFormValid}`) when any required
field is empty or when `keyMessage` contains only whitespace.

### Generate Button

- Text: "Generer"
- Left icon: `Sparkles` (lucide-react, 14px)
- Size: `lg`
- Disabled when: `!isFormValid`
- On click: calls `handleGenerate()` which POSTs to `/api/admin/ai-engine/generate`

### Phase Transitions

1. **brief -> generating**: Button click triggers `handleGenerate()`. Phase set to
   `generating`, then `fetch()` fires. On response, `simulateProgress()` animates
   pipeline steps via chained `setTimeout()` calls.

2. **generating -> review**: If API returns `{ status: 'review' }`, after progress
   animation completes, phase transitions to `review` with the `reviewPayload`.

3. **generating -> result**: If API returns final content, after progress animation
   completes, phase transitions to `result`.

4. **review -> result**: After operator submits approval decision and API returns
   completed content, phase transitions to `result`.

5. **review -> review**: If operator requests edits and API returns another review
   cycle, the review panel refreshes with new content.

6. **Any -> error**: If `fetch()` throws or response is not `ok`, phase transitions
   to `error` with the error message.

7. **error -> generating**: Retry button calls `handleGenerate()` again.

8. **error -> brief**: "Modifier le brief" button calls `handleReset()`.

### API Contract

**POST** `/api/admin/ai-engine/generate`

Request body:
```json
{
  "objective": "engagement",
  "platform": "instagram",
  "format": "carousel",
  "tone": "luxurious",
  "keyMessage": "Le rituel FemiGlow pour des ongles lumineux",
  "productFocus": "Kit de soin FemiGlow",
  "trendReference": "J-Beauty trend"
}
```

Success response (direct result):
```json
{
  "status": "completed",
  "jobId": "job_abc123",
  "script": { "hook": "...", "scenes": [...], "cta": "..." },
  "caption": "...",
  "hashtags": ["femiglow", "jbeauty"],
  "images": [{ "url": "...", "mimeType": "image/png" }],
  "qualityScores": { "brand_alignment": 0.85, "clarity": 0.92 },
  "totalCostCents": 15,
  "bridgeResult": { "ideaId": "...", "briefId": "...", "draftId": "..." },
  "contentStudioUrl": "/admin/content-studio-v2/library?highlight=cd_test001"
}
```

Review response:
```json
{
  "status": "review",
  "jobId": "job_abc123",
  "reviewPayload": {
    "script": { "hook": "...", "scenes": [...], "cta": "..." },
    "caption": "...",
    "hashtags": ["skincare"],
    "images": [],
    "qualityScores": { "brand_alignment": 0.85 },
    "moderationResult": null
  }
}
```

### Error Display

The error panel shows:
- AlertTriangle icon (40x40 amber circle)
- "Erreur de generation" heading
- Dynamic error message text
- Two action buttons:
  - "Reessayer" (primary, RefreshCw icon) -- retries generation
  - "Modifier le brief" (ghost) -- resets to brief phase

### Result Display

After successful generation, the page renders the `GenerationResult` component (F13)
and optionally the `PublishSection` component if `bridgeResult` is present.

## Design Tokens Used

- `--cs-bg-elevated`, `--cs-bg-base`, `--cs-bg-sunken`
- `--cs-border`, `--cs-border-hair`
- `--cs-fg-primary`, `--cs-fg-secondary`, `--cs-fg-muted`
- `--cs-accent`, `--cs-danger`, `--cs-danger-bg`
- `--cs-radius-sm`, `--cs-radius-md`, `--cs-radius`
- `--cs-shadow-sm`
- `--cs-text-xs`, `--cs-text-sm`, `--cs-text-lg`, `--cs-text-xl`
- `--cs-motion-fast`, `--cs-easing`

## Dependencies

- `GenerationProgress` component (F11)
- `GenerationResult` component (includes PublishSection)
- `Button` primitive from CS v2 design system
- lucide-react icons: Sparkles, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle,
  XCircle, Edit3, Eye, Loader2, BookOpen, ImageIcon, Hash

## Accessibility Requirements

- All `<select>` elements have associated `<label>` elements
- Required fields marked with red asterisk (`*`)
- Focus rings on all interactive elements via `:focus` border-color change
- Button disabled state communicated via `disabled` attribute
- Error messages are visible and descriptive
