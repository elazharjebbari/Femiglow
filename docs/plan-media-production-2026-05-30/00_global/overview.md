# Overview — Media-production action plan (architecture backbone)

> Folder: `docs/plan-media-production-2026-05-30/00_global/`
> Read [`ground-truth-codebase.md`](./ground-truth-codebase.md) first — it is the
> single source of truth. This file is the **vision + index** for the whole dossier.

---

## 1. Vision

The FemiGlow Content Studio must let an operator, from the existing
`/admin/content-studio-v2/create` flow, produce a **fully composed social video**:
generate a **voice-over**, lay a **music** bed, burn **subtitles / script-on-video**,
**compose** them onto the primary video with ffmpeg, **preview** the result with the
existing `VideoPlayer`, and **publish in dry-run** — all **in mock mode by default,
without ever enabling live publishing**, and **without regressing** the current
image/video flow.

Everything the operator needs to do this **already exists as code** — but in the
*wrong pipeline*. Pipeline A (the LangGraph AI-Engine) owns the rich media nodes
(`generateVoiceoverNode`, `generateMusicNode`, `generateSubtitlesNode`,
`composeNode`, `transcodeExportNode`). Pipeline B (the operator create-flow) owns the
UI and the per-draft surface (`generateVisualForDraft`). The two are joined by a
**one-way, lossy bridge** that throws away every audio/subtitle/composed artifact.

This dossier closes that gap. **This `00_global` folder is the architecture
backbone** (`MP-AR-*`): it widens the DTO, extends the bridge, adds the per-draft
media-bundle data model + migration, and defines the feature flag. The three
feature folders (`01_voiceover`, `02_compose`, `03_subtitles`) consume this
backbone; the test battery (`04_test-battery`) and runbook (`05_runbook`) validate
and ship it.

## 2. The BUG-004 gap

This plan closes **BUG-004** of
`docs/audit-generation-publication-2026-05-29/`. The gap, in one sentence:

> Pipeline A *produces* voice-over, music, subtitles, and a composed video; the
> `GenerationResult` DTO and `bridgeToContentStudio` **drop every one of them**, so
> the operator can never see, preview, or publish a composed video.

Concretely (verified, see [`architecture-current.md`](./architecture-current.md)):

- `GenerationResult` (`src/lib/ai-engine/orchestrator.ts` ~L30–45) has **no**
  `voiceover` / `music` / `subtitles` / `composedVideo` / `transcodedVideo` fields.
  Even when the graph fills `state.voiceover`, `state.music`, `state.subtitles`,
  `state.composition`, `buildResultFromState` (~L109–131) never reads them.
- `bridgeToContentStudio` (`src/lib/ai-engine/bridge/content-studio-bridge.ts`
  ~L81) copies **only** `script`, `caption`, `hashtags`, and one image
  (`upsertPrimaryAsset`, ~L157). Direction **A → B only**.
- Pipeline B has **no per-draft service or route** for voice-over, music,
  subtitles, or compose — only `generateVisualForDraft` (image | video).

## 3. The outcome

After this plan ships (behind `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off):

- The operator picks a `reel`/`story` draft, generates a primary video, then in a
  **"Studio média" tracks panel** generates 🎙️ voice-off, 🎵 music, 💬 subtitles,
  and presses 🎞️ **Composer** to assemble them into one mp4.
- The composed video plays inline via `VideoPlayer.tsx` and is what the publish
  confirm dialog (`PublishActionGroup`) shows.
- Every artifact is persisted as a **per-draft media asset addressed by role**
  (`primary_video`, `voiceover`, `music`, `subtitles`, `composed_video`).
- **No provider call in mock mode**; `live`-no-key returns `HttpError invalid_state`
  (409); publishing stays `dry_run`.

## 4. How the pieces fit

```
                ┌─────────────────────────────────────────────┐
                │  00_global  (MP-AR-*)  — THIS BACKBONE       │
                │  · extended GenerationResult DTO (D2)        │
                │  · upsertPrimaryAsset → upsertBundleAssets   │
                │  · per-draft media bundle by role (D1)       │
                │  · Drizzle additive migration                │
                │  · feature flag CONTENT_STUDIO_MEDIA_STUDIO… │
                └───────────────┬──────────────┬──────────────┘
                                │ blocks       │ blocks
          ┌─────────────────────┼──────────────┼─────────────────────┐
          ▼                     ▼              ▼                       ▼
   01_voiceover (MP-VO)  02_compose (MP-CO)  03_subtitles (MP-SU)   (each: service +
   generateVoiceover-    composeDraftVideo   generateSubtitles-      route + UI track,
   ForDraft + route +    + route + Composer  ForDraft + route +      reusing pipeline-A
   track UI              button + preview    SRT track UI            nodes — D3/D5)
          └─────────────────────┴──────────────┴─────────────────────┘
                                │ validated by
                    ┌───────────┴───────────┐
                    ▼                       ▼
            04_test-battery (MP-TB)   05_runbook (MP-RB)
            vitest + MSW + Playwright  enable flag, smoke,
            + tsc gate                 rollback, dry-run check
```

`MP-AR-*` is the **hard prerequisite**: no feature can persist or surface an
artifact until the DTO, bridge, data model, and migration land. See
[`dependency-graph.puml`](./dependency-graph.puml).

## 5. Index of this dossier

| File | What it gives you |
|---|---|
| [`ground-truth-codebase.md`](./ground-truth-codebase.md) | **READ FIRST** — verified facts, paths, conventions, quality bar |
| [`overview.md`](./overview.md) | this file — vision, BUG-004 gap, outcome, index |
| [`scope-and-outcomes.md`](./scope-and-outcomes.md) | in/out of scope, success outcomes, program acceptance |
| [`architecture-current.md`](./architecture-current.md) | as-is: two pipelines, lossy bridge, DTO leak, where artifacts die |
| [`architecture-target.md`](./architecture-target.md) · [`.puml`](./architecture-target.puml) | to-be: extended DTO, `upsertBundleAssets`, per-draft services, feature flag |
| [`data-model.md`](./data-model.md) · [`.puml`](./data-model.puml) | per-draft media bundle, role discriminator, widened kind, SRT storage, Drizzle deltas |
| [`dto-bridge-changes.md`](./dto-bridge-changes.md) | before/after of `GenerationResult` + `bridgeToContentStudio`, TS snippets |
| [`db-migration.md`](./db-migration.md) | additive Drizzle migration, forward + rollback, backfill |
| [`dependency-graph.puml`](./dependency-graph.puml) | MP-AR blocks MP-VO/CO/SU; files each task touches |
| [`decision-log.md`](./decision-log.md) | ADRs for D1–D6 |
| [`risks.csv`](./risks.csv) | program-level risk register |
| [`glossary.md`](./glossary.md) | shared vocabulary |
| [`naming-conventions.md`](./naming-conventions.md) | task-ID scheme, file/route/service/test naming |

### Sibling feature folders (consume this backbone)

- `../01_voiceover/` — `MP-VO-*` — voice-over generation
- `../02_compose/` — `MP-CO-*` — montage / compose
- `../03_subtitles/` — `MP-SU-*` — subtitles / script-on-video
- `../04_test-battery/` — `MP-TB-*` — vitest + MSW + Playwright + `tsc` gate
- `../05_runbook/` — `MP-RB-*` — enablement, smoke, rollback, dry-run guard
