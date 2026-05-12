/**
 * Component registry — source de vérité pour le système Component-Media.
 *
 * Chaque entrée décrit un composant du site Next.js qui peut recevoir un (ou
 * plusieurs) media via les `componentMediaBindings`. La synchronisation
 * `sync-registry` upserte ces entrées dans la table `siteComponents`.
 *
 * Convention de clé (`key`) :
 *   `${pageGroup}-${slug-court}` — minuscules, tirets, stable dans le temps.
 *
 * IMPORTANT :
 *   - Ne pas renommer une `key` après seed prod : ce serait perçu comme une
 *     suppression + recréation et les bindings actifs seraient orphelins.
 *   - Pour ajouter un nouveau composant, ajouter ici puis lancer
 *     `pnpm --filter @femiglow/web sync:components`.
 */
import type {
  ComponentCategory,
  ComponentFieldDefinition,
  FetchPriority,
  MediaLoadingStrategy,
  SlotDefinition,
} from '@/lib/db/types';

/**
 * Politique de génération des variants pour un composant.
 * - `default` : breakpoints habituels (sm → 2xl). Convient à la majorité
 *   des sections / heros / covers de page d'article.
 * - `with-thumbnail` : breakpoints habituels + `xs` (320 px). À utiliser
 *   quand l'image est aussi affichée à très petite taille (vignette du
 *   sommaire, mini-card de la grille journal compacte, avatar, etc.).
 * - `thumb-only` : uniquement `xs` + `sm`. Réservé aux images qui ne sont
 *   jamais affichées au-delà de 480 px (badges, picto raster).
 *
 * Cette politique est lue par `seed-pipeline.ts` qui passe les breakpoints
 * appropriés à `optimizeImage`.
 */
export type ComponentVariantPolicy = 'default' | 'with-thumbnail' | 'thumb-only';

export interface SiteComponentSeed {
  key: string;
  name: string;
  description: string;
  category: ComponentCategory;
  pageGroup: 'home' | 'rituel' | 'kit' | 'maison' | 'journal' | 'shared';
  filePath: string;
  slots: SlotDefinition[];
  defaultSvgFallback: string | null;
  defaultLoadingStrategy: MediaLoadingStrategy;
  defaultFetchPriority: FetchPriority;
  supportsAnimation: boolean;
  /**
   * Politique de génération des variants. Défaut : `default` (sm → 2xl).
   * Voir `ComponentVariantPolicy` pour les valeurs possibles.
   */
  variantPolicy?: ComponentVariantPolicy;
  metadata?: Record<string, unknown>;
  /**
   * Champs éditoriaux (Components-CMS). Synchronisés en DB par `seed-pipeline`
   * dans la colonne `site_components.fields`. Source de vérité = ce registre.
   * cf. docs/components-cms/architecture/02-data-model.md
   */
  fields?: ComponentFieldDefinition[];
}

const SLOT_HERO_PRIMARY: SlotDefinition = {
  key: 'primary',
  label: 'Visuel principal',
  required: true,
  acceptKinds: ['image', 'video'],
  aspectRatioHint: '16/9',
  recommendedWidth: 1920,
  description: 'Image (ou vidéo poster) affichée dans le hero, eager.',
};

const SLOT_CARD_COVER: SlotDefinition = {
  key: 'cover',
  label: 'Couverture',
  required: false,
  acceptKinds: ['image'],
  // Le rendu (ArticleCard, CrossLinkCard) utilise un ratio 4:5 verrouillé.
  // On le déclare au niveau du slot pour :
  //   - aligner les <picture> sur ce ratio (côté client),
  //   - autoriser le pipeline à recadrer physiquement les variants.
  aspectRatioHint: '4/5',
  recommendedWidth: 960,
  description: 'Image carte d’article ou de produit, lazy en viewport.',
  // Mode d'adaptation par défaut : `cover` est le bon défaut esthétique
  // (pas de letterbox dans la grille).
  objectFitDefault: 'cover',
  // On demande au pipeline de recadrer physiquement à 4/5 lors du seed
  // (centré ou focal point). Élimine définitivement les triptyques
  // wide-and-short qui s'affichaient en lettrebox.
  cropToAspect: true,
  // Couleur de fond cohérente avec la charte (utile en `contain` pour
  // les rares images qu'un admin voudrait garder entières) — sert aussi
  // pour aplatir la transparence en JPEG (sinon : bord noir).
  backgroundFillDefault: 'creme',
};

const SLOT_GALLERY_ITEM = (index: number, label: string): SlotDefinition => ({
  key: `gallery-${index}`,
  label,
  required: false,
  acceptKinds: ['image'],
  aspectRatioHint: '4/5',
  recommendedWidth: 1080,
  description: `Élément ${index} de la galerie.`,
  // Idem `SLOT_CARD_COVER` : on impose le crop physique au seed pour
  // homogénéiser la grille (3 portraits 4/5 alignés, jamais de lettrebox).
  objectFitDefault: 'cover',
  cropToAspect: true,
  backgroundFillDefault: 'creme',
});

const SLOT_TESTIMONIAL_BEFORE: SlotDefinition = {
  key: 'before',
  label: 'Avant',
  required: false,
  acceptKinds: ['image'],
  aspectRatioHint: '1/1',
  recommendedWidth: 720,
};

const SLOT_TESTIMONIAL_AFTER: SlotDefinition = {
  key: 'after',
  label: 'Après',
  required: false,
  acceptKinds: ['image'],
  aspectRatioHint: '1/1',
  recommendedWidth: 720,
};

const SLOT_AVATAR: SlotDefinition = {
  key: 'avatar',
  label: 'Portrait',
  required: false,
  acceptKinds: ['image'],
  aspectRatioHint: '1/1',
  recommendedWidth: 480,
};

const SLOT_VIDEO_POSTER: SlotDefinition = {
  key: 'poster',
  label: 'Poster vidéo',
  required: false,
  acceptKinds: ['image'],
  aspectRatioHint: '16/9',
  recommendedWidth: 1920,
};

const SLOT_VIDEO_SOURCE: SlotDefinition = {
  key: 'video',
  label: 'Source vidéo',
  required: false,
  acceptKinds: ['video'],
  aspectRatioHint: '16/9',
  recommendedWidth: 1920,
};

export const SITE_COMPONENT_REGISTRY: SiteComponentSeed[] = [
  /* ───── Home ───── */
  {
    key: 'home-hero',
    name: 'Hero Accueil',
    description: 'Hero principal de la page d’accueil, image eager + animation reveal-up.',
    category: 'hero',
    pageGroup: 'home',
    filePath: 'src/components/sections/Hero.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/journal/hero-accueil.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
    // P12 — pilote Components-CMS. Cf. catalog/home-hero.md.
    // Convention defaultValue : valeur DÉCODÉE pour les scalaires (text, multiline,
    // kicker…), valeur structurée pour les composés (cta, link, quote, etc.).
    // La cascade `default` renvoie `fieldDef.defaultValue` tel quel sans décodage.
    fields: [
      {
        key: 'kicker',
        label: 'Kicker (sur-titre)',
        type: 'kicker',
        required: false,
        defaultValue: 'Maison de Rabat',
        description:
          'Sur-titre court affiché au-dessus du H1, traité visuellement en champagne.',
        group: 'Header',
        order: 1,
        config: { maxLength: 30 },
      },
      {
        key: 'title',
        label: 'Titre principal',
        type: 'text',
        required: true,
        defaultValue: 'Le rituel ongles, en cinq minutes.',
        description: 'H1 de la page. Tient en deux lignes sur mobile.',
        group: 'Header',
        order: 2,
        config: { maxLength: 70 },
      },
      {
        key: 'subtitle',
        label: 'Sous-titre',
        type: 'multiline',
        required: false,
        defaultValue:
          'Trois gestes, une saison. Une beauté lente, ancrée au Maroc.',
        description: 'Phrase d’accroche éditoriale, deux à trois lignes max.',
        group: 'Header',
        order: 3,
        config: { maxLength: 200 },
      },
      {
        key: 'cta',
        label: 'Bouton principal',
        type: 'cta',
        required: false,
        defaultValue: {
          label: 'Découvrir le rituel',
          href: '/rituel',
          variant: 'primary',
        },
        description: 'CTA de conversion. Vise une page-group du site.',
        group: 'CTA',
        order: 4,
        config: { variants: ['primary', 'secondary'] },
      },
      {
        key: 'ctaSecondary',
        label: 'Bouton secondaire',
        type: 'cta',
        required: false,
        defaultValue: {
          label: 'Voir le kit',
          href: '/kit',
          variant: 'link',
        },
        description: 'CTA inline discret, à côté du primaire.',
        group: 'CTA',
        order: 5,
        config: { variants: ['link', 'ghost'] },
      },
    ],
  },
  {
    key: 'home-avis-strip',
    name: 'Bandeau Avis',
    description: 'Trois portraits clientes en bandeau horizontal, lazy viewport.',
    category: 'banner',
    pageGroup: 'home',
    filePath: 'src/components/sections/AvisStrip.tsx',
    slots: [
      { ...SLOT_GALLERY_ITEM(1, 'Avis Yasmine'), key: 'avis-yasmine' },
      { ...SLOT_GALLERY_ITEM(2, 'Avis Salma'), key: 'avis-salma' },
      { ...SLOT_GALLERY_ITEM(3, 'Avis Inès'), key: 'avis-ines' },
    ],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    variantPolicy: 'with-thumbnail',
    metadata: { animationProfile: 'fade-in' },
    // Cf. catalog/home-avis-strip.md (C3).
    // L'image des témoins reste portée par les slots Component-Media
    // (`avis-yasmine`/`avis-salma`/`avis-ines`) — pas dans les fields.
    // TODO: ramener `maxItems` à 3 tant que `homepageContentSchema.avis.max(3)`.
    fields: [
      {
        key: 'kicker',
        label: 'Kicker (sur-titre)',
        type: 'kicker',
        required: false,
        defaultValue: 'Voix',
        description: 'Sur-titre court de la section.',
        group: 'Header',
        order: 1,
        config: { maxLength: 30 },
      },
      {
        key: 'heading',
        label: 'Titre de section',
        type: 'text',
        required: false,
        defaultValue: 'Celles qui ont essayé.',
        description: 'H2 italique de la section.',
        group: 'Header',
        order: 2,
        config: { maxLength: 60 },
      },
      {
        key: 'reviews',
        label: 'Témoignages',
        type: 'list',
        required: true,
        defaultValue: {
          items: [
            {
              fields: {
                id: { v: 't1' },
                authorFirstName: { v: 'Salma' },
                authorContext: { v: 'Casablanca' },
                initieeDepuis: { v: 'Janvier 2025' },
                quote: {
                  v: 'Mes ongles ne cassent plus depuis trois mois. Je ne pensais pas que cinq minutes le soir suffiraient.',
                },
              },
            },
            {
              fields: {
                id: { v: 't2' },
                authorFirstName: { v: 'Yasmine' },
                authorContext: { v: 'Rabat' },
                initieeDepuis: { v: 'Mars 2024' },
                quote: {
                  v: 'C’est devenu un moment pour moi. Le rituel rythme ma fin de journée.',
                },
              },
            },
            {
              fields: {
                id: { v: 't3' },
                authorFirstName: { v: 'Inès' },
                authorContext: { v: 'Marrakech' },
                initieeDepuis: { v: 'Octobre 2023' },
                quote: {
                  v: 'La base a une finition naturelle qui me ressemble enfin.',
                },
              },
            },
          ],
        },
        description:
          'Trois portraits clientes (prénom, contexte, citation). Min 3, max 8 (à ramener à 3 tant que le RSC ne gère pas plus).',
        group: 'Reviews',
        order: 3,
        config: {
          minItems: 3,
          maxItems: 8,
          itemType: 'record',
          itemConfig: {
            shape: {
              id: { type: 'text', required: true, config: { maxLength: 40 } },
              authorFirstName: {
                type: 'text',
                required: true,
                config: { maxLength: 40 },
              },
              authorContext: {
                type: 'text',
                required: false,
                config: { maxLength: 60 },
              },
              quote: {
                type: 'multiline',
                required: true,
                config: { maxLength: 240 },
              },
              initieeDepuis: {
                type: 'text',
                required: false,
                config: { maxLength: 40 },
              },
              rating: {
                type: 'number',
                required: false,
                config: { min: 1, max: 5, step: 1 },
              },
            },
          },
        },
      },
      {
        key: 'cta',
        label: 'CTA bas de section',
        type: 'cta',
        required: false,
        defaultValue: null,
        description:
          'Lien optionnel vers `/rituel` ou un article. À ajouter au RSC en migration.',
        group: 'CTA',
        order: 4,
        config: { variants: ['link', 'ghost'] },
      },
    ],
  },
  {
    key: 'home-og',
    name: 'OG Accueil',
    description: 'Image Open Graph de la page d’accueil.',
    category: 'media-block',
    pageGroup: 'home',
    filePath: 'src/app/page.tsx',
    slots: [{ ...SLOT_HERO_PRIMARY, key: 'og', label: 'Image OG', aspectRatioHint: '1.91/1' }],
    defaultSvgFallback: '/og/home.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
  },

  /* ───── Rituel ───── */
  {
    key: 'rituel-hero-lifestyle',
    name: 'Hero Rituel (lifestyle)',
    description: 'Hero éditorial de la page rituel.',
    category: 'hero',
    pageGroup: 'rituel',
    filePath: 'src/components/sections/HeroLifestyle.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/rituel/hero-lifestyle.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: { animationProfile: 'parallax-soft' },
  },
  {
    key: 'rituel-portrait-salma',
    name: 'Portrait Souheila',
    description: 'Portrait éditorial de la fondatrice, intégré dans la lettre (avatar rond ≤ 480 px).',
    category: 'card',
    pageGroup: 'rituel',
    filePath: 'src/components/sections/EditorialLetter.tsx',
    slots: [SLOT_AVATAR],
    defaultSvgFallback: '/rituel/portrait-salma.svg',
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    variantPolicy: 'with-thumbnail',
    metadata: { animationProfile: 'fade-in' },
  },
  {
    key: 'rituel-origine-sepia',
    name: 'Origine sépia',
    description: 'Image sépia accompagnant la section origine.',
    category: 'section',
    pageGroup: 'rituel',
    filePath: 'src/components/sections/SectionNarrative.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/rituel/origine-sepia.svg',
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'rituel-video-4-gestes',
    name: 'Vidéo 4 gestes',
    description: 'Vidéo démonstration des 4 gestes (poster + mp4/webm).',
    category: 'media-block',
    pageGroup: 'rituel',
    filePath: 'src/components/sections/VideoPlayer4Gestes.tsx',
    slots: [SLOT_VIDEO_POSTER, SLOT_VIDEO_SOURCE],
    defaultSvgFallback: '/videos/rituel-poster.svg',
    defaultLoadingStrategy: 'interaction',
    defaultFetchPriority: 'low',
    supportsAnimation: false,
  },
  {
    key: 'rituel-og',
    name: 'OG Rituel',
    description: 'Image Open Graph rituel.',
    category: 'media-block',
    pageGroup: 'rituel',
    filePath: 'src/app/rituel/page.tsx',
    slots: [{ ...SLOT_HERO_PRIMARY, key: 'og', label: 'Image OG' }],
    defaultSvgFallback: '/og/rituel.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
  },

  /* ───── Kit ───── */
  {
    key: 'kit-hero-produit',
    name: 'Hero Kit (produit)',
    description: 'Hero produit — packshot principal eager.',
    category: 'hero',
    pageGroup: 'kit',
    filePath: 'src/components/sections/HeroProduit.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/products/kit-principale.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: { animationProfile: 'scale-hover' },
  },
  {
    key: 'kit-detail-mains',
    name: 'Kit — détail mains',
    description: 'Image macro mains/kit pour la section détail.',
    category: 'section',
    pageGroup: 'kit',
    filePath: 'src/components/sections/IngredientsDetails.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/products/kit-detail-mains.svg',
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'kit-comparatif',
    name: 'Comparatif Kit (3 produits)',
    description: 'Trois packshots — Base, Fortifiant, Lime.',
    category: 'gallery',
    pageGroup: 'kit',
    filePath: 'src/components/sections/ComparatifSection.tsx',
    slots: [
      { ...SLOT_GALLERY_ITEM(1, 'Kit Base'), key: 'kit-base' },
      { ...SLOT_GALLERY_ITEM(2, 'Kit Fortifiant'), key: 'kit-fortifiant' },
      { ...SLOT_GALLERY_ITEM(3, 'Kit Lime'), key: 'kit-lime' },
    ],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'fade-in' },
  },
  {
    key: 'kit-hands-testimonials',
    name: 'Avis mains (avant/après)',
    description: 'Témoignages mains avant/après pour Sara, Lina, Amal.',
    category: 'gallery',
    pageGroup: 'kit',
    filePath: 'src/components/sections/HandsTestimonials.tsx',
    slots: [
      { ...SLOT_TESTIMONIAL_BEFORE, key: 'sara-before', label: 'Sara avant' },
      { ...SLOT_TESTIMONIAL_AFTER, key: 'sara-after', label: 'Sara après' },
      { ...SLOT_TESTIMONIAL_BEFORE, key: 'lina-before', label: 'Lina avant' },
      { ...SLOT_TESTIMONIAL_AFTER, key: 'lina-after', label: 'Lina après' },
      { ...SLOT_TESTIMONIAL_BEFORE, key: 'amal-before', label: 'Amal avant' },
      { ...SLOT_TESTIMONIAL_AFTER, key: 'amal-after', label: 'Amal après' },
    ],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'kit-og',
    name: 'OG Kit',
    description: 'Image Open Graph kit.',
    category: 'media-block',
    pageGroup: 'kit',
    filePath: 'src/app/kit/page.tsx',
    slots: [{ ...SLOT_HERO_PRIMARY, key: 'og', label: 'Image OG' }],
    defaultSvgFallback: '/og/kit.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
  },

  /* ───── Maison ───── */
  {
    key: 'maison-hero',
    name: 'Hero Maison',
    description: 'Hero éditorial de la page maison.',
    category: 'hero',
    pageGroup: 'maison',
    filePath: 'src/components/sections/HeroMaison.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/maison/origine.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: { animationProfile: 'parallax-soft' },
  },
  {
    key: 'maison-fondatrice-mains',
    name: 'Fondatrice — mains',
    description: 'Portrait de la fondatrice (mains) — affiché en avatar côté section.',
    category: 'section',
    pageGroup: 'maison',
    filePath: 'src/components/sections/Manifeste.tsx',
    slots: [SLOT_AVATAR],
    defaultSvgFallback: '/maison/fondatrice-mains.svg',
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    variantPolicy: 'with-thumbnail',
    metadata: { animationProfile: 'fade-in' },
  },
  {
    key: 'maison-atelier-gallery',
    name: 'Galerie Atelier',
    description: 'Trois vues de l’atelier (céramique, plantes, plan de travail).',
    category: 'gallery',
    pageGroup: 'maison',
    filePath: 'src/components/sections/AtelierGallery.tsx',
    slots: [
      { ...SLOT_GALLERY_ITEM(1, 'Atelier 1'), key: 'atelier-1' },
      { ...SLOT_GALLERY_ITEM(2, 'Atelier 2'), key: 'atelier-2' },
      { ...SLOT_GALLERY_ITEM(3, 'Atelier 3'), key: 'atelier-3' },
    ],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'maison-cross-links',
    name: 'Cross-links Maison',
    description:
      'Triptyque de cross-links vers Rituel/Kit/Journal. Mêmes images réutilisées en vignettes 88×88 dans le sommaire ; on génère donc aussi le variant xs.',
    category: 'banner',
    pageGroup: 'maison',
    filePath: 'src/components/sections/CrossLinkTriptyque.tsx',
    slots: [
      { ...SLOT_CARD_COVER, key: 'cross-rituel', label: 'Cross-link Rituel' },
      { ...SLOT_CARD_COVER, key: 'cross-kit', label: 'Cross-link Kit' },
      { ...SLOT_CARD_COVER, key: 'cross-journal', label: 'Cross-link Journal' },
    ],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    variantPolicy: 'with-thumbnail',
    metadata: { animationProfile: 'cross-link' },
    // Cf. catalog/maison-cross-links.md (C4).
    // L'image de chaque carte reste portée par les slots Component-Media
    // (`cross-rituel`/`cross-kit`/`cross-journal`) — pas dans les fields.
    // TODO: maxItems ramené à 3 tant que le design n'absorbe pas 2/4/6.
    fields: [
      {
        key: 'heading',
        label: 'Titre de section',
        type: 'text',
        required: false,
        defaultValue: null,
        description:
          'H2 optionnel au-dessus du triptyque. À ajouter au RSC `CrossLinkTriptyque.tsx` lors de la migration.',
        group: 'Header',
        order: 1,
        config: { maxLength: 60 },
      },
      {
        key: 'intro',
        label: 'Phrase d’introduction',
        type: 'multiline',
        required: false,
        defaultValue: null,
        description:
          'Phrase courte au-dessus des cartes. À ajouter au RSC lors de la migration.',
        group: 'Header',
        order: 2,
        config: { maxLength: 200 },
      },
      {
        key: 'links',
        label: 'Cartes',
        type: 'list',
        required: true,
        defaultValue: {
          items: [
            {
              fields: {
                id: { v: 'rituel' },
                kicker: { v: 'Le rituel' },
                label: { v: 'Lire le rituel' },
                description: null,
                href: {
                  href: '/rituel',
                  label: 'Lire le rituel',
                  external: false,
                },
              },
            },
            {
              fields: {
                id: { v: 'journal' },
                kicker: { v: 'Le journal' },
                label: { v: 'Le journal' },
                description: null,
                href: {
                  href: '/journal',
                  label: 'Le journal',
                  external: false,
                },
              },
            },
            {
              fields: {
                id: { v: 'kit' },
                kicker: { v: 'Le kit' },
                label: { v: 'Voir le kit' },
                description: null,
                href: { href: '/kit', label: 'Voir le kit', external: false },
              },
            },
          ],
        },
        description:
          'Cartes de cross-link. `id` jointe vers le slot media (`cross-<id>`). Min 2, max 3 (le design actuel n’en absorbe pas plus).',
        group: 'Cards',
        order: 3,
        config: {
          minItems: 2,
          maxItems: 3,
          itemType: 'record',
          itemConfig: {
            shape: {
              id: { type: 'text', required: true, config: { maxLength: 40 } },
              kicker: {
                type: 'kicker',
                required: false,
                config: { maxLength: 30 },
              },
              label: {
                type: 'text',
                required: true,
                config: { maxLength: 50 },
              },
              description: {
                type: 'multiline',
                required: false,
                config: { maxLength: 200 },
              },
              href: {
                type: 'link',
                required: true,
                config: { allowedHrefSchemes: ['http', 'https'] },
              },
              icon: {
                type: 'icon',
                required: false,
                config: { iconRegistry: 'femiglow-curated' },
              },
            },
          },
        },
      },
    ],
  },
  {
    key: 'maison-og',
    name: 'OG Maison',
    description: 'Image Open Graph maison.',
    category: 'media-block',
    pageGroup: 'maison',
    filePath: 'src/app/maison/page.tsx',
    slots: [{ ...SLOT_HERO_PRIMARY, key: 'og', label: 'Image OG' }],
    defaultSvgFallback: '/og/home.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
  },

  /* ───── Journal — hero & shared ───── */
  {
    key: 'journal-hero',
    name: 'Hero Journal',
    description: 'Hero de l’index journal.',
    category: 'hero',
    pageGroup: 'journal',
    filePath: 'src/components/sections/JournalHero.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/journal/hero-accueil.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'journal-featured',
    name: 'Article mis en avant',
    description: 'Article éditorial mis en avant — image de couverture grande.',
    category: 'card',
    pageGroup: 'journal',
    filePath: 'src/components/sections/FeaturedArticle.tsx',
    slots: [SLOT_HERO_PRIMARY],
    defaultSvgFallback: '/journal/cinq-minutes-le-soir.svg',
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: { animationProfile: 'reveal-up' },
  },
  {
    key: 'journal-og',
    name: 'OG Journal',
    description: 'Image Open Graph journal.',
    category: 'media-block',
    pageGroup: 'journal',
    filePath: 'src/app/journal/page.tsx',
    slots: [{ ...SLOT_HERO_PRIMARY, key: 'og', label: 'Image OG' }],
    defaultSvgFallback: '/og/journal.svg',
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
  },

  /* ───── Journal — articles individuels ─────
   * Une entrée par article, pour piloter sa cover (grid + page d’article).
   *
   * Cf. catalog/journal-article.md (C5). Le périmètre Components-CMS porte
   * uniquement sur les libellés **structurels et partagés** entre tous les
   * articles (toc, related, share, fallback bio, dropCap, heroQuote, breadcrumb).
   * Les champs **per-article** (kicker, title, body, excerpt, author, …)
   * restent dans la table `articles` — pas exposés ici.
   */
];

/**
 * Fields communs à tous les composants `journal-article-<slug>` — libellés
 * structurels partagés. Cf. catalog/journal-article.md.
 *
 * TODO (post-migration des 4 TBD du catalogue) : remplacer chaque
 * `defaultValue` par le **littéral exact** lu dans `TableOfContents.tsx`,
 * `RelatedArticles.tsx`, `ShareButtons.tsx`, `AuthorCard.tsx`.
 */
const JOURNAL_ARTICLE_FIELDS: ComponentFieldDefinition[] = [
  {
    key: 'tocHeading',
    label: 'Titre du sommaire',
    type: 'text',
    required: false,
    defaultValue: 'Sur cette page',
    description:
      'Libellé au-dessus du ToC en sidebar (xl+). TBD : confirmer dans `TableOfContents.tsx`.',
    group: 'Sidebar',
    order: 1,
    config: { maxLength: 30 },
  },
  {
    key: 'relatedHeading',
    label: 'Titre related',
    type: 'text',
    required: false,
    defaultValue: 'À lire ensuite',
    description:
      'H2 au-dessus du bloc related. TBD : valeur exacte à reprendre de `RelatedArticles.tsx`.',
    group: 'Related',
    order: 2,
    config: { maxLength: 40 },
  },
  {
    key: 'relatedLimit',
    label: 'Nombre d’articles related',
    type: 'number',
    required: false,
    defaultValue: 3,
    description:
      'Code en dur `slice(0, 3)` dans `journal/[slug]/page.tsx`. À paramétrer.',
    group: 'Related',
    order: 3,
    config: { min: 1, max: 6, step: 1 },
  },
  {
    key: 'shareLabel',
    label: 'Libellé share',
    type: 'text',
    required: false,
    defaultValue: 'Partager',
    description:
      'Libellé au-dessus des boutons de partage. TBD : confirmer dans `ShareButtons.tsx`.',
    group: 'Share',
    order: 4,
    config: { maxLength: 30 },
  },
  {
    key: 'authorFallbackBio',
    label: 'Bio par défaut auteur',
    type: 'multiline',
    required: false,
    defaultValue: 'Plume invitée de la maison FemiGlow.',
    description:
      'Bio affichée si l’article n’a pas de `author.bio`. TBD : confirmer dans `AuthorCard.tsx`.',
    group: 'Author',
    order: 5,
    config: { maxLength: 240 },
  },
  {
    key: 'dropCap',
    label: 'Lettrine activée',
    type: 'boolean',
    required: false,
    defaultValue: true,
    description:
      'Active la lettrine sur le premier paragraphe (`ArticleProse.tsx`, prop `dropCap`).',
    group: 'Body',
    order: 6,
  },
  {
    key: 'heroQuote',
    label: 'Citation héro layout',
    type: 'quote',
    required: false,
    defaultValue: null,
    description:
      'Citation optionnelle insérée entre le hero et le corps, activée globalement (événement éditorial). N’est PAS la citation per-article (qui vit dans le body).',
    group: 'Hero',
    order: 7,
  },
  {
    key: 'breadcrumbRoot',
    label: 'Segment racine fil d’ariane',
    type: 'breadcrumb-segment',
    required: false,
    defaultValue: { label: 'Journal', href: '/journal' },
    description:
      'Premier segment du fil d’ariane après « Accueil » — codé en dur dans `journal/[slug]/page.tsx`.',
    group: 'Breadcrumb',
    order: 8,
  },
];

const JOURNAL_ARTICLES: ReadonlyArray<readonly [string, string]> = [
  ['cinq-minutes-le-soir', 'Cinq minutes le soir'],
  ['ranger-son-rituel', 'Ranger son rituel'],
  ['voix-de-lina', 'Voix de Lina'],
  ['voix-de-sara', 'Voix de Sara'],
  ['voix-d-amal', 'Voix d’Amal'],
  ['la-poudre-de-kaolin', 'La poudre de kaolin'],
  ['hiver-ongles-patience', 'Hiver, ongles, patience'],
  ['avril-soleil-bas', 'Avril, soleil bas'],
  ['pluie-de-mars', 'Pluie de mars'],
  ['huile-d-argan-vraie', 'Huile d’argan vraie'],
  ['matieres-d-ailleurs', 'Matières d’ailleurs'],
  ['la-cuisine-comme-laboratoire', 'La cuisine comme laboratoire'],
  ['la-table-comme-atelier', 'La table comme atelier'],
  ['la-maison-au-printemps', 'La maison au printemps'],
  ['visiter-l-atelier', 'Visiter l’atelier'],
];

for (const [slug, name] of JOURNAL_ARTICLES) {
  SITE_COMPONENT_REGISTRY.push({
    key: `journal-article-${slug}`,
    name: `Article — ${name}`,
    description: `Cover éditoriale pour l’article « ${name} » — utilisée en carte standard ET en mini-card 160 px (grille asymétrique).`,
    category: 'card',
    pageGroup: 'journal',
    filePath: 'src/components/sections/ArticleCard.tsx',
    slots: [SLOT_CARD_COVER],
    defaultSvgFallback: `/journal/${slug}.svg`,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    variantPolicy: 'with-thumbnail',
    metadata: { articleSlug: slug, animationProfile: 'reveal-up' },
    fields: JOURNAL_ARTICLE_FIELDS,
  });
}

export function findComponentSeed(key: string): SiteComponentSeed | undefined {
  return SITE_COMPONENT_REGISTRY.find((c) => c.key === key);
}

export function listComponentKeys(): string[] {
  return SITE_COMPONENT_REGISTRY.map((c) => c.key);
}
