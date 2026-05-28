/**
 * Page `/[locale]/` — home FemiGlow upgrade depuis le pilote démo.
 *
 * Migration de la page `/` (legacy) vers le routing locale-aware.
 * Localise generateMetadata + JSON-LD + structure. Le contenu CMS
 * (hero, gestes, manifeste, avis, journal extracts) reste FR jusqu'à
 * Phase 3 multilingue.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.7
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AvisStripBound } from '@/components/sections/AvisStripBound';
import { GestesGrid } from '@/components/sections/GestesGrid';
import { HeroBound } from '@/components/sections/HeroBound';
import { JournalExtraitsBound } from '@/components/sections/JournalExtraitsBound';
import { Manifeste } from '@/components/sections/Manifeste';
import { NewsletterBlock } from '@/components/sections/NewsletterBlock';
import { ScrollMilestonesTracker } from '@/components/tracking/ScrollMilestonesTracker';
import { Fleuron } from '@/components/ui/Fleuron';
import { isLocale, type Locale } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { resolveOgImage } from '@/lib/components/og-image';
import { JsonLd, organizationSchema, websiteSchema } from '@/lib/seo/json-ld';

const SITE_URL = 'https://femiglow-maroc.com';

const FALLBACK_OG = {
  url: '/og/home.svg',
  width: 1200,
  height: 630,
  alt: 'FemiGlow',
};

interface PageProps {
  params: { locale: string };
}

// ---------------------------------------------------------------------------
// generateMetadata — SEO localisé
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'FemiGlow' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'marketing.home.metadata',
  });
  const og = (await resolveOgImage('home-og')) ?? FALLBACK_OG;
  const canonicalPath = `/${params.locale}/`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonicalPath,
      languages: {
        fr: '/fr/',
        ar: '/ar/',
        en: '/en/',
        'x-default': '/fr/',
      },
    },
    openGraph: {
      type: 'website',
      title: t('og_title'),
      description: t('og_description'),
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'FemiGlow',
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
      images: [
        { url: og.url, width: og.width, height: og.height, alt: og.alt },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('og_title'),
      description: t('og_description'),
      images: [og.url],
    },
  };
}

export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Page — vraie home (remplace le pilote démo précédent)
// ---------------------------------------------------------------------------

export default async function HomePage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  // Phase 3 T3.2/T3.3 : pass locale aux fetches CMS (impl mock fait fallback FR).
  const [content, journalArticles, tGestes] = await Promise.all([
    cms.getHomepageContent({ locale }),
    cms.getArticles({ limit: 3, featured: true, locale }),
    // Phase 7C — kicker localisé pour `<GestesGrid>` (default prop FR).
    getTranslations({ locale, namespace: 'marketing.home.gestes' }),
  ]);

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <ScrollMilestonesTracker contentId="home" contentType="page" />
      <HeroBound data={content.hero} priority componentKey="home-hero" locale={locale} />
      <Fleuron />
      <GestesGrid etapes={content.gestes} kicker={tGestes('kicker')} title={tGestes('title')} />
      <Fleuron />
      <Manifeste data={content.manifeste} />
      <Fleuron />
      <AvisStripBound
        testimonials={content.avis}
        componentKey="home-avis-strip"
      />
      <Fleuron />
      <JournalExtraitsBound articles={journalArticles} />
      <NewsletterBlock />
    </>
  );
}
