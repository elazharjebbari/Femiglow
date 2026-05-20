/**
 * Helpers pour la mini-timeline `VideoChapters` (Kolenda §4.4).
 *
 *  - `formatChapterTimestamp(seconds)` : `0:18`, `1:05`, `12:34`.
 *    Pad uniquement les **secondes** (jamais les minutes) — convention
 *    YouTube/Vimeo + lisibilité sur 4 colonnes mobile.
 *  - `findActiveChapterIndex(chapters, currentSeconds)` : retourne l'index
 *    du chapitre actif. Si `currentSeconds === 0` → 0 (premier chapitre).
 *    Si `currentSeconds` ≥ dernier `startSeconds` → dernier index.
 *  - `formatChapterIndex(i)` : `01`, `02`, ... (1-based, pad-2). Discret,
 *    couleur encre/40 % en UI.
 *
 * Pas d'effets, pas de DOM, pas de React — pur compute pour pouvoir
 * tester avec vitest sans setup React.
 */
import type { VideoChapter } from '@/lib/schemas';

/**
 * Format `MM:SS` sans pad sur les minutes : `0:18`, `1:05`, `12:34`.
 * Convention YouTube/Vimeo. Tabular-nums recommandé en CSS.
 */
export function formatChapterTimestamp(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const safe = Math.floor(totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Renvoie l'index du chapitre actif pour `currentSeconds`. Prend en compte
 * un tableau **trié par `startSeconds` croissant** (validé en amont par
 * Zod). Retourne `-1` si `chapters` est vide.
 */
export function findActiveChapterIndex(
  chapters: ReadonlyArray<VideoChapter>,
  currentSeconds: number,
): number {
  if (chapters.length === 0) return -1;
  const t = Math.max(0, Math.floor(currentSeconds));
  let active = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i]!.startSeconds <= t) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Format `01`, `02`, ... (1-based, pad-2). Discret, couleur encre/40 % en UI.
 * Au-delà de 99 → on retourne le nombre brut (cas hors-spec).
 */
export function formatChapterIndex(i: number): string {
  const oneBased = i + 1;
  if (oneBased < 0) return '00';
  if (oneBased < 100) return oneBased.toString().padStart(2, '0');
  return oneBased.toString();
}
