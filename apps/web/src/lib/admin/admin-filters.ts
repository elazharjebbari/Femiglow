/**
 * Sérialisation/déserialisation des filtres admin pour les listes de rituels.
 * URL persistance pour bookmark, partage, retour-arrière sans perte d'état.
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P1.3
 */
import type { RitualSource } from '@/lib/db/types';

export const KNOWN_AUTO_FLAGS = [
  'emoji_detected',
  'link_external',
  'forbidden_word',
  'all_caps',
  'face_detected',
  'duplicate_strict',
  'duplicate_loose',
] as const;
export type KnownAutoFlag = (typeof KNOWN_AUTO_FLAGS)[number];

export const KNOWN_SOURCES: RitualSource[] = [
  'web',
  'email_j45',
  'manual',
  'import_csv',
  'import_json',
  'import_zip',
];

export interface AdminFilters {
  flags: KnownAutoFlag[];
  sources: RitualSource[];
  /** ISO date YYYY-MM-DD. */
  dateFrom: string | null;
  dateTo: string | null;
  /** Recherche libre sur prénom auteur OU customer_hash. */
  authorQuery: string | null;
  /** true = uniquement vérifiés ; false = uniquement non vérifiés ; null = tous. */
  verified: boolean | null;
}

export const EMPTY_FILTERS: AdminFilters = {
  flags: [],
  sources: [],
  dateFrom: null,
  dateTo: null,
  authorQuery: null,
  verified: null,
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(src: ParamSource, key: string): string | null {
  if (src instanceof URLSearchParams) {
    return src.get(key);
  }
  const v = src[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function getCsv(src: ParamSource, key: string): string[] {
  const raw = getParam(src, key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAdminFilters(src: ParamSource): AdminFilters {
  const rawFlags = getCsv(src, 'flags');
  const flags = rawFlags.filter((f): f is KnownAutoFlag =>
    (KNOWN_AUTO_FLAGS as readonly string[]).includes(f),
  );

  const rawSources = getCsv(src, 'source');
  const sources = rawSources.filter((s): s is RitualSource =>
    (KNOWN_SOURCES as readonly string[]).includes(s),
  );

  const dateFrom = getParam(src, 'from');
  const dateTo = getParam(src, 'to');

  const author = getParam(src, 'author');
  const verifiedRaw = getParam(src, 'verified');
  const verified =
    verifiedRaw === 'true' ? true : verifiedRaw === 'false' ? false : null;

  return {
    flags,
    sources,
    dateFrom: dateFrom && ISO_DATE.test(dateFrom) ? dateFrom : null,
    dateTo: dateTo && ISO_DATE.test(dateTo) ? dateTo : null,
    authorQuery: author && author.length > 0 ? author : null,
    verified,
  };
}

export function serializeAdminFilters(filters: AdminFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.flags.length > 0) out.set('flags', filters.flags.join(','));
  if (filters.sources.length > 0) out.set('source', filters.sources.join(','));
  if (filters.dateFrom) out.set('from', filters.dateFrom);
  if (filters.dateTo) out.set('to', filters.dateTo);
  if (filters.authorQuery) out.set('author', filters.authorQuery);
  if (filters.verified !== null) out.set('verified', filters.verified ? 'true' : 'false');
  return out;
}

export function countActiveFilters(filters: AdminFilters): number {
  let n = 0;
  if (filters.flags.length > 0) n += 1;
  if (filters.sources.length > 0) n += 1;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  if (filters.authorQuery) n += 1;
  if (filters.verified !== null) n += 1;
  return n;
}
