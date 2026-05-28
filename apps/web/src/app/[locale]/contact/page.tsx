/**
 * Page `/[locale]/contact` — POC migration depuis `/contact` legacy.
 *
 * Première vraie page localisée du sprint i18n. Démontre les patterns :
 *  - `generateMetadata` async avec `getTranslations({ locale, namespace })`
 *  - `setRequestLocale` requis pour les server components
 *  - Construction d'arrays statiques depuis des keys de namespace
 *  - Réutilisation des composants visuels existants (props traduites)
 *  - JSON-LD avec données localisées
 *
 * Quand `I18N_ENABLED=true` :
 *  - `/fr/contact` → ce fichier avec FR
 *  - `/ar/contact` → ce fichier avec AR (RTL)
 *  - `/en/contact` → ce fichier avec EN
 *  - `/contact` legacy → middleware redirige vers `/{detected_locale}/contact`
 *
 * Tant que `I18N_ENABLED=false` :
 *  - `/contact` legacy continue (app/(marketing)/contact/page.tsx)
 *  - Cette route reste accessible directement si on tape l'URL avec préfixe
 *    mais le middleware ne redirige PAS — c'est OK pour les tests.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.3
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactForm } from '@/components/forms/ContactForm';
import {
  ContactCrossLinks,
  ContactHero,
  DirectContactBlock,
  FAQAccordion,
  type FAQAccordionItem,
} from '@/components/sections';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { isLocale, type Locale } from '@/i18n.config';
import { JsonLd } from '@/lib/seo/json-ld';
import { contactTypeSchema, type ContactType } from '@/lib/schemas';

// ---------------------------------------------------------------------------
// Constantes business (non-traduisibles)
// ---------------------------------------------------------------------------

const CONTACT_EMAIL = 'info@femiglow-maroc.com';
const CONTACT_PHONE = '+212 630-035905';
const SITE_URL = 'https://femiglow-maroc.com';

const FAQ_IDS = ['duree', 'fragiles', 'livraison', 'formation', 'echantillon'] as const;

// ---------------------------------------------------------------------------
// generateMetadata — SEO localisé
// ---------------------------------------------------------------------------

interface PageProps {
  params: { locale: string };
  searchParams?: { type?: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'Contact' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'marketing.contact.metadata',
  });

  const canonicalPath = `/${params.locale}/contact`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonicalPath,
      languages: {
        fr: '/fr/contact',
        ar: '/ar/contact',
        en: '/en/contact',
        'x-default': '/fr/contact',
      },
    },
    openGraph: {
      type: 'website',
      title: t('title'),
      description: t('og_description'),
      url: `${SITE_URL}${canonicalPath}`,
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
    },
    twitter: {
      card: 'summary',
      title: t('title'),
      description: t('og_description'),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDefaultType(raw: string | undefined): ContactType {
  const parsed = contactTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'question';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ContactPage({
  params,
  searchParams,
}: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'marketing.contact' });
  const defaultType = resolveDefaultType(searchParams?.type);

  // Construction de la liste FAQ depuis les clés du namespace.
  // Les IDs sont stables (utilisés pour l'accordion + ancres URL),
  // les question/answer sont traduits.
  const faqs: FAQAccordionItem[] = FAQ_IDS.map((id) => ({
    id: `${id}-rituel`,
    question: t(`faq.${id}.question`),
    answer: t(`faq.${id}.answer`),
  }));

  const crossLinks = [
    { href: `/${locale}/rituel`, label: t('crosslinks.rituel') },
    { href: `/${locale}/kit`, label: t('crosslinks.kit') },
    { href: `/${locale}/maison`, label: t('crosslinks.maison') },
  ];

  // JSON-LD ContactPoint — données structurées SEO localisées.
  const contactPointSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE.replace(/\s|-/g, ''),
    areaServed: 'MA',
    availableLanguage:
      locale === 'ar'
        ? ['Arabic', 'French']
        : locale === 'en'
          ? ['English', 'French']
          : ['French', 'Arabic'],
    url: `${SITE_URL}/${locale}/contact`,
  };

  return (
    <>
      <JsonLd data={contactPointSchema} />
      <ContactHero email={CONTACT_EMAIL} />
      <DirectContactBlock
        email={CONTACT_EMAIL}
        streetAddress="25 bis avenue Patrice Lumumba"
        district="Rabat"
      />
      <section
        className="border-t border-encre/10 bg-creme py-16 sm:py-20"
        aria-labelledby="contact-form-heading"
      >
        <Container width="prose">
          <Heading
            as="h2"
            size="display-sm"
            id="contact-form-heading"
            className="mb-10"
          >
            {t('form.section_title')}
          </Heading>
          <ContactForm defaultType={defaultType} />
        </Container>
      </section>
      <FAQAccordion items={faqs} />
      <ContactCrossLinks links={crossLinks} />
    </>
  );
}
