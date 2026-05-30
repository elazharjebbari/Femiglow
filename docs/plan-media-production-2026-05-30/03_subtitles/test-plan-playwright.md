# Subtitles — Playwright E2E plan (mock mode)

> Runs against **staging :8012** in **mock** mode (`cs_generation_mode=mock`).
> NEVER live publishing (`SOCIAL_PUBLISHING_MODE` stays `dry_run`). Mirrors the
> existing `e2e/content-studio-v2/create-golden-path.spec.ts` conventions (admin auth
> fixture, draft selection, `data-cs-*` / `data-testid` selectors).
> File: `apps/web/e2e/content-studio-v2/subtitles.spec.ts` (MP-SU-14).
> Pre-req: `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true` for the test run.

## Selectors introduced (UI must expose these)

| Selector | Element |
|---|---|
| `[data-cs-section="track-subtitles"]` | the Sous-titres track container |
| `[data-cs-subtitles-generate]` | "Générer les sous-titres" button |
| `[data-cs-subtitles-regenerate]` | "Régénérer" button |
| `[data-cs-subtitles-save]` | "Enregistrer les sous-titres" button |
| `[data-cs-cue-editor]` | `CueEditor` root (role=table) |
| `[data-cs-cue-row="{n}"]` | cue row n |
| `[data-cs-cue-start="{n}"]` / `[data-cs-cue-end="{n}"]` | timecode inputs |
| `[data-cs-cue-line="{n}-{k}"]` | line k textarea of cue n |
| `[data-cs-cue-add]` / `[data-cs-cue-delete="{n}"]` | add / delete cue |
| `[data-cs-cue-issue]` | error/warning summary item |
| `[data-cs-style-position="bottom"]` | position radio |
| `[data-cs-subtitle-preview]` | `SubtitleOverlayPreview` root |
| `[data-cs-track-badge="subtitles"]` | publish summary 💬 row |

## Scenarios

### subtitles.spec.ts > operator generates, edits and saves subtitles (mock)
1. Login as admin; open `/admin/content-studio-v2/create`.
2. Cadrer → Générer (pick a **Reel** variant) → step **Visuel**.
3. Generate a primary **video** (existing flow) so the draft is video-capable.
4. Assert `[data-cs-section="track-subtitles"]` is visible.
5. Click `[data-cs-subtitles-generate]`; wait for `[data-cs-cue-editor]` to appear
   with ≥1 `[data-cs-cue-row]`; assert a toast "Sous-titres générés".
6. Edit cue 1 line text; assert the char counter updates and
   `[data-cs-subtitle-preview]` reflects the new text.
7. Click `[data-cs-style-position="bottom"]`/another position; assert the preview moves.
8. Click `[data-cs-subtitles-save]`; assert toast "Sous-titres enregistrés".
9. Assert the page made the PUT and got 200 (intercept `**/drafts/*/subtitles`).
   **No network to any provider host** — covered by unit/MSW.

### subtitles.spec.ts > save blocked on overlapping cues
1. From a generated track, edit cue 2 `start` to a value before cue 1 `end`
   (force an overlap).
2. Assert `[data-cs-cue-issue]` shows the overlap error and
   `[data-cs-subtitles-save]` is `disabled` / `aria-disabled`.
3. Click the issue's "Aller au sous-titre" link; assert focus lands on the cue 2
   start input.
4. Fix the timecode; assert the error clears and Enregistrer re-enables.

### subtitles.spec.ts > regenerate warns before overwriting edits
1. With edited cues, click `[data-cs-subtitles-regenerate]`.
2. Assert a confirm dialog "Cela remplacera vos sous-titres édités."; cancel keeps the
   edits; confirm replaces them.

### subtitles.spec.ts > flows into publish summary
1. With a saved subtitles asset, open `PublishActionGroup` confirm dialog.
2. Assert `[data-cs-track-badge="subtitles"]` shows 💬 Sous-titres ✓.
3. Confirm publish proceeds in **dry-run** (assert the dry-run banner/label).

### subtitles.spec.ts > track hidden for non-video format (non-regression)
1. Create a **carousel** draft; go to Visuel.
2. Assert `[data-cs-section="track-subtitles"]` is **absent**.

### subtitles.spec.ts > track hidden when Media-Studio flag off (non-regression)
1. With `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false`, repeat the Reel flow.
2. Assert the Sous-titres track is absent and the legacy MediaStudio is byte-stable
   (existing visual generation still works).

### subtitles.spec.ts > keyboard a11y smoke
1. Tab into `[data-cs-cue-editor]`; assert focus order start → end → line1 → line2 →
   row actions.
2. Focus a cue; press `Alt+ArrowUp`; assert both start and end shift by −100 ms.
3. Press `Ctrl+Enter` with a valid editor; assert a save is triggered.
4. Tab to `[data-cs-style-position]` radiogroup; arrow-navigate; assert the preview
   updates.

## CI

- Tagged `@content-studio @subtitles`. Runs after vitest + `tsc --noEmit` pass.
- Uses the mock-mode project config; trace on first retry.
