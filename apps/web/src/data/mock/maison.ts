import type { MaisonPageContent } from '@/lib/schemas';

export const mockMaison: MaisonPageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'La maison',
    title: 'La maison d\u2019\u00e9clat.',
    subtitle:
      'Une maison de soin pour les ongles, \u00e9dit\u00e9e \u00e0 Casablanca. Lente, attentive, situ\u00e9e.',
    cta: {
      variant: 'link',
      label: 'D\u00e9couvrir l\u2019atelier \u2192',
      href: '#origine',
    },
  },
  origine: {
    kicker: 'L\u2019origine',
    titre: 'Une attention partie d\u2019un constat simple.',
    paragraphs: [
      'FemiGlow est n\u00e9 d\u2019un constat simple : les ongles tiennent quand on leur pr\u00eate le temps qu\u2019ils demandent. Pas plus, pas moins. Cinq minutes le soir, en cinq gestes mesur\u00e9s.',
      'L\u2019id\u00e9e a pris forme \u00e0 Casablanca, dans un appartement bord de mer o\u00f9 la lumi\u00e8re tombe juste avant 18 heures. Trois m\u00e9tiers se sont assis autour d\u2019une table : la formulation, la mati\u00e8re, l\u2019\u00e9criture. Une seule conviction \u2014 la beaut\u00e9 lente est une attention, jamais une performance.',
      'Nos formulations sont pens\u00e9es pour le climat m\u00e9diterran\u00e9en : soleil franc l\u2019\u00e9t\u00e9, air sec l\u2019hiver. Elles s\u2019ajustent aux saisons, au rythme de celles qui les portent.',
    ],
    image: {
      src: '/maison/maison-origine.png',
      alt: 'Plan de travail d\u2019atelier, lumi\u00e8re d\u2019apr\u00e8s-midi sur des fioles ambr\u00e9es',
      width: 960,
      height: 1200,
    },
    imagePosition: 'right',
  },
  fondatrice: {
    kicker: 'La fondatrice',
    titre: 'Salma, formulatrice, lectrice patiente.',
    paragraphs: [
      'Salma a grandi entre une grand-m\u00e8re qui pr\u00e9parait ses huiles \u00e0 la lampe et une m\u00e8re qui lui apprenait la patience devant une lime. Elle a pass\u00e9 dix ans en laboratoire avant de revenir \u00e0 cette \u00e9vidence : le geste compte autant que la formule.',
      'Elle \u00e9crit la voix de la maison, choisit les mati\u00e8res, signe les notes. \u00c9crit \u00e0 voix basse, sur le soin lent et les mati\u00e8res du Maghreb.',
    ],
    image: {
      src: '/maison/fondatrice-mains.svg',
      alt: 'Mains au travail sur un plan de travail clair, lime et flacon ambr\u00e9 \u00e0 c\u00f4t\u00e9',
      width: 960,
      height: 1200,
    },
    imagePosition: 'left',
  },
  atelier: {
    adresse: '14 rue des Acacias',
    quartier: 'Bourgogne, Casablanca',
    description: [
      'L\u2019atelier tient dans deux pi\u00e8ces calmes : un plan de travail clair, une biblioth\u00e8que d\u2019ouvrages techniques et de carnets, des \u00e9chantillons de mati\u00e8res rang\u00e9s par saison.',
      'On y formule en petites s\u00e9ries. On y re\u00e7oit, sur rendez-vous, celles qui \u00e9crivent sur le soin et la mati\u00e8re.',
    ],
    gallerie: [
      {
        src: '/maison/atelier-1.svg',
        alt: 'Vue d\u2019ensemble de l\u2019atelier, lumi\u00e8re traversante depuis la fen\u00eatre nord',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-2.svg',
        alt: 'Plan de travail avec balance de pr\u00e9cision, fioles et carnet ouvert',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-3.svg',
        alt: 'D\u00e9tail mati\u00e8re : cire d\u2019abeille fondue dans un bol en c\u00e9ramique',
        width: 1600,
        height: 1067,
      },
    ],
  },
  matieres: [
    {
      id: 'cire',
      nom: 'Cire d\u2019abeille',
      origine: 'R\u00e9colt\u00e9e dans le Souss, en partenariat avec une coop\u00e9rative familiale.',
      pourquoi: 'Adoucit le sertissage de l\u2019ongle et tient la base sans la rigidifier.',
      iconSlug: 'cire',
      ambiance: 'champagne',
    },
    {
      id: 'jojoba',
      nom: 'Huile de jojoba',
      origine: 'Press\u00e9e \u00e0 froid au Mexique, importation directe.',
      pourquoi: 'Cire liquide qui imite le s\u00e9bum cutan\u00e9 \u2014 nourrit sans graisser.',
      iconSlug: 'jojoba',
      ambiance: 'sauge',
    },
    {
      id: 'kaolin',
      nom: 'Kaolin blanc',
      origine: 'Argile minier marocaine, lav\u00e9e trois fois en atelier.',
      pourquoi: 'Mati\u00e9rifie l\u2019ongle sans l\u2019ass\u00e9cher, fixe les pigments min\u00e9raux.',
      iconSlug: 'kaolin',
      ambiance: 'creme',
    },
    {
      id: 'mica',
      nom: 'Mica naturel',
      origine: 'Sourcing certifi\u00e9 sans travail des enfants, Inde du Sud.',
      pourquoi: 'D\u00e9pose un voile lumineux discret \u2014 jamais paillet\u00e9.',
      iconSlug: 'mica',
      ambiance: 'petale',
    },
  ],
  engagements: [
    {
      ordre: 1,
      titre: 'Sourcing direct',
      description:
        'Chaque mati\u00e8re est trac\u00e9e jusqu\u2019\u00e0 son atelier d\u2019origine. Aucun interm\u00e9diaire anonyme.',
    },
    {
      ordre: 2,
      titre: 'Sans vernis',
      description:
        'Pas de r\u00e9sine plastique, pas de solvant fort. Le soin se voit \u00e0 l\u2019ongle, pas dans l\u2019air.',
    },
    {
      ordre: 3,
      titre: 'Rituel lent',
      description:
        'Tout est calibr\u00e9 pour cinq minutes le soir. Plus court, c\u2019est de la cosm\u00e9tique. Plus long, c\u2019est une corv\u00e9e.',
    },
    {
      ordre: 4,
      titre: 'Local',
      description:
        'Conditionn\u00e9, \u00e9tiquet\u00e9, exp\u00e9di\u00e9 depuis Casablanca. Quand c\u2019est possible, on garde la cha\u00eene courte.',
    },
  ],
  crossLinks: [
    {
      id: 'rituel',
      href: '/rituel',
      kicker: 'Le rituel',
      titre: 'Lire le rituel',
      image: {
        src: '/maison/cross-rituel.png',
        alt: 'Mains au repos sur un plaid de laine claire',
        width: 800,
        height: 1000,
      },
    },
    {
      id: 'journal',
      href: '/journal',
      kicker: 'Le journal',
      titre: 'Le journal',
      image: {
        src: '/maison/cross-journal.png',
        alt: 'Carnet ouvert sur une table, plume en suspens',
        width: 800,
        height: 1000,
      },
    },
    {
      id: 'kit',
      href: '/kit',
      kicker: 'Le kit',
      titre: 'Voir le kit',
      image: {
        src: '/maison/cross-kit.png',
        alt: 'Trois flacons et une lime align\u00e9s sur un linge \u00e9cru',
        width: 800,
        height: 1000,
      },
    },
  ],
};
