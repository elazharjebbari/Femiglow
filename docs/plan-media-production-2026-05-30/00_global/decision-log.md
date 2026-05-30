# Decision log (ADR) — D1–D6

> ADR-style records for the agreed decisions in
> [`ground-truth-codebase.md`](./ground-truth-codebase.md) §3. Status: **Accepted**
> (these are the shared invariants every agent aligns to). Each entry:
> context · decision · consequences · alternatives rejected.

---

## ADR-D1 — Per-draft media bundle addressed by role

**Context.** Today a draft holds exactly one asset binding, hardcoded
`role:'primary'` (`upsertPrimaryAsset`, repository.ts L445–472, deletes all bindings
for the draft on each write). A composed social video needs several coexisting
artifacts (primary video, voice-over, music, subtitles, composed video). The
`content_asset_binding` table **already** has a `role` column and a unique
`(draftId, role)` index — only the repository collapses everything to one row.

**Decision.** Model a draft's media as a **bundle of bindings, one per role**:
`MediaRole = primary_image | primary_video | voiceover | music | subtitles | composed_video`.
Add `upsertBundleAssets` (per-role delete-then-insert) and `getDraftBundle`. Widen
`StudioV2MediaKind` to `image | video | audio | subtitles`; SRT stored as text
(binding `meta.srt`) **and** a `.srt` asset. Add a `meta` jsonb column to bindings.
Authority: [`data-model.md`](./data-model.md), [`db-migration.md`](./db-migration.md).

**Consequences.** (+) Multiple artifacts coexist per draft; the table's existing
unique index is finally used as intended. (+) `upsertPrimaryAsset` survives as a
shim → non-regression. (−) Requires a backfill of the legacy `primary` role and a
filter widening in `listPrimaryAssetsForDrafts`. (−) One extra column.

**Alternatives rejected.** (a) *A JSON blob of assets on `content_draft`* — loses
referential integrity to `media`, can't reuse the existing unique index, harder to
query. (b) *A new `content_media_track` table* — duplicates `content_asset_binding`,
which already has role + uniqueness; more migration surface, more code.

---

## ADR-D2 — Extend the DTO + bridge (close the leak)

**Context.** The graph produces `state.voiceover/music/subtitles/composition`
(`state.ts` L120–137) but `GenerationResult` (orchestrator.ts L30–45) has no such
fields and `buildResultFromState` (L109–131) never reads them; `bridgeToContentStudio`
(bridge.ts L81–193) copies only script/caption/hashtags/one-image. Artifacts die at
the boundary (BUG-004).

**Decision.** Add optional `voiceover, music, subtitles, composedVideo,
transcodedVideo` to `GenerationResult`; read the matching state channels in
`buildResultFromState` (channel `composition` → field `composedVideo`;
`exports.final` → `transcodedVideo`). In the bridge, replace the single
`upsertPrimaryAsset` call with one `upsertBundleAssets` that maps every present
artifact to its role. Exact before/after: [`dto-bridge-changes.md`](./dto-bridge-changes.md).

**Consequences.** (+) The backbone all three features consume. (+) Additive optional
fields → existing callers and `tsc` unaffected. (+) Mock primary-visual skip rule is
preserved; only audio/subtitles/composed are newly surfaced. (−) The DTO/state
channel-name mismatch (`composition` vs `composedVideo`) must be handled explicitly.

**Alternatives rejected.** (a) *Make the bridge read `state` directly instead of the
DTO* — the DTO is the contract persisted in `updateJobResult`; bypassing it would
desync jobs storage. (b) *A separate "media DTO"* — two DTOs to keep in sync; one
extended interface is simpler.

---

## ADR-D3 — Per-draft service + routes in pipeline B

**Context.** Pipeline B's only generation surface is `generateVisualForDraft`
(service.ts L287) + `POST …/[id]/generate-visual`. There is no per-draft entry point
for voice-over/subtitles/compose, so the operator UI cannot trigger them.

**Decision.** Add mode-aware service fns + routes mirroring `generateVisualForDraft`:
`generateVoiceoverForDraft` / `…/generate-voiceover`, `generateSubtitlesForDraft` /
`…/generate-subtitles`, `composeDraftVideo` / `…/compose`. Each: enforce flag + admin
auth, read `cs_generation_mode` cookie, validate zod body, reuse the pipeline-A node
core, persist via `createMedia` + `upsertBundleAssets`, log a generation run.
`mock` = deterministic silent/sample artifact, **no provider call**;
`live`-no-key = `HttpError invalid_state` (409).

**Consequences.** (+) Symmetric, testable surface (MSW `onUnhandledRequest:'error'`
proves the no-network path). (+) Reuses existing auth/budget/audit plumbing. (−) Three
new routes + schemas to maintain.

**Alternatives rejected.** (a) *One mega-route `…/media` with an `action` field* —
worse OpenAPI contracts, harder validation, conflates concerns. (b) *Run the whole
LangGraph per draft* — heavy, couples B to A's graph lifecycle, breaks mode isolation.

---

## ADR-D4 — UI: "Studio média" tracks panel in step 3

**Context.** `MediaStudio.tsx` toggles only `image|video` (~L418); there is nowhere
to generate or preview audio/subtitles or to compose.

**Decision.** When the primary media is a video (`reel`/`story`), render a tracks
panel `🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer`. Each
track: generate/regenerate + preview; **Composer** assembles them; the composed video
plays via the reused `VideoPlayer.tsx`. `PublishActionGroup` shows the composed video
+ a track summary. Detail lives in the feature folders.

**Consequences.** (+) Reuses `VideoPlayer`, `PlatformPreview`, `PublishActionGroup`.
(+) Progressive: tracks are optional; compose degrades gracefully (mirrors
`compose.ts` no-audio byte-copy). (−) New stateful UI to keep a11y/i18n-clean.

**Alternatives rejected.** (a) *A separate "/media" page* — breaks the 4-step flow and
the single-draft mental model. (b) *Auto-compose on every track change* — wasteful
ffmpeg runs; explicit Composer is cheaper and clearer.

---

## ADR-D5 — Reuse, don't reinvent (node cores)

**Context.** ffmpeg compose, TTS, and SRT generation already exist as pipeline-A
nodes (`compose.ts`, `generate-voiceover.ts`, `generate-subtitles.ts`,
`generate-music.ts`). They take a graph `state` record.

**Decision.** Extract a **pure core** alongside each node (e.g.
`composeMediaBundle(...)`, `generateVoiceoverAsset(...)`, reuse existing `generateSRT`)
and make the graph node a thin wrapper. Per-draft services call the same core. No
duplicate ffmpeg/TTS code; `MEDIA_DIR`/`MEDIA_URL_PREFIX` (compose.ts L15–16) stay the
shared media root.

**Consequences.** (+) Single implementation; bug-fixes apply to both pipelines.
(+) Node co-located `*.test.ts` keep covering the core. (−) A refactor of the nodes to
expose the core (mechanical, low-risk).

**Alternatives rejected.** (a) *Copy the ffmpeg/TTS logic into service.ts* — violates
D5, doubles maintenance, risks drift. (b) *Invoke the node by faking a graph state in
B* — brittle; the node returns partial-state shapes, not clean values.

---

## ADR-D6 — Non-regression + feature flag

**Context.** The existing 4-step flow and `generateVisualForDraft` must keep working
unchanged; staging ships frequently and two build-breakers shipped this week
(ground-truth §6).

**Decision.** Every change is additive and gated by
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (`z.enum(['true','false']).default('false')` in
`env.ts`, mirrored in `.env.example`). Off ⇒ today's behavior, byte-for-byte. Keep
`upsertPrimaryAsset` as a shim; keep the migration additive (no drop) with a backfill;
keep publishing `dry_run`. CI gates on `tsc --noEmit` (vitest does not typecheck) and
the existing CS v2 regression suite + `create-golden-path` Playwright spec.

**Consequences.** (+) Safe incremental rollout, instant kill-switch. (+) Prod
untouched until the G-gate flips the flag. (−) Flag plumbing in routes + UI; flag must
be cleaned up once GA.

**Alternatives rejected.** (a) *Ship without a flag* — unacceptable regression risk on
a hot path. (b) *A DB-stored flag* — slower to toggle, more moving parts than an env
var for a staging rollout.
