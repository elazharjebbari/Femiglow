import type { Metadata } from 'next';
import { MerciClient, MerciFallback } from '@/components/commerce/MerciClient';
import { JsonLd, breadcrumbListSchema } from '@/lib/seo/json-ld';
import { orderIdSchema } from '@/lib/schemas';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Merci',
  description: 'Votre commande FemiGlow est confirmée.',
  robots: { index: false, follow: false },
  other: {
    'Cache-Control': 'no-store',
  },
};

interface SearchParams {
  searchParams: { order?: string };
}

export default function MerciPage({ searchParams }: SearchParams) {
  const parsed = orderIdSchema.safeParse(searchParams.order);

  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: 'Accueil', url: routes.home },
          { name: 'Merci', url: '/merci' },
        ])}
      />
      {parsed.success ? (
        <MerciClient orderId={parsed.data} />
      ) : (
        <MerciFallback orderId={searchParams.order} />
      )}
    </>
  );
}
