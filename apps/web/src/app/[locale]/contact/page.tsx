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

import {
  ContactForm,
  type ContactFormStrings,
} from '@/components/forms/ContactForm';
import {
  ContactCrossLinks,
  ContactHero,
  DirectContactBlock,
  FAQAccordion,
  type FAQAccordionItem,
} from '@/components/sections';
import { getContactHeroStringsForLocale } from '@/components/sections/ContactHero';
import { getDirectContactStringsForLocale } from '@/components/sections/DirectContactBlock';
import { getFAQAccordionHeaderForLocale } from '@/components/sections/FAQAccordion';
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

/**
 * Token sentinel pour isoler le préfixe de `form.error.body` (qui contient
 * un `{email}` ICU). On interpole ce token puis on split dessus : ErrorState
 * rend lui-même le lien email + le point final.
 */
const EMAIL_TOKEN = '@@EMAIL@@';

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

  // Phase 7 wiring — libellés localisés du formulaire (composant client).
  const contactFormStrings: ContactFormStrings = {
    fieldName: t('form.field.name'),
    fieldEmail: t('form.field.email'),
    fieldPhone: t('form.field.phone'),
    fieldCompany: t('form.field.company'),
    fieldRole: t('form.field.role'),
    fieldOrderNumber: t('form.field.order_number'),
    fieldOrderNumberHint: t('form.field.order_number_hint'),
    fieldMessage: t('form.field.message'),
    fieldMessageHint: t('form.field.message_hint'),
    honeypotLabel: t('form.honeypot_label'),
    typeLegend: t('form.type.legend'),
    typeQuestion: t('form.type.question'),
    typeOrder: t('form.type.order'),
    typeProfessional: t('form.type.professional'),
    gdprConsentText: t('form.gdpr_consent_text'),
    gdprConsentLink: t('form.gdpr_consent_link'),
    newsletterConsent: t('form.newsletter_consent'),
    submit: t('form.submit'),
    successTitle: t('form.success.title'),
    successBody: t('form.success.body'),
    // `error.body` catalogue = « … à {email}. » ; le composant ErrorState
    // rend lui-même le lien email + le point final. On ne conserve donc que
    // le préfixe situé avant le `{email}` (split sur un sentinel).
    errorBody: t('form.error.body', { email: EMAIL_TOKEN })
      .split(EMAIL_TOKEN)[0]!
      .trimEnd(),
  };

  // Phase 7C — Pré-résolution des strings localisés. Les composants
  // section restent sync (compat tests vitest) ; on leur passe un objet
  // plain qui inclut les bonnes traductions FR/AR/EN.
  const [contactHeroStrings, directContactStrings, faqHeader] = await Promise.all([
    getContactHeroStringsForLocale(locale),
    getDirectContactStringsForLocale(locale),
    getFAQAccordionHeaderForLocale(locale),
  ]);

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
      <ContactHero email={CONTACT_EMAIL} strings={contactHeroStrings} />
      <DirectContactBlock
        email={CONTACT_EMAIL}
        strings={directContactStrings}
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
          <ContactForm defaultType={defaultType} strings={contactFormStrings} />
        </Container>
      </section>
      <FAQAccordion items={faqs} header={faqHeader} />
      <ContactCrossLinks links={crossLinks} />
    </>
  );
}
