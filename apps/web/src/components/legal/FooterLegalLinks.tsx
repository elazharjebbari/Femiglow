import Link from 'next/link';

import { listPlacementsForZone } from '@/lib/legal/repository';

interface FooterLegalLinksProps {
  zoneKey?: string;
  className?: string;
  linkClassName?: string;
}

const DEFAULT_LINKS = [
  { slug: 'mentions-legales', label: 'Mentions légales' },
  { slug: 'cgv', label: 'CGV' },
  { slug: 'confidentialite', label: 'Confidentialité' },
  { slug: 'cookies', label: 'Cookies' },
];

export async function FooterLegalLinks({
  zoneKey = 'footer-main',
  className,
  linkClassName,
}: FooterLegalLinksProps) {
  let links: Array<{ slug: string; label: string }> = [];
  try {
    const rows = await listPlacementsForZone(zoneKey);
    links = rows.map((r) => ({ slug: r.pageSlug, label: r.labelOverride ?? r.title }));
  } catch {
    links = [];
  }

  if (links.length === 0) {
    links = DEFAULT_LINKS;
  }

  return (
    <ul className={className ?? 'mt-4 space-y-3'}>
      {links.map((link) => (
        <li key={link.slug}>
          <Link
            href={`/legal/${link.slug}`}
            className={linkClassName ?? 'text-sm text-creme/80 transition-colors hover:text-creme'}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
