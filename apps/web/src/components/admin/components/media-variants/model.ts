/**
 * Médias par audience — logique d'affichage de la matrice admin (module pur).
 *
 * Lignes (défaut + valeurs de dimension), colonnes (langues d'ensemble),
 * index des ensembles par tuple, pastilles de statut, « hérite de… » (lu
 * dans la couverture calculée par le serveur avec `selectMediaSet`), URL
 * d'aperçu. Aucune requête ici : tout est testable sans DOM.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import type { MediaVariantSlotPolicy } from '@/lib/components/registry';
import type {
  AdminMediaSetJson,
  MatrixRow,
  MediaSetCoverageCell,
  MediaSetTuple,
  MediaVariantDimensionJson,
  StuckScheduledJson,
} from './types';

export const DEFAULT_DIM = 'default';
export const WILDCARD = '*';
const TZ = 'Europe/Paris';

/** Angles du kit : libellé court + rappel du message de la publicité. */
const ANGLE_LABELS: Readonly<Record<string, { title: string; hint: string }>> = {
  a: { title: 'Angle A', hint: 'ça brille, pas du vernis' },
  b: { title: 'Angle B', hint: 'zéro vernis et ça brille' },
  c: { title: 'Angle C', hint: 'fini le semi-permanent' },
  d: { title: 'Angle D', hint: 'rien à retirer avant le woudou' },
  e: { title: 'Angle E', hint: 'salon ou 99 DH' },
  temoin: { title: 'Témoin', hint: 'manucure japonaise à la maison' },
};

export const LOCALE_COLUMN_LABEL: Readonly<Record<string, string>> = {
  '*': 'Toutes langues',
  fr: 'FR',
  ar: 'AR',
  en: 'EN',
};

export function localeLabel(locale: string): string {
  return LOCALE_COLUMN_LABEL[locale] ?? locale.toUpperCase();
}

/** Lignes : `défaut`, puis chaque valeur des dimensions énumérables. */
export function matrixRows(dimensions: readonly MediaVariantDimensionJson[]): MatrixRow[] {
  const rows: MatrixRow[] = [{ variantDim: DEFAULT_DIM, variantKey: WILDCARD }];
  for (const dim of dimensions) {
    for (const value of dim.values ?? []) rows.push({ variantDim: dim.id, variantKey: value });
  }
  return rows;
}

export function rowKey(row: MatrixRow): string {
  return `${row.variantDim}:${row.variantKey}`;
}

/** Libellé d'une ligne : « Défaut », « Angle E » (+ rappel), « Expérience x · b ». */
export function rowLabel(
  row: MatrixRow,
  dimensions: readonly MediaVariantDimensionJson[] = [],
): { title: string; hint: string | null } {
  if (row.variantDim === DEFAULT_DIM) return { title: 'Défaut', hint: 'sans angle reconnu' };
  if (row.variantDim === 'angle') {
    const known = ANGLE_LABELS[row.variantKey];
    if (known) return known;
    return { title: `Angle ${row.variantKey.toUpperCase()}`, hint: null };
  }
  const dim = dimensions.find((d) => d.id === row.variantDim);
  return { title: `${dim?.label ?? row.variantDim} · ${row.variantKey}`, hint: null };
}

/** « angle e », « angle témoin », « défaut » — forme courte de « hérite de… ». */
export function shortVariantLabel(variantDim: string, variantKey: string): string {
  if (variantDim === DEFAULT_DIM) return 'défaut';
  if (variantDim === 'angle') return `angle ${variantKey === 'temoin' ? 'témoin' : variantKey}`;
  return `${variantDim} ${variantKey}`;
}

export function tupleKey(t: MediaSetTuple): string {
  return [t.slot, t.variantDim, t.variantKey, t.locale].join('|');
}

export interface TupleSets {
  draft?: AdminMediaSetJson;
  published?: AdminMediaSetJson;
  scheduled?: AdminMediaSetJson;
}

/** Index des ensembles vivants par tuple (au plus un par statut, cf. index partiels). */
export function indexSets(sets: readonly AdminMediaSetJson[]): Map<string, TupleSets> {
  const map = new Map<string, TupleSets>();
  for (const s of sets) {
    if (s.status !== 'draft' && s.status !== 'published' && s.status !== 'scheduled') continue;
    const key = tupleKey(s);
    const entry = map.get(key) ?? {};
    entry[s.status] = s;
    map.set(key, entry);
  }
  return map;
}

export function findSetById(
  sets: readonly AdminMediaSetJson[],
  id: string | null | undefined,
): AdminMediaSetJson | null {
  if (!id) return null;
  return sets.find((s) => s.id === id) ?? null;
}

export function formatParis(iso: string, style: 'short' | 'long' = 'short'): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: TZ,
      ...(style === 'short'
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { dateStyle: 'long', timeStyle: 'short' }),
    } as Intl.DateTimeFormatOptions).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type PillTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export interface StatusPill {
  tone: PillTone;
  label: string;
}

/** Pastilles de statut d'une cellule (ordre : publié, programmé, brouillon). */
export function statusPills(entry: TupleSets | undefined, stuckIds: ReadonlySet<string>): StatusPill[] {
  const pills: StatusPill[] = [];
  if (!entry) return pills;
  if (entry.published) {
    pills.push({ tone: 'success', label: `publié v${entry.published.version}` });
    if (entry.published.hasUnavailableMedia) {
      pills.push({ tone: 'danger', label: 'média indisponible' });
    }
  }
  if (entry.scheduled) {
    const s = entry.scheduled;
    if (stuckIds.has(s.id)) pills.push({ tone: 'danger', label: 'bloqué' });
    else
      pills.push({
        tone: 'info',
        label: s.scheduledAt ? `programmé ${formatParis(s.scheduledAt)}` : 'programmé',
      });
  }
  if (entry.draft) {
    pills.push({ tone: 'warning', label: entry.draft.source === 'import' ? 'brouillon importé' : 'brouillon' });
  }
  return pills;
}

/**
 * Ensemble à montrer en vignette pour une cellule qui en possède un :
 * le publié, sinon la programmation, sinon le brouillon.
 */
export function displaySet(entry: TupleSets | undefined): AdminMediaSetJson | null {
  return entry?.published ?? entry?.scheduled ?? entry?.draft ?? null;
}

/** Locales de visiteuse couvertes par le calcul de couverture. */
export function coverageCellFor(
  cells: readonly MediaSetCoverageCell[],
  row: MatrixRow,
  locale: string,
  slot: string,
): MediaSetCoverageCell | null {
  return (
    cells.find(
      (c) =>
        c.slot === slot &&
        c.locale === locale &&
        c.variantDim === row.variantDim &&
        c.variantKey === row.variantKey,
    ) ?? null
  );
}

export type InheritanceKind = 'own' | 'inherited' | 'legacy' | 'product';

export interface Inheritance {
  kind: InheritanceKind;
  /** Libellé affiché (« hérite de : angle e · * », « liaison existante »…). */
  label: string;
  /** Ensemble servi (niveaux 1–6). */
  setId: string | null;
}

/**
 * Ce que voit une visiteuse de langue `locale` sur cette ligne, d'après la
 * couverture serveur (ensembles PUBLIÉS). `null` si la colonne n'est pas une
 * langue de visiteuse (`*`) ou si la couverture n'a pas cette cellule.
 *
 * Niveau 7 : liaisons legacy si l'un des slots de repli est lié, sinon
 * l'image produit (niveau 8 au rendu).
 */
export function inheritanceFor(
  cell: MediaSetCoverageCell | null,
  slotPolicy: MediaVariantSlotPolicy | undefined,
  activeLegacySlots: ReadonlySet<string>,
): Inheritance | null {
  if (!cell) return null;
  if (cell.level >= 7 || !cell.source) {
    const hasLegacy = (slotPolicy?.legacySlots ?? []).some((s) => activeLegacySlots.has(s));
    return hasLegacy
      ? { kind: 'legacy', label: 'liaison existante', setId: null }
      : { kind: 'product', label: 'image produit', setId: null };
  }
  if (cell.exact && cell.sameLocale) return { kind: 'own', label: 'ensemble de la cellule', setId: cell.setId };
  const src = cell.source;
  const crossNote = src.crossLocale && src.locale !== WILDCARD && src.locale !== cell.locale ? ' (sans texte)' : '';
  return {
    kind: 'inherited',
    label: `hérite de : ${shortVariantLabel(src.variantDim, src.variantKey)} · ${src.locale}${crossNote}`,
    setId: cell.setId,
  };
}

/** Niveau de repli lisible (diagnostic). */
export const LEVEL_LABELS: Readonly<Record<number, string>> = {
  1: 'variante + langue exacte',
  2: 'variante, toutes langues',
  3: 'variante en FR (images sans texte)',
  4: 'défaut + langue',
  5: 'défaut, toutes langues',
  6: 'défaut en FR (images sans texte)',
  7: 'liaisons existantes du composant',
  8: 'image produit',
};

export function levelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? `niveau ${level}`;
}

/** Langue de page pour l'aperçu : `fr` pour la colonne `*`. */
export function previewLocale(locale: string): string {
  return locale === WILDCARD ? 'fr' : locale;
}

/**
 * URL d'aperçu brouillon d'une cellule : `/{locale}/{page}?angle=<k>&hmv_preview=draft`.
 * La ligne `défaut` n'a pas de paramètre d'angle (attention : un cookie
 * `fg_angle` mémorisé dans ce navigateur s'applique alors).
 */
export function previewUrl(row: MatrixRow, locale: string, pagePath = 'kit'): string {
  const qs = new URLSearchParams();
  if (row.variantDim !== DEFAULT_DIM) qs.set(row.variantDim, row.variantKey);
  qs.set('hmv_preview', 'draft');
  return `/${previewLocale(locale)}/${pagePath.replace(/^\/+/, '')}?${qs.toString()}`;
}

/** Variantes simulées pour `GET /resolve` (une seule dimension renseignée par ligne). */
export function resolveVariants(row: MatrixRow): Record<string, string> {
  return row.variantDim === DEFAULT_DIM ? {} : { [row.variantDim]: row.variantKey };
}

/** Description d'un slot de la politique (« liste · 6 images max · 3:4 / 4:5 »). */
export function slotDescription(slot: MediaVariantSlotPolicy, maxItems: number): string {
  const kind = slot.kind === 'single' ? 'image unique' : `liste · ${maxItems} images max`;
  const aspect =
    'all' in slot.aspect
      ? `ratio ${slot.aspect.all}`
      : `mobile ${slot.aspect.mobile} · desktop ${slot.aspect.desktop}`;
  return `${kind} · ${aspect}`;
}

export const STUCK_REASON_LABEL: Readonly<Record<StuckScheduledJson['reason'], string>> = {
  media_unavailable: 'un média est supprimé ou pas prêt (ou l’ensemble est vide)',
  overdue: 'échéance dépassée depuis plus de 15 minutes (le cron tourne-t-il ?)',
};

export function cellTitle(
  row: MatrixRow,
  locale: string,
  slot: string,
  dimensions: readonly MediaVariantDimensionJson[] = [],
): string {
  return `${rowLabel(row, dimensions).title} · ${localeLabel(locale)} · ${slot}`;
}
