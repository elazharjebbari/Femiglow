# Compose (montage vidéo) — UI/UX design

> Tokens, layout, interactions, a11y, i18n (FR). Grounded in `MediaStudio.tsx` and
> `VideoPlayer.tsx` (token vocabulary, `data-cs-*` selectors). Decision D4. Prefix
> `MP-CO-*`.

## 1. Placement

Step 3 **Visuel**, inside the **Studio média** tracks panel (D4), the **Montage**
panel sits **last**, after the track generators, as the assembly stage:

```
🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer
```

Only shown when the draft is video-capable (`reel`/`story`) and
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` is on (D6).

## 2. ASCII wireframe

### Blocked (no primary video yet)
```
┌─ 🎞️ Montage ───────────────────────────────────────  [ mock ▾ ]┐
│                                                                  │
│   🎬 Vidéo        —  (aucune vidéo primaire)                     │
│   🎙️ Voix-off     —                                              │
│   🎵 Musique       —                                              │
│   💬 Sous-titres   —                                              │
│                                                                  │
│   ⓘ Générez d’abord une vidéo pour activer le montage.           │
│                          [  🎞️  Composer  ]   (désactivé)         │
└──────────────────────────────────────────────────────────────────┘
```

### Empty (primary video present, tracks optional)
```
┌─ 🎞️ Montage ───────────────────────────────────────  [ mock ▾ ]┐
│   Pistes à monter                                                │
│   🎬 Vidéo        ✓ présente            (requise)                │
│   🎙️ Voix-off     ✓ présente            [✓ inclure]             │
│   🎵 Musique       — absente                                     │
│   💬 Sous-titres   ✓ présents           [✓ inclure]             │
│                                                                  │
│   ☐ Exporter au format plateforme (transcode)                    │
│                          [  🎞️  Composer  ]                       │
└──────────────────────────────────────────────────────────────────┘
```

### Composing
```
│   [▓▓▓▓▓▓▓░░░░░░░░] 7s · ≈18s en général                         │
│   Montage en cours…   (contrôles désactivés)                     │
```

### Ready
```
┌─ 🎞️ Montage ───────────────────────  🎬✓ · 🎙️✓ · 🎵✗ · 💬✓ · 0:14 ┐
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  ▶  [ VIDÉO · 0:14 ]                  🔊     │  │
│  │              (VideoPlayer — vidéo composée)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Pistes montées : 🎬 ✓  🎙️ ✓  🎵 ✗  💬 ✓        [ ↻ Recomposer ] │
└────────────────────────────────────────────────────────────────────┘
```

### Stale (a source track changed after a ready compose)
```
┌─ 🎞️ Montage ───────────────  🟠 à recomposer · 🎬✓ 🎙️✓ 💬✓ · 0:14 ┐
│  …VideoPlayer (vidéo composée — toujours lisible)…                 │
│  Pistes montées : … (obsolètes)              [ ↻ Recomposer ]      │  ← emphasized
└────────────────────────────────────────────────────────────────────┘
```

### Error (ffmpeg / no source)
```
│  ⚠ Échec du montage ffmpeg. Réessayez ou régénérez une piste.     │
│                                       [  🎞️ Réessayer  ]           │
```

## 3. Interactions

| Action | Result |
|---|---|
| Toggle "inclure" on a present track | flips `include*`; if a `ready` compose exists, marks panel `stale`. |
| Toggle "Exporter au format plateforme" | sets `export`; included in the next compose POST. |
| Click "Composer"/"Recomposer" | POST `/compose`; disabled while in-flight; estimator bar shown. |
| Success toast | "Vidéo composée" / "Vidéo recomposée". |
| Composed video ▶/⏸/🔊 | delegated to the reused `VideoPlayer` (its own play/mute controls). |
| Blocked "Composer" | disabled + hint; clicking is a no-op (also guarded in JS with a toast). |
| Source track regenerated upstream | panel becomes `stale`; "Recomposer" emphasized. |

## 4. Accessibility (a11y) — non-negotiable

### Container
- Panel is a `<section aria-label="Montage vidéo">`. State changes announce via a
  visually-hidden `aria-live="polite"` region ("Montage en cours…", "Vidéo
  composée", "Échec du montage").

### Track-presence list
- Rendered as a `<ul>` of rows; each row is a list item with a textual presence
  state ("présente"/"absente") that is **not** conveyed by the emoji alone
  (emojis are `aria-hidden`, the text is the SR source of truth).
- The include control is a `<button role="switch" aria-checked aria-label="Inclure
  la voix-off dans le montage">` (a switch, not a checkbox glyph). Absent-track
  switches are `aria-disabled` + `disabled`.
- The 🎬 Vidéo row's control is `aria-disabled` with `aria-label="Vidéo requise
  (toujours incluse)"`.

### Compose button
- `<button aria-label>` toggles "Composer la vidéo" / "Recomposer la vidéo".
  When `blocked`, `aria-disabled="true"` + `aria-describedby` points at the hint
  text. While `composing`, `aria-busy="true"`.

### Composed video player
- Reuses `VideoPlayer.tsx`, which already exposes accessible controls
  (`aria-label` on the `<video>`, play/mute buttons with `aria-label`,
  `data-cs-video-*`). No new a11y work for playback; the panel only adds the
  surrounding `aria-live` + track-summary semantics.

### Track-summary chip
- `role="status"` (or inside the `aria-live` region), with **textual** per-track
  state, e.g. "Pistes montées : vidéo incluse, voix-off incluse, musique exclue,
  sous-titres inclus." (emoji decorative/`aria-hidden`).

### Keyboard map
| Key | Context | Action |
|---|---|---|
| `Tab` | panel | include switches → export checkbox → Composer → (ready) player controls |
| `Space`/`Enter` | include switch | toggle include |
| `Space`/`Enter` | Composer button | trigger compose (no-op when disabled) |
| `Space` | player play button | toggle (delegated to VideoPlayer) |

- All interactive controls keyboard-reachable & operable; visible focus ring uses
  `--cs-focus-ring`. No focus trap. Disabled controls get `aria-disabled`.

### Contrast
- Text on `--cs-bg-elevated` ≥ 4.5:1; the amber "à recomposer" badge text ≥ 4.5:1
  on its background; error text uses `--cs-danger` on `--cs-bg-elevated` (≥ 4.5:1);
  "présente/absente" states never rely on color alone (text + icon).

## 5. i18n — FR strings (single source for the feature)

| Key | FR |
|---|---|
| `compose.panel.title` | Montage vidéo |
| `compose.tracks.heading` | Pistes à monter |
| `compose.track.video` | Vidéo |
| `compose.track.voiceover` | Voix-off |
| `compose.track.music` | Musique |
| `compose.track.subtitles` | Sous-titres |
| `compose.track.present` | présente |
| `compose.track.absent` | absente |
| `compose.track.required` | requise |
| `compose.track.include` | Inclure dans le montage |
| `compose.export.label` | Exporter au format plateforme (transcode) |
| `compose.compose` | Composer |
| `compose.recompose` | Recomposer |
| `compose.retry` | Réessayer |
| `compose.composing` | Montage en cours… |
| `compose.toast.composed` | Vidéo composée |
| `compose.toast.recomposed` | Vidéo recomposée |
| `compose.badge.stale` | à recomposer |
| `compose.summary.label` | Pistes montées |
| `compose.hint.noVideo` | Générez d’abord une vidéo pour activer le montage. |
| `compose.error.noPrimaryVideo` | Aucune vidéo primaire à monter. |
| `compose.error.noTracks` | Aucune piste à monter (voix-off, musique ou sous-titres). |
| `compose.error.format` | Montage réservé aux formats vidéo (Reel/Story). |
| `compose.error.sourceMissing` | Fichier vidéo source introuvable. |
| `compose.error.ffmpeg` | Échec du montage ffmpeg. |
| `compose.error.timeout` | Montage interrompu (délai dépassé). |
| `compose.error.generic` | Échec du montage |
| `compose.guard.noDraft` | Sélectionnez d’abord une variante. |
| `compose.guard.noVideo` | Générez d’abord une vidéo. |

All copy is **French** (matches existing MediaStudio / VideoPlayer strings).

## 6. Design tokens (reused — no new tokens unless noted)

| Token | Use |
|---|---|
| `--cs-bg-elevated` | panel card background |
| `--cs-bg-sunken` | track list / player frame background |
| `--cs-border-hair` | card & control borders |
| `--cs-radius-md` / `--cs-radius-sm` / `--cs-radius-full` | corners |
| `--cs-accent` / `--cs-on-accent` | primary "Composer" button, active switch, progress |
| `--cs-fg-primary` / `--cs-fg-secondary` / `--cs-fg-muted` | text hierarchy, absent tracks |
| `--cs-font-display` / `--cs-font-mono` | title / timecode & summary |
| `--cs-danger` | error text |
| `--cs-warning` | "à recomposer" badge (`stale`) |
| `--cs-text-lg` | panel title |
| `--cs-motion-fast` (≈150ms) | switch & button transitions |
| `--cs-focus-ring` | keyboard focus (verify token exists; else `2px solid --cs-accent`) |

No layout shift on state change (reserve the player height equal to the primary
video aspect ratio). Respect `prefers-reduced-motion`: disable the estimator bar
transition.

## 7. Responsive

Panel is full-width within the MediaStudio column; the track list stacks; on narrow
viewports the include switches stay right-aligned and wrap under their labels; the
composed `VideoPlayer` keeps the draft's aspect ratio (`reel`/`story` = 9:16) and
flexes to the column width.

## 8. Selectors (E2E contract — UI must expose)

| Selector | Element |
|---|---|
| `[data-cs-section="track-compose"]` | the Montage panel container |
| `[data-cs-compose-track="video\|voiceover\|music\|subtitles"]` | a track-presence row |
| `[data-cs-compose-include="voiceover\|music\|subtitles"]` | include switch |
| `[data-cs-compose-export]` | export checkbox |
| `[data-cs-compose-button]` | "Composer"/"Recomposer" button |
| `[data-cs-compose-summary]` | track-summary chip (ready) |
| `[data-cs-video-player]` (from `VideoPlayer.tsx`) | composed video preview |
| `[data-cs-track-badge="composed"]` | publish-confirm composed-video marker |
