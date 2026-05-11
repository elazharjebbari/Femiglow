/**
 * Seed SEO — settings + overrides pour les 13 pages connues + JSON-LD enrichi.
 *
 * Idempotent : recharge à chaque exécution les overrides + settings vers leur état seed.
 *
 * Usage : `pnpm tsx scripts/seed-seo.ts`
 */
import { upsertOverride, upsertSeoSettings } from '@/lib/db/queries/seo';
import { seoSettingsDefault } from '@/lib/seo/defaults';
import { FEMIGLOW_KNOWN_PAGES } from '@/lib/seo/known-pages';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://femiglow.com';

interface Seed {
  scope: 'page' | 'product' | 'article';
  targetKey: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageTemplate?: 'marketing' | 'article' | 'product' | 'default';
  keywords?: string[];
  canonical?: string;
  structuredData?: unknown;
}

const PAGE_SEEDS: Seed[] = [
  {
    scope: 'page',
    targetKey: 'home',
    title: 'FemiGlow — Rituels intimes naturels conçus au Maroc',
    description:
      'Découvrez les rituels FemiGlow : soin intime naturel, douceur clinique, qualité marocaine. Inspiré du hammam, validé par la science.',
    ogImageTemplate: 'marketing',
    keywords: ['femiglow', 'soin intime', 'maroc', 'rituel', 'naturel'],
    canonical: SITE_URL,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'FemiGlow',
          url: SITE_URL,
          logo: `${SITE_URL}/brand/logo.svg`,
          sameAs: ['https://www.instagram.com/femiglow'],
        },
        {
          '@type': 'WebSite',
          url: SITE_URL,
          name: 'FemiGlow',
          inLanguage: 'fr-MA',
        },
      ],
    },
  },
  {
    scope: 'page',
    targetKey: 'kit',
    title: 'Le Kit FemiGlow — Soin intime complet',
    description:
      'Le Kit FemiGlow réunit les essentiels du rituel : nettoyant doux, soin pH-équilibré, brume hydratante. Conçu au Maroc, validé en clinique.',
    ogImageTemplate: 'product',
    keywords: ['kit femiglow', 'soin intime', 'pH', 'rituel'],
    canonical: `${SITE_URL}/kit`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Le Kit FemiGlow',
      description:
        'Soin intime complet : nettoyant doux, soin pH-équilibré, brume hydratante.',
      brand: { '@type': 'Brand', name: 'FemiGlow' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: '49.00',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/kit`,
      },
    },
  },
  {
    scope: 'page',
    targetKey: 'rituel',
    title: 'Le Rituel — Une routine douce, ancrée, quotidienne',
    description:
      'Le Rituel FemiGlow : 3 gestes courts pour une routine intime apaisée. Inspiré du hammam, pensé pour le quotidien.',
    ogImageTemplate: 'marketing',
    canonical: `${SITE_URL}/rituel`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Le Rituel FemiGlow',
      description: 'Trois gestes pour une routine intime apaisée.',
      step: [
        { '@type': 'HowToStep', name: 'Nettoyer', text: 'Geste doux, sans savon agressif.' },
        { '@type': 'HowToStep', name: 'Équilibrer', text: 'Soin pH-équilibré, biome respecté.' },
        { '@type': 'HowToStep', name: 'Hydrater', text: 'Brume légère, fini en douceur.' },
      ],
    },
  },
  {
    scope: 'page',
    targetKey: 'manifeste',
    title: 'Manifeste — Une marque qui prend soin sans donner de leçons',
    description:
      'Le manifeste FemiGlow : douceur, science et héritage marocain. Pourquoi nous existons, ce qui nous tient à cœur.',
    ogImageTemplate: 'marketing',
    canonical: `${SITE_URL}/manifeste`,
  },
  {
    scope: 'page',
    targetKey: 'fondatrice',
    title: 'La Fondatrice — Histoire et vision de FemiGlow',
    description:
      "Rencontre avec la fondatrice de FemiGlow : son parcours, sa vision, l'origine du Rituel.",
    ogImageTemplate: 'article',
    canonical: `${SITE_URL}/fondatrice`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Fondatrice FemiGlow',
      jobTitle: 'Fondatrice',
      worksFor: { '@type': 'Organization', name: 'FemiGlow' },
    },
  },
  {
    scope: 'page',
    targetKey: 'temoignages',
    title: 'Témoignages — Ce qu\'elles vivent avec FemiGlow',
    description:
      'Lecture des retours clients FemiGlow : impressions, transformations, vie quotidienne avec le Rituel.',
    ogImageTemplate: 'marketing',
    canonical: `${SITE_URL}/temoignages`,
  },
  {
    scope: 'page',
    targetKey: 'journal',
    title: 'Journal FemiGlow — Bien-être intime, sciences douces',
    description:
      'Le Journal FemiGlow : articles courts, validés, sur le soin intime, le hammam, le pH, l\'équilibre du biome.',
    ogImageTemplate: 'article',
    canonical: `${SITE_URL}/journal`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Journal FemiGlow',
      url: `${SITE_URL}/journal`,
      inLanguage: 'fr-MA',
    },
  },
  {
    scope: 'page',
    targetKey: 'faq',
    title: 'FAQ — Questions fréquentes FemiGlow',
    description:
      'Questions fréquentes sur les soins FemiGlow : composition, usage, livraison, retours.',
    ogImageTemplate: 'default',
    canonical: `${SITE_URL}/faq`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Le Kit convient-il à toutes les peaux ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Le Kit FemiGlow est formulé sans parfum agressif et au pH respectueux du biome. Il convient à la majorité des peaux sensibles.',
          },
        },
        {
          '@type': 'Question',
          name: 'Livrez-vous au Maroc et en Europe ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui — livraison standard au Maroc en 48 h, en Europe en 5 à 7 jours ouvrés.',
          },
        },
      ],
    },
  },
  {
    scope: 'page',
    targetKey: 'contact',
    title: 'Contact — Écrivez à FemiGlow',
    description:
      'Une question, un retour, un partenariat : écrivez à l\'équipe FemiGlow. Réponse sous 48 heures ouvrées.',
    ogImageTemplate: 'default',
    canonical: `${SITE_URL}/contact`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      url: `${SITE_URL}/contact`,
    },
  },
  {
    scope: 'page',
    targetKey: 'cgv',
    title: 'CGV — Conditions générales de vente FemiGlow',
    description:
      'Conditions générales de vente FemiGlow : commande, paiement, livraison, retours, garanties.',
    canonical: `${SITE_URL}/cgv`,
  },
  {
    scope: 'page',
    targetKey: 'mentions-legales',
    title: 'Mentions légales — FemiGlow',
    description:
      'Mentions légales FemiGlow : éditeur, hébergeur, propriété intellectuelle.',
    canonical: `${SITE_URL}/mentions-legales`,
  },
  {
    scope: 'page',
    targetKey: 'confidentialite',
    title: 'Politique de confidentialité — FemiGlow',
    description:
      'Politique de confidentialité FemiGlow : données collectées, finalités, droits.',
    canonical: `${SITE_URL}/confidentialite`,
  },
  {
    scope: 'page',
    targetKey: 'cookies',
    title: 'Cookies — Politique FemiGlow',
    description:
      'Gestion des cookies sur femiglow.com : essentiels, mesures d\'audience, préférences.',
    canonical: `${SITE_URL}/cookies`,
  },
];

export async function runSeoSeed(actorId: string | null = null): Promise<{
  settings: 'updated';
  overrides: number;
}> {
  // 1) Settings — siteName, organizationJsonLd, knownPages
  await upsertSeoSettings({
    siteName: seoSettingsDefault.siteName,
    defaultDescription: seoSettingsDefault.defaultDescription,
    defaultOgImageMediaId: seoSettingsDefault.defaultOgImageMediaId,
    twitterHandle: seoSettingsDefault.twitterHandle,
    organizationJsonLd: seoSettingsDefault.organizationJsonLd,
    defaultRobotsIndex: seoSettingsDefault.defaultRobotsIndex,
    defaultRobotsFollow: seoSettingsDefault.defaultRobotsFollow,
    knownPages: FEMIGLOW_KNOWN_PAGES,
    actorId,
  });

  // 2) Overrides
  let count = 0;
  for (const seed of PAGE_SEEDS) {
    await upsertOverride({
      scope: seed.scope,
      targetKey: seed.targetKey,
      locale: 'fr-MA',
      title: seed.title,
      description: seed.description,
      keywords: seed.keywords ?? [],
      ogTitle: seed.ogTitle ?? seed.title,
      ogDescription: seed.ogDescription ?? seed.description,
      ogImageMediaId: null,
      ogImageTemplate: seed.ogImageTemplate ?? null,
      twitterCard: 'summary_large_image',
      canonical: seed.canonical ?? null,
      robotsIndex: true,
      robotsFollow: true,
      structuredData: seed.structuredData ?? null,
      actorId,
    });
    count += 1;
  }

  return { settings: 'updated', overrides: count };
}

async function main(): Promise<void> {
  const result = await runSeoSeed();
  console.log(
    `[seed-seo] settings: ${result.settings} | overrides: ${result.overrides}`,
  );
}

// Auto-execute when run directly (ESM-compatible)
main().catch((err) => {
  console.error('[seed-seo] erreur:', err);
  process.exit(1);
});
