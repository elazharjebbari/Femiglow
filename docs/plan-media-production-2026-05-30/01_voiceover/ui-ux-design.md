# Voice-over — UI/UX design

> Tokens, layout, interactions, a11y, i18n. Grounded in `MediaStudio.tsx` and
> `VideoPlayer.tsx` (token vocabulary). Decision D4. Prefix `MP-VO-*`.

## 1. Placement

Step 3 **Visuel**, inside the **Studio média** tracks panel (D4), the Voix-off
track sits between **🎬 Vidéo** and **🎵 Musique**:

```
🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer
```

Only shown when the draft is video-capable (`reel`/`story`) and
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` is on (D6).

## 2. ASCII wireframe

### Empty state
```
┌─ 🎙️ Voix-off ────────────────────────────────  [ mock ▾ ]┐
│                                                            │
│  Script narration                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Un geste lent, une main qui retrouve sa lumière. …    │ │
│  │ (pré-rempli depuis la narration du script)            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                              312 / 4000 ⓘ  │
│                                                            │
│  Voix   ( • nova )( alloy )( shimmer )( bella )            │
│                                                            │
│                         [  🎙️  Générer la voix-off  ]      │
└────────────────────────────────────────────────────────────┘
```

### Generating
```
│  [▓▓▓▓▓▓▓▓░░░░░░░] 8s · ≈12s en général                    │
│  Génération de la voix-off…   (contrôles désactivés)        │
```

### Ready
```
┌─ 🎙️ Voix-off ───────────────────────  🎙️ mock · nova · 0:14 ┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ▶  ──────●────────────────  0:06 / 0:14    🔊         │  │
│  └──────────────────────────────────────────────────────┘  │
│  Script (replié)  ▸                          [ ↻ Régénérer ]│
└─────────────────────────────────────────────────────────────┘
```

### Stale (script edited after ready)
```
┌─ 🎙️ Voix-off ─────────────  🟠 modifié · 🎙️ mock · nova · 0:14 ┐
│  …audio player…                              [ ↻ Régénérer ]   │  ← emphasized
└────────────────────────────────────────────────────────────────┘
```

### Error (live, no key)
```
│  ⚠ Aucune clé TTS configurée. Ajoutez une clé ou repassez en   │
│    mode mock.                          [  🎙️ Réessayer  ]       │
```

## 3. Interactions

| Action | Result |
|---|---|
| Type in textarea | updates `script`; live char counter; if a `ready` asset exists, marks track `stale`. |
| Pick a voice | updates `voice` (radiogroup); marks `stale` if `ready`. |
| Click "Générer"/"Régénérer" | POST; disabled while in-flight; estimator bar shown. |
| Success toast | "Voix-off générée" / "Voix-off régénérée". |
| Audio ▶/⏸ | play/pause; Space toggles when player focused. |
| Seek bar | drag or ←/→ keys; updates `currentTime`. |
| Mute | toggles audio; icon swaps 🔊/🔇. |
| Collapse "Script ▸" | shows/hides the read-only generated script. |

## 4. Accessibility (a11y) — non-negotiable

### Container
- Track is a `<section aria-label="Voix-off">`. Track-state changes announce via a
  visually-hidden `aria-live="polite"` region ("Voix-off générée", "Génération en
  cours…").

### Script field
- `<textarea>` with associated `<label for>` "Script de la voix-off". Char counter
  linked via `aria-describedby`. Over-limit ⇒ `aria-invalid="true"`.

### Voice selector
- `role="radiogroup" aria-label="Voix de synthèse"`; each option `role="radio"
  aria-checked`; arrow keys move selection (roving tabindex), Space/Enter selects.

### `AudioTrackPlayer` ARIA (MP-VO-06)
- Root: `role="group" aria-label="Lecteur voix-off"`.
- Play/pause button: `aria-label` toggles "Lire la voix-off" / "Mettre en pause";
  `aria-pressed` reflects playing.
- Seek: `<input type="range">` with `aria-label="Position de lecture"`,
  `aria-valuetext="6 secondes sur 14"`, `min=0 max={durationSec}`.
- Mute: `aria-label` "Couper le son" / "Activer le son", `aria-pressed`.
- Time readout: `aria-hidden` (the slider's `aria-valuetext` is the SR source of
  truth — no double announcement).
- The native `<audio>` element is `aria-hidden` (custom controls own semantics).

### Keyboard map
| Key | Context | Action |
|---|---|---|
| `Tab` | track | textarea → voices → generate → (ready) player controls |
| `Space`/`Enter` | play button | toggle play/pause |
| `←` / `→` | seek slider | −/+ 1s |
| `Home`/`End` | seek slider | start / end |
| `m` | player focused | toggle mute |
| arrows | voice radiogroup | change voice |

- All interactive controls reachable & operable via keyboard; visible focus ring
  uses `--cs-focus-ring`. No focus trap. Disabled buttons get `aria-disabled`.

### Contrast
- Text on `--cs-bg-elevated` ≥ 4.5:1; the amber "modifié" badge text ≥ 4.5:1 on its
  background; error text uses `--cs-danger` on `--cs-bg-elevated` (≥ 4.5:1).

## 5. i18n — FR strings (single source for the feature)

| Key | FR |
|---|---|
| `voiceover.track.title` | Voix-off |
| `voiceover.script.label` | Script de la voix-off |
| `voiceover.script.placeholder` | La narration parlée de votre vidéo… |
| `voiceover.script.counter` | {n} / 4000 |
| `voiceover.voice.label` | Voix de synthèse |
| `voiceover.generate` | Générer la voix-off |
| `voiceover.regenerate` | Régénérer |
| `voiceover.retry` | Réessayer |
| `voiceover.generating` | Génération de la voix-off… |
| `voiceover.toast.created` | Voix-off générée |
| `voiceover.toast.regenerated` | Voix-off régénérée |
| `voiceover.badge.modified` | modifié |
| `voiceover.error.noKey` | Aucune clé TTS configurée. Ajoutez une clé ou repassez en mode mock. |
| `voiceover.error.format` | Voix-off réservée aux formats vidéo (Reel/Story). |
| `voiceover.error.generic` | Échec de la génération |
| `voiceover.player.label` | Lecteur voix-off |
| `voiceover.player.play` | Lire la voix-off |
| `voiceover.player.pause` | Mettre en pause |
| `voiceover.player.seek` | Position de lecture |
| `voiceover.player.mute` | Couper le son |
| `voiceover.player.unmute` | Activer le son |
| `voiceover.guard.noDraft` | Sélectionnez d’abord une variante. |

All copy is **French** (matches existing MediaStudio strings).

## 6. Design tokens (reused — no new tokens unless noted)

| Token | Use |
|---|---|
| `--cs-bg-elevated` | track card background |
| `--cs-bg-sunken` | textarea / player background |
| `--cs-border-hair` | card & control borders |
| `--cs-radius-md` / `--cs-radius-sm` / `--cs-radius-full` | corners |
| `--cs-accent` / `--cs-on-accent` | primary button, active voice, progress |
| `--cs-fg-primary` / `--cs-fg-secondary` / `--cs-fg-muted` | text hierarchy |
| `--cs-font-display` / `--cs-font-mono` | title / counter & timecode |
| `--cs-danger` | error text, over-budget |
| `--cs-warning` | "modifié" badge (`stale`) |
| `--cs-text-lg` | track title |
| `--cs-motion-fast` (≈150ms) | control transitions |
| `--cs-focus-ring` | keyboard focus (verify token exists; else `2px solid --cs-accent`) |

No layout shift on state change (reserve player height). Respect
`prefers-reduced-motion`: disable the estimator bar transition.

## 7. Responsive

Track is full-width within the MediaStudio column; textarea min 3 rows, grows to 6;
on narrow viewports the voice radios wrap; the audio player controls stay inline
(play | seek | time | mute) and the seek bar flexes.
