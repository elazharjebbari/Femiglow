/**
 * Wrapper minimaliste autour de la YouTube IFrame Player API.
 *
 *  - `loadYouTubeIframeApi()` : charge `https://www.youtube.com/iframe_api`
 *    une seule fois (idempotent). Retourne le `window.YT` global une fois
 *    que `YT.Player` est disponible.
 *  - `attachVideoTracker(iframe, opts)` : crée un `YT.Player` sur l'iframe
 *    (qui doit déjà avoir `enablejsapi=1`), pose les events `onStateChange`
 *    + polling `getCurrentTime` pour émettre `25/50/75/100`. Retourne une
 *    fonction `detach()` qui arrête le polling et détruit le player.
 *
 * Robustesse :
 *  - Si le script est bloqué (ad-blocker), `loadYouTubeIframeApi` rejette
 *    après 5 s. Le caller doit catch et désactiver le tracking enrichi
 *    sans casser la lecture vidéo (le `<iframe>` reste fonctionnel sans
 *    l'API).
 *  - Idempotence : appels successifs partagent la même promise interne.
 *  - SSR-safe : `loadYouTubeIframeApi` renvoie une promise rejected si
 *    `window` est `undefined`.
 *
 * cf. docs/video-gestes-optim-2026-05/05-frontend-public-design.md §5
 */

/**
 * Forme minimale de l'API YT.Player utilisée par le tracker. Pas de typage
 * complet (gros bloc d'overloads inutiles côté composant).
 */
interface YTPlayerInstance {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  addEventListener?: (event: string, listener: (e: { data: number }) => void) => void;
}

interface YTPlayerOptions {
  events?: {
    onReady?: (e: { target: YTPlayerInstance }) => void;
    onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
  };
}

interface YTGlobal {
  Player: new (iframe: HTMLIFrameElement, options: YTPlayerOptions) => YTPlayerInstance;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 500;

let cachedLoad: Promise<YTGlobal> | null = null;

/**
 * Réinitialise le cache interne (uniquement pour les tests).
 * @internal
 */
export function __resetYouTubeIframeApiCache(): void {
  cachedLoad = null;
}

/**
 * Charge l'IFrame API YouTube. Idempotent : appels successifs partagent
 * la même promise. Rejette après `LOAD_TIMEOUT_MS` si l'API n'est jamais
 * dispo (ad-blocker, hors-ligne, etc.).
 */
export function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API unavailable in SSR'));
  }

  if (cachedLoad) return cachedLoad;

  // Si l'API est déjà chargée (autre composant), on la renvoie immédiatement.
  if (window.YT && typeof window.YT.Player === 'function') {
    cachedLoad = Promise.resolve(window.YT);
    return cachedLoad;
  }

  cachedLoad = new Promise<YTGlobal>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('YouTube IFrame API load timeout'));
    }, LOAD_TIMEOUT_MS);

    const onReady = (): void => {
      window.clearTimeout(timeoutId);
      if (window.YT && typeof window.YT.Player === 'function') {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube IFrame API loaded but YT.Player missing'));
      }
    };

    // Convention IFrame API : on définit `window.onYouTubeIframeAPIReady`
    // AVANT d'injecter le script, l'API l'appelle quand prête.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) {
        try { previous(); } catch { /* noop */ }
      }
      onReady();
    };

    // N'injecter le tag <script> qu'une seule fois. Si un autre composant
    // l'a déjà injecté, on s'attend à ce que `onYouTubeIframeAPIReady`
    // soit toujours déclenché.
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const tag = document.createElement('script');
      tag.src = SCRIPT_SRC;
      tag.async = true;
      tag.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error('YouTube IFrame API script error'));
      };
      document.head.appendChild(tag);
    }
  });

  return cachedLoad;
}

export interface AttachVideoTrackerOptions {
  /** Appelé à chaque palier 25/50/75 franchi (une seule fois par palier). */
  onProgress?: (percent: 25 | 50 | 75) => void;
  /** Appelé à `PlayerState.ENDED` (une seule fois). */
  onComplete?: () => void;
  /** Appelé après `onReady` avec la durée détectée (pour piloter `VideoChapters`). */
  onReady?: (player: YTPlayerInstance) => void;
  /**
   * Poll callback pour `currentTime` (utile pour mettre à jour l'état actif
   * de `VideoChapters`). Appelé toutes les ~500 ms tant que la vidéo joue.
   */
  onCurrentTime?: (seconds: number) => void;
}

/**
 * Attache un tracker `YT.Player` sur l'iframe. Le caller doit garantir
 * que l'iframe a déjà `enablejsapi=1` dans son URL. Retourne une fonction
 * `detach()` à appeler à l'unmount pour stopper le polling + détruire le
 * player (pas de leak).
 */
export async function attachVideoTracker(
  iframe: HTMLIFrameElement,
  opts: AttachVideoTrackerOptions,
): Promise<() => void> {
  const YT = await loadYouTubeIframeApi();

  const firedThresholds = new Set<25 | 50 | 75>();
  let completeFired = false;
  let pollHandle: number | null = null;
  let player: YTPlayerInstance | null = null;
  let detached = false;

  const tick = (): void => {
    if (!player || detached) return;
    const current = safeNumber(player.getCurrentTime());
    const duration = safeNumber(player.getDuration());
    if (opts.onCurrentTime && current >= 0) opts.onCurrentTime(current);
    if (duration <= 0) return;

    const pct = (current / duration) * 100;
    for (const threshold of [25, 50, 75] as const) {
      if (pct >= threshold && !firedThresholds.has(threshold)) {
        firedThresholds.add(threshold);
        opts.onProgress?.(threshold);
      }
    }
  };

  player = new YT.Player(iframe, {
    events: {
      onReady: (e) => {
        opts.onReady?.(e.target);
        // Démarrer le polling APRÈS ready (sinon getDuration === 0).
        if (pollHandle === null) {
          pollHandle = window.setInterval(tick, POLL_INTERVAL_MS);
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED && !completeFired) {
          completeFired = true;
          // Force tous les paliers à 100 % au passage en ENDED (gestion
          // edge-case où la vidéo termine entre 2 polls).
          for (const threshold of [25, 50, 75] as const) {
            if (!firedThresholds.has(threshold)) {
              firedThresholds.add(threshold);
              opts.onProgress?.(threshold);
            }
          }
          opts.onComplete?.();
        }
      },
    },
  });

  return () => {
    detached = true;
    if (pollHandle !== null) {
      window.clearInterval(pollHandle);
      pollHandle = null;
    }
    try {
      player?.destroy();
    } catch {
      // YT.Player.destroy peut throw si l'iframe est déjà détaché.
    }
    player = null;
  };
}

function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : -1;
}
