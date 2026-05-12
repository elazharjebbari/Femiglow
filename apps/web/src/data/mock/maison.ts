import type { MaisonPageContent } from '@/lib/schemas';

/**
 * Audit 08/09 — Maison FemiGlow à Rabat (25 bis avenue Patrice Lumumba).
 * Fondatrice : Souheila, biologiste, formulatrice, formatrice.
 * Ajout engagement halal, signature géographique cohérente.
 */
export const mockMaison: MaisonPageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'La maison',
    title: 'La maison d\u2019\u00e9clat.',
    subtitle:
      'Une maison de soin pour les ongles, \u00e9dit\u00e9e \u00e0 Rabat. Lente, attentive, situ\u00e9e au 25 bis avenue Patrice Lumumba.',
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
      'FemiGlow est n\u00e9 d\u2019un constat simple : les ongles tiennent quand on leur pr\u00eate le temps qu\u2019ils demandent. Pas plus, pas moins. Cinq minutes le soir, deux gestes mesur\u00e9s et un polissoir.',
      'L\u2019id\u00e9e a pris forme \u00e0 Rabat, dans un atelier de l\u2019avenue Patrice Lumumba o\u00f9 la lumi\u00e8re tombe juste avant 18 heures. Trois m\u00e9tiers se sont assis autour d\u2019une table : la formulation, la mati\u00e8re, l\u2019\u00e9criture. Une seule conviction \u2014 la beaut\u00e9 lente est une attention, jamais une performance.',
      'Souheila est biologiste. Elle a suivi plusieurs formations en fabrication cosm\u00e9tique avant d\u2019\u00e9diter ses premi\u00e8res marques de soins naturels. Aujourd\u2019hui, elle anime des formations dans le m\u00eame atelier o\u00f9 FemiGlow est con\u00e7u. Le rituel n\u2019est pas une d\u00e9couverte \u2014 c\u2019est une transmission.',
    ],
    image: {
      src: '/maison/maison-origine.png',
      alt: 'Plan de travail d\u2019atelier \u00e0 Rabat, lumi\u00e8re d\u2019apr\u00e8s-midi sur des pots de paste et de powder',
      width: 960,
      height: 1200,
    },
    imagePosition: 'right',
  },
  fondatrice: {
    kicker: 'La fondatrice',
    titre: 'Souheila, biologiste et formulatrice.',
    paragraphs: [
      'Souheila tient un master en biologie. Elle a suivi plusieurs formations sp\u00e9cialis\u00e9es en fabrication de produits cosm\u00e9tiques. Avant FemiGlow, elle a \u00e9dit\u00e9 plusieurs marques de soins naturels \u2014 et chacune lui a appris quelque chose sur le geste, la mati\u00e8re, la tra\u00e7abilit\u00e9.',
      'Elle anime aujourd\u2019hui des formations dans l\u2019atelier de Rabat, ouvertes aux jeunes formulatrices marocaines. FemiGlow est sa maison la plus lente.',
    ],
    image: {
      src: '/maison/fondatrice-mains.svg',
      alt: 'Atelier de Rabat, fin d\u2019apr\u00e8s-midi. Souheila pr\u00e9pare une paste, geste lent, observation continue',
      width: 960,
      height: 1200,
    },
    imagePosition: 'left',
  },
  atelier: {
    adresse: '25 bis avenue Patrice Lumumba',
    quartier: 'Rabat',
    description: [
      'L\u2019atelier tient dans deux pi\u00e8ces calmes : un plan de travail clair, une biblioth\u00e8que d\u2019ouvrages techniques et de carnets, des \u00e9chantillons de mati\u00e8res rang\u00e9s par saison.',
      'On y formule en petites s\u00e9ries. On y re\u00e7oit Souheila sur rendez-vous, le mardi et le jeudi, pour les formations et les consultations.',
    ],
    gallerie: [
      {
        src: '/maison/atelier-1.svg',
        alt: 'Vue d\u2019ensemble de l\u2019atelier de Rabat, lumi\u00e8re traversante depuis la fen\u00eatre nord',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-2.svg',
        alt: 'Plan de travail avec balance de pr\u00e9cision, pots de paste et de powder, carnet ouvert',
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
      pourquoi: 'Adoucit le sertissage de l\u2019ongle et tient la paste sans la rigidifier.',
      iconSlug: 'cire',
      ambiance: 'champagne',
    },
    {
      id: 'jojoba',
      nom: 'Huile de jojoba',
      origine: 'Press\u00e9e \u00e0 froid dans le Souss-Massa, fili\u00e8re marocaine.',
      pourquoi: 'Cire liquide qui imite le s\u00e9bum cutan\u00e9 \u2014 nourrit sans graisser.',
      iconSlug: 'jojoba',
      ambiance: 'sauge',
    },
    {
      id: 'kaolin',
      nom: 'Kaolin polissant',
      origine: 'Argile mini\u00e8re marocaine, carri\u00e8re de Marrakech.',
      pourquoi: 'Polit l\u2019ongle sans l\u2019ass\u00e9cher \u2014 c\u2019est lui qui anime le polissoir Step 4.',
      iconSlug: 'kaolin',
      ambiance: 'creme',
    },
    {
      id: 'riz',
      nom: 'Poudre de riz',
      origine: 'Cultures biologiques d\u2019Asie, fili\u00e8re trac\u00e9e.',
      pourquoi: 'Absorbant doux \u2014 c\u2019est elle qui donne \u00e0 la powder sa finition mate juste avant la brillance.',
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
      titre: 'Certification halal',
      description:
        'Chaque mati\u00e8re est trac\u00e9e. Notre fabricant est audit\u00e9 par le Halal Cosmetics Council. Le label figure sur chaque pot et sur le polissoir.',
    },
    {
      ordre: 3,
      titre: 'Sans vernis',
      description:
        'Pas de r\u00e9sine plastique, pas de solvant fort. Le soin se voit \u00e0 l\u2019ongle, pas dans l\u2019air.',
    },
    {
      ordre: 4,
      titre: 'Rituel lent',
      description:
        'Tout est calibr\u00e9 pour cinq minutes le soir. Plus court, c\u2019est de la cosm\u00e9tique. Plus long, c\u2019est une corv\u00e9e.',
    },
    {
      ordre: 5,
      titre: 'Local',
      description:
        'Conditionn\u00e9, \u00e9tiquet\u00e9, exp\u00e9di\u00e9 depuis Rabat. Quand c\u2019est possible, on garde la cha\u00eene courte.',
    },
    {
      ordre: 6,
      titre: 'Transmission',
      description:
        'Souheila forme r\u00e9guli\u00e8rement des esth\u00e9ticiennes et des formulatrices \u00e0 la manucure japonaise, dans l\u2019atelier de Rabat.',
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
      kicker: 'Le pack',
      titre: 'Voir le pack',
      image: {
        src: '/maison/cross-kit.png',
        alt: 'Pack FemiGlow ouvert : paste, powder et polissoir align\u00e9s sur un linge \u00e9cru',
        width: 800,
        height: 1000,
      },
    },
  ],
};
