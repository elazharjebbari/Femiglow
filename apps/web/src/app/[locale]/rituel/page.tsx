/**
 * Page `/[locale]/rituel` — migration depuis `/rituel` legacy.
 *
 * Stratégie Phase 2 : on localise `generateMetadata` + JSON-LD + canonical
 * et on réutilise les composants Bound existants (HeroLifestyleBound,
 * SectionNarrativeBound, etc.) qui fetchent leur contenu depuis le CMS.
 *
 * En Phase 3 (CMS multilingue), ces composants Bound seront étendus pour
 * fetcher par locale — sans avoir à modifier cette page.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.4
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Fleuron } from '@/components/ui/Fleuron';
import { HeroLifestyleBound } from '@/components/sections/HeroLifestyleBound';
import { InterviewQRBound } from '@/components/sections/InterviewQRBound';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { PivotBanner } from '@/components/sections/PivotBanner';
import { SciencesDuSoin } from '@/components/sections/SciencesDuSoin';
import { SectionNarrativeBound } from '@/components/sections/SectionNarrativeBound';
import { VideoPlayer4GestesBound } from '@/components/sections/VideoPlayer4GestesBound';
import { isLocale, type Locale } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { resolveOgImage } from '@/lib/components/og-image';
import { JsonLd, howToSchema } from '@/lib/seo/json-ld';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SITE_URL = 'https://femiglow-maroc.com';

const FALLBACK_OG = {
  url: '/og/rituel.svg',
  width: 1200,
  height: 630,
  alt: 'Le rituel FemiGlow',
};

// ---------------------------------------------------------------------------
// generateMetadata — SEO localisé
// ---------------------------------------------------------------------------

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'Le rituel' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'marketing.rituel.metadata',
  });
  const og = (await resolveOgImage('rituel-og')) ?? FALLBACK_OG;
  const canonicalPath = `/${params.locale}/rituel`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonicalPath,
      languages: {
        fr: '/fr/rituel',
        ar: '/ar/rituel',
        en: '/en/rituel',
        'x-default': '/fr/rituel',
      },
    },
    openGraph: {
      type: 'article',
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

// ISR — régénération heure par heure, cohérent avec /rituel legacy.
export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RituelPage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  const tHowto = await getTranslations({
    locale,
    namespace: 'marketing.rituel.howto',
  });

  // Phase 3 T3.2/T3.4 : pass locale aux fetches CMS.
  const [content, journalArticles, homepage] = await Promise.all([
    cms.getRituelPageContent({ locale }),
    cms.getArticles({ limit: 3, featured: true, locale }),
    cms.getHomepageContent({ locale }),
  ]);

  const crossSlugs = new Set(content.journalCrossSlugs);
  const crossArticles = journalArticles.filter((a) => crossSlugs.has(a.slug));
  const finalArticles =
    crossArticles.length >= 3 ? crossArticles : journalArticles;

  return (
    <>
      <JsonLd
        data={howToSchema({
          name: tHowto('name'),
          description: tHowto('description'),
          totalTimeIso: 'PT5M',
          slug: `/${locale}/rituel`,
          steps: homepage.gestes.map((g) => ({
            name: g.titre,
            text: g.description,
          })),
        })}
      />
      <HeroLifestyleBound
        data={content.hero}
        priority
        componentKey="rituel-hero-lifestyle"
      />
      <SectionNarrativeBound
        kicker={content.origine.kicker}
        titre={content.origine.titre}
        paragraphes={content.origine.paragraphes}
        image={content.origine.photoSepia}
        imageSide="right"
        componentKey="rituel-origine-sepia"
      />
      <Fleuron />
      <VideoPlayer4GestesBound
        video={content.videoGestes}
        componentKey="rituel-video-4-gestes"
      />
      <Fleuron />
      <SciencesDuSoin data={content.sciences} />
      <Fleuron />
      <InterviewQRBound
        data={content.interview}
        componentKey="rituel-portrait-salma"
      />
      <PivotBanner data={content.pivot} />
      <JournalGridBound
        articles={finalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures de la maison."
        variant="symmetric"
        limit={3}
      />
    </>
  );
}
