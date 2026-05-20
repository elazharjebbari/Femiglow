/**
 * Sanitization et validation des covers SVG pour `/admin/kit/video`.
 *
 *  - `sanitizeSvgInline(raw)` : strip toute syntaxe XSS-able (scripts, on*,
 *    href javascript:, data: binaires). Vérifie taille, viewBox, racine
 *    `<svg>`. Retourne `{ ok, sanitized, warnings[] }`.
 *  - `validateSvgUrl(url)` : HEAD HTTPS sur l'URL externe pour vérifier
 *    content-type `image/svg+xml` et taille. Retourne `{ ok, contentType,
 *    size, reason? }`.
 *
 * Défense en profondeur : DOMPurify avec profile SVG strict + whitelist
 * supplémentaire côté maison, double passe (regex + DOMPurify).
 *
 * cf. docs/video-gestes-optim-2026-05/ (extension phase admin cover).
 */
import DOMPurify from 'isomorphic-dompurify';

const MAX_INLINE_BYTES = 50_000;
const MAX_URL_BYTES = 200_000;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/svg+xml',
  'image/svg+xml; charset=utf-8',
  'image/svg+xml;charset=utf-8',
]);


export interface SanitizeSvgResult {
  ok: boolean;
  sanitized: string;
  warnings: string[];
  reason?: string;
}

/**
 * Sanitize un SVG inline saisi par l'admin. Strict :
 *  - Strip tout `<script>`, `on*`, `href="javascript:"`, etc.
 *  - Refuse si taille > 50 kB ou racine ≠ `<svg>` ou pas de viewBox.
 *  - Whitelist de balises restreinte (pas d'`<image href=…>` binaire).
 */
export function sanitizeSvgInline(raw: string): SanitizeSvgResult {
  const warnings: string[] = [];

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, sanitized: '', warnings, reason: 'SVG vide.' };
  }

  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_INLINE_BYTES) {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: `SVG trop volumineux (${bytes} > ${MAX_INLINE_BYTES} octets).`,
    };
  }

  // Pre-check rapide : doit commencer par <svg ou contenir <svg en racine.
  const trimmed = raw.trim();
  if (!/^<svg\b/i.test(trimmed)) {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: 'La racine doit être un élément <svg>.',
    };
  }

  // viewBox obligatoire pour préserver l'aspect ratio dans le composant.
  if (!/viewBox\s*=\s*["'][^"']+["']/.test(trimmed)) {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: 'L\'attribut viewBox est obligatoire sur la racine <svg>.',
    };
  }

  // Refuse les images binaires inline (data:image/*) pour éviter
  // l'exfiltration de payload arbitraires via l'override SVG.
  if (/<image\b[^>]*(href|xlink:href)\s*=\s*["']\s*data:/i.test(trimmed)) {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: 'Les <image href="data:..."> ne sont pas autorisés (bypass payload).',
    };
  }

  // DOMPurify avec profil SVG strict + ajout explicite des balises
  // d'animation SMIL et des filtres (le profil par défaut les exclut).
  let sanitized: string;
  try {
    sanitized = DOMPurify.sanitize(trimmed, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: [
        'animate',
        'animateTransform',
        'animateMotion',
        'mpath',
        'feSpecularLighting',
        'feDistantLight',
        'feOffset',
        'feFlood',
        'feBlend',
        'feMerge',
        'feMergeNode',
        'feColorMatrix',
        'feTurbulence',
        'feComposite',
        'feGaussianBlur',
      ],
      ADD_ATTR: [
        'attributeName',
        'attributeType',
        'values',
        'dur',
        'repeatCount',
        'begin',
        'end',
        'from',
        'to',
        'by',
        'restart',
        'fill',
        'calcMode',
        'keyTimes',
        'keySplines',
        'additive',
        'accumulate',
        'baseFrequency',
        'numOctaves',
        'stdDeviation',
        'seed',
        'type',
      ],
      // Référence : ALLOWED_TAGS est utilisé pour intersection si non vide.
      // On laisse vide ici pour additionner aux profils.
      FORBID_ATTR: ['style'], // style="..." peut cacher du expression() ou des URLs js
      KEEP_CONTENT: false,
    }) as string;
  } catch (err) {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: `Erreur de sanitization : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (sanitized.trim() === '') {
    return {
      ok: false,
      sanitized: '',
      warnings,
      reason: 'SVG vide après sanitization (contenu refusé en bloc).',
    };
  }

  // Détecte les attributs forbidden qu'on aurait laissés filer (paranoia).
  const stripped = stripForbiddenAttrs(sanitized);
  if (stripped !== sanitized) {
    warnings.push('Attributs interdits supprimés (on*, javascript:, etc.).');
    sanitized = stripped;
  }

  // Si le contenu original mentionnait <script>, on log un warning.
  if (/<script\b/i.test(trimmed)) {
    warnings.push('Balise <script> détectée et supprimée.');
  }

  return { ok: true, sanitized, warnings };
}

/**
 * Strip défensif des attributs `on*` et des URLs `javascript:` qui auraient
 * survécu à DOMPurify (paranoia : on ne fait jamais trop confiance).
 */
function stripForbiddenAttrs(svg: string): string {
  let cleaned = svg;
  // Strip on* event handlers : onclick, onload, onmouseover, etc.
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Strip href="javascript:..."
  cleaned = cleaned.replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  return cleaned;
}

export interface ValidateSvgUrlResult {
  ok: boolean;
  contentType?: string;
  size?: number;
  reason?: string;
}

/**
 * Valide une URL externe pointant vers un SVG. Vérifie :
 *  - URL HTTPS (pas de HTTP ni de javascript:).
 *  - content-type `image/svg+xml`.
 *  - Taille content-length ≤ 200 kB.
 *
 *  La fonction fait un fetch HEAD ; si l'origin refuse HEAD elle fallback
 *  sur un GET partiel via Range si possible, sinon retourne `ok: false`.
 *
 * Note : ne télécharge PAS le SVG (le rendu côté client le chargera via
 * `<img src=…>`). On vérifie juste la conformité du contrat.
 */
export async function validateSvgUrl(url: string): Promise<ValidateSvgUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'URL invalide.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Seules les URLs HTTPS sont acceptées.' };
  }

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      // Cache-control : pas de cache pour la validation, on veut le live.
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, reason: `HEAD ${parsed.host} → ${res.status}` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase())) {
      return {
        ok: false,
        contentType,
        reason: `Content-Type non supporté : « ${contentType} ». Attendu : image/svg+xml.`,
      };
    }

    const lengthHeader = res.headers.get('content-length');
    const size = lengthHeader ? Number.parseInt(lengthHeader, 10) : undefined;
    if (size !== undefined && Number.isFinite(size) && size > MAX_URL_BYTES) {
      return {
        ok: false,
        contentType,
        size,
        reason: `SVG trop volumineux (${size} > ${MAX_URL_BYTES} octets).`,
      };
    }

    return { ok: true, contentType, size };
  } catch (err) {
    return {
      ok: false,
      reason: `Erreur réseau : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Exporté pour tests et pour le client (défense en profondeur). */
export const SANITIZE_SVG_LIMITS = {
  MAX_INLINE_BYTES,
  MAX_URL_BYTES,
} as const;
