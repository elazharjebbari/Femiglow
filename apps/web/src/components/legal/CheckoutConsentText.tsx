import Link from 'next/link';

import { listPlacementsForZone } from '@/lib/legal/repository';

interface CheckoutConsentTextProps {
  className?: string;
}

const DEFAULT_LINKS = [
  { slug: 'cgv', label: 'CGV' },
  { slug: 'confidentialite', label: 'Politique de confidentialité' },
];

export async function CheckoutConsentText({ className }: CheckoutConsentTextProps) {
  let links: Array<{ slug: string; label: string }> = [];
  try {
    const rows = await listPlacementsForZone('checkout-consent');
    links = rows.map((r) => ({ slug: r.pageSlug, label: r.labelOverride ?? r.title }));
  } catch {
    links = [];
  }
  if (links.length === 0) links = DEFAULT_LINKS;

  return (
    <span className={className ?? 'text-sm text-encre/70'}>
      En validant la commande, vous reconnaissez avoir pris connaissance et accepter les{' '}
      {links.map((link, idx) => (
        <span key={link.slug}>
          <Link href={`/legal/${link.slug}`} className="underline underline-offset-2 hover:text-encre">
            {link.label}
          </Link>
          {idx < links.length - 2 ? ', ' : idx === links.length - 2 ? ' et ' : ''}
        </span>
      ))}
      .
    </span>
  );
}
