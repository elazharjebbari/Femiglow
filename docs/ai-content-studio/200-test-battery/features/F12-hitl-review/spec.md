# F12 -- HITL Review (Human In The Loop)

## Feature ID
F12

## Source Files
- Review panel UI: `apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx` (inline `ReviewPanel` component)
- Existing tests: `apps/web/src/components/admin/content-studio-v2/ai-engine/ReviewPanel.test.tsx`
- HITL scenarios: `docs/ai-content-studio/110-tests/ai-engine/08-hitl-review/hitl-scenarios.md`

## Description

The HITL Review feature enables human oversight of AI-generated content before
publication. When the LangGraph pipeline reaches the `reviewGate` node, execution
pauses and returns `status: 'review'` with a `reviewPayload` containing the
generated content. The operator examines the content and makes a decision:
approve, reject, or request edits.

This component is rendered inline within the Create page (F10) during the `review`
phase. It is NOT a standalone component file -- it is defined as a function
component `ReviewPanel` inside `create/page.tsx`.

## Component Interface

```typescript
function ReviewPanel({
  jobId,          // string -- the generation job ID
  reviewPayload,  // ReviewPayload -- content to review
  onDecision,     // (decision: string, feedback?: string) => void
  submitting,     // boolean -- loading state for decision submission
}: ReviewPanelProps)
```

### ReviewPayload Shape

```typescript
interface ReviewPayload {
  jobId?: string;
  script?: Record<string, unknown> | null;
  caption?: string;
  hashtags?: string[];
  images?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  qualityScores?: Record<string, number>;
  moderationResult?: Record<string, unknown> | null;
}
```

## UI Sections

### Header

- Eye icon (18px) in a 40px circle with accent background
- Title: "Revue humaine requise" (`cs-display`, `--cs-text-lg`)
- Subtitle: "Job {jobId.slice(0,8)}... -- Examinez le contenu avant publication"
- Container: elevated background with accent border

### Script Preview

Conditionally rendered when `reviewPayload.script` is truthy.

- Section icon: BookOpen (14px, secondary color)
- Label: "Script" (eyebrow style)
- Content container: base background, hair border
- Hook text: bold (fontWeight 600), prefixed with "Hook:"
- CTA text: "CTA:" prefix with medium weight
- Scenes: rendered as a list, each showing "Scene {number}: {narration or visual description}"

### Caption Preview

Conditionally rendered when `caption` is truthy.

- Section icon: Edit3 (14px, secondary color)
- Label: "Caption" (eyebrow style)
- Content: full caption text with `white-space: pre-wrap`

### Hashtags

Conditionally rendered when `hashtags.length > 0`.

- Section icon: Hash (14px, secondary color)
- Label: "Hashtags" (eyebrow style)
- Tags rendered as inline badges with `#` prefix
- Badge styling: accent background (12% opacity), accent text, `--cs-text-xs`

### Image Thumbnails

Conditionally rendered when `images.length > 0`.

- Section icon: ImageIcon (14px, secondary color)
- Label: "Images ({count})" (eyebrow style)
- Horizontal scrolling container (`overflowX: auto`)
- Each thumbnail: 100x100px, rounded, with border
- Images with `url` property render as `<img>`, otherwise show ImageIcon placeholder

### Quality Scores

Conditionally rendered when `qualityScores` has at least one key.

- Label: "Scores qualite" (eyebrow style)
- Each score rendered as: key name (capitalized) + percentage value
- Color coding: >= 70% green (`--cs-success`), >= 50% amber (`--cs-warning`), < 50% red (`--cs-danger`)
- Percentage computed as `(val * 100).toFixed(0)`

## Decision Buttons

When `feedbackMode` is null (initial state), three buttons are displayed:

| Button | Label | Icon | Variant | Behavior |
|---|---|---|---|---|
| Approve | "Approuver" | CheckCircle (14px) | primary | Calls `onDecision('approved')` immediately |
| Edit | "Demander des modifications" | Edit3 (14px) | ghost (warning border/color) | Sets `feedbackMode` to `'edit_requested'` |
| Reject | "Rejeter" | XCircle (14px) | ghost (danger border/color) | Sets `feedbackMode` to `'rejected'` |

All three buttons are disabled when `submitting` is true.
The Approve button shows a Loader2 spinner when `submitting` is true.

## Feedback Flow

When the operator clicks "Reject" or "Edit", the component enters feedback mode:

1. Decision buttons are hidden
2. A TextAreaField appears with contextual placeholder:
   - Rejected: "Expliquez pourquoi ce contenu ne convient pas..."
   - Edit requested: "Decrivez les modifications souhaitees..."
3. Two action buttons appear below the textarea:
   - "Confirmer" (primary) -- calls `onDecision(feedbackMode, feedback)` with the
     entered text
   - "Annuler" (ghost) -- resets feedbackMode to null and clears feedback text
4. Confirm button shows Loader2 spinner when `submitting` is true

## State Management

The ReviewPanel manages two local state variables:
- `feedbackMode`: `'rejected' | 'edit_requested' | null` -- determines which
  textarea is shown
- `feedback`: string -- the feedback text entered by the operator

## API Contract

**POST** `/api/admin/ai-engine/jobs/:id/review`

Request body:
```json
{
  "decision": "approved" | "rejected" | "edit_requested",
  "feedback": "optional feedback text"
}
```

Response (completed):
```json
{
  "status": "completed",
  "script": { ... },
  "caption": "...",
  "hashtags": [...],
  "totalCostCents": 200
}
```

Response (another review cycle):
```json
{
  "status": "review",
  "jobId": "job_xyz",
  "reviewPayload": { ... }
}
```

## Review Cycle Loop

The Create page supports multiple review cycles:
1. Operator requests edits
2. API regenerates content with feedback
3. API returns another `status: 'review'`
4. ReviewPanel re-renders with updated content
5. Operator reviews again (approve/reject/edit)
6. Loop continues until approval or final rejection

## Error Handling

If the review API call fails:
- `setErrorMsg()` is called with the error message
- Phase transitions to `error`
- Error panel (F10) displays with retry/reset options

## Design Tokens

- Container: `--cs-bg-elevated`, `--cs-accent` border, `--cs-radius-md`
- Script/Caption boxes: `--cs-bg-base`, `--cs-border-hair`
- Hashtag badges: `rgba(209, 183, 153, 0.12)` background, `--cs-accent` text
- Quality scores: `--cs-success` / `--cs-warning` / `--cs-danger` based on threshold
- Buttons: standard CS v2 Button primitive

## Dependencies

- lucide-react: Eye, BookOpen, Edit3, Hash, ImageIcon, CheckCircle, XCircle, Loader2
- Button primitive from CS v2 design system
- TextAreaField (inline component in create/page.tsx)
