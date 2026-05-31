import type { KitPageContent } from '@/lib/schemas';
import { mockKit } from './product';
import { mockRituel } from './rituel';
import {
  DEFAULT_KIT_VIDEO_COVER_ARIA_LABEL,
  DEFAULT_KIT_VIDEO_COVER_SVG,
} from './kit-video-cover';

/**
 * Audit 08/09 — Pack FemiGlow : composition refondue (paste / powder /
 * polissoir Step 4), comparatif ajusté, témoignages redistribués
 * (Rabat centre de gravité).
 */
export const mockKitPageContent: KitPageContent = {
  product: mockKit,
  composition: [
    {
      id: '1-paste',
      name: '1 Paste',
      sensation: 'Tiède au contact.',
      accentColor: 'sauge',
      shortDescription:
        'Pâte crème onctueuse. Filme la plaque sans l\u2019étouffer. Une noisette suffit.',
      volume: '15 g',
      usageHint: 'une noisette filme dix doigts',
      narrative:
        '12 % de cire d’abeille fondue à basse température par la coopérative apicole du Moyen Atlas. Trois minutes de pose, le fini est mat.',
      image: {
        src: '/products/kit-base.svg',
        alt: 'Pot carré transparent à bords facettés, étiquette circulaire vert sauge "1 paste", pâte crème onctueuse',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Cire d\u2019abeille',
          inci: 'Cera Alba',
          function: 'Filmog\u00e8ne naturel',
          origin: 'Coop\u00e9rative apicole, Atlas marocain',
          concentrationPct: 12,
          inciDefinition:
            'Nom officiel de la cire d\u2019abeille pure. Filme l\u2019ongle sans le sceller, laisse respirer la plaque.',
        },
        {
          name: 'Huile de jojoba',
          inci: 'Simmondsia Chinensis Seed Oil',
          function: 'H\u00e9misphage des cuticules',
          origin: 'Cultures biologiques, Souss-Massa',
          concentrationPct: 8,
          inciDefinition:
            'Cire v\u00e9g\u00e9tale liquide, proche du s\u00e9bum naturel. Assouplit les cuticules sans graisser.',
        },
        {
          name: 'Tocoph\u00e9rol',
          inci: 'Tocopherol',
          function: 'Antioxydant',
          origin: 'Origine v\u00e9g\u00e9tale, Europe',
          concentrationPct: 0.5,
          inciDefinition:
            'Vitamine E d\u2019origine v\u00e9g\u00e9tale. Pr\u00e9serve les huiles de la formule du rancissement.',
        },
      ],
      certifications: [
        { label: 'Cosmos Organic', body: 'Ecocert' },
        { label: 'Vegan', body: 'EVE Vegan' },
      ],
    },
    {
      id: '2-powder',
      name: '2 Powder',
      sensation: 'Glisse, ne grise pas.',
      accentColor: 'petale',
      shortDescription:
        'Poudre fine blanche, déposée sur la paste. Absorbe l\u2019excès, lustre la surface.',
      volume: '8 g',
      usageHint: 'une pincée lustre toute la main',
      narrative:
        'Poudre minérale fine, déposée juste après la paste. Le talc absorbe le surplus, la silice lustre la surface. Pas de blanc, pas de gris.',
      image: {
        src: '/products/kit-fortifiant.svg',
        alt: 'Pot carré transparent à bords facettés, étiquette circulaire rose poudré "2 powder", poudre fine blanche',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Talc cosm\u00e9tique',
          inci: 'Talc',
          function: 'Matifiant min\u00e9ral',
          origin: 'Maroc',
          concentrationPct: 60,
          inciDefinition:
            'Silicate de magn\u00e9sium pur, lav\u00e9 et tamis\u00e9. Matifie sans gercer la plaque.',
        },
        {
          name: 'Poudre de riz',
          inci: 'Oryza Sativa Powder',
          function: 'Absorbant doux',
          origin: 'Asie biologique',
          concentrationPct: 30,
          inciDefinition:
            'Amidon de riz finement broy\u00e9. Absorbe le surplus de paste sans dess\u00e9cher.',
        },
        {
          name: 'Silice',
          inci: 'Silica',
          function: 'Texture & glissant',
          origin: 'Origine min\u00e9rale, Europe',
          concentrationPct: 10,
          inciDefinition:
            'Forme cosm\u00e9tique du silicate. Donne la glisse et r\u00e9v\u00e8le la brillance au polissage.',
        },
      ],
      certifications: [
        { label: 'Cosmos Organic', body: 'Ecocert' },
      ],
    },
    {
      id: 'polissoir-step-4',
      name: 'Polissoir Step 4 — Polish & Shine',
      shortDescription:
        'Polissoir rectangulaire bleu ciel. Trois faces, trois grains. Révèle la brillance naturelle.',
      volume: '90 mm',
      sensation: 'La lumière revient à la surface.',
      accentColor: 'ciel',
      usageHint: 'six mois de polissage doux',
      narrative:
        'Polissoir trois faces, du plus rugueux au plus doux. La dernière face révèle la brillance, sans solvant ni vernis. Se rince à l’eau tiède.',
      image: {
        src: '/products/kit-lime.svg',
        alt: 'Polissoir rectangulaire bleu ciel et gris clair, marqué "Step 4 Polish & Shine", trois faces de polissage',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Mousse polyur\u00e9thane haute densit\u00e9',
          inci: 'Polyurethane Foam',
          function: 'Support',
          origin: 'Europe',
          inciDefinition:
            'Mousse synth\u00e9tique haute densit\u00e9, support structurel du polissoir. Lavable, durable, n\u2019absorbe pas la poudre.',
        },
        {
          name: 'Poudre de kaolin polissant',
          inci: 'Kaolin',
          function: 'Argile douce',
          origin: 'Carri\u00e8re, Marrakech',
          inciDefinition:
            'Argile blanche fine extraite localement. Polit sans rayer, r\u00e9v\u00e8le la brillance naturelle de l\u2019ongle.',
        },
        {
          name: 'Encre cosm\u00e9tique Step 4 Polish & Shine',
          inci: 'Cosmetic Ink',
          function: 'Marquage sans solvant',
          origin: 'Europe',
          inciDefinition:
            'Encre \u00e0 base d\u2019eau, sans solvant ni m\u00e9tal lourd. Marque le grain sans contaminer le polissage.',
        },
      ],
      certifications: [],
    },
  ],
  // CHA-243 — Vidéo hero kit servie via YouTube (Short vertical).
  // Le composant `VideoPlayer4Gestes` détecte `youtubeUrl` et délègue à
  // `<YouTubeEmbed>` (iframe `youtube-nocookie.com`). Les `sources` mp4/webm
  // restent renseignées pour compat schéma + fallback futur si l'URL YouTube
  // devient invalide (parseYouTubeUrl → null → variante self-hosted).
  videoSrc: {
    ...mockRituel.videoGestes,
    youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb',
    posterCoverSvg: {
      source: 'inline' as const,
      inline: DEFAULT_KIT_VIDEO_COVER_SVG,
      meta: { ariaLabel: DEFAULT_KIT_VIDEO_COVER_ARIA_LABEL },
    },
  },
  comparatif: {
    titreVernis: 'Vernis classique',
    titreRituel: 'Pack FemiGlow',
    rows: [
      {
        axis: 'Pr\u00e9paration',
        vernis: 'D\u00e9graissage \u00e0 l\u2019ac\u00e9tone, surface lisse forc\u00e9e.',
        rituel: 'Nettoyage doux, observation de la plaque, sans solvant agressif.',
      },
      {
        axis: 'Tenue',
        vernis: '5 \u00e0 7 jours sur ongle pr\u00e9par\u00e9, retouches fr\u00e9quentes.',
        rituel: 'Pas de tenue color\u00e9e\u202F: l\u2019ongle reste tel qu\u2019il est, soutenu jour apr\u00e8s jour.',
      },
      {
        axis: 'R\u00e9cup\u00e9ration',
        vernis: 'Ongle d\u00e9shydrat\u00e9 sous la couche, parfois fragilis\u00e9.',
        rituel: 'Plaque hydrat\u00e9e, cuticules souples, polissage au kaolin Step 4.',
      },
      {
        axis: 'Co\u00fbt annuel',
        vernis: 'Vernis + dissolvant + cures r\u00e9paratrices, env. 1\u202F500 dh.',
        rituel: 'Un pack FemiGlow \u00e0 199 dh tient quatre \u00e0 cinq mois. Soit environ 500 dh par an.',
      },
      {
        axis: 'Impact mati\u00e8re',
        vernis: 'Solvants volatils, formules \u00e0 base p\u00e9trochimique fr\u00e9quente.',
        rituel:
          'Cire d\u2019abeille, jojoba, talc min\u00e9ral, riz, kaolin. Certification Cosmos Organic.',
      },
      {
        axis: 'Temps quotidien',
        vernis: 'Application 20 min, s\u00e9chage long, retouches.',
        rituel: 'Cinq minutes par jour, geste lent, sans s\u00e9chage forc\u00e9.',
      },
    ],
  },
  faq: [
    {
      id: 'duree-pack',
      question: 'Combien de temps dure un pack\u202F?',
      answer:
        'En usage quotidien, le pack tient quatre \u00e0 cinq mois. La paste se vide en premier, la powder suit. Le polissoir dure environ un an. Nous proposons des recharges \u00e0 partir de l\u2019automne 2026.',
    },
    {
      id: 'frequence',
      question: '\u00c0 quelle fr\u00e9quence appliquer\u202F?',
      answer:
        'Tous les soirs si vous le pouvez, en cinq minutes. Si vous sautez un jour, ce n\u2019est pas grave\u202F: la maison accueille la pause comme elle accueille le retour.',
    },
    {
      id: 'compatibilite-vernis',
      question: 'Puis-je continuer \u00e0 porter du vernis\u202F?',
      answer:
        'Le rituel s\u2019accommode du vernis m\u00eame s\u2019il est pens\u00e9 pour s\u2019en passer. Appliquez la paste et la powder les soirs sans vernis. La plaque respire, le rituel installe sa lenteur.',
    },
    {
      id: 'grossesse',
      question: 'Le rituel convient-il pendant la grossesse\u202F?',
      answer:
        'Toutes les formules sont sans solvants volatils, sans phtalates, sans toluene. Nous recommandons d\u2019\u00e9changer avec votre m\u00e9decin\u202F: le soin se construit en confiance.',
    },
    {
      id: 'expedition',
      question: 'Quels sont les d\u00e9lais de livraison\u202F?',
      answer:
        'Rabat\u202F: 24 h. Reste du Maroc\u202F: 48 \u00e0 72 h. Livraison offerte. International\u202F: nous \u00e9tudions chaque destination, l\u2019envoi se fait par DHL avec suivi.',
    },
    {
      id: 'retours',
      question: 'Puis-je retourner le pack\u202F?',
      answer:
        'Oui, sous trente jours, m\u00eame entam\u00e9. Vous nous \u00e9crivez deux lignes \u00e0 info@femiglow-maroc.com, nous reprenons le pack. Remboursement sous cinq jours ouvr\u00e9s.',
    },
    {
      id: 'allergies',
      question: 'Et si je suis allergique \u00e0 un ingr\u00e9dient\u202F?',
      answer:
        'Chaque formule liste son INCI complet sur cette page et sur l\u2019\u00e9tiquette du pot. En cas de doute, nous vous adressons un \u00e9chantillon avant l\u2019envoi du pack complet.',
    },
    {
      id: 'adolescentes',
      question: 'Le rituel est-il adapt\u00e9 aux adolescentes\u202F?',
      answer:
        'Oui, \u00e0 partir de quatorze ans. Les formules sont douces, les gestes simples. C\u2019est souvent un premier rendez-vous avec le soin lent.',
    },
  ],
  handsTestimonials: [
    {
      id: 'amal',
      authorFirstName: 'Amal',
      city: 'Rabat',
      quote:
        'Trois mois, et l\u2019ongle a retrouv\u00e9 sa nervure. J\u2019ai cess\u00e9 de le forcer.',
      beforeImage: {
        src: '/testimonials/hands-amal-avant.svg',
        alt: 'Mains d\u2019Amal avant le rituel, ongles courts et stri\u00e9s',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-amal-apres.svg',
        alt: 'Mains d\u2019Amal apr\u00e8s trois mois, ongles allong\u00e9s et lisses',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'F\u00e9vrier 2026',
    },
    {
      id: 'lina',
      authorFirstName: 'Lina',
      city: 'Casablanca',
      quote:
        'Cinq minutes le soir, c\u2019est devenu un signal de fin de journ\u00e9e.',
      beforeImage: {
        src: '/testimonials/hands-lina-avant.svg',
        alt: 'Mains de Lina avant le rituel, cuticules s\u00e8ches',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-lina-apres.svg',
        alt: 'Mains de Lina apr\u00e8s deux mois, cuticules apais\u00e9es',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'D\u00e9cembre 2025',
    },
    {
      id: 'sara',
      authorFirstName: 'Sara',
      city: 'Marrakech',
      quote:
        'Je ne reviendrai pas au vernis. La main suffit \u00e0 elle-m\u00eame.',
      beforeImage: {
        src: '/testimonials/hands-sara-avant.svg',
        alt: 'Mains de Sara avant, ongles cassants',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-sara-apres.svg',
        alt: 'Mains de Sara apr\u00e8s quatre mois, ongles fortifi\u00e9s',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'Janvier 2026',
    },
  ],
  reassurances: [
    {
      icon: 'shipping',
      label: 'Livraison offerte',
      detail: 'Rabat 24 h \u2014 Maroc 48 \u00e0 72 h',
    },
    { icon: 'return', label: 'Retour 30 jours', detail: 'M\u00eame entam\u00e9' },
    {
      icon: 'payment',
      label: 'Paiement \u00e0 la livraison',
      detail: 'V\u00e9rifiez avant de payer',
    },
  ],
  journalCrossSlugs: [
    'hiver-ongles-patience',
    'matieres-d-ailleurs',
    'paste-et-powder-deux-gestes',
  ],
};
