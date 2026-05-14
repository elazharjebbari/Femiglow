/**
 * chat-guard — utilitaire pour valider qu'un slug de page légale référencé par
 * le chatbot existe et est publié, et pour suggérer un slug proche en cas de
 * faute de frappe. Pensé pour être branché dans le pipeline d'enrichissement
 * de réponse chat (post-LLM) : si l'IA propose `/legal/cgv-2024`, on vérifie
 * d'abord que la page existe.
 */
import { listPublishedSlugs } from '@/lib/legal/repository';

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) matrix[i] = [i];
  for (let j = 0; j <= a.length; j += 1) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

export interface ChatGuardResult {
  slug: string;
  exists: boolean;
  suggestion: string | null;
}

export async function validateLegalSlug(rawSlug: string): Promise<ChatGuardResult> {
  const slug = rawSlug.trim().toLowerCase();
  let published: string[] = [];
  try {
    published = await listPublishedSlugs();
  } catch {
    return { slug, exists: false, suggestion: null };
  }

  if (published.includes(slug)) {
    return { slug, exists: true, suggestion: null };
  }

  let best: { s: string; d: number } | null = null;
  for (const candidate of published) {
    const d = levenshtein(slug, candidate);
    if (best === null || d < best.d) best = { s: candidate, d };
  }

  const threshold = Math.max(2, Math.floor(slug.length * 0.4));
  const suggestion = best && best.d <= threshold ? best.s : null;

  return { slug, exists: false, suggestion };
}

/**
 * Filtre une liste d'URLs `/legal/<slug>` dans un texte généré par le chat,
 * remplace les slugs invalides par leur suggestion la plus proche (si
 * suffisamment similaire) ou retire le lien sinon. Renvoie le texte modifié.
 */
export async function sanitizeLegalLinksInText(text: string): Promise<string> {
  const matches = [...text.matchAll(/\/legal\/([a-z0-9-]+)/g)];
  if (matches.length === 0) return text;

  const slugs = [...new Set(matches.map((m) => m[1]!))];
  const results = await Promise.all(slugs.map((s) => validateLegalSlug(s)));
  const replacements = new Map<string, string | null>();
  for (const r of results) {
    if (r.exists) continue;
    replacements.set(r.slug, r.suggestion);
  }
  if (replacements.size === 0) return text;

  return text.replace(/\/legal\/([a-z0-9-]+)/g, (full, captured) => {
    const replacement = replacements.get(captured as string);
    if (replacement === undefined) return full;
    if (replacement === null) return '[lien retiré]';
    return `/legal/${replacement}`;
  });
}
