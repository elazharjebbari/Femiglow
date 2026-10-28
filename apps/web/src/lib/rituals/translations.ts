/**
 * Traductions éditoriales des témoignages mis en avant.
 *
 * Quand une locale (ar, en) n'a aucun témoignage publié, `listRituals` retombe
 * sur le français. Plutôt que d'insérer les traductions comme de nouveaux avis
 * (ce qui gonflerait le compteur), on affiche la traduction du MÊME avis :
 * même id, même note, mêmes photos — seuls le texte et l'identité affichée
 * changent de langue.
 *
 * Source : les miroirs de `seed-data.ts`, reliés par `mirrorKey`. La clé de
 * correspondance est le hash du body français (`bodyHash`, normalisé), donc un
 * avis français modifié en base n'est plus traduit (il reste affiché tel quel).
 */
import { bodyHash } from '@/lib/rituals/duplicate-detection';
import { SEED_RITUALS } from '@/lib/rituals/seed-data';

type TranslatableLanguage = 'ar' | 'en';

export interface RitualTranslation {
  body: string;
  authorFirstName: string | null;
  authorCity: string | null;
  initiatedSince: string | null;
}

let cache: Map<string, Partial<Record<TranslatableLanguage, RitualTranslation>>> | null = null;

function translationsByFrenchBody(): Map<
  string,
  Partial<Record<TranslatableLanguage, RitualTranslation>>
> {
  if (cache) return cache;
  const groups = new Map<string, typeof SEED_RITUALS>();
  for (const seed of SEED_RITUALS) {
    if (!seed.mirrorKey) continue;
    const group = groups.get(seed.mirrorKey) ?? [];
    group.push(seed);
    groups.set(seed.mirrorKey, group);
  }
  const out = new Map<string, Partial<Record<TranslatableLanguage, RitualTranslation>>>();
  for (const group of groups.values()) {
    const fr = group.find((s) => (s.language ?? 'fr') === 'fr');
    if (!fr) continue;
    const entry: Partial<Record<TranslatableLanguage, RitualTranslation>> = {};
    for (const s of group) {
      if (s.language === 'ar' || s.language === 'en') {
        entry[s.language] = {
          body: s.body,
          authorFirstName: s.authorFirstName,
          authorCity: s.authorCity,
          initiatedSince: s.initiatedSince,
        };
      }
    }
    out.set(bodyHash(fr.body), entry);
  }
  cache = out;
  return out;
}

/** Traduction éditoriale d'un avis français, ou `null` s'il n'en a pas. */
export function findRitualTranslation(
  frenchBody: string,
  language: string,
): RitualTranslation | null {
  if (language !== 'ar' && language !== 'en') return null;
  return translationsByFrenchBody().get(bodyHash(frenchBody))?.[language] ?? null;
}

/**
 * Applique la traduction éditoriale à un avis français affiché en repli.
 * Sans traduction connue, l'avis est renvoyé inchangé (toujours en français).
 */
export function translateFallbackRitual<
  T extends {
    body: string;
    authorFirstName: string | null;
    authorCity: string | null;
    initiatedSince: string | null;
    language: string | null;
  },
>(row: T, language: NonNullable<T['language']>): T {
  const t = findRitualTranslation(row.body, language);
  if (!t) return row;
  return {
    ...row,
    body: t.body,
    authorFirstName: row.authorFirstName === null ? null : t.authorFirstName,
    authorCity: row.authorCity === null ? null : t.authorCity,
    initiatedSince: row.initiatedSince === null ? null : t.initiatedSince,
    language,
  };
}
