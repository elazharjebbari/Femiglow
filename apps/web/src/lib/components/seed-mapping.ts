/**
 * Seed mapping — relie chaque PNG de `docs/images/values/<group>/` à un
 * slot d’un composant du registre.
 *
 * Format :
 *   sourcePath (relatif à `docs/images/values/`) → { componentKey, slot,
 *                                                    autoActivate? }
 *
 * Cette table est utilisée par le pipeline `seed-from-docs` pour :
 *   1. Ingérer le PNG comme `Media` (via `optimizeImage` + storage adapter).
 *   2. Créer un `componentMediaBindings` (componentKey, slot, mediaId).
 *
 * Activation (Option B — cf. `seed-pipeline.ts`) :
 *  - À la CRÉATION du binding (premier seed) : `isActive=true` par défaut.
 *    Le site est immédiatement utilisable après le seed, pas besoin d'aller
 *    cliquer dans l'admin pour chaque slot.
 *  - À la MISE À JOUR d'un binding existant : `isActive` est PRÉSERVÉ.
 *    Si l'admin a désactivé un slot via la CMS, un re-seed ne le réactive
 *    pas en silence.
 *  - `--auto-activate` (CLI) ou `mapping.autoActivate: true` forcent la
 *    réactivation même sur un binding désactivé manuellement — à utiliser
 *    quand on veut explicitement remettre tout en route après un override
 *    admin (debug, rollback éditorial).
 */
export interface SeedMappingEntry {
  componentKey: string;
  slot: string;
  /**
   * Si vrai, force `isActive=true` même sur un binding préexistant désactivé
   * par l'admin (cf. Option B dans `seed-pipeline.ts`). À réserver aux assets
   * que l'éditorial considère comme la source canon non-négociable
   * (ex. CHA-243 — hero kit pointe systématiquement sur `image-produit.png`).
   * En pratique, sur un fresh-seed cette option est redondante (création =
   * actif par défaut) ; elle sert surtout aux re-seeds pour restaurer un slot
   * après un override admin temporaire.
   */
  autoActivate?: boolean;
}

export const IMAGE_TO_COMPONENT: Record<string, SeedMappingEntry> = {
  /* ───── home/ ───── */
  'home/hero-home.png': { componentKey: 'home-hero', slot: 'primary' },
  'home/og-home.png': { componentKey: 'home-og', slot: 'og' },
  'home/mains-yasmine.png': { componentKey: 'home-avis-strip', slot: 'avis-yasmine' },
  'home/mains-salma.png': { componentKey: 'home-avis-strip', slot: 'avis-salma' },
  'home/mains-ines.png': { componentKey: 'home-avis-strip', slot: 'avis-ines' },

  /* ───── rituel/ ───── */
  'rituel/hero-lifestyle.png': { componentKey: 'rituel-hero-lifestyle', slot: 'primary' },
  'rituel/portrait-salma.png': { componentKey: 'rituel-portrait-salma', slot: 'avatar' },
  'rituel/origine-sepia.png': { componentKey: 'rituel-origine-sepia', slot: 'primary' },
  'rituel/poster-video.png': { componentKey: 'rituel-video-4-gestes', slot: 'poster' },
  'rituel/og-rituel.png': { componentKey: 'rituel-og', slot: 'og' },

  /* ───── kit/ ─────
   * `image-produit.png` est l'image de référence pour le hero kit (CHA-243).
   * Le composant `kit-hero-produit` ramène l'image au ratio 4:5 via Next/Image
   * + `object-cover`, donc l'image source n'a pas besoin d'être pré-cropée :
   * c'est l'image qui s'adapte au composant, pas l'inverse.
   *
   * `autoActivate: true` — marque ce slot comme canon non-négociable :
   * même si un admin l'a désactivé via la CMS, un re-seed le ré-active
   * (rollback éditorial). Sur un fresh-seed cette option est redondante
   * (création = actif par défaut depuis Option B) — elle reste là pour
   * documenter explicitement que `image-produit.png` est la source canon
   * du hero kit.
   *
   * `kit-principale.png` reste disponible comme Media (toujours seedé), mais
   * sans auto-binding — utile pour A/B test depuis l'admin.
   */
  'kit/image-produit.png': {
    componentKey: 'kit-hero-produit',
    slot: 'primary',
    autoActivate: true,
  },
  'kit/kit-detail-mains.png': { componentKey: 'kit-detail-mains', slot: 'primary' },
  'kit/kit-base.png': { componentKey: 'kit-comparatif', slot: 'kit-base' },
  'kit/kit-fortifiant.png': { componentKey: 'kit-comparatif', slot: 'kit-fortifiant' },
  'kit/kit-lime.png': { componentKey: 'kit-comparatif', slot: 'kit-lime' },
  'kit/hands-sara-avant.png': { componentKey: 'kit-hands-testimonials', slot: 'sara-before' },
  'kit/hands-sara-apres.png': { componentKey: 'kit-hands-testimonials', slot: 'sara-after' },
  'kit/hands-amal-avant.png': { componentKey: 'kit-hands-testimonials', slot: 'amal-before' },
  'kit/hands-amal-apres.png': { componentKey: 'kit-hands-testimonials', slot: 'amal-after' },
  'kit/hands-lina-avant.png': { componentKey: 'kit-hands-testimonials', slot: 'lina-before' },
  'kit/hands-lina-apres.png': { componentKey: 'kit-hands-testimonials', slot: 'lina-after' },
  'kit/og-kit.png': { componentKey: 'kit-og', slot: 'og' },

  /* ───── maison/ ───── */
  'maison/maison-hero.png': { componentKey: 'maison-hero', slot: 'primary' },
  'maison/fondatrice-mains.png': { componentKey: 'maison-fondatrice-mains', slot: 'avatar' },
  'maison/atelier-1.png': { componentKey: 'maison-atelier-gallery', slot: 'atelier-1' },
  'maison/atelier-2.png': { componentKey: 'maison-atelier-gallery', slot: 'atelier-2' },
  'maison/atelier-3.png': { componentKey: 'maison-atelier-gallery', slot: 'atelier-3' },
  'maison/cross-rituel.png': { componentKey: 'maison-cross-links', slot: 'cross-rituel' },
  'maison/cross-kit.png': { componentKey: 'maison-cross-links', slot: 'cross-kit' },
  'maison/cross-journal.png': { componentKey: 'maison-cross-links', slot: 'cross-journal' },
  'maison/og-maison.png': { componentKey: 'maison-og', slot: 'og' },

  /* ───── journal/ ─────
   * Une entrée par article — la cover est utilisée à la fois dans la grille
   * et sur la page d’article. La couverture du « featured » réutilise
   * `cinq-minutes-le-soir` côté homepage par défaut.
   */
  'journal/cinq-minutes-le-soir.png': {
    componentKey: 'journal-article-cinq-minutes-le-soir',
    slot: 'cover',
  },
  'journal/ranger-son-rituel.png': {
    componentKey: 'journal-article-ranger-son-rituel',
    slot: 'cover',
  },
  'journal/voix-de-lina.png': { componentKey: 'journal-article-voix-de-lina', slot: 'cover' },
  'journal/voix-de-sara.png': { componentKey: 'journal-article-voix-de-sara', slot: 'cover' },
  'journal/voix-d-amal.png': { componentKey: 'journal-article-voix-d-amal', slot: 'cover' },
  'journal/la-poudre-de-kaolin.png': {
    componentKey: 'journal-article-la-poudre-de-kaolin',
    slot: 'cover',
  },
  'journal/hiver-ongles-patience.png': {
    componentKey: 'journal-article-hiver-ongles-patience',
    slot: 'cover',
  },
  'journal/avril-soleil-bas.png': {
    componentKey: 'journal-article-avril-soleil-bas',
    slot: 'cover',
  },
  'journal/pluie-de-mars.png': { componentKey: 'journal-article-pluie-de-mars', slot: 'cover' },
  'journal/huile-d-argan-vraie.png': {
    componentKey: 'journal-article-huile-d-argan-vraie',
    slot: 'cover',
  },
  'journal/matieres-d-ailleurs.png': {
    componentKey: 'journal-article-matieres-d-ailleurs',
    slot: 'cover',
  },
  'journal/la-cuisine-comme-laboratoire.png': {
    componentKey: 'journal-article-la-cuisine-comme-laboratoire',
    slot: 'cover',
  },
  'journal/la-table-comme-atelier.png': {
    componentKey: 'journal-article-la-table-comme-atelier',
    slot: 'cover',
  },
  'journal/la-maison-au-printemps.png': {
    componentKey: 'journal-article-la-maison-au-printemps',
    slot: 'cover',
  },
  'journal/visiter-l-atelier.png': {
    componentKey: 'journal-article-visiter-l-atelier',
    slot: 'cover',
  },
  'journal/og-journal.png': { componentKey: 'journal-og', slot: 'og' },
};

/**
 * Assets présents sur disque mais intentionnellement non bindés à un composant.
 * Ils sont quand même importés en `Media` par `seed-media.ts` (utiles pour
 * A/B testing depuis l'admin), mais ne créent pas de binding éditorial.
 *
 * Garde-fou : le test de couverture `seed-mapping.test.ts` ne considère pas
 * ces fichiers comme « unmapped » (donc pas d'échec CI quand ils existent).
 */
export const INTENTIONALLY_UNMAPPED: ReadonlySet<string> = new Set([
  // Hero kit alternatif — l'image active est `kit/image-produit.png` (cf. CHA-243).
  'kit/kit-principale.png',
]);

export function findMappingFor(sourcePath: string): SeedMappingEntry | undefined {
  return IMAGE_TO_COMPONENT[sourcePath];
}

export function listSeedSourcePaths(): string[] {
  return Object.keys(IMAGE_TO_COMPONENT);
}

/**
 * Liste des fichiers présents sous `docs/images/values/` mais NON mappés
 * dans `IMAGE_TO_COMPONENT` (et non listés comme intentionnellement non mappés).
 * Utilisé pour le rapport CLI `--report`.
 */
export function listUnmapped(filesPresent: string[]): string[] {
  return filesPresent.filter(
    (f) => !IMAGE_TO_COMPONENT[f] && !INTENTIONALLY_UNMAPPED.has(f),
  );
}
