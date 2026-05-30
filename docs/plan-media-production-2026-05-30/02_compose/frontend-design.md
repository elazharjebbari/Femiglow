# Compose (montage vidéo) — frontend design

> Grounded in: `src/components/admin/content-studio-v2/create/MediaStudio.tsx`
> (`VIDEO_FORMATS = ['reel','story']` L41, `videoCapable` L58, `generateVisual`
> toast/estimator/guards L80), `.../media/VideoPlayer.tsx` (reuse — `formatDuration`
> exported, `data-cs-video-*` selectors), `.../create/GenerationModeToggle.tsx`,
> `.../create/PublishActionGroup.tsx`, `src/lib/content-studio-v2/media/types.ts`,
> `@/lib/content-studio-v2/state/useGenerationEstimator`. Decisions D4/D6. Prefix
> `MP-CO-*`.

## 1. Component tree

```
MediaStudio.tsx                          (existing — gains a TracksPanel slot, additive)
└─ TracksPanel.tsx           (MP-CO-06)  ── the shared "Studio média" shell
   ├─ VoiceoverTrack.tsx     (MP-VO-05)  ── 🎙️ (sibling feature)
   ├─ (MusicTrack — future)              ── 🎵
   ├─ SubtitlesTrack.tsx     (MP-SU-*)   ── 💬 (sibling feature)
   └─ ComposePanel.tsx       (MP-CO-05)  ── 🎞️ Montage
      ├─ TrackPresenceRow ×4   🎬 / 🎙️ / 🎵 / 💬  (present? toggle include)
      ├─ <Button> Composer / Recomposer
      ├─ EstimatorBar          (reused from MediaStudio)
      └─ VideoPlayer.tsx       (REUSED)  ── composed video (ready state)
```

`TracksPanel` (and therefore `ComposePanel`) is mounted by `MediaStudio` **only**
when `videoCapable && mediaStudioEnabled` (D4/D6). Flag off ⇒ panel not mounted ⇒
DOM byte-identical to today (non-regression).

## 2. `ComposePanel` — props & state

```ts
interface ComposePanelProps {
  draftId: string;
  /** Role-addressed bundle of the draft (D1), loaded by the workspace. */
  bundle: {
    primaryVideo: StudioV2MediaItem | null;
    voiceover: StudioV2AudioItem | null;   // from MP-VO
    music: StudioV2AudioItem | null;
    subtitles: StudioV2SubtitlesItem | null; // from MP-SU (meta.srt)
    composed: StudioV2MediaItem | null;    // role='composed_video'
  };
  /** Bubble the new/updated composed asset up so the parent refreshes the bundle. */
  onComposed: (asset: StudioV2MediaItem, tracks: TrackReport) => void;
}

type TrackReport = { hasVoiceover: boolean; hasMusic: boolean; hasSubtitles: boolean };
```

Local state (no global store; mirrors `MediaStudio` self-contained pattern):

```ts
const [includeVoiceover, setIncVO] = useState(true);
const [includeMusic, setIncMu]     = useState(true);
const [includeSubtitles, setIncSu] = useState(true);
const [doExport, setExport]        = useState(false);
const [composing, setComposing]    = useState(false);
const [error, setError]            = useState<string | null>(null);
const estimator = useGenerationEstimator({ bucket: 'compose', fallbackMs: 18_000 });
```

Derived flags (functional-spec §4):
```ts
const hasPrimaryVideo = bundle.primaryVideo != null;
const presentCount = [bundle.voiceover, bundle.music, bundle.subtitles].filter(Boolean).length;
// stale: a source track is newer than the composed asset (or its source set changed)
const stale = bundle.composed != null && isComposeStale(bundle);
```

Derived **panel state** (functional-spec §4): `blocked` (`!hasPrimaryVideo`),
`empty` (`hasPrimaryVideo && !bundle.composed`), `ready` (`bundle.composed && !stale`),
`stale` (`bundle.composed && stale`), `composing`, `error`. "Composer" is
**disabled** in `blocked` with a hint; emphasized in `stale`.

## 3. Data flow — compose

Mirror `MediaStudio.generateVisual` exactly (toast, estimator, guards):

```ts
async function compose() {
  if (!draftId) { toast.error('Sélectionnez d’abord une variante.'); return; }
  if (!hasPrimaryVideo) { toast.error('Générez d’abord une vidéo.'); return; }
  setComposing(true); setError(null); estimator.start();
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/compose`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ includeVoiceover, includeMusic, includeSubtitles, export: doExport }),
    });
    const json = await res.json().catch(() => null) as
      { media?: ComposeResultDTO; error?: { message?: string } } | null;
    if (!res.ok || !json?.media) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const asset = adaptComposed(json.media);   // DTO → StudioV2MediaItem
    onComposed(asset, json.media.tracks);
    estimator.stop();
    toast.success(bundle.composed ? 'Vidéo recomposée' : 'Vidéo composée');
  } catch (err) {
    estimator.cancel();
    const message = err instanceof Error ? err.message : 'Échec du montage';
    setError(message);
    toast.error(`Montage : ${message}`);
  } finally {
    setComposing(false);
  }
}
```

- **Mode** is implicit: the route reads `cs_generation_mode` (shared
  `GenerationModeToggle` in the MediaStudio header). The panel does **not**
  duplicate the toggle.
- **No optimistic asset insert** (the composed mp4 has a real URL only after
  ffmpeg); we optimistically flip to `composing` (disabled controls + estimator)
  and commit the asset only on success — avoids a broken `<video>` `src`.
- The **409 / 502** error message from the route is surfaced verbatim in the toast
  and inline `error` slot (e.g. "Aucune vidéo primaire à monter.", "Échec du
  montage ffmpeg.").

## 4. `adaptComposed` (DTO → UI model)

`StudioV2MediaItem` already exists (`src/lib/content-studio-v2/media/types.ts`);
the composed video is `kind:'video'` so it plugs straight into `VideoPlayer`.

```ts
function adaptComposed(m: ComposeResultDTO): StudioV2MediaItem {
  return {
    id: m.id,
    kind: 'video',
    compartment: 'ai_generated',
    alt: m.alt,
    slug: m.slug,
    thumbnailUrl: m.thumbnailUrl ?? null,
    previewUrl: m.previewUrl ?? m.originalUrl ?? '',
    originalUrl: m.originalUrl ?? '',
    durationSec: m.durationSec ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    createdAt: m.createdAt ?? new Date().toISOString(),
  } satisfies StudioV2MediaItem;
}
```

## 5. Track-presence rows

Each row renders an icon, a label, a present/absent indicator, and (when present)
an **include toggle** that excludes that track from the next compose:

| Track | Icon | Present source | Toggle |
|---|---|---|---|
| Vidéo | 🎬 | `bundle.primaryVideo` | none (always required; disabled toggle "requis") |
| Voix-off | 🎙️ | `bundle.voiceover` | `includeVoiceover` |
| Musique | 🎵 | `bundle.music` | `includeMusic` |
| Sous-titres | 💬 | `bundle.subtitles` | `includeSubtitles` |

Absent tracks render dimmed with "—" and the toggle disabled. Toggling a present
track marks the panel `stale` if a `composed` asset already exists (nudges
recompose). After a successful compose the **track summary** mirrors the response
`tracks` report (✓/✗ per track).

## 6. Parent wiring (MediaStudio / bundle)

- The draft **bundle** (D1) is loaded by the workspace; `MediaStudio` passes the
  role-addressed assets to `TracksPanel` → `ComposePanel`.
- `onComposed` updates the workspace bundle state so: (a) "Recomposer" replaces in
  place, (b) the **publish confirm** (`PublishActionGroup`) shows the **composed**
  video + a track summary (MP-CO-08, D4), (c) the preview pane prefers the composed
  video over the raw primary clip.
- All additive: if the flag is off, nothing renders; image-only drafts never mount
  the panel.

## 7. Publish surfacing (MP-CO-08)

`PublishActionGroup` confirm dialog: when `bundle.composed` exists, the preview
uses the **composed** `StudioV2MediaItem` in `VideoPlayer` (`controls="none"`,
`compact`) and shows a track summary line
`🎬 ✓ · 🎙️ {hasVoiceover?✓:✗} · 🎵 {hasMusic?✓:✗} · 💬 {hasSubtitles?✓:✗}`
from the composed asset's `meta`. Publishing stays **dry-run**
(`SOCIAL_PUBLISHING_MODE`). When no composed asset exists, the dialog falls back to
the primary video exactly as today (non-regression).

## 8. Hooks / utilities reused (no new infra)

- `useGenerationEstimator` (`@/lib/content-studio-v2/state/useGenerationEstimator`)
  — new bucket `'compose'`.
- `VideoPlayer` + `formatDuration` from `media/VideoPlayer.tsx` (no duplication).
- `toast` from `sonner` (same as MediaStudio).
- `Button` from `@/components/admin/content-studio-v2/primitives`.
- Design tokens (`--cs-*`) — see [`ui-ux-design.md`](ui-ux-design.md).

## 9. Loading / error / empty / blocked UX

| State | Rendered |
|---|---|
| `blocked` | track rows (🎬 absent) + disabled "Composer" + hint "Générez d’abord une vidéo". |
| `empty` | track rows (present/absent) + primary "🎞️ Composer". |
| `composing` | `EstimatorBar`, controls `disabled`, button `loading` "Montage en cours…". |
| `ready` | `VideoPlayer` (composed) + track summary chip + ghost "Recomposer". |
| `stale` | as `ready` + amber "à recomposer" badge + emphasized "Recomposer". |
| `error` | inline `role="alert"` text (FR) + button re-enabled. |

## 10. TypeScript strictness (quality bar §6)

- `StudioV2MediaItem` is reused for the composed video (`kind:'video'`); `satisfies`
  is used in `adaptComposed` so `tsc --noEmit` enforces the shape.
- `bundle.*` are nullable; every read is guarded (`noUncheckedIndexedAccess`-safe).
  `TrackReport` is a closed object literal; `presentRoles` is derived from a guarded
  filter.
