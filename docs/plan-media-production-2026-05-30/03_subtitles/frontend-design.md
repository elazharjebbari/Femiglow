# Subtitles / script-on-video — frontend design

> Grounded in: `src/components/admin/content-studio-v2/create/MediaStudio.tsx`,
> `.../media/VideoPlayer.tsx` (reuse `formatDuration` + player frame),
> `.../create/GenerationModeToggle.tsx`, `src/lib/content-studio-v2/media/types.ts`.
> Decisions D4/D6. Prefix `MP-SU-*`.

## 1. Component tree

```
MediaStudio.tsx                          (existing — gains a TracksPanel slot, additive)
└─ TracksPanel.tsx             (MP-CO owns the shell; SU contributes one track)
   └─ SubtitlesTrack.tsx       (MP-SU-07)  ── the Sous-titres track (state machine root)
      ├─ <Button> Générer / Régénérer les sous-titres
      ├─ CueEditor.tsx         (MP-SU-08)  ── timed-lines editor (start/end/text per cue)
      │   └─ CueRow (per cue: TimecodeInput × start/end, line textareas, add/del/split/merge)
      ├─ SubtitleStyleControls.tsx (MP-SU-10) ── burn-in style (font/size/position/color/box)
      ├─ SubtitleOverlayPreview.tsx (MP-SU-11) ── styled subtitle over a video frame
      ├─ CueIssueSummary       (errors/warnings list, links to cue rows)
      └─ <Button> Enregistrer les sous-titres
```

`SubtitlesTrack` is rendered by the tracks panel **only** when
`videoCapable && mediaStudioEnabled` (D4/D6). When the flag is off the panel is not
mounted, so the DOM is byte-identical to today (non-regression).

## 2. `SubtitlesTrack` — props & state

```ts
interface SubtitlesTrackProps {
  draftId: string;
  /** Existing subtitles asset for this draft, if any (from the bundle). */
  subtitles: StudioV2SubtitlesItem | null;   // D1: kind:'subtitles', role:'subtitles'
  /** Primary video frame URL + duration for the preview + V11 validation. */
  videoPosterUrl: string | null;
  videoDurationMs: number | null;
  /** Bubble the new/updated asset up so the parent refreshes the bundle. */
  onSaved: (asset: StudioV2SubtitlesItem) => void;
}
```

Local state (no global store; mirrors `MediaStudio` self-contained pattern):

```ts
const [cues, setCues]       = useState<Cue[]>(subtitles?.cues ?? []);
const [style, setStyle]     = useState<BurnInStyle>(subtitles?.style ?? DEFAULT_BURN_IN_STYLE);
const [busy, setBusy]       = useState<null | 'generating' | 'saving'>(null);
const [error, setError]     = useState<string | null>(null);
const estimator = useGenerationEstimator({ bucket: 'subtitles', fallbackMs: 6_000 });

// validation is recomputed (memoized) on every cue/style change
const issues = useMemo(() => validateCues(cues, { videoDurationMs }), [cues, videoDurationMs]);
const errors = issues.filter(i => i.severity === 'error');
const valid  = errors.length === 0;
const dirty  = !srtEquals(cues, subtitles?.cues) || !styleEquals(style, subtitles?.style);
```

Derived **track state** (functional-spec §4):
- `empty`   = `cues.length === 0 && !subtitles`
- `editing` = `cues.length > 0 && (dirty || !subtitles) && valid`
- `invalid` = `!valid`
- `ready`   = `subtitles != null && !dirty && valid`
- plus `generating` / `saving` from `busy`.

`validateCues`, `serializeSrt`, `DEFAULT_BURN_IN_STYLE`, `SUBTITLE_LIMITS` are imported
from `@/lib/ai-engine/subtitles/srt` — **one** source of truth shared with the server.

## 3. Data flow — generate

Mirror `MediaStudio.generateVisual` exactly (toast, estimator, guards):

```ts
async function generate({ refine = false } = {}) {
  if (!draftId) { toast.error('Sélectionnez d’abord une variante.'); return; }
  if (cues.length > 0 && !window.confirm('Cela remplacera vos sous-titres édités. Continuer ?')) return; // E10
  setBusy('generating'); setError(null); estimator.start();
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/generate-subtitles`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refine }),
    });
    const json = await res.json().catch(() => null) as { media?: SubtitlesResultDTO; error?: { message?: string } } | null;
    if (!res.ok || !json?.media) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const asset = adaptSubtitles(json.media);
    setCues(asset.cues); setStyle(asset.style);
    if (asset.id) onSaved(asset);                 // generate auto-persists when ≥1 cue
    estimator.stop();
    toast.success(asset.cueCount > 0 ? 'Sous-titres générés' : 'Aucun texte à sous-titrer');
  } catch (err) {
    estimator.cancel();
    const message = err instanceof Error ? err.message : 'Échec de la génération';
    setError(message); toast.error(`Sous-titres : ${message}`);
  } finally { setBusy(null); }
}
```

## 4. Data flow — save (operator edits + style)

```ts
async function save() {
  if (!draftId) { toast.error('Sélectionnez d’abord une variante.'); return; }
  if (!valid) { toast.error('Corrigez les erreurs avant d’enregistrer.'); return; } // client guard; server revalidates
  setBusy('saving'); setError(null); estimator.start();
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/subtitles`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cues, style }),
    });
    const json = await res.json().catch(() => null) as { media?: SubtitlesResultDTO; error?: { message?: string; details?: { cueErrors?: CueIssue[] } } } | null;
    if (!res.ok || !json?.media) {
      // surface server cueErrors against the editor rows
      const cueErrors = json?.error?.details?.cueErrors;
      if (cueErrors) markCueErrors(cueErrors);
      throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    }
    onSaved(adaptSubtitles(json.media));
    estimator.stop(); toast.success('Sous-titres enregistrés');
  } catch (err) {
    estimator.cancel();
    const message = err instanceof Error ? err.message : 'Échec de l’enregistrement';
    setError(message); toast.error(`Sous-titres : ${message}`);
  } finally { setBusy(null); }
}
```

- **Mode** is implicit: the route reads the `cs_generation_mode` cookie (set by the
  shared `GenerationModeToggle` in the MediaStudio header). The track does **not**
  duplicate the toggle.
- **Optimistic UI**: cue edits update local `cues` immediately (live validation + live
  preview). The asset is only committed on `Enregistrer` success (or on generate
  auto-save). No optimistic asset row for the `.srt` (it has bytes only after save).
- **Server cueErrors** (defense-in-depth) are mapped back onto the editor rows via
  `markCueErrors` so the operator sees exactly which cue failed even if client and
  server validation ever diverge.

## 5. `CueEditor` — model & interactions (MP-SU-08)

```ts
interface CueEditorProps {
  cues: Cue[];
  issues: CueIssue[];                 // from validateCues (memoized in parent)
  onChange: (next: Cue[]) => void;
  disabled?: boolean;
}
```

Pure, controlled. Operations (all produce a new `Cue[]`; parent re-validates):

| Op | Effect |
|---|---|
| edit `start`/`end` | `TimecodeInput` parses `hh:mm:ss,mmm` ↔ ms; invalid input flags V1 inline |
| edit line text | updates `lines[k]`; char counter per line; over 42 flags V6 |
| add line | only when `lines.length < 2` |
| add cue | inserts after current, default 2 s after previous end, 2 s duration |
| delete cue | removes; re-index is display-only (server re-indexes on save) |
| split cue | splits the line at caret into two cues sharing the time range proportionally |
| merge with next | merges text (≤2 lines) and spans the union time range |
| nudge ±100 ms | keyboard shortcut on a focused cue to shift start/end together |

`TimecodeInput` is a masked text input (`__:__:__,___`) that round-trips through
`parseTimecode`/`formatTimecode`; on blur it normalizes; on parse failure it keeps the
raw string and sets `aria-invalid` + V1 error.

## 6. `adaptSubtitles` (DTO → UI model)

```ts
type StudioV2SubtitlesItem = {
  id: string; kind: 'subtitles'; role: 'subtitles';
  cues: Cue[]; srt: string; style: BurnInStyle;
  cueCount: number; previewUrl: string; provider: string; createdAt: string;
};
function adaptSubtitles(m: SubtitlesResultDTO): StudioV2SubtitlesItem {
  return {
    id: m.id, kind: 'subtitles', role: 'subtitles',
    cues: m.cues ?? parseSrt(m.srt ?? ''),       // tolerate cue-less payloads
    srt: m.srt ?? '', style: m.style ?? DEFAULT_BURN_IN_STYLE,
    cueCount: m.cueCount ?? (m.cues?.length ?? 0),
    previewUrl: m.previewUrl ?? m.originalUrl ?? '',
    provider: m.provider, createdAt: m.createdAt ?? new Date().toISOString(),
  };
}
```

## 7. `SubtitleStyleControls` + `SubtitleOverlayPreview` (MP-SU-10 / MP-SU-11)

- `SubtitleStyleControls`: font radio (`sans|serif|mono`), size slider (12–72 px),
  position segmented (`haut|milieu|bas`), text colour swatch, "Cadre" (box) toggle +
  box colour + opacity slider. Emits a `BurnInStyle` (matches `meta.style`).
- `SubtitleOverlayPreview`: a fixed-aspect frame using `videoPosterUrl` as background
  (or a neutral placeholder), rendering the **active cue text** (defaults to the first
  cue) as a positioned, styled `<div>` so the operator sees the burn-in *before*
  Compose runs. CSS maps `BurnInStyle` → font/size/position/colour/box. This is a
  **visual approximation** of the ffmpeg burn-in (MP-CO-*); pixel-exactness is Compose's
  job. A small note clarifies "Aperçu indicatif — le rendu final est produit à la
  composition."

## 8. Parent wiring (MediaStudio / bundle)

- The draft **bundle** (D1) is loaded by the workspace; `MediaStudio` receives the
  current `subtitles` asset (role-addressed), the primary-video poster + duration, and
  passes them down.
- `onSaved` updates the workspace bundle state so: (a) the **publish confirm**
  (`PublishActionGroup`) track-summary shows "💬 Sous-titres ✓" (D4), (b) **Compose**
  can read `meta.srt` + `meta.style`.
- All additive: if `subtitles` is `null` and the flag is off, nothing renders.

## 9. Hooks / utilities reused (no new infra)

- `useGenerationEstimator` (`@/lib/content-studio-v2/state/useGenerationEstimator`) —
  new bucket `'subtitles'`.
- `toast` from `sonner` (same as MediaStudio).
- `Button` from `@/components/admin/content-studio-v2/primitives`.
- `formatDuration` from `VideoPlayer.tsx` (for the preview time hint) — no duplication.
- SRT lib (`@/lib/ai-engine/subtitles/srt`) — `parseSrt`, `serializeSrt`,
  `formatTimecode`, `parseTimecode`, `validateCues`, `SUBTITLE_LIMITS`,
  `DEFAULT_BURN_IN_STYLE` (shared with server).
- Design tokens (`--cs-*`) — see [`ui-ux-design.md`](ui-ux-design.md).

## 10. Loading / error / empty UX

| State | Rendered |
|---|---|
| `empty` | "Générer les sous-titres" primary CTA + style defaults preview (placeholder frame). |
| `generating` / `saving` | `EstimatorBar` (reuse MediaStudio's), controls `disabled`, button `loading`. |
| `editing` | `CueEditor` + `SubtitleStyleControls` + `SubtitleOverlayPreview` + "Enregistrer" (enabled when dirty & valid). |
| `invalid` | as `editing` + `CueIssueSummary` (errors first), "Enregistrer" disabled, offending rows highlighted. |
| `ready` | as `editing` (clean) + "Régénérer" ghost; "Enregistrer" disabled (nothing to save). |
| `error` | inline `role="alert"` text (FR) + controls re-enabled. |

## 11. TypeScript strictness (quality bar §6)

- `StudioV2SubtitlesItem` is a discriminated member (`kind:'subtitles'`,
  `role:'subtitles'`) so `tsc --noEmit` enforces exhaustive bundle handling. Use
  `satisfies` on `DEFAULT_BURN_IN_STYLE` and guard `json.media` /
  `details?.cueErrors?.[i]` before use (`noUncheckedIndexedAccess`-safe). `Cue.lines`
  access is length-guarded.
