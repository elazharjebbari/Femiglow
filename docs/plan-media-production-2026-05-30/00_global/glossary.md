# Glossary

> Shared vocabulary for the media-production dossier. Where a term maps to code,
> the file is cited. Align all feature folders to these definitions.

| Term | Definition |
|---|---|
| **Pipeline A** | The AI-Engine LangGraph pipeline under `src/lib/ai-engine/*`. Owns the rich media-production nodes; graph wired in `graph/builder.ts`. Produces artifacts into graph **state channels**. |
| **Pipeline B** | The Content-Studio create-flow under `src/lib/content-studio/*` + the v2 operator UI at `/admin/content-studio-v2/create`. Owns per-draft generation (`generateVisualForDraft`) and publishing. |
| **Bridge** | `bridgeToContentStudio` in `src/lib/ai-engine/bridge/content-studio-bridge.ts` (~L81). One-way A → B mapping of a `GenerationResult` into Content-Studio records. Today lossy (drops audio/subtitles/composed); extended in D2. |
| **GenerationResult** | The DTO returned by `runGeneration` (`orchestrator.ts` ~L30). The contract persisted in jobs storage and read by the bridge. Extended (D2) with `voiceover/music/subtitles/composedVideo/transcodedVideo`. |
| **State channel** | A field of the LangGraph `ContentGenerationState` (`types/state.ts`) carrying an artifact between nodes, e.g. `state.voiceover`, `state.music`, `state.subtitles`, `state.composition`. |
| **MediaAsset** | Pipeline-A artifact value type (`types/media.ts`): `{ assetId, url, mimeType, width?, height?, durationMs?, fileSizeBytes, provider, generationParams, costCents }`. Produced by the media nodes. |
| **StudioV2MediaItem** | Pipeline-B UI media type (`content-studio-v2/media/types.ts`): `{ id, kind, compartment, alt, slug, thumbnailUrl, previewUrl, originalUrl, durationSec?, width?, height?, createdAt }`. What the UI renders. |
| **StudioMediaItem** | Service-layer media shape returned by `service.ts` (e.g. from `generateVisualForDraft`): `{ id, slug, kind, source, compartment, status, alt, caption, originalUrl, thumbUrl, previewUrl, width, height, durationMs?, createdAt }`. |
| **Voiceover** | TTS narration track. Pipeline-A node `generateVoiceoverNode` (`nodes/generate-voiceover.ts`). Stored as `media.kind='audio'`, role `voiceover`. Mock = deterministic silent audio (`provider:'mock'`). |
| **Music** | Background music bed sized to duration. Node `generateMusicNode` (`nodes/generate-music.ts`). `media.kind='audio'`, role `music`. Mock = silent track. |
| **Subtitles** | SRT subtitle text generated from scene narration. Node `generateSubtitlesNode` → `generateSRT` (`nodes/generate-subtitles.ts`). A **string** in state, persisted as `media.kind='subtitles'` (`.srt` asset) + binding `meta.srt`, role `subtitles`. |
| **Compose** | ffmpeg montage that muxes primary video + voiceover + music (+ subtitles) into one mp4. Node `composeNode` → `composeVideo` (`nodes/compose.ts`, `fluent-ffmpeg` + `ffmpeg-static`). Output `media.kind='video'`, role `composed_video`. |
| **Transcode** | Platform-spec final encode. Node `transcodeExportNode` (`nodes/transcode-export.ts`); lands in `state.exports`. Carried in the DTO as `transcodedVideo`; not surfaced as its own operator step this phase. |
| **Role** | Discriminator on `content_asset_binding.role` identifying an asset's function in a draft's bundle: `primary_image \| primary_video \| voiceover \| music \| subtitles \| composed_video` (`MediaRole`). |
| **Bundle** | The set of role-addressed asset bindings for one draft (≤ one per role). Read via `getDraftBundle`, written via `upsertBundleAssets`. Replaces the old single-`primary` binding model (D1). |
| **Mock (mode)** | `cs_generation_mode = 'mock'` (cookie). Never calls an LLM/provider; returns a deterministic silent/sample artifact. Default when no cookie. Proven network-free by MSW `onUnhandledRequest:'error'`. |
| **Live (mode)** | `cs_generation_mode = 'live'`. Calls the real provider if a key is resolvable; `live`-no-key throws `HttpError('invalid_state')` → 409. |
| **dry_run** | `SOCIAL_PUBLISHING_MODE='dry_run'` (default). Publishing is simulated; no real Postiz delivery. **Never** switched to `live` in this plan. |
| **Media bundle by role** | Synonym for **Bundle**; the D1 data model. |
| **Feature flag** | `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (`env.ts`, default `false`). Gates all new routes + the tracks panel (D6). |
| **Tracks panel / Studio média** | The step-3 UI (`MediaStudio.tsx`) showing `🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer` (D4). |
| **Node core** | The pure, graph-decoupled function extracted from a pipeline-A node (D5) so pipeline-B services can reuse the same ffmpeg/TTS/SRT logic without LangGraph. |
| **BUG-004** | The audit finding (`docs/audit-generation-publication-2026-05-29/`) this whole plan closes: media artifacts produced by pipeline A are dropped before reaching the operator. |
| **HttpError** | `src/lib/errors/http-error.ts`. `HttpError(code, msg, details)`; `invalid_input`→400, `invalid_state`→409, `gone`→410; `formatErrorResponse` → `{ error: { code, message, details } }`. |
