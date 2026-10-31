/**
 * Médias par audience — état du formulaire d'une cellule (module pur).
 *
 * Conversion ensemble ↔ items éditables ↔ payload `PUT /draft`, détection
 * des modifications et des alt manquants pour la langue de la cellule.
 */
import type { MediaObjectPosition } from '@/lib/db/types';
import { WILDCARD } from './model';
import type {
  AdminMediaSetJson,
  AdminMediaState,
  MediaSetHistoryEntryJson,
  MediaSetItemPayload,
  MediaSetTuple,
} from './types';

export const ALT_LOCALES = ['fr', 'ar', 'en'] as const;
export type AltLocale = (typeof ALT_LOCALES)[number];

export const OBJECT_POSITIONS: readonly MediaObjectPosition[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
];

export const OBJECT_POSITION_LABEL: Readonly<Record<MediaObjectPosition, string>> = {
  center: 'Centre',
  top: 'Haut',
  bottom: 'Bas',
  left: 'Gauche',
  right: 'Droite',
  'top left': 'Haut gauche',
  'top right': 'Haut droite',
  'bottom left': 'Bas gauche',
  'bottom right': 'Bas droite',
};

export interface EditorItem {
  /** Clé stable côté client (tri, React). */
  uid: string;
  mediaId: string;
  thumbUrl: string | null;
  /** Alt de la médiathèque (repli FR au rendu). */
  libraryAlt: string | null;
  state: AdminMediaState;
  mobileMediaId: string | null;
  mobileThumbUrl: string | null;
  mobileState: AdminMediaState | null;
  alt: Record<AltLocale, string>;
  objectPosition: MediaObjectPosition | null;
  focalX: number | null;
  focalY: number | null;
}

export interface EditorForm {
  items: EditorItem[];
  crossLocale: boolean;
  notes: string;
}

let uidSeq = 0;
export function newUid(): string {
  uidSeq += 1;
  return `it_${Date.now().toString(36)}_${uidSeq}`;
}

function altOf(raw: Partial<Record<string, string>> | null | undefined): Record<AltLocale, string> {
  return { fr: raw?.fr ?? '', ar: raw?.ar ?? '', en: raw?.en ?? '' };
}

export function emptyForm(): EditorForm {
  return { items: [], crossLocale: false, notes: '' };
}

/** Formulaire initialisé depuis un ensemble (liste enrichie : vignettes). */
export function formFromSet(
  set: AdminMediaSetJson | null,
  thumbs?: ReadonlyMap<string, string | null>,
): EditorForm {
  if (!set) return emptyForm();
  return {
    crossLocale: set.crossLocale,
    notes: set.notes ?? '',
    items: [...set.items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        uid: newUid(),
        mediaId: i.mediaId,
        thumbUrl: i.media?.thumbUrl ?? thumbs?.get(i.mediaId) ?? null,
        libraryAlt: i.media?.alt ?? null,
        state: i.media?.state ?? 'ok',
        mobileMediaId: i.mobileMediaId,
        mobileThumbUrl: i.mobileMedia?.thumbUrl ?? (i.mobileMediaId ? (thumbs?.get(i.mobileMediaId) ?? null) : null),
        mobileState: i.mobileMediaId ? (i.mobileMedia?.state ?? 'ok') : null,
        alt: altOf(i.alt),
        objectPosition: i.objectPosition,
        focalX: i.focalX,
        focalY: i.focalY,
      })),
  };
}

/** Formulaire depuis une entrée d'historique (aperçu avant restauration). */
export function formFromHistory(entry: MediaSetHistoryEntryJson): EditorForm {
  return {
    crossLocale: entry.crossLocale,
    notes: entry.notes ?? '',
    items: entry.items.map((i) => ({
      uid: newUid(),
      mediaId: i.mediaId,
      thumbUrl: i.thumbUrl,
      libraryAlt: null,
      state: 'ok',
      mobileMediaId: i.mobileMediaId,
      mobileThumbUrl: i.mobileThumbUrl,
      mobileState: i.mobileMediaId ? 'ok' : null,
      alt: altOf(i.alt),
      objectPosition: i.objectPosition,
      focalX: i.focalX,
      focalY: i.focalY,
    })),
  };
}

/** Items du payload `PUT /draft` (alt vides omis, position = ordre). */
export function toPayloadItems(items: readonly EditorItem[]): MediaSetItemPayload[] {
  return items.map((i) => {
    const alt: Partial<Record<AltLocale, string>> = {};
    for (const loc of ALT_LOCALES) {
      const v = i.alt[loc].trim();
      if (v) alt[loc] = v;
    }
    return {
      mediaId: i.mediaId,
      mobileMediaId: i.mobileMediaId,
      alt,
      objectPosition: i.objectPosition,
      focalX: i.focalX,
      focalY: i.focalY,
    };
  });
}

export function toDraftPayload(tuple: MediaSetTuple, form: EditorForm) {
  const notes = form.notes.trim();
  return {
    ...tuple,
    crossLocale: form.crossLocale,
    items: toPayloadItems(form.items),
    notes: notes ? notes : null,
  };
}

/** Empreinte comparable (détection des modifications non enregistrées). */
export function formFingerprint(form: EditorForm): string {
  return JSON.stringify({
    items: toPayloadItems(form.items),
    crossLocale: form.crossLocale,
    notes: form.notes.trim(),
  });
}

/**
 * Langues d'alt à renseigner pour la langue de la cellule : la langue
 * elle-même, ou les trois pour `*` (servi à toutes les langues).
 */
export function missingAltLocales(item: EditorItem, cellLocale: string): AltLocale[] {
  const wanted: readonly AltLocale[] =
    cellLocale === WILDCARD
      ? ALT_LOCALES
      : (ALT_LOCALES as readonly string[]).includes(cellLocale)
        ? [cellLocale as AltLocale]
        : [];
  return wanted.filter((loc) => !item.alt[loc].trim());
}

/** Clamp 0–100 entier ; vide → `null`. */
export function parseFocal(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it!);
  return next;
}
