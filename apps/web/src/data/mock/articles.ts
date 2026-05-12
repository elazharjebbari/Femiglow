import type { Article } from '@/lib/schemas';

export const mockArticles: Article[] = [
  {
    slug: 'hiver-ongles-patience',
    title: 'Hiver, ongles, patience',
    kicker: 'Saison',
    excerpt:
      'Le froid sec de Rabat dessèche tout ce qui résiste. Les ongles plient, mais ne cassent pas — à condition de ralentir.',
    category: 'saison',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-01-12'),
    updatedAt: new Date('2026-01-12'),
    featuredImage: {
      src: '/journal/hiver-ongles-patience.svg',
      alt: 'Mains au repos sur une table en bois clair, lumière douce d\u2019hiver',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'Souheila · FemiGlow',
      bio: 'Fondatrice de la maison FemiGlow. Biologiste et formulatrice, elle écrit depuis Rabat sur le soin lent et les matières du Maghreb.',
    },
    body: `Quand l\u2019air sec descend sur Rabat en janvier, on cesse d\u2019attendre des ongles qu\u2019ils brillent. On leur demande de tenir. C\u2019est un changement d\u2019accord, presque imperceptible, et il fait toute la diff\u00e9rence.

La patience devient un soin. Les gestes se font rares. Le rituel s\u2019accorde au temps qu\u2019il fait dehors, plut\u00f4t qu\u2019\u00e0 l\u2019envie d\u2019\u00eatre vue. C\u2019est une saison o\u00f9 l\u2019on n\u2019applique plus pour faire briller : on applique pour ne pas casser.

## La saison s\u00e8che, vraiment

L\u2019hiver rabati n\u2019est pas un hiver de neige. C\u2019est un hiver de vent. L\u2019air vient du nord-est, traverse la m\u00e9diterran\u00e9e, atterrit sur la c\u00f4te avec une humidit\u00e9 trompeuse. La peau ne s\u2019y trompe pas. Les cuticules, encore moins.

On note d\u2019abord une rugosit\u00e9 nouvelle au bord de l\u2019ongle. Puis un dessin blanc, en surface, comme une trace de craie. C\u2019est le signe que la k\u00e9ratine a soif. Pas d\u2019huile, pas de cr\u00e8me \u2014 d\u2019eau d\u2019abord, et de gras ensuite, dans cet ordre.

> Un ongle qui casse, en janvier, ne casse pas par fragilit\u00e9. Il casse par soif.

C\u2019est une phrase que l\u2019on r\u00e9p\u00e8te dans l\u2019atelier, et qui d\u00e9range autant qu\u2019elle apaise. D\u00e9range, parce qu\u2019elle d\u00e9place la responsabilit\u00e9 de l\u2019ongle vers le geste. Apaise, parce qu\u2019elle dit que rien n\u2019est perdu.

## Le rituel ralenti

En hiver, le rituel se r\u00e9duit. On garde l\u2019huile, on garde la base. On enl\u00e8ve tout le reste. La lime devient inutile \u2014 l\u2019ongle est trop sec pour \u00eatre travaill\u00e9 \u00e0 plat. On laisse pousser, on laisse courir, on laisse le temps faire.

Trois gestes suffisent :

- D\u00e9poser une goutte d\u2019huile sur la cuticule, le soir, au coucher.
- Masser doucement, du milieu de l\u2019ongle vers la base, pendant trente secondes.
- Ne rien faire d\u2019autre.

Pas de polissage, pas de buffer, pas de bain de paraffine. La saison s\u00e8che n\u2019aime pas l\u2019insistance. Elle aime la r\u00e9p\u00e9tition discr\u00e8te.

![Mains au repos sur un plaid de laine, lumi\u00e8re d\u2019hiver](/journal/hiver-ongles-patience.svg)

## Ce que l\u2019hiver enseigne

Au sortir de janvier, vers la fin f\u00e9vrier, on observe une chose curieuse : l\u2019ongle n\u2019a pas grandi plus vite, mais il a grandi plus droit. La courbe est plus pure, l\u2019ondulation plus douce. C\u2019est l\u2019effet d\u2019une saison enti\u00e8re sans manipulation excessive.

Les m\u00eames mains, en septembre, n\u2019ont pas la m\u00eame force. C\u2019est l\u2019hiver qui a fait ce travail. La patience qu\u2019il a impos\u00e9e, on ne la d\u00e9cide pas \u2014 on la subit, on l\u2019accueille, et on en tire un b\u00e9n\u00e9fice diff\u00e9r\u00e9.

C\u2019est une le\u00e7on plus large que celle des ongles. La saison qui semble la plus pauvre est celle qui prot\u00e8ge le plus. C\u2019est aussi pour cela que nous publions le journal au rythme du climat : pour rappeler que le geste change, et qu\u2019il a raison de changer.

Pour aller plus loin, le [rituel \u2014 deux gestes et un polissoir](/rituel) est document\u00e9 pas \u00e0 pas. Pour comprendre pourquoi le sourcing direct compte aussi, l\u2019article [L\u2019huile d\u2019argan, vraie](/journal/huile-d-argan-vraie) ouvre l\u2019atelier. Et si vous \u00eates curieuses de la recherche en cosm\u00e9tique douce, le [rapport 2024 de la SOFW](https://www.sofw.com/) reste une r\u00e9f\u00e9rence accessible.

L\u2019hiver finit par passer. Les ongles auront \u00e9cout\u00e9 ; \u00e0 nous, simplement, d\u2019avoir \u00e9cout\u00e9 avec eux.`,
    isFeatured: false,
    wordCount: 820,
    seo: {
      title: 'Hiver, ongles, patience',
      description:
        'Quand le froid sec dessèche tout ce qui résiste, le rituel ralentit. Récit d\u2019un janvier marocain.',
      noIndex: false,
    },
  },
  {
    slug: 'matieres-d-ailleurs',
    title: 'Matières d\u2019ailleurs',
    kicker: 'Matières',
    excerpt:
      'Le sourcing parle d\u2019honnêteté. Voici ce qui compose vraiment notre soin, et d\u2019où viennent les matières.',
    category: 'matieres',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-02-03'),
    updatedAt: new Date('2026-02-03'),
    featuredImage: {
      src: '/journal/matieres-d-ailleurs.svg',
      alt: 'Plan rapproché sur des ingrédients bruts \u2014 huile, poudre',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Origine, traçabilité, choix.',
    isFeatured: false,
    wordCount: 1100,
    seo: { noIndex: false },
  },
  {
    slug: 'paste-et-powder-deux-gestes',
    title: 'Paste et powder \u2014 deux gestes, un \u00e9clat',
    kicker: 'Rituel',
    excerpt:
      'Deux gestes, un \u00e9clat. Tutorial sensoriel d\u00e9taill\u00e9 \u2014 paste, powder, polissoir Step 4.',
    category: 'pratique',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-02-18'),
    updatedAt: new Date('2026-02-18'),
    featuredImage: {
      src: '/journal/cinq-minutes-le-soir.svg',
      alt: 'Pot de paste, pot de powder et polissoir align\u00e9s, lumi\u00e8re douce',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Vivre la paste et la powder par procuration avant de les pratiquer. Cire d\u2019abeille et jojoba pour la paste, talc et poudre de riz pour la powder, mouvement lent du polissoir Step 4 pour finir.',
    isFeatured: false,
    wordCount: 700,
    seo: { noIndex: false },
  },
  {
    slug: 'la-maison-au-printemps',
    title: 'La maison, au printemps',
    kicker: 'Maison',
    excerpt:
      'L\u2019atelier de Rabat change de souffle quand l\u2019orange fleurit. Visite d\u2019un mois où la lumière revient.',
    category: 'maison',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-03-10'),
    featuredImage: {
      src: '/journal/la-maison-au-printemps.svg',
      alt: 'Atelier de Rabat, lumière du matin sur une table en bois',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Le printemps casablancais, vu de l\u2019atelier.',
    isFeatured: false,
    wordCount: 1200,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-d-amal',
    title: 'La voix d\u2019Amal',
    kicker: 'Voix',
    excerpt:
      'Trois mois de rituel, racontés par celle qui les a tenus. Sans promesse, sans avant-après caricatural.',
    category: 'voix',
    readingTimeMinutes: 7,
    publishedAt: new Date('2026-03-18'),
    updatedAt: new Date('2026-03-18'),
    featuredImage: {
      src: '/journal/voix-d-amal.svg',
      alt: 'Mains d\u2019Amal posées sur un livre ouvert',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Témoignage d\u2019une initiée.',
    isFeatured: false,
    wordCount: 1450,
    seo: { noIndex: false },
  },
  {
    slug: 'pluie-de-mars',
    title: 'Pluie de mars',
    kicker: 'Saison',
    excerpt:
      'L\u2019humidité revient sur la côte. Les cuticules respirent, les gestes peuvent s\u2019espacer.',
    category: 'saison',
    readingTimeMinutes: 3,
    publishedAt: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-25'),
    featuredImage: {
      src: '/journal/pluie-de-mars.svg',
      alt: 'Gouttes de pluie sur une fenêtre, plante en arrière-plan',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Le rituel s\u2019adapte à la saison humide.',
    isFeatured: false,
    wordCount: 680,
    seo: { noIndex: false },
  },
  {
    slug: 'la-poudre-de-kaolin',
    title: 'La poudre de kaolin',
    kicker: 'Matières',
    excerpt:
      'Argile blanche, douce, neutre. Comment elle entre dans la base et pourquoi elle y reste.',
    category: 'matieres',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-02'),
    updatedAt: new Date('2026-04-02'),
    featuredImage: {
      src: '/journal/la-poudre-de-kaolin.svg',
      alt: 'Poudre de kaolin blanche dans un bol en céramique',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Une argile, un choix.',
    isFeatured: false,
    wordCount: 950,
    seo: { noIndex: false },
  },
  {
    slug: 'la-table-comme-atelier',
    title: 'La table comme atelier',
    kicker: 'Pratique',
    excerpt:
      'Préparer son espace avant de commencer. La nappe, la lumière, le verre d\u2019eau.',
    category: 'pratique',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-10'),
    featuredImage: {
      src: '/journal/la-table-comme-atelier.svg',
      alt: 'Table en bois clair, nappe de lin, accessoires du rituel',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Le décor du rituel.',
    isFeatured: false,
    wordCount: 760,
    seo: { noIndex: false },
  },
  {
    slug: 'visiter-l-atelier',
    title: 'Visiter l\u2019atelier',
    kicker: 'Maison',
    excerpt:
      '25 bis avenue Patrice Lumumba, Rabat. Comment on est arrivés ici, et ce qu\u2019on y fabrique.',
    category: 'maison',
    readingTimeMinutes: 8,
    publishedAt: new Date('2026-04-15'),
    updatedAt: new Date('2026-04-15'),
    featuredImage: {
      src: '/journal/visiter-l-atelier.svg',
      alt: 'Façade de l\u2019atelier FemiGlow dans le quartier des Habous',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'L\u2019atelier de Rabat, en détail.',
    isFeatured: false,
    wordCount: 1600,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-de-lina',
    title: 'La voix de Lina',
    kicker: 'Voix',
    excerpt:
      'Deux mois après, elle nous écrit. Ce qui a changé, ce qui n\u2019a pas changé, et ce qu\u2019elle attend de la suite.',
    category: 'voix',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-04-18'),
    updatedAt: new Date('2026-04-18'),
    featuredImage: {
      src: '/journal/voix-de-lina.svg',
      alt: 'Mains de Lina, ongles soignés, sur un cahier ouvert',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Lina témoigne.',
    isFeatured: false,
    wordCount: 1080,
    seo: { noIndex: false },
  },
  {
    slug: 'avril-soleil-bas',
    title: 'Avril, soleil bas',
    kicker: 'Saison',
    excerpt:
      'Le soleil casablancais reprend sa hauteur. Les mains se découvrent, le rituel s\u2019allège.',
    category: 'saison',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-22'),
    updatedAt: new Date('2026-04-22'),
    featuredImage: {
      src: '/journal/avril-soleil-bas.svg',
      alt: 'Mains exposées au soleil oblique, lumière dorée',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Le printemps avancé, et la peau qui se découvre.',
    isFeatured: false,
    wordCount: 740,
    seo: { noIndex: false },
  },
  {
    slug: 'huile-d-argan-vraie',
    title: 'L\u2019huile d\u2019argan, vraie',
    kicker: 'Matières',
    excerpt:
      'Tiznit, coopératives, première pression. Pourquoi nous achetons direct, et combien ça coûte vraiment.',
    category: 'matieres',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-04-25'),
    updatedAt: new Date('2026-04-25'),
    featuredImage: {
      src: '/journal/huile-d-argan-vraie.svg',
      alt: 'Bouteille d\u2019huile d\u2019argan ambrée sur fond crème',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Sourcing direct, traçabilité.',
    isFeatured: false,
    wordCount: 1380,
    seo: { noIndex: false },
  },
  {
    slug: 'ranger-son-rituel',
    title: 'Ranger son rituel',
    kicker: 'Pratique',
    excerpt:
      'Le placard, le tiroir, la trousse. Comment garder les flacons en bon état d\u2019une saison à l\u2019autre.',
    category: 'pratique',
    readingTimeMinutes: 3,
    publishedAt: new Date('2026-04-28'),
    updatedAt: new Date('2026-04-28'),
    featuredImage: {
      src: '/journal/ranger-son-rituel.svg',
      alt: 'Tiroir de salle de bain ouvert, flacons rangés',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Conservation et rangement.',
    isFeatured: false,
    wordCount: 620,
    seo: { noIndex: false },
  },
  {
    slug: 'la-cuisine-comme-laboratoire',
    title: 'La cuisine comme laboratoire',
    kicker: 'Maison',
    excerpt:
      'Avant l\u2019atelier, il y a eu la cuisine. Récit d\u2019un commencement domestique.',
    category: 'maison',
    readingTimeMinutes: 7,
    publishedAt: new Date('2026-04-29'),
    updatedAt: new Date('2026-04-29'),
    featuredImage: {
      src: '/journal/la-cuisine-comme-laboratoire.svg',
      alt: 'Cuisine domestique reconvertie, balances et bocaux',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Les premiers essais, à la maison.',
    isFeatured: false,
    wordCount: 1320,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-de-sara',
    title: 'La voix de Sara',
    kicker: 'Voix',
    excerpt:
      'Quatre mois pleins. Sara raconte ses ongles, sa fatigue, ses doutes, et le geste qui s\u2019est installé.',
    category: 'voix',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-04-30'),
    updatedAt: new Date('2026-04-30'),
    featuredImage: {
      src: '/journal/voix-de-sara.svg',
      alt: 'Mains de Sara, ongles allongés, sur une serviette de lin',
      width: 1600,
      height: 1067,
    },
    author: { name: 'Souheila · FemiGlow' },
    body: 'Sara témoigne après quatre mois.',
    isFeatured: true,
    wordCount: 1240,
    seo: { noIndex: false },
  },
];
