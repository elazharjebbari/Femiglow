# Voice-over — Playwright E2E plan (mock mode)

> Runs against **staging :8012** in **mock** mode (`cs_generation_mode=mock`).
> NEVER live publishing (`SOCIAL_PUBLISHING_MODE` stays `dry_run`). Mirrors the
> existing `e2e/content-studio-v2/create-golden-path.spec.ts` conventions
> (admin auth fixture, draft selection, `data-cs-*` / `data-testid` selectors).
> File: `apps/web/e2e/content-studio-v2/voiceover.spec.ts` (MP-VO-09).
> Pre-req: `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true` for the test run.

## Selectors introduced (UI must expose these)

| Selector | Element |
|---|---|
| `[data-cs-section="track-voiceover"]` | the Voix-off track container |
| `#voiceover-script` (label "Script de la voix-off") | script textarea |
| `[data-testid="voiceover-voice-mock"]` | mock voice radio |
| `[data-cs-voiceover-generate]` | "Générer la voix-off" button |
| `[data-cs-voiceover-regenerate]` | "Régénérer" button |
| `[data-cs-audio-player]` | `AudioTrackPlayer` root |
| `[data-cs-audio-toggle-play]` / `[data-cs-audio-toggle-mute]` | player controls |
| `[data-cs-track-badge="voiceover"]` | publish summary 🎙️ row |

## Scenarios

### voiceover.spec.ts > operator generates and previews a voice-over (mock)
1. Login as admin; open `/admin/content-studio-v2/create`.
2. Cadrer → Générer (pick a **Reel** variant) → step **Visuel**.
3. Generate a primary **video** (existing flow) so the draft is video-capable.
4. Assert `[data-cs-section="track-voiceover"]` is visible.
5. Assert `#voiceover-script` is pre-filled (non-empty).
6. Edit the script; pick voice `mock`.
7. Click `[data-cs-voiceover-generate]`.
8. Wait for `[data-cs-audio-player]` to appear (track `ready`); assert a toast
   "Voix-off générée".
9. Assert the player exposes `[data-cs-audio-toggle-play]` with an `aria-label`.
10. **No network to any provider host** — covered by unit/MSW; here assert the
    page made the POST and got 200 (intercept `**/generate-voiceover`).

### voiceover.spec.ts > regenerate replaces the track
1. From a `ready` track, edit the script (track shows "modifié").
2. Click `[data-cs-voiceover-regenerate]`; wait for the player to refresh.
3. Assert toast "Voix-off régénérée"; the "modifié" badge clears.

### voiceover.spec.ts > flows into publish summary
1. With a `ready` voice-over, open `PublishActionGroup` confirm dialog.
2. Assert `[data-cs-track-badge="voiceover"]` shows 🎙️ Voix-off ✓.
3. Confirm publish proceeds in **dry-run** (assert the dry-run banner/label).

### voiceover.spec.ts > track hidden for non-video format (non-regression)
1. Create a **carousel** draft; go to Visuel.
2. Assert `[data-cs-section="track-voiceover"]` is **absent**.

### voiceover.spec.ts > track hidden when Media-Studio flag off (non-regression)
1. With `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false`, repeat the Reel flow.
2. Assert the Voix-off track is absent and the legacy MediaStudio is byte-stable
   (existing visual generation still works).

### voiceover.spec.ts > keyboard a11y smoke
1. Tab to `[data-cs-audio-toggle-play]`; press Space; assert
   `data-cs-audio-playing` flips.
2. Focus the seek slider; press `ArrowRight`; assert `aria-valuetext` updates.

## CI

- Tagged `@content-studio @voiceover`. Runs after vitest + `tsc --noEmit` pass.
- Uses the mock-mode project config; trace on first retry.
