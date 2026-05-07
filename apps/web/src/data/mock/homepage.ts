import type { HomepageContent } from '@/lib/schemas';

export const mockHomepage: HomepageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'Maison de Casablanca',
    title: 'Le rituel ongles, en cinq minutes.',
    subtitle: 'Trois gestes, une saison. Une beauté lente, ancrée au Maroc.',
    cta: { label: 'Découvrir le rituel', href: '/rituel', variant: 'primary' },
    ctaSecondary: { label: 'Voir le kit', href: '/kit', variant: 'link' },
    image: {
      src: '/journal/hero-accueil.svg',
      alt: 'Mains posées sur une table en bois, lumière douce de fin de matinée',
      width: 1600,
      height: 2000,
    },
  },
  gestes: [
    {
      ordre: 1,
      titre: 'Préparer',
      duree: '1 minute',
      description: 'Nettoyer, déposer la main au repos.',
    },
    {
      ordre: 2,
      titre: 'Limer',
      duree: '1 minute',
      description: 'Donner la forme. Sans précipitation.',
    },
    {
      ordre: 3,
      titre: 'Hydrater les cuticules',
      duree: '1 minute',
      description: 'Une goutte d\u2019huile, repousser doucement.',
    },
    {
      ordre: 4,
      titre: 'Appliquer la base',
      duree: '1 minute',
      description: 'Couche fine, sans surcharge.',
    },
    {
      ordre: 5,
      titre: 'Sceller',
      duree: '1 minute',
      description: 'Fortifiant en finition, laisser sécher.',
    },
  ],
  manifeste: {
    kicker: 'Manifeste',
    title: 'La beauté lente est une attention.',
    paragraphs: [
      'Nous croyons que les ongles tiennent quand on leur prête le temps qu\u2019ils demandent.',
      'Pas plus, pas moins. Cinq minutes par jour, un soin sans démonstration.',
    ],
  },
  avis: [
    {
      id: 't1',
      authorFirstName: 'Salma',
      authorContext: 'Casablanca',
      initieeDepuis: 'Janvier 2025',
      quote:
        'Mes ongles ne cassent plus depuis trois mois. Je ne pensais pas que cinq minutes le soir suffiraient.',
      handImage: {
        src: '/avis/mains-salma.svg',
        alt: 'Mains au repos sur un plaid clair, lumière naturelle',
        width: 1200,
        height: 1500,
      },
    },
    {
      id: 't2',
      authorFirstName: 'Yasmine',
      authorContext: 'Rabat',
      initieeDepuis: 'Mars 2024',
      quote: 'C\u2019est devenu un moment pour moi. Le rituel rythme ma fin de journée.',
      handImage: {
        src: '/avis/mains-yasmine.svg',
        alt: 'Mains qui tiennent une tasse en céramique, posées sur une table en bois',
        width: 1200,
        height: 1500,
      },
    },
    {
      id: 't3',
      authorFirstName: 'Inès',
      authorContext: 'Marrakech',
      initieeDepuis: 'Octobre 2023',
      quote: 'La base a une finition naturelle qui me ressemble enfin.',
      handImage: {
        src: '/avis/mains-ines.svg',
        alt: 'Mains croisées sur un drap de lin, ongles nus aux reflets pétale',
        width: 1200,
        height: 1500,
      },
    },
  ],
  journalExtraitsSlugs: ['hiver-ongles-patience', 'matieres-d-ailleurs', 'cinq-minutes-le-soir'],
};
