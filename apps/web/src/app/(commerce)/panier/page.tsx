import type { Metadata } from 'next';
import {
  CartHero,
  TrustSignals,
  JournalCrossLink,
} from '@/components/sections';
import { CartLayout } from '@/components/commerce';
import { JsonLd, breadcrumbListSchema } from '@/lib/seo/json-ld';

export const metadata: Metadata = {
  title: 'Le panier',
  description:
    'Le r\u00E9capitulatif de votre rituel, avant la commande.',
  alternates: { canonical: '/panier' },
  robots: { index: false, follow: false },
};

const breadcrumb = breadcrumbListSchema([
  { name: 'Accueil', url: '/' },
  { name: 'Le kit', url: '/kit' },
  { name: 'Le panier', url: '/panier' },
]);

export default function PanierPage() {
  return (
    <>
      <JsonLd data={breadcrumb} />
      <CartHero />
      <CartLayout />
      <TrustSignals />
      <JournalCrossLink
        href="/journal"
        kicker="En attendant"
        title={'Lire le journal de la maison.'}
        description={'Trois lettres par saison. Aucune urgence.'}
      />
    </>
  );
}
