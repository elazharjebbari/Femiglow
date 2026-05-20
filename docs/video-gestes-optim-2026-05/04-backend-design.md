# 04 — Design backend / CMS / API

## 1. Architecture cible

```
                +------------------------------------+
   Public RSC   | KitPage (Server Component)         |
                |   └─ cms.getKitPageContent()       |
                +-----------------+------------------+
                                  |
                                  v
                +------------------------------------+
   CMS adapter  | apps/web/src/lib/cms/index.ts      |
                |   ├─ mock (production court)       |
                |   └─ sanity (Phase 2, hors)        |
                +-----------------+------------------+
                                  |
                  override admin  v   (phase 6)
                +------------------------------------+
   Override DB  | kit_video_override (phase 6 opt)   |
                |   ou Component-Fields slot video   |
                +-----------------+------------------+
                                  |
                                  v
                +------------------------------------+
                | mock/kit.ts videoSrc (defaults)    |
                +------------------------------------+
```

## 2. CMS — `getKitPageContent().videoSrc`

### 2.1 Signature existante

Aucune modification de signature publique. Les nouveaux champs (`chapters`, `posterCustom`, `provenance`, `durationDisplay`, `accentColor`) sont portés par l'objet `RituelVideo` enrichi (cf. `03-data-model.md`).

### 2.2 Phase 1 — extension transparente

Le mock TS retourne les champs enrichis. Les consommateurs existants (`VideoPlayer4Gestes`, `feed.xml` éventuellement) restent fonctionnels.

### 2.3 Phase 6 — override admin

Ajout d'un service `resolveKitVideo()` qui applique la cascade :

```ts
// apps/web/src/lib/video/video-resolver.ts (nouveau, phase 6)
export async function resolveKitVideo(): Promise<RituelVideo> {
  const baseline = (await getKitPageContent()).videoSrc;
  const override = await getKitVideoOverride();
  if (!override || !override.publishedAt) return baseline;
  return {
    ...baseline,
    youtubeUrl: override.youtubeUrl ?? baseline.youtubeUrl,
    posterCustom: override.posterCustom ?? baseline.posterCustom,
    chapters: override.chapters ?? baseline.chapters,
    provenance: override.provenance ?? baseline.provenance,
    durationDisplay: override.durationDisplay ?? baseline.durationDisplay,
    accentColor: override.accentColor ?? baseline.accentColor,
  };
}
```

`KitPage` consommerait `resolveKitVideo()` côté Bound (`VideoPlayer4GestesBound`).

## 3. Services internes

### 3.1 `lib/video/chapters.ts` (nouveau, phase 3)

Fonctions pures de manipulation des chapitres.

```ts
import type { VideoChapter } from '@/lib/schemas';

/** Formate un timestamp seconds → `1:23` ou `0:42`. */
export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Calcule le chapitre actif pour un timestamp donné (binary search). */
export function activeChapterIndex(
  chapters: VideoChapter[],
  currentSeconds: number,
): number {
  if (chapters.length === 0) return -1;
  let lo = 0;
  let hi = chapters.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = chapters[mid]?.startSeconds ?? 0;
    if (start <= currentSeconds) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Calcule la progression (0-1) au sein du chapitre actif. */
export function chapterProgress(
  chapters: VideoChapter[],
  currentSeconds: number,
  durationSeconds: number,
): { activeIndex: number; progressInChapter: number; progressInVideo: number } {
  if (chapters.length === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { activeIndex: -1, progressInChapter: 0, progressInVideo: 0 };
  }
  const idx = activeChapterIndex(chapters, currentSeconds);
  const start = chapters[idx]?.startSeconds ?? 0;
  const end = chapters[idx + 1]?.startSeconds ?? durationSeconds;
  const span = Math.max(1, end - start);
  return {
    activeIndex: idx,
    progressInChapter: Math.min(1, Math.max(0, (currentSeconds - start) / span)),
    progressInVideo: Math.min(1, Math.max(0, currentSeconds / durationSeconds)),
  };
}
```

### 3.2 `lib/video/youtube-url.ts` (existant, à étendre)

Ajouter un helper qui construit l'URL embed avec les paramètres conformes aux invariants Kolenda.

```ts
// extension de buildYouTubeEmbedUrl
interface BuildEmbedOptions {
  hl?: string;
  startSeconds?: number;
  mute?: boolean;        // nouveau — default true sur /kit (anti-pattern §4.4)
  captions?: 'fr' | 'ar' | 'auto' | 'off';   // nouveau — default 'fr' sur /kit
  enableJsApi?: boolean; // nouveau — true uniquement après consent + IFrame API mount
}

export function buildYouTubeEmbedUrl(id: string, opts: BuildEmbedOptions = {}): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  });
  if (opts.mute !== false) params.set('mute', '1');
  if (opts.captions && opts.captions !== 'off') {
    params.set('cc_load_policy', '1');
    if (opts.captions !== 'auto') params.set('cc_lang_pref', opts.captions);
  }
  if (opts.hl) params.set('hl', opts.hl);
  if (opts.startSeconds && opts.startSeconds > 0) {
    params.set('start', String(Math.floor(opts.startSeconds)));
  }
  if (opts.enableJsApi) params.set('enablejsapi', '1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}
```

### 3.3 `lib/video/iframe-tracker.ts` (nouveau, phase 4)

Wrapper minimaliste de YouTube IFrame API pour émettre `video_complete` et les paliers 25/50/75 %.

```ts
// apps/web/src/lib/video/iframe-tracker.ts
export interface VideoTrackerEvents {
  onProgress: (percent: 25 | 50 | 75) => void;
  onComplete: () => void;
}

/** Promesse résolue quand `YT` global est disponible. Idempotent. */
let ytReady: Promise<typeof YT> | null = null;
export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('iframe_api script failed'));
    document.head.appendChild(script);
    (window as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
  });
  return ytReady;
}

export async function attachVideoTracker(
  iframe: HTMLIFrameElement,
  events: VideoTrackerEvents,
): Promise<() => void> {
  const YT = await loadYouTubeIframeApi();
  const fired = new Set<25 | 50 | 75>();
  let completeFired = false;
  let intervalId: number | undefined;

  const player = new YT.Player(iframe, {
    events: {
      onStateChange: (e: { data: number }) => {
        if (e.data === YT.PlayerState.PLAYING && intervalId === undefined) {
          intervalId = window.setInterval(() => {
            const cur = player.getCurrentTime();
            const dur = player.getDuration();
            if (!Number.isFinite(dur) || dur <= 0) return;
            const pct = (cur / dur) * 100;
            for (const milestone of [25, 50, 75] as const) {
              if (!fired.has(milestone) && pct >= milestone) {
                fired.add(milestone);
                events.onProgress(milestone);
              }
            }
          }, 500);
        }
        if (e.data === YT.PlayerState.ENDED && !completeFired) {
          completeFired = true;
          events.onComplete();
        }
        if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
          if (intervalId !== undefined) {
            window.clearInterval(intervalId);
            intervalId = undefined;
          }
        }
      },
    },
  });

  return () => {
    if (intervalId !== undefined) window.clearInterval(intervalId);
    player.destroy?.();
  };
}
```

**Garanties** :
- Charge le script une seule fois (`ytReady` mémoïsé).
- Pas de cookies tiers tant que l'iframe reste sur `youtube-nocookie.com` (la connexion à l'API ne crée pas de cookie additionnel sur le domaine du site).
- Cleanup de l'interval à pause/unmount.
- Si `loadYouTubeIframeApi` rejette (réseau, ad-blocker), le composant continue sans tracking enrichi (graceful degradation).

## 4. API admin (phase 6)

### 4.1 Routes prévues

| Route | Méthode | Rôle |
|---|---|---|
| `/api/admin/kit/video` | GET | Lit la config courante (override DB ou mock fallback) |
| `/api/admin/kit/video` | PATCH | Met à jour le draft |
| `/api/admin/kit/video/publish` | POST | Publie le draft (audit log + revalidateTag) |
| `/api/admin/kit/video/unpublish` | POST | Repasse en draft (rendu public retombe sur mock) |
| `/api/admin/kit/video/reset` | POST | Supprime l'override |

### 4.2 Validation Zod

```ts
// apps/web/src/lib/video/schemas.ts (phase 6)
export const kitVideoOverrideUpsertSchema = z.object({
  youtubeUrl: z.string().url().nullable().optional(),
  posterCustomMediaId: z.string().nullable().optional(),
  chapters: z.array(videoChapterSchema).min(2).max(6).nullable().optional(),
  provenance: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/[.!?»]$/)
    .nullable()
    .optional(),
  durationDisplay: z.string().min(1).max(8).nullable().optional(),
  accentColor: subProductAccentColorSchema.nullable().optional(),
});
```

### 4.3 Audit trail

À chaque mutation, log `auditEvent` :

| Action | Meta |
|---|---|
| `kit_video.draft` | `{ fields: Object.keys(patch) }` |
| `kit_video.publish` | `{ previous: snapshotBeforePublish }` |
| `kit_video.unpublish` | `{}` |
| `kit_video.reset` | `{ previous: fullOverrideDeleted }` |

### 4.4 Cache et revalidation

```ts
// après publish/unpublish/reset
revalidateTag('kit-video');
revalidatePath('/kit');
```

`VideoPlayer4GestesBound` consomme via `resolveKitVideo()` wrappée :

```ts
const video = await unstable_cache(
  () => resolveKitVideo(),
  ['kit-video-v1'],
  { tags: ['kit-video'], revalidate: 3600 },
)();
```

## 5. Sécurité

- **Auth admin** sur toutes les routes (`getAdminSession`).
- **Validation Zod stricte** sur tous les inputs (rejet 400/422).
- **Validation URL YouTube** côté API : passer par `parseYouTubeUrl` ; rejet si non parsable.
- **Sanitization provenance** : pas de HTML accepté ; rendu via `{value}` JSX. Le `regex` ponctuation finale empêche de finir sur du HTML imbriqué.
- **Whitelisting accentColor** : enum Zod strict.

## 6. Observabilité

### 6.1 Tracking events

| Event | Source | Payload |
|---|---|---|
| `video_section_view` | IntersectionObserver section (50 %) | `{ video_id, video_provider }` |
| `video_user_play` | Click sur poster overlay | `{ video_id, video_title, video_provider }` |
| `video_progress_25` | IFrame API, 25 % | `{ video_id, video_duration }` |
| `video_progress_50` | IFrame API, 50 % | idem |
| `video_progress_75` | IFrame API, 75 % | idem |
| `video_complete` | IFrame API, état ENDED | idem |
| `video_chapter_click` | Click sur chapitre timeline | `{ video_id, chapter_key, target_seconds }` |
| `video_transcript_open` | Toggle accordéon | `{ video_id }` |

### 6.2 Logs structurés

Côté admin, chaque mutation produit un `logger.info('audit.event', {...})` ingestable Datadog/Loki.

### 6.3 Métriques

- Taux de complétion (`video_complete / video_user_play`).
- Médiane chapter_click par session.
- LCP de la section (Performance API navigation).

## 7. Performance

- **Poster `next/image priority`** — devient le LCP de la section (au lieu de l'iframe).
- **IFrame mount différé au clic** — pas de charge iframe avant interaction utilisateur.
- **IFrame API chargée à la demande** — uniquement après `video_user_play` (pas au paint).
- **Cleanup interval** : pas de leak quand la cliente quitte la page.

## 8. Compatibilité

- **Feature flags** :
  - `NEXT_PUBLIC_VIDEO_V2` : active la refonte phase 0-5 (default `true` en staging puis prod après J+7).
  - `NEXT_PUBLIC_VIDEO_SOURCE` = `'youtube' | 'self_hosted'` : pilote la variante (default `'youtube'` tant que master non livré).
- **Rollback par phase** : `git revert` du commit + flag à `false` si nécessaire.
- **Backward-compat** : `SelfHostedVariant` reste fonctionnelle, partagera les nouveaux sous-composants en phase 7.

## 9. Risques backend

| Risque | Mitigation |
|---|---|
| `loadYouTubeIframeApi` rejette en ad-blocker / privacy strict | Graceful degradation : tracking enrichi off, la lecture vidéo reste OK |
| `unstable_cache` ne revalide pas en dev (HMR) | Documenté dans le runbook, revalidation testée en build prod |
| Override DB stale après changement schema chapters | Migration validation Zod ; en cas d'erreur, fallback mock |
| Cookies tiers acceptés via IFrame API | L'iframe reste sur `youtube-nocookie.com` ; le script `iframe_api` est servi par `youtube.com` MAIS ne crée pas de cookie côté site tiers (vérifié `Set-Cookie` headers) |
