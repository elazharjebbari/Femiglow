# Subtitles / script-on-video — UI/UX design

> Tokens, layout, interactions, a11y, i18n. Grounded in `MediaStudio.tsx` and
> `VideoPlayer.tsx` (token vocabulary). Decision D4. Prefix `MP-SU-*`.

## 1. Placement

Step 3 **Visuel**, inside the **Studio média** tracks panel (D4), the Sous-titres
track sits after **🎵 Musique** and before the **🎞️ Composer** action:

```
🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer
```

Only shown when the draft is video-capable (`reel`/`story`) and
`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` is on (D6).

## 2. ASCII wireframe

### Empty state
```
┌─ 💬 Sous-titres ─────────────────────────────────  [ mock ▾ ]┐
│                                                               │
│   Aucun sous-titre pour cette vidéo.                          │
│   Générez-les depuis le script, puis ajustez-les.            │
│                                                               │
│                    [  💬  Générer les sous-titres  ]          │
└───────────────────────────────────────────────────────────────┘
```

### Editing state (cues loaded)
```
┌─ 💬 Sous-titres ──────────────────  4 lignes · rule-based · 0:14 ┐
│ ┌─ Lignes synchronisées ──────────────────────────────────────┐ │
│ │ #  Début        Fin          Texte                          │ │
│ │ 1  00:00:00,000 00:00:03,000  Découvrez le secret des       │ │
│ │                               ongles parfaits.        37/42 │ │
│ │ 2  00:00:03,000 00:00:08,000  Un geste lent, une main qui   │ │
│ │                               retrouve sa lumière.    41/42 │ │
│ │ 3  00:00:08,000 00:00:12,000  Le camellia nourrit en        │ │
│ │ ⚠ Lecture rapide (19 c/s)     profondeur.            22/42  │ │
│ │ 4  00:00:12,000 00:00:15,000  FemiGlow, le rituel…   33/42  │ │
│ │ [ + Ajouter ] [ Scinder ] [ Fusionner ] [ Suppr ]          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌─ Style d’incrustation ──────────┐ ┌─ Aperçu ────────────────┐ │
│ │ Police  (•sans)(serif)(mono)    │ │  ┌────────────────────┐ │ │
│ │ Taille  [────●─────] 28px       │ │  │   (image vidéo)    │ │ │
│ │ Position (haut)(milieu)(•bas)   │ │  │                    │ │ │
│ │ Couleur  ⬜#FFFFFF  Cadre [✓]    │ │  │ ▣ Découvrez le… ▣ │ │ │
│ │ Fond ⬛#000000  Opacité [──●──]  │ │  └────────────────────┘ │ │
│ └──────────────────────────────────┘ │ Aperçu indicatif        │ │
│                                       └─────────────────────────┘ │
│  [ ↻ Régénérer ]                       [ 💾 Enregistrer ]          │
└────────────────────────────────────────────────────────────────────┘
```

### Invalid state (blocking errors)
```
│ ⚠ 2 erreurs à corriger :                                       │
│   • Sous-titre 2 : chevauchement avec le sous-titre 3.         │
│   • Sous-titre 4 : ligne trop longue (47/42 caractères).      │
│  …editor with rows 2 and 4 highlighted (rouge)…               │
│  [ ↻ Régénérer ]                       [ 💾 Enregistrer ]  (désactivé) │
```

### Error (live, refine, no IA key)
```
│ ⚠ Aucune clé IA configurée pour l’affinage. Désactivez        │
│   l’affinage ou repassez en mode mock.   [ 💬 Réessayer ]      │
```

## 3. Interactions

| Action | Result |
|---|---|
| Click "Générer" | POST generate; if cues already edited, confirm "remplacera vos sous-titres édités"; estimator bar; on success populate `CueEditor`. |
| Edit a timecode | `TimecodeInput` parses `hh:mm:ss,mmm`; live re-validation (V1–V11); preview/CPS update. |
| Edit line text | live char counter `n/42`; over-limit row flags V6; first cue updates the overlay preview. |
| + Ajouter / 🗑 Suppr | add/remove a cue; re-numbering display-only. |
| ⤢ Scinder / ⤡ Fusionner | split at caret / merge with next (≤ 2 lines). |
| Pick style (police/taille/position/couleur/cadre) | live preview overlay updates; marks dirty. |
| Click "Enregistrer" | PUT; disabled while invalid or clean; toast "Sous-titres enregistrés". |
| Click "Régénérer" | re-generate (confirm overwrite). |
| Warnings | shown inline + in summary; **do not** block save. |
| Errors | block save; summary lists each with a "Aller au sous-titre" link that focuses the row. |

## 4. Accessibility (a11y) — non-negotiable (timed-lines editor)

### Container
- Track is a `<section aria-label="Sous-titres">`. Track-state changes announce via a
  visually-hidden `aria-live="polite"` region ("Sous-titres générés", "Génération en
  cours…", "Sous-titres enregistrés").

### `CueEditor` (the timed-lines editor)
- Rendered as a semantic **table** (`role="table"`/`<table>`): a header row (`#`,
  `Début`, `Fin`, `Texte`) and one `role="row"` per cue. Each cell is `<th scope="row">`
  (index) / `<td>`.
- Each row has `aria-label="Sous-titre {n}, de {start} à {end}"` so a screen-reader user
  hears the cue context on row focus.
- **Timecode inputs**: `<input>` with `<label>` "Début du sous-titre {n}" /
  "Fin du sous-titre {n}", `inputmode="numeric"`, `aria-describedby` pointing to the
  format hint "Format hh:mm:ss,mmm". Parse failure ⇒ `aria-invalid="true"` +
  `aria-errormessage` referencing the V1 message.
- **Line textareas**: `<label>` "Texte ligne {k} du sous-titre {n}"; char counter linked
  via `aria-describedby`; over-limit ⇒ `aria-invalid="true"`.
- **Per-cue issues**: each error/warning is a `role="status"` (warning) or
  `role="alert"` (error) node referenced by the relevant field's `aria-errormessage` /
  `aria-describedby`, so the SR announces *why* a field is invalid.
- **Row action buttons** (add/delete/split/merge): each has an explicit `aria-label`
  including the cue number ("Supprimer le sous-titre 3"), not just an icon.
- **Error summary** (`CueIssueSummary`): a `role="alert"` region at the top listing
  errors; each item is a `<button>`/link that, on activation, **moves focus** to the
  offending cue's first invalid field (`element.focus()`), so keyboard users jump
  straight to the problem.

### Style controls & preview
- `SubtitleStyleControls`: position is a `role="radiogroup" aria-label="Position des
  sous-titres"`; font likewise; sliders are native `<input type="range">` with
  `aria-valuetext` ("28 pixels", "opacité 50 %"). The colour swatches are buttons with
  `aria-label` ("Couleur du texte : blanc").
- `SubtitleOverlayPreview`: `role="img"` with an `aria-label` describing the rendered
  cue + style ("Aperçu : « Découvrez le secret… » en bas, police sans, 28px, sur cadre
  noir"). The note "Aperçu indicatif…" is plain text, not focus-trapping.

### Keyboard map
| Key | Context | Action |
|---|---|---|
| `Tab` | track | Générer → (each cue: start → end → line1 → line2 → row actions) → style controls → Enregistrer |
| `Enter` | focused cue line | add a second line (if absent) or move to next cue |
| `Alt`+`↑`/`↓` | focused cue | nudge start+end by −/+ 100 ms |
| `Ctrl`+`Enter` | anywhere in editor | trigger Enregistrer (if valid) |
| arrows | position/font radiogroup | change value (roving tabindex) |
| `←`/`→`, `Home`/`End` | range slider | size / opacity adjust |

- All interactive controls reachable & operable via keyboard; visible focus ring uses
  `--cs-focus-ring`. No focus trap. Disabled "Enregistrer" gets `aria-disabled` and a
  tooltip "Corrigez les erreurs pour enregistrer." Reduced motion: estimator + preview
  transitions disabled under `prefers-reduced-motion`.

### Contrast
- Editor text on `--cs-bg-sunken` ≥ 4.5:1; error rows use `--cs-danger`, warnings
  `--cs-warning`, both ≥ 4.5:1 on their background. The **preview** overlay must itself
  warn if the chosen `textColor` vs `boxColor` is below 4.5:1 ("Contraste faible —
  lisibilité réduite") — guidance only, non-blocking.

## 5. i18n — FR strings (single source for the feature)

| Key | FR |
|---|---|
| `subtitles.track.title` | Sous-titres |
| `subtitles.generate` | Générer les sous-titres |
| `subtitles.regenerate` | Régénérer |
| `subtitles.save` | Enregistrer les sous-titres |
| `subtitles.retry` | Réessayer |
| `subtitles.generating` | Génération des sous-titres… |
| `subtitles.saving` | Enregistrement… |
| `subtitles.empty.title` | Aucun sous-titre pour cette vidéo. |
| `subtitles.empty.hint` | Générez-les depuis le script, puis ajustez-les. |
| `subtitles.noText` | Aucun texte à sous-titrer. |
| `subtitles.confirm.overwrite` | Cela remplacera vos sous-titres édités. Continuer ? |
| `subtitles.toast.generated` | Sous-titres générés |
| `subtitles.toast.saved` | Sous-titres enregistrés |
| `subtitles.editor.title` | Lignes synchronisées |
| `subtitles.editor.col.index` | # |
| `subtitles.editor.col.start` | Début |
| `subtitles.editor.col.end` | Fin |
| `subtitles.editor.col.text` | Texte |
| `subtitles.editor.add` | Ajouter un sous-titre |
| `subtitles.editor.delete` | Supprimer le sous-titre {n} |
| `subtitles.editor.split` | Scinder le sous-titre {n} |
| `subtitles.editor.merge` | Fusionner avec le suivant |
| `subtitles.editor.tcHint` | Format hh:mm:ss,mmm |
| `subtitles.editor.lineCounter` | {n}/42 |
| `subtitles.style.title` | Style d’incrustation |
| `subtitles.style.font` | Police |
| `subtitles.style.size` | Taille |
| `subtitles.style.position` | Position |
| `subtitles.style.position.top` | Haut |
| `subtitles.style.position.middle` | Milieu |
| `subtitles.style.position.bottom` | Bas |
| `subtitles.style.textColor` | Couleur du texte |
| `subtitles.style.box` | Cadre |
| `subtitles.style.boxColor` | Couleur du fond |
| `subtitles.style.boxOpacity` | Opacité du fond |
| `subtitles.preview.title` | Aperçu |
| `subtitles.preview.note` | Aperçu indicatif — le rendu final est produit à la composition. |
| `subtitles.err.summary` | {n} erreur(s) à corriger : |
| `subtitles.err.timecode` | Horodatage invalide (attendu hh:mm:ss,mmm). |
| `subtitles.err.duration` | La fin doit être après le début. |
| `subtitles.err.order` | Les sous-titres doivent être ordonnés dans le temps. |
| `subtitles.err.overlap` | Chevauchement : un sous-titre commence avant la fin du précédent. |
| `subtitles.err.lines` | Maximum 2 lignes par sous-titre. |
| `subtitles.err.lineLength` | Ligne trop longue ({n}/42 caractères). |
| `subtitles.err.empty` | Le texte du sous-titre est vide. |
| `subtitles.warn.minDuration` | Sous-titre très court (< 0,7 s). |
| `subtitles.warn.cps` | Lecture rapide ({cps} c/s, max conseillé 17). |
| `subtitles.warn.minGap` | Écart minimal entre sous-titres non respecté. |
| `subtitles.warn.beyondVideo` | Le sous-titre dépasse la durée de la vidéo. |
| `subtitles.warn.contrast` | Contraste faible — lisibilité réduite. |
| `subtitles.error.noKey` | Aucune clé IA configurée pour l’affinage. Désactivez l’affinage ou repassez en mode mock. |
| `subtitles.error.format` | Sous-titres réservés aux formats vidéo (Reel/Story). |
| `subtitles.error.invalidSave` | Corrigez les erreurs avant d’enregistrer. |
| `subtitles.error.generic` | Échec de la génération |
| `subtitles.guard.noDraft` | Sélectionnez d’abord une variante. |
| `subtitles.goToCue` | Aller au sous-titre {n} |

All copy is **French** (matches existing MediaStudio strings).

## 6. Design tokens (reused — no new tokens unless noted)

| Token | Use |
|---|---|
| `--cs-bg-elevated` | track card background |
| `--cs-bg-sunken` | editor table / inputs / preview frame background |
| `--cs-border-hair` | card, table, control borders |
| `--cs-radius-md` / `--cs-radius-sm` / `--cs-radius-full` | corners |
| `--cs-accent` / `--cs-on-accent` | primary buttons, active radio, focused row |
| `--cs-fg-primary` / `--cs-fg-secondary` / `--cs-fg-muted` | text hierarchy |
| `--cs-font-display` | track title |
| `--cs-font-mono` | timecode inputs + char counters (alignment) |
| `--cs-danger` | error rows / summary / `aria-invalid` ring |
| `--cs-warning` | warning chips (CPS, short cue) |
| `--cs-text-lg` | track title |
| `--cs-motion-fast` (≈150ms) | control transitions |
| `--cs-focus-ring` | keyboard focus (verify token exists; else `2px solid --cs-accent`) |

No layout shift between `editing`/`invalid`/`ready` (same mounted editor; the issue
summary reserves height when present-or-absent via a min-height slot). Respect
`prefers-reduced-motion`.

## 7. Responsive

Track is full-width within the MediaStudio column. On wide viewports the editor table and
the style/preview pair sit in two columns; below ~720 px they stack (editor on top,
style then preview). Timecode inputs keep a fixed `--cs-font-mono` width; line textareas
flex. The preview keeps the video aspect ratio (9:16 for reel/story).
