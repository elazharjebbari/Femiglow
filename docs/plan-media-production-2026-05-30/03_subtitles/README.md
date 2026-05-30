# 03 · Subtitles / script-on-video (sous-titres) — feature folder index

> **Task prefix:** `MP-SU-*` · **Closes:** BUG-004 (subtitles never reach the
> operator UI nor the composed/published video). **Prerequisite:** `MP-AR-*`
> (architecture: DTO + bridge + per-draft media bundle / `role` discriminator +
> `media_kind` enum value `'subtitles'`) — this feature **owns the enum addition**
> in coordination with `MP-AR-*`. See
> [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
>
> **Single source of truth:** [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
> Decisions D1–D6 and the quality bar (§6) are binding. This folder consumes the
> data-model authority that lives in `00_global`
> ([`data-model.md`](../00_global/data-model.md),
> [`db-migration.md`](../00_global/db-migration.md)) and must not contradict it.

## What this feature delivers

Let an operator, on **step 3 (Visuel)** of `/admin/content-studio-v2/create`, for a
draft whose primary media is a **video** (`reel`/`story`):

1. **Generate timed subtitles (SRT)** from the draft's script/narration, reusing the
   core of `generateSubtitlesNode` (`src/lib/ai-engine/nodes/generate-subtitles.ts`).
   The graph-coupled node is refactored to a thin wrapper over a pure core
   `generateSubtitlesForDraftCore` so pipeline B can call it per-draft **without**
   running the LangGraph (D3, D5). Mock = deterministic SRT from the script with
   **no provider call** (pure string building, no network).
2. **Review / EDIT the subtitle lines** in a timed-text editor (start/end/text per
   cue), with live validation: monotonic ordering, non-overlapping, max chars/line,
   max lines/cue, and reading-speed (CPS) guidance.
3. **Choose a burn-in style** (font, size, position, background box, colour) so
   `composeNode` (`src/lib/ai-engine/nodes/compose.ts`) renders the script **onto**
   the video. A live **preview overlay** shows the styled subtitle over the video
   frame.

The artifact is persisted as a `role='subtitles'` (`kind='subtitles'`) bundle asset:
the **SRT text** lives in the binding `meta.srt` **and** in a `.srt` asset
(`originalMime: application/x-subrip`), per
[`../00_global/data-model.md`](../00_global/data-model.md) §5. The burn-in style is
stored in `meta.style`; it is read by Compose (`MP-CO-*`).

New surface (all additive, feature-flagged behind
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off — D6):

| Layer | Artifact | Path |
|---|---|---|
| Node core (refactor) | `generateSubtitlesForDraftCore(...)` + `parseSrt` / `serializeSrt` / `validateCues` extracted from `generateSubtitlesNode` | `apps/web/src/lib/ai-engine/nodes/generate-subtitles.ts` |
| SRT lib (new, pure) | `parseSrt`, `serializeSrt`, `formatTimecode`, `parseTimecode`, `validateCues` | `apps/web/src/lib/ai-engine/subtitles/srt.ts` |
| Service (pipeline B) | `generateSubtitlesForDraft(input): Promise<SubtitlesResult>` (generate) · `saveSubtitlesForDraft(input)` (persist operator edits + style) | `apps/web/src/lib/content-studio/service.ts` |
| Route | `POST /api/admin/content-studio/drafts/[id]/generate-subtitles` | `apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-subtitles/route.ts` |
| Route | `PUT /api/admin/content-studio/drafts/[id]/subtitles` (save edits + style) | `apps/web/src/app/api/admin/content-studio/drafts/[id]/subtitles/route.ts` |
| Schema | `subtitlesGenerationSchema`, `subtitlesSaveSchema` (zod) | `apps/web/src/lib/content-studio/schemas.ts` |
| UI | `SubtitlesTrack` (track in the MediaStudio tracks panel) | `apps/web/src/components/admin/content-studio-v2/create/tracks/SubtitlesTrack.tsx` |
| UI | `CueEditor` (a11y timed-lines editor) | `apps/web/src/components/admin/content-studio-v2/create/tracks/CueEditor.tsx` |
| UI | `SubtitleStyleControls` (burn-in style) + `SubtitleOverlayPreview` | `apps/web/src/components/admin/content-studio-v2/create/tracks/SubtitleStyleControls.tsx`, `.../SubtitleOverlayPreview.tsx` |

## Mode-awareness (D3)

- **`mock`** → deterministic SRT built from the draft script (`parseScriptToCues` →
  `serializeSrt`); **pure / no provider HTTP call** (proven with MSW
  `onUnhandledRequest:'error'`); `costCents=0`.
- **`live` + no key** → only relevant if a refinement LLM is used. The default
  subtitle generation is **pure string building from the script and never calls an
  LLM**, so `live` behaves like `mock` (no network). **If** an optional LLM-refine
  path is requested (`refine:true`) and there is no key →
  `HttpError('invalid_state', …)` → **HTTP 409**, before any fetch.
- **`live` + key + refine** → optional LLM tidy-up of the cue text via the reused
  text core. Out of scope to enable on staging (no key); covered by MSW-mocked tests.

## Files in this folder (template — ground-truth §5)

| File | Purpose |
|---|---|
| [`functional-spec.md`](functional-spec.md) | optimal functioning, user stories, states, edit-validation rules, edge cases |
| [`backend-design.md`](backend-design.md) | service fns, routes, node reuse, SRT lib, mode-awareness, errors, cost |
| [`frontend-design.md`](frontend-design.md) | components, state, hooks, data flow, optimistic UI, cue editor model |
| [`ui-ux-design.md`](ui-ux-design.md) | layout, interactions, a11y (timed-lines editor keyboard/SR), i18n (FR), tokens, ASCII wireframe |
| [`api-contract.yaml`](api-contract.yaml) | OpenAPI request/response/error for both routes |
| [`data-contract.json`](data-contract.json) | JSON-Schema of payloads + cue/SRT/style + asset/role records |
| [`sequence.puml`](sequence.puml) | UI→route→service→node-core/SRT→DB sequence (generate + save) |
| [`state-machine.puml`](state-machine.puml) | subtitles track lifecycle |
| [`dev-plan.md`](dev-plan.md) | ordered steps, each with its proving test |
| [`action-plan.csv`](action-plan.csv) | `id,title,layer,depends_on,files,test_ids,verifies,status` |
| [`test-plan-vitest.md`](test-plan-vitest.md) | unit/integration cases (SRT lib, service, route, components) |
| [`test-plan-playwright.md`](test-plan-playwright.md) | E2E (mock mode, staging :8012) |
| [`test-plan-msw.md`](test-plan-msw.md) | MSW handlers + mock/no-network proof (default path makes ZERO calls) |
| [`verification-checklist.csv`](verification-checklist.csv) | every angle |
| [`acceptance-criteria.csv`](acceptance-criteria.csv) | Gherkin-ish criteria |

## Cross-references

- DTO/bridge/data-model authority: `../00_global/*` (`MP-AR-*`). The
  `media_kind='subtitles'` enum value and the `content_asset_binding.meta_json`
  column ship with **MP-AR-005** (migration `0064`); **MP-SU-00** depends on them.
- Sibling features that consume the same bundle: `../01_voiceover` (`MP-VO-*`),
  `../02_compose` (`MP-CO-*`). **Compose reads the `role='subtitles'` SRT
  (`meta.srt`) and the burn-in `meta.style`** to burn the script onto the video
  (`compose.ts` `state.subtitles`). The consumer relationship is documented in
  [`backend-design.md`](backend-design.md) §6 and pinned by task **MP-SU-09**.
- Test battery aggregation: `../04_test-battery` (`MP-TB-*`).
