import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

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
  // Phase 8 — libellés localisés par slug (`navigation.footer.legal_links`),
  // fallback sur le titre DB / labelOverride si aucune clé. Les titres légaux
  // DB restent FR ; on prend la clé i18n quand elle existe pour /ar & /en.
  const t = await getTranslations({ namespace: 'navigation.footer.legal_links' });
  const localizeLabel = (slug: string, fallback: string): string => {
    const key = slug.replace(/-/g, '_');
    return t.has(key) ? t(key) : fallback;
  };

  let links: Array<{ slug: string; label: string }> = [];
  try {
    const rows = await listPlacementsForZone(zoneKey);
    links = rows.map((r) => ({
      slug: r.pageSlug,
      label: localizeLabel(r.pageSlug, r.labelOverride ?? r.title),
    }));
  } catch {
    links = [];
  }

  if (links.length === 0) {
    links = DEFAULT_LINKS.map((l) => ({ slug: l.slug, label: localizeLabel(l.slug, l.label) }));
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
