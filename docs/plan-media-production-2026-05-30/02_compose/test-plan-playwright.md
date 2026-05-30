# Compose (montage vidéo) — Playwright E2E plan (mock mode)

> Runs against **staging :8012** in **mock** mode (`cs_generation_mode=mock`).
> NEVER live publishing (`SOCIAL_PUBLISHING_MODE` stays `dry_run`). Mirrors the
> existing `e2e/content-studio-v2/create-golden-path.spec.ts` conventions (admin
> auth fixture, draft selection, `data-cs-*` / `data-testid` selectors).
> File: `apps/web/e2e/content-studio-v2/compose.spec.ts` (MP-CO-10).
> Pre-req: `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true` for the test run; a primary
> **video** exists (generate it via the existing visual flow before composing).
> In mock mode compose is a deterministic byte-copy — no real ffmpeg encode, no
> provider, no network.

## Selectors introduced (UI must expose these)

| Selector | Element |
|---|---|
| `[data-cs-section="track-compose"]` | the Montage panel container |
| `[data-cs-compose-track="video\|voiceover\|music\|subtitles"]` | a track-presence row |
| `[data-cs-compose-include="voiceover\|music\|subtitles"]` | include switch |
| `[data-cs-compose-export]` | export checkbox |
| `[data-cs-compose-button]` | "Composer"/"Recomposer" button |
| `[data-cs-compose-summary]` | track-summary chip (ready) |
| `[data-cs-video-player]` (reused from `VideoPlayer.tsx`) | composed video preview |
| `[data-cs-track-badge="composed"]` | publish-confirm composed-video marker |

## Scenarios

### compose.spec.ts > operator composes and previews a montage (mock)
1. Login as admin; open `/admin/content-studio-v2/create`.
2. Cadrer → Générer (pick a **Reel** variant) → step **Visuel**.
3. Generate a primary **video** (existing flow) so the draft has a `primary_video`.
4. (Optional) generate a voice-over via the sibling Voix-off track so a track is present.
5. Assert `[data-cs-section="track-compose"]` is visible and the 🎬 Vidéo row shows "présente".
6. Click `[data-cs-compose-button]`.
7. Wait for `[data-cs-video-player]` inside the panel (panel `ready`); assert a toast
   "Vidéo composée".
8. Assert `[data-cs-compose-summary]` reflects the present tracks (e.g. 🎬 ✓ · 🎙️ ✓).
9. Intercept `**/compose` and assert the page got a 200 with a `media.previewUrl`.
   (No provider/network calls — covered by unit/MSW; here we only assert the POST.)

### compose.spec.ts > Composer is blocked without a primary video
1. On a Reel draft at Visuel **before** generating any video.
2. Assert `[data-cs-compose-button]` is disabled and the hint
   "Générez d’abord une vidéo…" is visible.

### compose.spec.ts > recompose replaces the montage
1. From a `ready` panel, toggle off `[data-cs-compose-include="music"]` (or
   regenerate a track) so the panel shows "à recomposer".
2. Click `[data-cs-compose-button]` (now "Recomposer"); wait for the player to refresh.
3. Assert toast "Vidéo recomposée"; the "à recomposer" badge clears; the summary updates.

### compose.spec.ts > flows into publish summary (dry-run)
1. With a `ready` composed video, open `PublishActionGroup` confirm dialog.
2. Assert the confirm preview uses `[data-cs-video-player]` (the **composed** video)
   and `[data-cs-track-badge="composed"]` is shown.
3. Confirm publish proceeds in **dry-run** (assert the dry-run banner/label).

### compose.spec.ts > panel hidden for non-video format (non-regression)
1. Create a **carousel** draft; go to Visuel.
2. Assert `[data-cs-section="track-compose"]` is **absent**.

### compose.spec.ts > panel hidden when Media-Studio flag off (non-regression)
1. With `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false`, repeat the Reel flow.
2. Assert the Montage panel is absent and the legacy MediaStudio is byte-stable
   (existing visual generation still works).

### compose.spec.ts > keyboard a11y smoke
1. Tab to an include switch; press Space; assert `aria-checked` flips.
2. Tab to `[data-cs-compose-button]`; press Enter; assert a compose request fires
   (when not blocked).

## CI

- Tagged `@content-studio @compose`. Runs after vitest + `tsc --noEmit` pass.
- Uses the mock-mode project config; trace on first retry.
- No real ffmpeg encode is required in mock mode (byte-copy); the E2E only proves
  the operator-visible flow and dry-run publish.
