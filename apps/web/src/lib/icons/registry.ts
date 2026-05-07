/**
 * Icon registry — sources d'icônes disponibles pour le `IconEditor` (F1) et
 * pour le rendu côté RSC (F2). Deux jeux sont publiés :
 *
 *  - `femiglow-curated` : sélection éditoriale (UI primary/secondary, social,
 *    décoratif). C'est la valeur par défaut.
 *  - `lucide` : passthrough vers les noms canoniques de `lucide-react` ; pour
 *    v1 on liste seulement les icônes effectivement utilisées dans le site.
 *
 * Chaque entrée a une `key` (clé stable persistée en DB), un `label` FR, et
 * une liste d'`aliases` pour faciliter la recherche fuzzy en admin.
 *
 * IMPORTANT — Ne PAS renommer une `key` après seed prod : les bindings publiés
 * la référencent telle quelle. Pour retirer une icône, marquer `deprecated:
 * true` afin qu'elle ne sorte plus dans le picker mais que les bindings
 * existants restent rendables.
 */

export interface IconRegistryEntry {
  /** Clé stable persistée. */
  key: string;
  /** Libellé FR (tooltip + a11y label). */
  label: string;
  /** Mots-clés pour la recherche fuzzy. Toujours en minuscules, sans accent. */
  aliases: string[];
  /** Catégorie informelle pour grouper l'affichage. */
  category?: 'ui' | 'social' | 'editorial' | 'misc';
  /** Si true, n'apparaît plus dans le picker (legacy). */
  deprecated?: boolean;
}

export type IconSetId = 'femiglow-curated' | 'lucide';

const FEMIGLOW_CURATED: IconRegistryEntry[] = [
  // UI primaires
  { key: 'arrow-right', label: 'Flèche droite', aliases: ['fleche', 'right', 'next'], category: 'ui' },
  { key: 'arrow-left', label: 'Flèche gauche', aliases: ['fleche', 'left', 'previous'], category: 'ui' },
  { key: 'chevron-down', label: 'Chevron bas', aliases: ['chevron', 'down', 'expand'], category: 'ui' },
  { key: 'chevron-up', label: 'Chevron haut', aliases: ['chevron', 'up', 'collapse'], category: 'ui' },
  { key: 'check', label: 'Coche', aliases: ['check', 'valide', 'ok'], category: 'ui' },
  { key: 'plus', label: 'Plus', aliases: ['add', 'ajouter'], category: 'ui' },
  { key: 'close', label: 'Fermer', aliases: ['close', 'cross', 'x'], category: 'ui' },
  // Editorial
  { key: 'leaf', label: 'Feuille', aliases: ['leaf', 'plante', 'nature'], category: 'editorial' },
  { key: 'flower', label: 'Fleur', aliases: ['flower', 'fleur', 'plante'], category: 'editorial' },
  { key: 'sparkle', label: 'Étincelle', aliases: ['sparkle', 'etoile', 'magic'], category: 'editorial' },
  { key: 'heart', label: 'Cœur', aliases: ['heart', 'coeur', 'aimer'], category: 'editorial' },
  { key: 'moon', label: 'Lune', aliases: ['moon', 'lune', 'nuit'], category: 'editorial' },
  { key: 'sun', label: 'Soleil', aliases: ['sun', 'soleil', 'jour'], category: 'editorial' },
  { key: 'feather', label: 'Plume', aliases: ['feather', 'plume', 'leger'], category: 'editorial' },
  // Social
  { key: 'instagram', label: 'Instagram', aliases: ['instagram', 'insta'], category: 'social' },
  { key: 'pinterest', label: 'Pinterest', aliases: ['pinterest'], category: 'social' },
  { key: 'newsletter', label: 'Newsletter', aliases: ['mail', 'email', 'newsletter'], category: 'social' },
  // Divers
  { key: 'shopping-bag', label: 'Sac shopping', aliases: ['bag', 'panier', 'shop'], category: 'misc' },
  { key: 'star', label: 'Étoile', aliases: ['star', 'etoile', 'favori'], category: 'misc' },
  { key: 'info', label: 'Info', aliases: ['info', 'information'], category: 'misc' },
];

const LUCIDE_SUBSET: IconRegistryEntry[] = [
  { key: 'arrow-right', label: 'Arrow Right', aliases: ['arrow', 'right'], category: 'ui' },
  { key: 'arrow-left', label: 'Arrow Left', aliases: ['arrow', 'left'], category: 'ui' },
  { key: 'check', label: 'Check', aliases: ['check', 'ok'], category: 'ui' },
  { key: 'x', label: 'X', aliases: ['close', 'cross'], category: 'ui' },
  { key: 'plus', label: 'Plus', aliases: ['add'], category: 'ui' },
  { key: 'minus', label: 'Minus', aliases: ['remove'], category: 'ui' },
  { key: 'menu', label: 'Menu', aliases: ['burger'], category: 'ui' },
  { key: 'search', label: 'Search', aliases: ['search', 'magnify'], category: 'ui' },
  { key: 'heart', label: 'Heart', aliases: ['heart'], category: 'editorial' },
  { key: 'star', label: 'Star', aliases: ['star', 'favorite'], category: 'editorial' },
];

export const ICON_REGISTRY: Record<IconSetId, IconRegistryEntry[]> = {
  'femiglow-curated': FEMIGLOW_CURATED,
  lucide: LUCIDE_SUBSET,
};

/**
 * Retourne la liste des icônes visibles (non dépréciées) d'un set.
 */
export function getIconSet(setId: IconSetId): IconRegistryEntry[] {
  return (ICON_REGISTRY[setId] ?? []).filter((i) => !i.deprecated);
}

/**
 * Recherche fuzzy par clé / label / alias (case-insensitive).
 */
export function searchIcons(setId: IconSetId, query: string): IconRegistryEntry[] {
  const list = getIconSet(setId);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (i) =>
      i.key.toLowerCase().includes(q) ||
      i.label.toLowerCase().includes(q) ||
      i.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

/**
 * Vérifie qu'une clé existe dans un set (utile pour les validators Zod côté
 * serveur ; cf. B2). Retourne false si l'icône est dépréciée.
 */
export function isIconKeyValid(setId: IconSetId, key: string): boolean {
  return getIconSet(setId).some((i) => i.key === key);
}
