import type { HomepageContent } from '@/lib/schemas';

/**
 * Audit 08/09 — Hero, quatre gestes (fiche kit-facts), manifeste, témoins.
 * Centre de gravité : Rabat. Produit nommé : Pack FemiGlow.
 */
export const mockHomepage: HomepageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'Maison de Rabat',
    title: 'Le pack FemiGlow. Quatre gestes, un éclat révélé.',
    subtitle:
      'Manucure japonaise halal, pensée à Rabat. Sans vernis, sans abrasion.',
    cta: { label: 'Découvrir le rituel', href: '/rituel', variant: 'primary' },
    ctaSecondary: { label: 'Recevoir le pack', href: '/kit', variant: 'link' },
    image: {
      src: '/journal/hero-accueil.svg',
      alt: 'Coffret pastel FemiGlow ouvert, pot paste sauge et pot powder à étiquette rose poudré, polissoir bleu ciel, lumière naturelle de fin de matinée',
      width: 1600,
      height: 2000,
    },
  },
  gestes: [
    {
      ordre: 1,
      titre: 'Préparer',
      duree: '1 minute',
      description:
        'Mains propres, ongles secs. Un coup de lime pour la forme.',
    },
    {
      ordre: 2,
      titre: 'Paste',
      duree: '1 minute',
      description:
        'Pâte crème onctueuse, posée sur ongle sec. Filme, lisse, prépare.',
    },
    {
      ordre: 3,
      titre: 'Powder',
      duree: '1 minute',
      description:
        'Poudre fine blanche, déposée sur la paste. Absorbe, lustre, réveille.',
    },
    {
      ordre: 4,
      titre: 'Polish & Shine',
      duree: '2 minutes',
      description:
        'Polissoir Step 4 passé en mouvements lents. La brillance naturelle apparaît.',
    },
  ],
  manifeste: {
    kicker: 'Manifeste',
    title: 'La beauté lente est une attention.',
    paragraphs: [
      'Nous croyons que les ongles révèlent ce qu\u2019on leur prête. Le geste, le temps, la patience.',
      'Cinq minutes, une fois par semaine. Quatre gestes et un polissoir. Aucune démonstration.',
    ],
  },
  avis: [
    {
      id: 't1',
      authorFirstName: 'Salma',
      authorContext: 'Casablanca',
      initieeDepuis: 'Janvier 2025',
      quote:
        'Trois mois sans casse. Cinq minutes, un soir par semaine, suffisent.',
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
      quote:
        'Le rituel rythme ma fin de journée. C\u2019est devenu un moment pour moi.',
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
      quote:
        'La paste donne un fini qui me ressemble. Naturel, sans vernis.',
      handImage: {
        src: '/avis/mains-ines.svg',
        alt: 'Mains croisées sur un drap de lin, ongles nus aux reflets pétale',
        width: 1200,
        height: 1500,
      },
    },
  ],
  journalExtraitsSlugs: [
    'hiver-ongles-patience',
    'matieres-d-ailleurs',
    'paste-et-powder-deux-gestes',
  ],
};
