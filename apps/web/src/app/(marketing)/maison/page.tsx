import type { Metadata } from 'next';
import { cms } from '@/lib/cms';
import { AtelierGalleryBound } from '@/components/sections/AtelierGalleryBound';
import { CrossLinkTriptyque } from '@/components/sections/CrossLinkTriptyque';
import { EngagementsGrid } from '@/components/sections/EngagementsGrid';
import { Fleuron } from '@/components/ui/Fleuron';
import { HeroMaisonBound } from '@/components/sections/HeroMaisonBound';
import { MatieresGrid } from '@/components/sections/MatieresGrid';
import { SectionNarrative } from '@/components/sections/SectionNarrative';
import { SectionNarrativeBound } from '@/components/sections/SectionNarrativeBound';
import { JsonLd, localBusinessSchema, organizationSchema } from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';

const SITE_URL = 'https://femiglow-maroc.com';

const FALLBACK_OG = {
  url: '/og/maison.svg',
  width: 1200,
  height: 630,
  alt: 'FemiGlow \u2014 La maison',
};

export async function generateMetadata(): Promise<Metadata> {
  const og = (await resolveOgImage('maison-og')) ?? FALLBACK_OG;
  return {
    title: 'La maison \u2014 Rabat',
    description:
      'FemiGlow, maison de soin pour les ongles \u00e9dit\u00e9e \u00e0 Rabat par notre fondatrice, biologiste et formulatrice. L\u2019origine, l\u2019atelier au 25 bis avenue Patrice Lumumba, les mati\u00e8res, les engagements halal et locaux.',
    alternates: { canonical: '/maison' },
    openGraph: {
      type: 'website',
      title: 'La maison FemiGlow \u2014 Rabat',
      description:
        'Maison de soin pour les ongles, \u00e9dit\u00e9e \u00e0 Rabat. Manucure japonaise halal.',
      url: `${SITE_URL}/maison`,
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'La maison FemiGlow \u2014 Rabat',
      description:
        'Maison de soin pour les ongles, \u00e9dit\u00e9e \u00e0 Rabat. Manucure japonaise halal.',
      images: [og.url],
    },
  };
}

export const revalidate = 3600;

export default async function MaisonPage() {
  const content = await cms.getMaisonPageContent();

  return (
    <>
      <JsonLd
        data={localBusinessSchema({
          name: 'FemiGlow',
          url: `${SITE_URL}/maison`,
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
      <AtelierGalleryBound data={content.atelier} />
      <MatieresGrid matieres={content.matieres} />
      <EngagementsGrid engagements={content.engagements} />
      <CrossLinkTriptyque links={content.crossLinks} />
    </>
  );
}
