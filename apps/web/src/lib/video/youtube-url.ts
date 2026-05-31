/**
 * YouTube URL utilities — parse + build embed URL.
 *
 * Supporte les formats d'URL YouTube usuels :
 *   - `https://www.youtube.com/watch?v=<ID>` (+ params)
 *   - `https://youtu.be/<ID>` (+ query)
 *   - `https://www.youtube.com/shorts/<ID>` (vertical 9:16)
 *   - `https://www.youtube.com/embed/<ID>`
 *   - `https://www.youtube-nocookie.com/embed/<ID>`
 *   - `<ID>` standalone (11 chars, `[A-Za-z0-9_-]`)
 *
 * Politique embed : on utilise toujours `youtube-nocookie.com` (domaine
 * privacy-enhanced de Google : pas de cookies posés tant que l'utilisateur
 * n'a pas joué la vidéo). Les params restrictifs (`rel=0`, `modestbranding=1`,
 * `iv_load_policy=3`) minimisent le branding YouTube et empêchent les
 * suggestions de vidéos externes en fin de lecture.
 *
 * Note : YouTube ne permet pas de désactiver à 100 % le lien « Watch on
 * YouTube » qui apparaît dans le coin du player. C'est le standard de
 * l'industrie ; les options ci-dessus minimisent la fuite d'attention.
 */

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Détecte si une chaîne ressemble à un ID YouTube brut (11 caractères).
 * Ne fait aucune validation de présence côté API YouTube — c'est juste
 * un guard syntaxique.
 */
export function isYouTubeId(candidate: string): boolean {
  return YOUTUBE_ID_REGEX.test(candidate);
}

export interface ParsedYouTube {
  /** ID vidéo 11 caractères. */
  id: string;
  /** True si l'URL d'origine venait d'un Short (`/shorts/<id>`). */
  isShort: boolean;
}

/**
 * Parse une URL YouTube (toutes variantes) ou un ID brut → `ParsedYouTube`.
 * Retourne `null` si le format n'est pas reconnu.
 *
 * Cas d'usage typiques :
 *   parseYouTubeUrl('https://youtube.com/shorts/N2pDuciP4uQ') → { id: 'N2pDuciP4uQ', isShort: true }
 *   parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ') → { id: 'dQw4w9WgXcQ', isShort: false }
 *   parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s') → { id: 'dQw4w9WgXcQ', isShort: false }
 *   parseYouTubeUrl('N2pDuciP4uQ') → { id: 'N2pDuciP4uQ', isShort: false }
 *   parseYouTubeUrl('https://vimeo.com/12345') → null
 */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1) ID brut.
  if (isYouTubeId(trimmed)) {
    return { id: trimmed, isShort: false };
  }

  // 2) URL — parse via WHATWG URL pour normaliser.
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'youtu.be' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'music.youtube.com';
  if (!isYouTubeHost) return null;

  // 2a) youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    if (isYouTubeId(id)) return { id, isShort: false };
    return null;
  }

  // 2b) /shorts/<id>
  const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (shortsMatch?.[1]) {
    return { id: shortsMatch[1], isShort: true };
  }

  // 2c) /embed/<id>
  const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (embedMatch?.[1]) {
    return { id: embedMatch[1], isShort: false };
  }

  // 2d) /watch?v=<id>
  if (url.pathname === '/watch') {
    const v = url.searchParams.get('v') ?? '';
    if (isYouTubeId(v)) return { id: v, isShort: false };
  }

  return null;
}

export type YouTubeCaptionsPref = 'fr' | 'ar' | 'auto' | 'off';

export interface BuildEmbedUrlOptions {
  /** Indique si on veut le contexte Short (ratio 9:16) — info portée par l'URL retournée via `?short=1` non, juste pour info aval. */
  isShort?: boolean;
  /** Démarre la vidéo en muet (utile si auto-play envisagé). Défaut: false. */
  mute?: boolean;
  /** Auto-play à l'ouverture (autorisé seulement si `mute=true` par les browsers). Défaut: false. */
  autoplay?: boolean;
  /** Locale de l'UI YouTube (`fr`, `ar`, etc.). Défaut: 'fr'. */
  hl?: string;
  /** Origin pour le postMessage YouTube IFrame API (validation CORS). Défaut: undefined (skip). */
  origin?: string;
  /** Démarrage à N secondes. Défaut: 0. */
  startSeconds?: number;
  /**
   * Politique de captions au démarrage.
   *  - `'fr' | 'ar'` : force `cc_load_policy=1` + `cc_lang_pref=<lang>` →
   *    captions chargées par défaut dans la langue demandée (anti-pattern
   *    Kolenda §4.4 « autoplay avec son » neutralisé via captions).
   *  - `'auto'` : force `cc_load_policy=1` sans pref de langue (YouTube
   *    choisit selon les préférences de la cliente).
   *  - `'off'` ou undefined : aucun param captions ajouté (comportement
   *    historique).
   */
  captions?: YouTubeCaptionsPref;
  /**
   * Active YouTube IFrame API (`enablejsapi=1`) pour permettre l'écoute des
   * events `onStateChange` (utilisé par `lib/video/iframe-tracker.ts` en
   * phase 4 pour émettre `video_complete` + `video_progress_*`).
   * Défaut : false — pas de surcharge tant qu'on n'instrumente pas.
   */
  enableJsApi?: boolean;
}

/**
 * Construit une URL `youtube-nocookie.com/embed/<id>` avec les params
 * privacy-friendly :
 *   - `rel=0` : pas de vidéos suggérées à la fin
 *   - `modestbranding=1` : minimise le logo YouTube
 *   - `iv_load_policy=3` : pas d'annotations
 *   - `playsinline=1` : lecture inline sur iOS (pas plein écran forcé)
 *   - `controls=1` : barre de contrôles standard
 *   - `fs=1` : autorise le passage plein écran
 *   - `disablekb=0` : raccourcis clavier OK
 *
 * Si tu fournis `origin`, on l'ajoute (utile si tu intègres l'IFrame API).
 */
export function buildYouTubeEmbedUrl(id: string, opts: BuildEmbedUrlOptions = {}): string {
  if (!isYouTubeId(id)) {
    throw new Error(`[youtube] ID invalide: "${id}"`);
  }
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
    controls: '1',
    fs: '1',
    hl: opts.hl ?? 'fr',
  });
  if (opts.mute) params.set('mute', '1');
  if (opts.autoplay) params.set('autoplay', '1');
  if (opts.origin) params.set('origin', opts.origin);
  if (opts.startSeconds && opts.startSeconds > 0) {
    params.set('start', String(Math.floor(opts.startSeconds)));
  }
  if (opts.captions && opts.captions !== 'off') {
    params.set('cc_load_policy', '1');
    if (opts.captions === 'fr' || opts.captions === 'ar') {
      params.set('cc_lang_pref', opts.captions);
    }
  }
  if (opts.enableJsApi) params.set('enablejsapi', '1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/**
 * Helper : parse + build en une seule passe. Retourne `null` si parse échoue.
 */
export function youTubeUrlToEmbed(
  input: string,
  opts: BuildEmbedUrlOptions = {},
): { embedUrl: string; isShort: boolean; id: string } | null {
  const parsed = parseYouTubeUrl(input);
  if (!parsed) return null;
  return {
    embedUrl: buildYouTubeEmbedUrl(parsed.id, { ...opts, isShort: parsed.isShort }),
    isShort: parsed.isShort,
    id: parsed.id,
  };
}
