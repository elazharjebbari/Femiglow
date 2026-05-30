# Voice-over — frontend design

> Grounded in: `src/components/admin/content-studio-v2/create/MediaStudio.tsx`,
> `.../media/VideoPlayer.tsx` (reuse pattern), `.../create/GenerationModeToggle.tsx`,
> `src/lib/content-studio-v2/media/types.ts`. Decisions D4/D6. Prefix `MP-VO-*`.

## 1. Component tree

```
MediaStudio.tsx                         (existing — gains a TracksPanel slot, additive)
└─ TracksPanel.tsx            (MP-CO owns the shell; VO contributes one track)
   └─ VoiceoverTrack.tsx      (MP-VO-05)  ── the Voix-off track
      ├─ <textarea>           script narration (controlled)
      ├─ VoiceSelector        (radiogroup of voices)
      ├─ <Button> Générer / Régénérer
      └─ AudioTrackPlayer.tsx (MP-VO-06)  ── a11y audio player (ready state)
```

`VoiceoverTrack` is rendered by the tracks panel **only** when
`videoCapable && mediaStudioEnabled` (D4/D6). When the flag is off the panel is
not mounted, so the DOM is byte-identical to today (non-regression).

## 2. `VoiceoverTrack` — props & state

```ts
interface VoiceoverTrackProps {
  draftId: string;
  /** Pre-fill: draft narration (script hook + scenes). */
  defaultScript: string;
  /** Existing voice-over asset for this draft, if any (from the bundle). */
  voiceover: StudioV2AudioItem | null;   // D1: kind:'audio', role:'voiceover'
  /** Bubble the new/updated asset up so the parent refreshes the bundle. */
  onGenerated: (asset: StudioV2AudioItem) => void;
}
```

Local state (no global store; mirrors `MediaStudio` self-contained pattern):

```ts
const [script, setScript]     = useState(voiceover?.script ?? defaultScript);
const [voice, setVoice]       = useState<VoiceId>(voiceover?.voice ?? 'mock');
const [generating, setGen]    = useState(false);
const [error, setError]       = useState<string | null>(null);
const estimator = useGenerationEstimator({ bucket: 'voiceover', fallbackMs: 12_000 });
const dirty = voiceover != null && script.trim() !== (voiceover.script ?? '').trim();
```

Derived **track state** (functional-spec §4): `empty` (`!voiceover`),
`ready` (`voiceover && !dirty`), `stale` (`voiceover && dirty`), `generating`,
`error`. `dirty`/`stale` drives the "Régénérer" highlight + "modifié" badge.

## 3. Data flow — generate

Mirror `MediaStudio.generateVisual` exactly (toast, estimator, guards):

```ts
async function generate() {
  if (!draftId) { toast.error('Sélectionnez d’abord une variante.'); return; }
  setGen(true); setError(null); estimator.start();
  try {
    const res = await fetch(`/api/admin/content-studio/drafts/${draftId}/generate-voiceover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ script: script.trim(), voice }),
    });
    const json = await res.json().catch(() => null) as
      { media?: VoiceoverResultDTO; error?: { message?: string } } | null;
    if (!res.ok || !json?.media) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const asset = adaptVoiceover(json.media);   // DTO → StudioV2AudioItem
    onGenerated(asset);
    estimator.stop();
    toast.success(voiceover ? 'Voix-off régénérée' : 'Voix-off générée');
  } catch (err) {
    estimator.cancel();
    const message = err instanceof Error ? err.message : 'Échec de la génération';
    setError(message);
    toast.error(`Voix-off : ${message}`);
  } finally {
    setGen(false);
  }
}
```

- **Mode** is implicit: the route reads the `cs_generation_mode` cookie (set by the
  shared `GenerationModeToggle` already in the MediaStudio header). The track does
  **not** duplicate the toggle — it shares the workspace one (single source).
- **No optimistic asset insert** (audio has a real URL only after generation); we
  optimistically flip to `generating` (disabled controls + estimator bar) and only
  commit the asset on success. This avoids a broken `<audio>` `src`.
- The **409 no-key** error message from the route is surfaced verbatim in the toast
  and inline `error` slot, guiding the operator to switch to mock or add a key.

## 4. `adaptVoiceover` (DTO → UI model)

```ts
type StudioV2AudioItem = {
  id: string; kind: 'audio'; role: 'voiceover';
  previewUrl: string; durationSec: number | null;
  provider: string; voice: string; script: string; createdAt: string;
};
function adaptVoiceover(m: VoiceoverResultDTO): StudioV2AudioItem {
  return {
    id: m.id, kind: 'audio', role: 'voiceover',
    previewUrl: m.previewUrl ?? m.originalUrl ?? '',
    durationSec: m.durationSec ?? null,
    provider: m.provider, voice: m.voice,
    script: (m as { script?: string }).script ?? '',
    createdAt: m.createdAt ?? new Date().toISOString(),
  };
}
```

## 5. `AudioTrackPlayer` (MP-VO-06)

A small, reusable, **a11y-first** audio player (not a video player — a sibling to
`VideoPlayer.tsx`, same token/styling language). API:

```ts
interface AudioTrackPlayerProps {
  src: string;
  durationSec: number | null;
  label: string;          // e.g. 'Voix-off — voix nova'
  compact?: boolean;
}
```

Internals: a hidden `<audio ref>` + custom controls (play/pause toggle, a native
`<input type="range">` seek bar bound to `currenttime`/`duration`, mute, time
readout via `formatDuration` reused from `VideoPlayer.tsx`). Full keyboard + ARIA
spec in [`ui-ux-design.md`](ui-ux-design.md) §a11y. Reuses
`formatDuration` (already exported by `VideoPlayer.tsx`) — no duplication.

## 6. Parent wiring (MediaStudio / bundle)

- The draft **bundle** (D1) is loaded by the workspace; `MediaStudio` receives the
  current `voiceover` asset (role-addressed) and passes it down.
- `onGenerated` updates the workspace bundle state so: (a) "Régénérer" replaces
  in place, (b) the **publish confirm** (`PublishActionGroup`) track-summary shows
  "🎙️ Voix-off ✓" (D4), (c) **Compose** can read the voice-over.
- All additive: if `voiceover` is `null` and the flag is off, nothing renders.

## 7. Hooks / utilities reused (no new infra)

- `useGenerationEstimator` (`@/lib/content-studio-v2/state/useGenerationEstimator`) —
  new bucket `'voiceover'`.
- `toast` from `sonner` (same as MediaStudio).
- `Button` from `@/components/admin/content-studio-v2/primitives`.
- `formatDuration` from `VideoPlayer.tsx`.
- Design tokens (`--cs-*`) — see [`ui-ux-design.md`](ui-ux-design.md).

## 8. Loading / error / empty UX

| State | Rendered |
|---|---|
| `empty` | textarea (filled w/ `defaultScript`) + VoiceSelector + primary "Générer la voix-off". |
| `generating` | `EstimatorBar` (reuse MediaStudio's), controls `disabled`, button `loading`. |
| `ready` | `AudioTrackPlayer` + meta chip (provider · voix · durée) + ghost "Régénérer". |
| `stale` | as `ready` + amber "modifié" badge + emphasized "Régénérer". |
| `error` | inline `role="alert"` text (FR) + button re-enabled. |

## 9. TypeScript strictness (quality bar §6)

- `StudioV2AudioItem` is a discriminated member (`kind:'audio'`, `role:'voiceover'`)
  so `tsc --noEmit` enforces exhaustive bundle handling. Use `satisfies` on the
  voice list and guard `json.media` before use (`noUncheckedIndexedAccess`-safe).
