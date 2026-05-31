/**
 * `Footer` — pied de page éditorial FemiGlow.
 *
 * Phase 7C (2026-05) — Localisé via `next-intl`.
 *
 * Détection de la locale : on lit le premier segment du `pathname` côté
 * client n'est PAS possible (server component). Donc on utilise
 * `getLocale()` qui retourne la locale active DANS le scope du
 * `NextIntlClientProvider`. Si rendu hors d'un provider (route legacy
 * `(marketing)/*`), `getLocale()` throw — on catch et on retombe sur FR.
 *
 * Cette approche garantit :
 *  - `/fr/*` → footer FR (via provider).
 *  - `/ar/*` → footer AR (via provider).
 *  - `/contact` legacy → footer FR (catch fallback).
 *
 * @see docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A4
 */
import { getLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';
import { Text } from '@/components/ui/Text';
import { Kicker } from '@/components/ui/Kicker';
import { FooterLegalLinks } from '@/components/legal/FooterLegalLinks';
import { routes } from '@/lib/routes';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n.config';

/**
 * Construit un href localisé. Sur la home (`/`) → `/<locale>` ; sinon
 * préfixe `<locale>` au path. En `defaultLocale` (FR) on garde les paths
 * legacy non préfixés pour back-compat (le middleware `(marketing)/*`
 * continue de servir).
 */
function localizedHref(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === '/') return `/${locale}`;
  if (path.startsWith('/')) return `/${locale}${path}`;
  return path;
}

async function safeGetLocale(): Promise<Locale> {
  try {
    const raw = await getLocale();
    if (isLocale(raw)) return raw;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function Footer() {
  const locale = await safeGetLocale();
  // Si hors provider (legacy `(marketing)`), `getTranslations` throw aussi.
  // On try/catch et on charge les strings FR hardcodées en fallback.
  let strings: FooterStrings;
  try {
    strings = await loadStrings(locale);
  } catch {
    strings = LEGACY_STRINGS_FR;
  }

  return (
    <footer role="contentinfo" className="bg-encre text-creme">
      <Container width="page">
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size="md" tone="on-dark" />
            <Text size="small" tone="on-dark" className="mt-4 max-w-xs opacity-80">
              {strings.tagline}
            </Text>
          </div>
          <nav aria-label={strings.columnRituel}>
            <Kicker tone="on-dark">{strings.columnRituel}</Kicker>
            <ul className="mt-4 space-y-3">
              <FooterLink href={localizedHref(routes.rituel, locale)} label={strings.linkRituel} />
              <FooterLink href={localizedHref(routes.kit, locale)} label={strings.linkKit} />
              <FooterLink href={localizedHref(routes.journal, locale)} label={strings.linkJournal} />
              <FooterLink href={localizedHref(routes.maison, locale)} label={strings.linkMaison} />
            </ul>
          </nav>
          <nav aria-label={strings.columnAssistance}>
            <Kicker tone="on-dark">{strings.columnAssistance}</Kicker>
            <ul className="mt-4 space-y-3">
              <FooterLink href={localizedHref(routes.contact, locale)} label={strings.linkContact} />
              <FooterLink href={localizedHref('/legal/livraison', locale)} label={strings.linkLivraison} />
              <FooterLink href={localizedHref('/legal/retours-remboursements', locale)} label={strings.linkRetours} />
            </ul>
          </nav>
          <nav aria-label={strings.columnLegal}>
            <Kicker tone="on-dark">{strings.columnLegal}</Kicker>
            <FooterLegalLinks />
          </nav>
        </div>
        <div className="border-t border-creme/10 py-6 text-xs text-creme/60 space-y-1">
          <div>
            {strings.address} ·{' '}
            <a
              href="mailto:info@femiglow-maroc.com"
              className="hover:text-creme"
            >
              info@femiglow-maroc.com
            </a>{' '}
            ·{' '}
            <a href="tel:+212630035905" className="hover:text-creme">
              +212 630-035905
            </a>
          </div>
          <div>{strings.copyright}</div>
        </div>
      </Container>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  // Import dynamique pour éviter d'introduire un cycle Link → use client.
  // Next.js permet d'utiliser <a> classique ici (server component, lien
  // simple). `<Link>` n'apporterait que le prefetch automatique — pour
  // une nav footer rare, on s'en passe sans régression UX mesurable.
  return (
    <li>
      <a
        href={href}
        className="text-sm text-creme/80 transition-colors hover:text-creme"
      >
        {label}
      </a>
    </li>
  );
}

interface FooterStrings {
  tagline: string;
  columnRituel: string;
  columnAssistance: string;
  columnLegal: string;
  linkRituel: string;
  linkKit: string;
  linkJournal: string;
  linkMaison: string;
  linkContact: string;
  linkLivraison: string;
  linkRetours: string;
  address: string;
  copyright: string;
}

const LEGACY_STRINGS_FR: FooterStrings = {
  tagline:
    'Maison marocaine de soin pour les ongles. Le rituel, en cinq minutes.',
  columnRituel: 'Le rituel',
  columnAssistance: 'Assistance',
  columnLegal: 'Légal',
  linkRituel: 'Le rituel',
  linkKit: 'Le kit',
  linkJournal: 'Journal',
  linkMaison: 'Maison',
  linkContact: 'Contact',
  linkLivraison: 'Livraison',
  linkRetours: 'Retours',
  address: 'FemiGlow · 25 bis avenue Patrice Lumumba, Rabat',
  copyright: `© ${new Date().getFullYear()} FemiGlow — Rabat. Tous droits réservés.`,
};

async function loadStrings(locale: Locale): Promise<FooterStrings> {
  const [tNav, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'navigation' }),
    getTranslations({ locale, namespace: 'navigation.footer' }),
  ]);
  // Year est interpolé côté ICU. On le passe ici pour ne pas garder un
  // placeholder `{year}` qui ferait throw next-intl.
  const year = new Date().getFullYear();
  return {
    tagline: tFooter('tagline'),
    columnRituel: tFooter('column_rituel'),
    columnAssistance: tFooter('column_assistance'),
    columnLegal: tFooter('column_legal'),
    linkRituel: tNav('rituel'),
    linkKit: tNav('kit_alt'),
    linkJournal: tFooter('link_journal'),
    linkMaison: tFooter('link_maison'),
    linkContact: tNav('contact'),
    linkLivraison: tFooter('link_livraison'),
    linkRetours: tFooter('link_retours'),
    address: tFooter('address'),
    copyright: tFooter('copyright', { year }),
  };
}
