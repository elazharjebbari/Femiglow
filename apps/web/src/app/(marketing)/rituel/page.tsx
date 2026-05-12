import type { Metadata } from 'next';
import { cms } from '@/lib/cms';
import { HeroLifestyleBound } from '@/components/sections/HeroLifestyleBound';
import { SectionNarrativeBound } from '@/components/sections/SectionNarrativeBound';
import { VideoPlayer4GestesBound } from '@/components/sections/VideoPlayer4GestesBound';
import { SciencesDuSoin } from '@/components/sections/SciencesDuSoin';
import { InterviewQRBound } from '@/components/sections/InterviewQRBound';
import { PivotBanner } from '@/components/sections/PivotBanner';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { Fleuron } from '@/components/ui/Fleuron';
import { JsonLd, howToSchema } from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';

const FALLBACK_OG = {
  url: '/og/rituel.svg',
  width: 1200,
  height: 630,
  alt: 'Le rituel FemiGlow',
};

export async function generateMetadata(): Promise<Metadata> {
  const og = (await resolveOgImage('rituel-og')) ?? FALLBACK_OG;
  return {
    title: 'Le rituel \u2014 manucure japonaise halal, deux gestes',
    description:
      'Origine japonaise, sciences du soin, interview de Souheila \u00E0 Rabat. Le rituel FemiGlow racont\u00e9 sans pr\u00E9cipitation.',
    alternates: { canonical: '/rituel' },
    openGraph: {
      type: 'article',
      title: 'Le rituel FemiGlow',
      description: 'Deux gestes, un polissoir, une m\u00e9thode lente, racont\u00e9e \u00e0 Rabat.',
      locale: 'fr_MA',
      siteName: 'FemiGlow',
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Le rituel FemiGlow',
      description: 'Deux gestes, un polissoir, une m\u00e9thode lente, racont\u00e9e \u00e0 Rabat.',
      images: [og.url],
    },
  };
}

export const revalidate = 3600;

export default async function RituelPage() {
  const [content, journalArticles, homepage] = await Promise.all([
    cms.getRituelPageContent(),
    cms.getArticles({ limit: 3, featured: true }),
    cms.getHomepageContent(),
  ]);

  const crossSlugs = new Set(content.journalCrossSlugs);
  const crossArticles = journalArticles.filter((a) => crossSlugs.has(a.slug));
  const finalArticles = crossArticles.length >= 3 ? crossArticles : journalArticles;

  return (
    <>
      <JsonLd
        data={howToSchema({
          name: 'Le rituel FemiGlow',
          description:
            'Deux gestes et un polissoir en cinq minutes pour le soin lent des ongles, expliqu\u00e9s pas \u00e0 pas \u2014 manucure japonaise halal.',
          totalTimeIso: 'PT5M',
          slug: '/rituel',
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
