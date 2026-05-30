# Scope & outcomes — program level

> Backbone scope: `MP-AR-*`. Program scope spans `MP-AR/VO/CO/SU/TB/RB`.
> Ground truth: [`ground-truth-codebase.md`](./ground-truth-codebase.md) §3 (D1–D6), §6.

---

## 1. In scope

### Architecture backbone (`MP-AR-*`, this folder)
- **MP-AR-001** — Extend `GenerationResult` (`orchestrator.ts`) with `voiceover`,
  `music`, `subtitles`, `composedVideo`, `transcodedVideo`; read them in
  `buildResultFromState`. (D2)
- **MP-AR-002** — Extend `bridgeToContentStudio` to map the new fields into
  Content-Studio assets; replace the single `upsertPrimaryAsset` call with
  `upsertBundleAssets`. (D2)
- **MP-AR-003** — Per-draft **media bundle by role**: extend the media model with a
  `role` discriminator (already a column on `content_asset_binding`) and **drop the
  single-role uniqueness assumption** in `upsertPrimaryAsset`; add
  `upsertBundleAssets` / `getDraftBundle` repository fns. (D1)
- **MP-AR-004** — Widen `StudioV2MediaKind` to `'image' | 'video' | 'audio' |
  'subtitles'`; SRT stored as text + a `.srt` asset. (D1)
- **MP-AR-005** — Additive Drizzle migration (columns/indexes only, no destructive
  change), forward + rollback + backfill note.
- **MP-AR-006** — Feature flag `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`
  (default `false`) in `env.ts` + `.env.example`; guards all new routes/UI.

### Features (consume the backbone)
- **MP-VO-*** — `generateVoiceoverForDraft` + `POST …/[id]/generate-voiceover`, track UI.
- **MP-CO-*** — `composeDraftVideo` + `POST …/[id]/compose`, Composer button + preview.
- **MP-SU-*** — `generateSubtitlesForDraft` + `POST …/[id]/generate-subtitles`, SRT track UI.
- **MP-TB-*** — vitest (service/route/node/component), MSW handlers, Playwright (mock, staging :8012), **`tsc --noEmit` CI gate**.
- **MP-RB-*** — enablement, smoke, rollback, dry-run guard, observability.

### Cross-cutting (in scope, all features)
- Mock-mode default; `mock` makes **no provider HTTP call** (asserted via MSW
  `onUnhandledRequest:'error'`); `live`-no-key → `HttpError invalid_state` (409).
- Reuse of pipeline-A node logic (extract shared core where graph-coupled). No new ffmpeg/TTS code.
- A11y (keyboard, ARIA, `prefers-reduced-motion`) and FR i18n for all new UI.
- Non-regression of `generateVisualForDraft` and the 4-step flow.

## 2. Out of scope

| Out | Why |
|---|---|
| **Live social publishing** | `SOCIAL_PUBLISHING_MODE` stays `dry_run`; explicit ground-truth §2 prohibition. |
| New ffmpeg / TTS / SRT **implementations** | D5 — reuse `compose.ts`, `generate-voiceover.ts`, `generate-subtitles.ts`, `generate-music.ts`. |
| Real TTS/music **providers** wired into pipeline B | mock-only this phase; OpenAI/ElevenLabs live paths stay in pipeline A config; live key remains a 409 in B. |
| `transcodeExportNode` surfaced as its own operator step | `transcodedVideo` is carried in the DTO for completeness but compose output is the publish artifact this phase. |
| Multi-video timeline / clip trimming editor | only single primary video compose. |
| Bidirectional B → A sync into the LangGraph state | bridge stays A → B for the graph; B gains its **own** per-draft service path (D3). "Bidirectional-enough" = B can write bundle assets, not feed the graph. |
| Changing the media worker / storage backend | reuse `createMedia` + `getStorage` + `enqueueJob`. |
| Carousel / multi-image audio | video formats (`reel`/`story`) only for the tracks panel. |

## 3. Success outcomes (what "done" means)

An operator on staging, **mock mode**, flag **on**, can:

1. **O1 — Generate voice-off.** On a `reel`/`story` draft, click 🎙️, get a
   voice-over asset (mock = deterministic silent audio), preview it. No network call.
2. **O2 — Generate music + subtitles.** Click 🎵 → music bed asset; click 💬 →
   SRT subtitles (text + `.srt` asset), preview the SRT.
3. **O3 — Compose montage.** Click 🎞️ **Composer** → ffmpeg assembles
   video+voiceover+music+subtitles into one mp4 `composed_video` asset, persisted
   under the draft by role.
4. **O4 — Preview the composed video.** It plays inline via `VideoPlayer.tsx`; the
   tracks panel shows each track's state and the compose metadata
   (`{hasVoiceover, hasMusic, hasSubtitles}`).
5. **O5 — Publish in dry-run.** `PublishActionGroup` shows the **composed** video +
   a track summary; approve → dry-run delivery only. Live is never reachable.
6. **O6 — Non-regression.** With the flag **off**, the create-flow is byte-for-byte
   the current behavior; image-only and no-audio drafts are unaffected.

## 4. Measurable acceptance (program level)

| ID | Criterion | Measure / proof |
|---|---|---|
| **PA-01** | DTO carries all artifacts | unit: a `GenerationResult` built from a state with `voiceover/music/subtitles/composition` exposes all five fields non-null (`MP-TB`). |
| **PA-02** | Bridge persists the bundle | integration: `bridgeToContentStudio` on such a result creates ≥2 `content_asset_binding` rows of distinct roles; `getDraftBundle` returns them. |
| **PA-03** | Per-draft routes work in mock | route tests: each of the 3 new POST routes returns 200 + an asset; MSW `onUnhandledRequest:'error'` proves **0** provider calls. |
| **PA-04** | Live-no-key is a clean 409 | route tests: mode=`live`, no key → `{ error: { code: 'invalid_state' } }`, status 409, **0** writes. |
| **PA-05** | Composed video previews | Playwright (mock): generate tracks → Composer → `VideoPlayer` renders the composed src; publish confirm shows composed video. |
| **PA-06** | Dry-run only | Playwright: publish path asserts `SOCIAL_PUBLISHING_MODE=dry_run`; no Postiz live call. |
| **PA-07** | Non-regression | full existing CS v2 vitest + the `create-golden-path` Playwright spec pass **unchanged**, flag off. |
| **PA-08** | `tsc --noEmit` passes | CI gate green on every touched package (ground-truth §6: vitest does NOT typecheck). |
| **PA-09** | Migration is additive & reversible | `db-migration.md` forward+rollback applied on a copy; no column dropped, no data lost; backfill verified. |
| **PA-10** | A11y + FR i18n | axe scan 0 criticals on the tracks panel; all new strings FR; `prefers-reduced-motion` honored. |
