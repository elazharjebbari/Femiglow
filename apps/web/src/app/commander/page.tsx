import type { Metadata } from 'next';
import { CheckoutPage } from '@/components/commerce/CheckoutPage';
import { JsonLd, breadcrumbListSchema } from '@/lib/seo/json-ld';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Commander',
  description:
    'Trois étapes mesurées pour confirmer votre commande FemiGlow : coordonnées, livraison, validation. Paiement à la livraison disponible.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/commander' },
};

export default function CommanderPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: 'Accueil', url: routes.home },
          { name: 'Le panier', url: routes.panier },
          { name: 'Commander', url: routes.commander },
        ])}
      />
      <CheckoutPage />
    </>
  );
}
