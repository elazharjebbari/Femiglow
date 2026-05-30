# 02 · Video montage / Compose (montage vidéo) — feature folder index

> **Task prefix:** `MP-CO-*` · **Closes:** BUG-004 (the composed video never
> reaches the operator UI / publish). **Prerequisite:** `MP-AR-*` (architecture:
> DTO + bridge + per-draft media bundle / `role` discriminator + `meta` column)
> — see [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
> **Soft-deps:** [`../01_voiceover`](../01_voiceover/) (`MP-VO-*`) and
> [`../03_subtitles`](../03_subtitles/) (`MP-SU-*`) — Compose *reads* the
> `role='voiceover'`, `role='music'`, `role='subtitles'` assets they produce, but
> degrades gracefully when they are absent (mirrors `compose.ts` no-audio
> byte-copy path).
>
> **Single source of truth:** [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md).
> Decisions D1–D6 and the quality bar (§6) are binding. This folder consumes the
> data-model authority that lives in `00_global` and must not contradict it.

## What this feature delivers

Let an operator **assemble** a draft's tracks — primary video + voice-over +
music + subtitles → **ONE composed mp4** — by reusing `composeNode`'s ffmpeg
core (`src/lib/ai-engine/nodes/compose.ts`). The graph-coupled `composeVideo`
helper is extracted into a reusable pure core `composeDraftVideo` so pipeline B
can compose per-draft **without** running the LangGraph (D3, D5). The composed
video becomes a `role='composed_video'` asset of the draft bundle (D1), plays in
the reused `VideoPlayer.tsx`, and is the video shown in the **publish confirm**
(D4). Optionally the composed mp4 is chained through `transcodeExportNode` for a
platform-spec export.

New surface (all additive, feature-flagged behind
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off — D6):

| Layer | Artifact | Path |
|---|---|---|
| Node core (refactor) | `composeMediaBundle(...)` extracted from `composeNode`'s `composeVideo` | `apps/web/src/lib/ai-engine/nodes/compose.ts` |
| Service (pipeline B) | `composeDraftVideo(input): Promise<ComposeResult>` | `apps/web/src/lib/content-studio/service.ts` |
| Route | `POST /api/admin/content-studio/drafts/[id]/compose` | `apps/web/src/app/api/admin/content-studio/drafts/[id]/compose/route.ts` |
| Schema | `composeGenerationSchema` (zod) | `apps/web/src/lib/content-studio/schemas.ts` |
| UI | `ComposePanel` (the "Montage" shell + track-presence toggles + Composer button) | `apps/web/src/components/admin/content-studio-v2/create/tracks/ComposePanel.tsx` |
| UI | `TracksPanel` (the shared tracks-panel shell that hosts VO/music/subtitles + Compose) | `apps/web/src/components/admin/content-studio-v2/create/tracks/TracksPanel.tsx` |

## Mode-awareness (D3)

- **`mock`** → **deterministic** stub mp4: a byte-copy of the primary video
  (mirrors `compose.ts` L56–78 no-audio path), `provider:'compose:mock'`,
  `costCents=0`; **no provider HTTP call** (Compose has no external HTTP at all —
  proven with MSW `onUnhandledRequest:'error'`). The track-presence report
  `{ hasVoiceover, hasMusic, hasSubtitles }` reflects which bundle assets existed.
- **`live` without required tracks** → `HttpError('invalid_state', …)` → **HTTP
  409** (compose requires at least a `primary_video`; in `live` it also requires
  at least one extra audio/subtitle track to justify a real ffmpeg mux — see
  [`functional-spec.md`](functional-spec.md) §7 E-CO-3).
- **`live` + tracks present** → real ffmpeg mux via the reused node core (no
  network: ffmpeg is a local binary). The MSW plan asserts the ffmpeg-binary
  boundary, not an HTTP boundary, and proves **zero** network with
  `onUnhandledRequest:'error'`.

## Prerequisite & dependency note (MP-CO-00)

Compose **depends on** the bundle assets existing. Hard prerequisite:
`MP-AR-001` (DTO), `MP-AR-002` (bridge), `MP-AR-003` (`upsertBundleAssets`,
`getDraftBundle`), `MP-AR-005` (migration: `meta_json` column + `subtitles`
enum). Soft dependencies: `MP-VO-*` (voice-over asset), `MP-SU-*` (subtitles
asset). Music has no dedicated feature folder this cycle; Compose reads
`role='music'` if a future flow produces it, else degrades. See
[`dev-plan.md`](dev-plan.md) Phase 0 and [`action-plan.csv`](action-plan.csv)
row `MP-CO-00`.

## Files in this folder (template — ground-truth §5)

| File | Purpose |
|---|---|
| [`functional-spec.md`](functional-spec.md) | optimal functioning, user stories, states, edge cases |
| [`backend-design.md`](backend-design.md) | service fn, route, node reuse, mode-awareness, errors, cost |
| [`frontend-design.md`](frontend-design.md) | components, state, hooks, data flow, optimistic UI |
| [`ui-ux-design.md`](ui-ux-design.md) | layout, interactions, a11y, i18n (FR), tokens, ASCII wireframe |
| [`api-contract.yaml`](api-contract.yaml) | OpenAPI request/response/error |
| [`data-contract.json`](data-contract.json) | JSON-Schema of payloads + asset/role records |
| [`sequence.puml`](sequence.puml) | UI→route→service→node→ffmpeg→DB sequence |
| [`state-machine.puml`](state-machine.puml) | compose track lifecycle |
| [`dev-plan.md`](dev-plan.md) | ordered steps, each with its proving test |
| [`action-plan.csv`](action-plan.csv) | `id,title,layer,depends_on,files,test_ids,verifies,status` |
| [`test-plan-vitest.md`](test-plan-vitest.md) | unit/integration cases (incl. fake-timers for ffmpeg) |
| [`test-plan-playwright.md`](test-plan-playwright.md) | E2E (mock mode, staging :8012) |
| [`test-plan-msw.md`](test-plan-msw.md) | ffmpeg-binary boundary + no-network proof |
| [`verification-checklist.csv`](verification-checklist.csv) | every angle |
| [`acceptance-criteria.csv`](acceptance-criteria.csv) | Gherkin-ish criteria |

## Cross-references

- DTO/bridge/data-model authority: `../00_global/*` (`MP-AR-*`). Note the
  state-channel ↔ DTO mapping: graph STATE channel is **`composition`**, the DTO
  field is **`composedVideo`** (see
  [`../00_global/dto-bridge-changes.md`](../00_global/dto-bridge-changes.md) §1).
- Sibling features that produce the tracks Compose reads: `../01_voiceover`
  (`role='voiceover'`), `../03_subtitles` (`role='subtitles'`).
- Test battery aggregation: `../04_test-battery` (`MP-TB-*`).
- Optional export chain: `transcodeExportNode`
  (`src/lib/ai-engine/nodes/transcode-export.ts`).
