/**
 * Calcule la région de crop à extraire d'une image source pour qu'elle
 * corresponde à un ratio cible, centrée sur un focal point optionnel.
 *
 * Convention :
 *  - `focalX` / `focalY` sont en pourcentage (0–100). 50/50 = centre.
 *  - Si la source est déjà au bon ratio (à 0.5 % près), on renvoie `null`
 *    (= pas de crop nécessaire, sharp recadre déjà naturellement).
 *
 * Sortie : `{ left, top, width, height }` en pixels entiers, prête à être
 * passée à sharp `extract()`.
 */
export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ComputeCropRegionInput {
  sourceWidth: number;
  sourceHeight: number;
  /** Ex. `'4/5'`, `'16/9'`, `'1/1'`, `'4:5'` (le `:` est toléré). */
  targetAspectRatio: string;
  /** Focal point en %, défaut 50/50. */
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Tolérance (en ratio) en deçà de laquelle on considère la source déjà
   * conforme au ratio cible et on ne crope pas. Défaut 0.005 = 0.5 %.
   */
  toleranceRatio?: number;
}

/** Parse un ratio `'4/5'` ou `'4:5'` en nombre `width/height`. */
export function parseAspectRatio(input: string): number | null {
  const m = input.match(/^\s*(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

export function computeCropRegion(input: ComputeCropRegionInput): CropRegion | null {
  const { sourceWidth: sW, sourceHeight: sH, targetAspectRatio } = input;
  if (sW <= 0 || sH <= 0) return null;

  const target = parseAspectRatio(targetAspectRatio);
  if (target === null) return null;

  const sourceRatio = sW / sH;
  const tolerance = input.toleranceRatio ?? 0.005;
  if (Math.abs(sourceRatio - target) / target <= tolerance) return null;

  // Si la source est plus large que la cible → on garde la hauteur,
  // on rétrécit la largeur. Inversement si elle est plus haute.
  let cropW: number;
  let cropH: number;
  if (sourceRatio > target) {
    cropH = sH;
    cropW = Math.round(sH * target);
  } else {
    cropW = sW;
    cropH = Math.round(sW / target);
  }

  // Clamp focal point.
  const fx = clamp01Pct(input.focalX ?? 50);
  const fy = clamp01Pct(input.focalY ?? 50);

  // Position du centre du crop sur la source.
  const centerX = (fx / 100) * sW;
  const centerY = (fy / 100) * sH;

  // On ramène à un rectangle qui rentre dans la source.
  let left = Math.round(centerX - cropW / 2);
  let top = Math.round(centerY - cropH / 2);
  left = Math.max(0, Math.min(left, sW - cropW));
  top = Math.max(0, Math.min(top, sH - cropH));

  return { left, top, width: cropW, height: cropH };
}

function clamp01Pct(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}
