import type { KitPageContent } from '@/lib/schemas';
import { mockKit } from './product';
import { mockRituel } from './rituel';

export const mockKitPageContent: KitPageContent = {
  product: mockKit,
  composition: [
    {
      id: 'base-transparente',
      name: 'La base transparente',
      shortDescription:
        'Filme la plaque sans l\u2019\u00e9touffer. Pose le terrain du soin lent.',
      volume: '15 ml',
      image: {
        src: '/products/kit-base.svg',
        alt: 'Flacon de base transparente FemiGlow, verre satin\u00e9 et capuchon ardoise',
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
        },
        {
          name: 'Huile de jojoba',
          inci: 'Simmondsia Chinensis Seed Oil',
          function: 'H\u00e9misphage des cuticules',
          origin: 'Cultures biologiques, Souss-Massa',
          concentrationPct: 8,
        },
        {
          name: 'Tocoph\u00e9rol',
          inci: 'Tocopherol',
          function: 'Antioxydant',
          origin: 'Origine v\u00e9g\u00e9tale, Europe',
          concentrationPct: 0.5,
        },
      ],
      certifications: [
        { label: 'Cosmos Organic', body: 'Ecocert' },
        { label: 'Vegan', body: 'EVE Vegan' },
      ],
    },
    {
      id: 'fortifiant',
      name: 'Le fortifiant',
      shortDescription:
        'Concentr\u00e9 qui retient l\u2019ongle dans le temps. Une goutte suffit.',
      volume: '10 ml',
      image: {
        src: '/products/kit-fortifiant.svg',
        alt: 'Flacon doseur de fortifiant FemiGlow, capuchon champagne',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'K\u00e9ratine hydrolys\u00e9e',
          inci: 'Hydrolyzed Keratin',
          function: 'Reconstituant',
          origin: 'Origine v\u00e9g\u00e9tale, Europe',
          concentrationPct: 5,
        },
        {
          name: 'Calcium pantoth\u00e9nate',
          inci: 'Calcium Pantothenate',
          function: 'Pro-vitamine B5',
          origin: 'Synth\u00e8se contr\u00f4l\u00e9e, France',
          concentrationPct: 2,
        },
        {
          name: 'Glyc\u00e9rine v\u00e9g\u00e9tale',
          inci: 'Glycerin',
          function: 'Hydratant',
          origin: 'Origine v\u00e9g\u00e9tale, Europe',
          concentrationPct: 4,
        },
      ],
      certifications: [
        { label: 'Cosmos Organic', body: 'Ecocert' },
      ],
    },
    {
      id: 'lime-artisanale',
      name: 'La lime artisanale',
      shortDescription:
        'Coupe de pr\u00e9cision, douce sur la k\u00e9ratine. Un seul outil, deux faces.',
      volume: '180 mm',
      image: {
        src: '/products/kit-lime.svg',
        alt: 'Lime artisanale FemiGlow, manche en bois clair',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Kaolin polissant',
          inci: 'Kaolin',
          function: 'Argile douce',
          origin: 'Carri\u00e8re, Marrakech',
        },
        {
          name: 'Bois de h\u00eatre',
          inci: 'Fagus Sylvatica',
          function: 'Manche',
          origin: 'For\u00eats certifi\u00e9es, Europe',
        },
      ],
      certifications: [
        { label: 'PEFC', body: 'Programme PEFC' },
      ],
    },
  ],
  videoSrc: mockRituel.videoGestes,
  comparatif: {
    titreVernis: 'Vernis classique',
    titreRituel: 'Rituel FemiGlow',
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
        rituel: 'Plaque hydrat\u00e9e, cuticules souples, kaolin polissant.',
      },
      {
        axis: 'Co\u00fbt annuel',
        vernis: 'Vernis + dissolvant + cures r\u00e9paratrices, env. 1\u202F500 MAD.',
        rituel: 'Un kit dure cinq mois en moyenne, env. 800 MAD par an.',
      },
      {
        axis: 'Impact mati\u00e8re',
        vernis: 'Solvants volatils, formules \u00e0 base p\u00e9trochimique fr\u00e9quente.',
        rituel: 'Cire d\u2019abeille, jojoba, kaolin, certifications Cosmos Organic.',
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
      id: 'duree-kit',
      question: 'Combien de temps dure un kit\u202F?',
      answer:
        'En usage quotidien, le kit tient environ cinq mois. La base se vide en premier, le fortifiant et la lime suivent au m\u00eame rythme. Nous proposons des recharges \u00e0 partir de l\u2019automne 2026.',
    },
    {
      id: 'frequence',
      question: '\u00c0 quelle fr\u00e9quence faut-il appliquer le rituel\u202F?',
      answer:
        'Tous les soirs si vous le pouvez, en cinq minutes. Si vous sautez un jour, ce n\u2019est pas grave\u202F: la maison accueille la pause comme elle accueille le retour.',
    },
    {
      id: 'compatibilite-vernis',
      question: 'Puis-je continuer \u00e0 porter du vernis\u202F?',
      answer:
        'Le rituel s\u2019accommode du vernis, m\u00eame s\u2019il est pens\u00e9 pour s\u2019en passer. Appliquez la base et le fortifiant les soirs sans vernis. La plaque respire, le rituel installe sa lenteur.',
    },
    {
      id: 'grossesse',
      question: 'Le rituel convient-il pendant la grossesse\u202F?',
      answer:
        'Toutes les formules sont sans solvants volatils, sans phtalates, sans toluene. Nous recommandons malgr\u00e9 tout d\u2019\u00e9changer avec votre m\u00e9decin\u202F: le soin se construit en confiance.',
    },
    {
      id: 'expedition',
      question: 'Quels sont les d\u00e9lais de livraison\u202F?',
      answer:
        'Casablanca\u202F: 48 heures en moyenne. Reste du Maroc\u202F: 72 \u00e0 96 heures. International\u202F: nous \u00e9tudions chaque destination, l\u2019envoi se fait par DHL avec suivi.',
    },
    {
      id: 'retours',
      question: 'Puis-je retourner le kit si le rituel ne me convient pas\u202F?',
      answer:
        'Oui, sous trente jours, m\u00eame entam\u00e9. Nous reprenons le kit, vous nous \u00e9crivez deux lignes, nous comprenons. Le remboursement intervient sous cinq jours ouvr\u00e9s.',
    },
    {
      id: 'allergies',
      question: 'Et si je suis allergique \u00e0 un ingr\u00e9dient\u202F?',
      answer:
        'Chaque formule liste son INCI complet sur cette page et sur l\u2019\u00e9tiquette. En cas de doute, nous vous adressons un \u00e9chantillon de chaque produit avant l\u2019envoi du kit complet.',
    },
    {
      id: 'enfants',
      question: 'Le rituel est-il adapt\u00e9 aux adolescentes\u202F?',
      answer:
        'Oui, \u00e0 partir de quatorze ans. Les formules sont douces, les gestes simples. C\u2019est souvent un premier rendez-vous avec le soin lent.',
    },
  ],
  handsTestimonials: [
    {
      id: 'amal',
      authorFirstName: 'Amal',
      city: 'Casablanca',
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
      city: 'Rabat',
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
    { icon: 'shipping', label: 'Livraison 48 h', detail: 'Casablanca, Rabat, Marrakech' },
    { icon: 'return', label: 'Retour 30 jours', detail: 'M\u00eame entam\u00e9' },
    { icon: 'payment', label: 'Paiement s\u00e9curis\u00e9', detail: '3D Secure' },
  ],
  journalCrossSlugs: ['hiver-ongles-patience', 'matieres-d-ailleurs', 'cinq-minutes-le-soir'],
};
