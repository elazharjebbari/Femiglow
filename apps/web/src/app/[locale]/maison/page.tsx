/**
 * Page `/[locale]/maison` — migration depuis `/maison` legacy.
 *
 * Localise generateMetadata + OG image alt + locale. Le corps de page
 * (HeroMaisonBound, SectionNarrative, MatieresGrid, EngagementsGrid, etc.)
 * reste piloté par le CMS — sera étendu en Phase 3 multilingue.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.5
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AtelierGalleryBound } from '@/components/sections/AtelierGalleryBound';
import { CrossLinkTriptyque } from '@/components/sections/CrossLinkTriptyque';
import { EngagementsGrid } from '@/components/sections/EngagementsGrid';
import { HeroMaisonBound } from '@/components/sections/HeroMaisonBound';
import { MatieresGrid } from '@/components/sections/MatieresGrid';
import { SectionNarrative } from '@/components/sections/SectionNarrative';
import { SectionNarrativeBound } from '@/components/sections/SectionNarrativeBound';
import { Fleuron } from '@/components/ui/Fleuron';
import { isLocale, type Locale } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { resolveOgImage } from '@/lib/components/og-image';
import {
  JsonLd,
  localBusinessSchema,
  organizationSchema,
} from '@/lib/seo/json-ld';

const SITE_URL = 'https://femiglow-maroc.com';

const FALLBACK_OG = {
  url: '/og/maison.svg',
  width: 1200,
  height: 630,
  alt: 'FemiGlow — La maison',
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
    return { title: 'La maison' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'marketing.maison.metadata',
  });
  const og = (await resolveOgImage('maison-og')) ?? FALLBACK_OG;
  const canonicalPath = `/${params.locale}/maison`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonicalPath,
      languages: {
        fr: '/fr/maison',
        ar: '/ar/maison',
        en: '/en/maison',
        'x-default': '/fr/maison',
      },
    },
    openGraph: {
      type: 'website',
      title: t('og_title'),
      description: t('og_description'),
      url: `${SITE_URL}${canonicalPath}`,
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
      images: [
        {
          url: og.url,
          width: og.width,
          height: og.height,
          alt: og.alt || t('og_alt'),
        },
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
// Page
// ---------------------------------------------------------------------------

export default async function MaisonPage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  // Phase 3 T3.2 : pass locale (impl mock ignore, Sanity impl Phase 3.3).
  const [content, tMatieres, tEngagements, tAtelier] = await Promise.all([
    cms.getMaisonPageContent({ locale }),
    // Phase 7 wiring — en-tête localisé de la grille des matières.
    getTranslations({ locale, namespace: 'marketing.maison.matieres.section' }),
    // Phase 7 wiring — en-tête localisé de la grille des engagements.
    getTranslations({
      locale,
      namespace: 'marketing.maison.engagements.section',
    }),
    // Phase 9bis — kicker/titre de la section atelier (« L'atelier » /
    // « Rabat, deux pièces calmes. » fuitaient FR sur /ar).
    getTranslations({ locale, namespace: 'marketing.maison.atelier.section' }),
  ]);
  const matieresHeader = {
    kicker: tMatieres('kicker'),
    title: tMatieres('title'),
  };
  // Phase 9 i18n — libellés des termes (Origine/Pourquoi) des cartes matière.
  const tMatieresLabels = await getTranslations({
    locale,
    namespace: 'marketing.maison.matieres.labels',
  });
  const matieresLabels = {
    origine: tMatieresLabels('origine'),
    pourquoi: tMatieresLabels('pourquoi'),
  };
  const engagementsHeader = {
    kicker: tEngagements('kicker'),
    title: tEngagements('title'),
  };

  return (
    <>
      <JsonLd
        data={localBusinessSchema({
          name: 'FemiGlow',
          url: `${SITE_URL}/${locale}/maison`,
          addressLocality: 'Rabat',
          addressCountry: 'MA',
          streetAddress: content.atelier.adresse,
          areaServed: content.atelier.quartier,
        })}
      />
      <JsonLd data={organizationSchema()} />
      <HeroMaisonBound data={content.hero} componentKey="maison-hero" />
      <SectionNarrative
        id="origine"
        kicker={content.origine.kicker}
        titre={content.origine.titre}
        paragraphes={content.origine.paragraphs}
        image={content.origine.image}
        imageSide={content.origine.imagePosition}
        tone="creme"
      />
      <Fleuron />
      <SectionNarrativeBound
        id="fondatrice"
        kicker={content.fondatrice.kicker}
        titre={content.fondatrice.titre}
        paragraphes={content.fondatrice.paragraphs}
        image={content.fondatrice.image}
        imageSide={content.fondatrice.imagePosition}
        tone="creme"
        componentKey="maison-fondatrice-mains"
        slot="avatar"
      />
      <AtelierGalleryBound
        data={content.atelier}
        kicker={tAtelier('kicker')}
        title={tAtelier('title')}
      />
      <MatieresGrid
        matieres={content.matieres}
        header={matieresHeader}
        labels={matieresLabels}
      />
      <EngagementsGrid
        engagements={content.engagements}
        header={engagementsHeader}
      />
      <CrossLinkTriptyque links={content.crossLinks} />
    </>
  );
}
