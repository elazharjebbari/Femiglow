# Ground truth — codebase facts & shared conventions (READ FIRST)

> This file is the **single source of truth** every authoring agent and every
> implementer must align to. All file paths are verified against the repo at
> merge commit `deecc53` (branch `master`, staging). Do **not** invent paths,
> types, or routes that contradict this document. If reality differs from a
> claim here, trust the code and flag the discrepancy.

Repo root: `/var/www/femiglow-staging` · App root: `apps/web` · All paths below
are relative to `apps/web/` unless prefixed with `docs/` or `plan/`.

---

## 1. The two-pipeline architecture (the root cause of the gap)

There are **two parallel generation pipelines**:

- **Pipeline A — AI-Engine (LangGraph)** under `src/lib/ai-engine/*`. It owns the
  *rich media production* nodes. Graph wired in
  `src/lib/ai-engine/graph/builder.ts` (video flow ~ lines 138-149):
  `generateVideo → generateVoiceover → generateMusic → generateSubtitles →
  generateCaption → compose → transcodeExport → qualityCheck → moderate →
  reviewGate → generateVariants`.
- **Pipeline B — Content-Studio create-flow** under `src/lib/content-studio/*`.
  It owns the **operator UI** at `/admin/content-studio-v2/create` and the
  per-draft visual generation (`generateVisualForDraft`).

They are joined by a **one-way, lossy bridge**:
`src/lib/ai-engine/bridge/content-studio-bridge.ts` →
`bridgeToContentStudio` (~line 81). Direction **A → B only**. It copies
**only** `script`, `caption`, `hashtags`, `images` into Content-Studio records.
It **never** carries voiceover, music, subtitles, composed video, or transcode.

### The DTO that drops the artifacts
`src/lib/ai-engine/orchestrator.ts`, interface `GenerationResult` (~lines 30-45):
```ts
export interface GenerationResult {
  jobId: string;
  status: 'completed' | 'review' | 'failed';
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  images: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  qualityScores: Record<string, number>;
  moderationResult: Record<string, unknown> | null;
  costTracking: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
  durationMs: number;
  reviewPayload?: Record<string, unknown> | null;
}
```
→ **No fields** for `voiceover`, `music`, `subtitles`, `composedVideo`,
`transcodedVideo`. Even when the graph produces them, this DTO discards them
before the bridge runs. **This is the first thing to extend.**

### Graph state channels (these DO carry the artifacts)
Canonical state in `src/lib/ai-engine/types/state.ts` (re-exported by
`src/lib/ai-engine/graph/state.ts`). Channels consumed by `compose.ts`:
- `state.videos` : `MediaAsset[]`
- `state.voiceover` : `MediaAsset | null`  (TTS narration track)
- `state.music` : `MediaAsset | null`      (background music track)
- `state.subtitles` : `string | null`      (**SRT text**, not a file ref)
- `state.images` : `MediaAsset[]`
- `state.errors` : `StepError[]` (already wired by ACT-BE-015)

`MediaAsset` type: `src/lib/ai-engine/types/media.ts`.

### The media-production nodes (already implemented in pipeline A)
| Node export | File | Produces |
|---|---|---|
| `generateVoiceoverNode` | `src/lib/ai-engine/nodes/generate-voiceover.ts` | TTS voice-over `MediaAsset` from the script narration |
| `generateMusicNode` | `src/lib/ai-engine/nodes/generate-music.ts` | background music `MediaAsset` sized to duration |
| `generateSubtitlesNode` | `src/lib/ai-engine/nodes/generate-subtitles.ts` | SRT subtitle **string** from scene narration |
| `composeNode` | `src/lib/ai-engine/nodes/compose.ts` | ffmpeg montage: video+voiceover+music+subtitles → one mp4 `MediaAsset` (metadata `{hasVoiceover,hasMusic,hasSubtitles}`) |
| `transcodeExportNode` | `src/lib/ai-engine/nodes/transcode-export.ts` | platform-spec final encode |
| `generateVideoNode` | `src/lib/ai-engine/nodes/generate-video.ts` | raw video clip `MediaAsset` |

`compose.ts` uses `fluent-ffmpeg` + `ffmpeg-static` (+ `sharp` for image
compose). Media dir constants `MEDIA_DIR` / `MEDIA_URL_PREFIX` live in compose.ts.
Each node has a co-located `*.test.ts`. **Reuse these node implementations** —
the plan must NOT reimplement ffmpeg/TTS logic; it must make pipeline B able to
invoke / reuse them per-draft and surface their output.

---

## 2. The operator UI today (pipeline B) — what exists

Entry: `src/app/admin/content-studio-v2/create/page.tsx` →
`src/components/admin/content-studio-v2/create/CreateWorkspace.tsx`.

Stepper (`.../create/Stepper.tsx`) — 4 steps:
1. **Cadrer** (intention) — `IntentionForm.tsx`
2. **Générer** (3 text variants) — `POST /api/admin/content-studio/ideas/{id}/generate`
3. **Visuel** (one image OR one video) — `MediaStudio.tsx`
4. **Valider** (preview + publish) — `PreviewPane.tsx`, `PublishActionGroup.tsx`

Relevant components:
- `MediaStudio.tsx` — media kind toggle `['image','video']` (~line 418) + `ModelPicker`; video gated to `reel`/`story` (`VIDEO_FORMATS`). Calls
  `POST /api/admin/content-studio/drafts/{id}/generate-visual`.
- `media/VideoPlayer.tsx` — reusable video player (badge, play/pause, mute) — **reuse it** for previewing voiceover-attached / composed video.
- `media/PlatformPreview.tsx` — Instagram-mockup preview.
- `create/PublishActionGroup.tsx` — publish dropdown + confirm dialog.
- `create/ApproveButton.tsx`, `create/GenerationModeToggle.tsx` (mock|live).

Service layer (pipeline B): `src/lib/content-studio/service.ts`
- `generateVisualForDraft(input: { draftId; prompt; kind?: 'image'|'video'; model?; mode? })` (~line 287)
- `generateIdeaDrafts`, `updateContentDraft`, `listContentStudioMedia`, `listDraftPrimaryAssets`.

Media model (pipeline B): `src/lib/content-studio-v2/media/types.ts`
```ts
export type StudioV2MediaKind = 'image' | 'video';
export interface StudioV2MediaItem {
  id; kind; compartment: 'imported'|'ai_generated'; alt; slug;
  thumbnailUrl: string|null; previewUrl: string; originalUrl: string;
  durationSec?: number|null; width?: number|null; height?: number|null; createdAt: string;
}
```
Model registry: `src/lib/content-studio-v2/models/registry.ts`.

DB schemas (Drizzle): `src/lib/db/schema-content-studio.ts` (drafts, assets,
generation runs), `src/lib/db/schema-ai-engine.ts`, `schema-social-publishing.ts`.

Mode/credentials:
- Generation mode cookie `cs_generation_mode` (`mock`|`live`); `mock` never hits an LLM/provider, `live`-no-key throws `HttpError invalid_state` (409).
- Provider credential resolution: `src/lib/content-studio/provider-credentials.ts` (`resolveProviderCredential`) + `src/lib/ai-engine/services/api-key-manager.ts` (`resolveApiKey`).
- Publishing mode `SOCIAL_PUBLISHING_MODE` (default `dry_run`). **Never enable live publishing in this plan.**
- Errors: `src/lib/errors/http-error.ts` — `HttpError(code,msg,details)`; codes `invalid_input`→400, `invalid_state`→409, `gone`→410; `formatErrorResponse` → `{ error: { code, message, details } }`.

---

## 3. Target design decisions (AGREED — all agents align to these)

The goal: surface **voice-over generation**, **video montage (compose)**, and
**subtitles/script-on-video** in the operator UI, reusing pipeline A's nodes,
without enabling live publishing and without regressing pipeline B.

**D1 — Per-draft media bundle.** A draft owns a *bundle* of assets addressed by
**role**, not just one primary visual:
`role ∈ { 'primary_video' | 'primary_image' | 'voiceover' | 'music' | 'subtitles' | 'composed_video' }`.
Extend the media model with a `role` discriminator and widen `StudioV2MediaKind`
to `'image' | 'video' | 'audio' | 'subtitles'` (subtitles stored as SRT text +
a `.srt` asset). The architecture folder (`00_global/data-model.*`) is the
authority on the exact schema/migration; feature folders consume it.

**D2 — Extend the DTO + bridge (close the leak).** Add `voiceover`, `music`,
`subtitles`, `composedVideo`, `transcodedVideo` to `GenerationResult`
(`orchestrator.ts`) and map them in `bridgeToContentStudio` into Content-Studio
assets (extend `upsertPrimaryAsset` → `upsertBundleAssets`). This is the shared
backbone consumed by all three features.

**D3 — Per-draft service + routes in pipeline B.** Each feature gets a
mode-aware service fn + an API route, mirroring `generateVisualForDraft`:
- Voice-over: `generateVoiceoverForDraft` + `POST /api/admin/content-studio/drafts/[id]/generate-voiceover`
- Subtitles: `generateSubtitlesForDraft` + `POST /api/admin/content-studio/drafts/[id]/generate-subtitles`
- Compose: `composeDraftVideo` + `POST /api/admin/content-studio/drafts/[id]/compose`
Each reuses the corresponding pipeline-A node logic (extract shared core into a
reusable function if the node is graph-coupled). `mock` mode = deterministic
silent/sample artifact, **no provider call** (assert via MSW `onUnhandledRequest:'error'`);
`live`-no-key = `HttpError invalid_state` 409.

**D4 — UI: a "Studio média" panel in step 3 (Visuel).** When the primary media
is a video (`reel`/`story`), `MediaStudio.tsx` shows a **tracks panel**:
`🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer`. Each track
has generate/regenerate + preview; “Composer” assembles them; the composed video
plays via `VideoPlayer.tsx`. The publish confirm (`PublishActionGroup`) shows the
**composed** video + a track summary.

**D5 — Reuse, don't reinvent.** ffmpeg/compose, TTS, SRT generation already exist
in pipeline A nodes — the plan WRAPS and SURFACES them. No duplicate ffmpeg code.

**D6 — Non-regression.** `generateVisualForDraft` and the existing 4-step flow
keep working unchanged for image-only / no-audio drafts. Every change is additive
and feature-flaggable (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off until G-gate).

---

## 4. Task-ID scheme (use these prefixes — they cross-reference across folders)

- `MP-AR-*` — architecture / DTO / bridge / data-model / migration (folder `00_global`)
- `MP-VO-*` — voice-over (folder `01_voiceover`)
- `MP-CO-*` — compose / montage (folder `02_compose`)
- `MP-SU-*` — subtitles / scripts-on-video (folder `03_subtitles`)
- `MP-TB-*` — test battery (folder `04_test-battery`)
- `MP-RB-*` — runbook (folder `05_runbook`)

Bug/audit cross-refs: this whole plan closes **BUG-004** of
`docs/audit-generation-publication-2026-05-29/`. Architecture work is the
prerequisite (`MP-AR-*` blocks all `MP-VO/CO/SU-*`).

---

## 5. Per-feature folder file template (each feature folder MUST contain)

| File | Ext | Purpose |
|---|---|---|
| `README.md` | md | folder index + how the feature fits, links to siblings |
| `functional-spec.md` | md | **optimal functioning**, user stories, states, edge cases — very detailed |
| `backend-design.md` | md | service fn, route, node reuse, mode-awareness, errors, cost |
| `frontend-design.md` | md | components, state, hooks, data flow, optimistic UI |
| `ui-ux-design.md` | md | layout, interactions, a11y, i18n (FR), tokens, wireframe (ASCII) |
| `api-contract.yaml` | yaml | OpenAPI-style request/response/error for the new route |
| `data-contract.json` | json | JSON-Schema of payloads + the asset/role records |
| `sequence.puml` | puml | PlantUML sequence diagram (UI→route→service→node→DB) |
| `state-machine.puml` | puml | PlantUML state diagram of the track lifecycle |
| `dev-plan.md` | md | ordered implementation steps, each with the test that proves it |
| `action-plan.csv` | csv | `id,title,layer,depends_on,files,test_ids,verifies,status` |
| `test-plan-vitest.md` | md | unit/integration cases (service, route, node, component) |
| `test-plan-playwright.md` | md | E2E scenarios (mock mode) on staging |
| `test-plan-msw.md` | md | MSW handlers for provider HTTP; mock/no-key assertions |
| `verification-checklist.csv` | csv | `area,item,how_to_verify,expected,evidence` — every angle (backend/frontend/data/ux/a11y/perf/security/non-regression) |
| `acceptance-criteria.csv` | csv | `id,given,when,then,test_id` (Gherkin-ish) |

Write **dense, implementation-ready** content. Prefer concrete signatures, exact
file paths, exact test names, and real payload examples over prose. Every claim
must be groundable in §1–§3. Cross-link sibling files with relative paths.

---

## 6. Quality bar (non-negotiable)

Robuste · fiable · pertinent · haute qualité · maintenable · **non-régressif** ·
modulaire · **fonctionnel**. Concretely:
- TypeScript strict, `noUncheckedIndexedAccess`-safe (use `satisfies`, guards).
- **`tsc --noEmit` must pass** — vitest does NOT typecheck (this exact gap shipped two build-breakers this week; CI must gate on `tsc`).
- Provider HTTP mocked via **MSW** (`src/test/msw/server.ts`, idempotent listen), never `vi.stubGlobal('fetch')`. `onUnhandledRequest:'error'` proves mock/no-key paths make no network call.
- Vitest for units/integration; Playwright for E2E (mock mode, staging :8012).
- Additive + feature-flagged; existing flows untouched (prove with regression tests).
- No secrets committed; dry-run publishing only.
