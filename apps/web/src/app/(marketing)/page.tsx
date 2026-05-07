import type { Metadata } from 'next';
import { cms } from '@/lib/cms';
import { HeroBound } from '@/components/sections/HeroBound';
import { GestesGrid } from '@/components/sections/GestesGrid';
import { Manifeste } from '@/components/sections/Manifeste';
import { AvisStripBound } from '@/components/sections/AvisStripBound';
import { JournalExtraitsBound } from '@/components/sections/JournalExtraitsBound';
import { NewsletterBlock } from '@/components/sections/NewsletterBlock';
import { Fleuron } from '@/components/ui/Fleuron';
import { ScrollMilestonesTracker } from '@/components/tracking/ScrollMilestonesTracker';
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
} from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';

export const revalidate = 3600;

const FALLBACK_OG = {
  url: '/og/home.svg',
  width: 1200,
  height: 630,
  alt: 'FemiGlow',
};

export async function generateMetadata(): Promise<Metadata> {
  const og = (await resolveOgImage('home-og')) ?? FALLBACK_OG;
  return {
    title: 'Maison de soin pour les ongles \u2014 \u00e0 Casablanca',
    description:
      'Trois gestes, cinq minutes, un rituel saisonnier. La maison FemiGlow, \u00e9dit\u00e9e \u00e0 Casablanca.',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      title: 'FemiGlow \u2014 Maison de soin pour les ongles',
      description: 'Trois gestes, cinq minutes, un rituel saisonnier.',
      locale: 'fr_MA',
      siteName: 'FemiGlow',
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'FemiGlow \u2014 Maison de soin pour les ongles',
      description: 'Trois gestes, cinq minutes, un rituel saisonnier.',
      images: [og.url],
    },
  };
}

export default async function HomePage() {
  const [content, journalArticles] = await Promise.all([
    cms.getHomepageContent(),
    cms.getArticles({ limit: 3, featured: true }),
  ]);

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <ScrollMilestonesTracker contentId="home" contentType="page" />
      <HeroBound data={content.hero} priority componentKey="home-hero" />
      <Fleuron />
      <GestesGrid etapes={content.gestes} />
      <Fleuron />
      <Manifeste data={content.manifeste} />
      <Fleuron />
      <AvisStripBound testimonials={content.avis} componentKey="home-avis-strip" />
      <Fleuron />
      <JournalExtraitsBound articles={journalArticles} />
      <NewsletterBlock />
    </>
  );
}
