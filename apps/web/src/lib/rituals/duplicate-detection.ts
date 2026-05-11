import { createHash } from 'crypto';

/**
 * Détection de doublons / témoignages similaires.
 *
 * Deux niveaux :
 *  - **Strict** : hash SHA-256 du body normalisé. Match exact.
 *  - **Proche** : similarité Jaccard sur trigrammes ≥ seuil (par défaut 0,7).
 *
 * Implémentation pure JS (pas de dépendance Postgres), utilisable côté test
 * memory store et serveur. À volume > 5 000, basculer vers `pg_trgm` Postgres.
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P2.4
 */

// Apostrophe courbe → apostrophe droite. Codée en \u car esbuild refuse U+2019 comme clé brute.
const CURLY_APOSTROPHE = '’';
const ACCENT_MAP: Record<string, string> = {
  à: 'a',
  á: 'a',
  â: 'a',
  ä: 'a',
  ã: 'a',
  ç: 'c',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ö: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ÿ: 'y',
  ñ: 'n',
  [CURLY_APOSTROPHE]: "'",
};

/**
 * Normalise un body pour la comparaison : minuscules, accents retirés,
 * ponctuation/diacritiques harmonisés, espaces collapsed, trim.
 */
export function normalizeForHash(body: string): string {
  const lower = body.toLowerCase();
  let out = '';
  for (const ch of lower) {
    out += ACCENT_MAP[ch] ?? ch;
  }
  out = out
    .replace(/[  ]/g, ' ') // espaces fines/insécables → espace
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}

/** Hash stable du body normalisé (clé de doublon strict). */
export function bodyHash(body: string): string {
  return createHash('sha256').update(normalizeForHash(body)).digest('hex');
}

/** Set de trigrammes (n-grams 3) d'un texte normalisé. */
export function trigrams(text: string): Set<string> {
  const norm = ` ${normalizeForHash(text)} `;
  const out = new Set<string>();
  for (let i = 0; i < norm.length - 2; i++) {
    out.add(norm.slice(i, i + 3));
  }
  return out;
}

/** Similarité Jaccard sur trigrammes ∈ [0, 1]. */
export function trigramSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

export interface SimilarityMatch {
  id: string;
  score: number;
  isStrict: boolean;
}

/**
 * Cherche les rituels similaires à `body` parmi un pool de candidats.
 * Retourne les matches triés par score décroissant, filtrés par `threshold`.
 *
 * `isStrict = true` si bodyHash identique (peu importe le score).
 */
export function findSimilar(
  body: string,
  candidates: ReadonlyArray<{ id: string; body: string }>,
  threshold: number = 0.7,
): SimilarityMatch[] {
  const targetHash = bodyHash(body);
  const out: SimilarityMatch[] = [];
  for (const c of candidates) {
    const isStrict = bodyHash(c.body) === targetHash;
    const score = isStrict ? 1 : trigramSimilarity(body, c.body);
    if (isStrict || score >= threshold) {
      out.push({ id: c.id, score, isStrict });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Détermine les auto-flags à poser pour un nouveau body donné, en fonction
 * de ce qu'on trouve parmi les existants.
 *
 * - `duplicate_strict` si au moins un hash identique
 * - `duplicate_loose` si au moins un score ∈ [0.7, 1)
 */
export function duplicateFlags(matches: SimilarityMatch[]): string[] {
  const out: string[] = [];
  if (matches.some((m) => m.isStrict)) out.push('duplicate_strict');
  if (matches.some((m) => !m.isStrict && m.score >= 0.7)) out.push('duplicate_loose');
  return out;
}
