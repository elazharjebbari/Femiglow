/**
 * Page `/[locale]/legal/[slug]` — migration depuis `/legal/[slug]` legacy.
 *
 * Localise tous les éléments "chrome" (back_home, kicker, last_updated, toc).
 * Le body markdown reste dans la langue source du CMS — Phase 3 ajoutera
 * le fetch par locale (le champ `legal_pages.locale` existe déjà en DB).
 *
 * Le format de date utilise `getFormatter().dateTime()` de next-intl qui
 * respecte la locale + timezone Africa/Casablanca.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.8
 */
import { Link } from '@/i18n/navigation';
import { isLocale, type Locale, LOCALES } from '@/i18n.config';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';

import { LegalContactBlock } from '@/components/legal/LegalContactBlock';
import { LegalPrintButton } from '@/components/legal/LegalPrintButton';
import { LegalRelatedLinks } from '@/components/legal/LegalRelatedLinks';
import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/Kicker';
import { env } from '@/lib/env';
import { lookupSlugRedirect } from '@/lib/legal/redirects';
import {
  getPublishedLegalPage,
  listAllTemplateVars,
  listPublishedSlugs,
} from '@/lib/legal/repository';
import { renderLegalMarkdownWithDbVars } from '@/lib/legal/render';

export const dynamic = 'force-static';
export const revalidate = 3600;

interface PageProps {
  params: { locale: string; slug: string };
}

/**
 * Pré-render statique : tous les slugs publiés × toutes les locales.
 */
export async function generateStaticParams() {
  try {
    const slugs = await listPublishedSlugs();
    return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'Legal' };
  }
  const page = await getPublishedLegalPage(params.slug);
  if (!page) {
    const t = await getTranslations({
      locale: params.locale,
      namespace: 'legal.chrome',
    });
    return { title: t('not_found_title') };
  }
  const robots = page.includeInSearch
    ? { index: true, follow: true }
    : { index: false, follow: true };
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    title: page.title,
    description: page.description ?? undefined,
    alternates: {
      canonical:
        page.canonicalUrl ?? `${base}/${params.locale}/legal/${page.slug}`,
      languages: {
        fr: `/fr/legal/${page.slug}`,
        ar: `/ar/legal/${page.slug}`,
        en: `/en/legal/${page.slug}`,
        'x-default': `/fr/legal/${page.slug}`,
      },
    },
    robots,
  };
}

export default async function LegalPage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  const tChrome = await getTranslations({ locale, namespace: 'legal.chrome' });
  const format = await getFormatter({ locale });

  const page = await getPublishedLegalPage(params.slug);
  if (!page) {
    const redirectTo = await lookupSlugRedirect(params.slug);
    if (redirectTo) permanentRedirect(`/${locale}/legal/${redirectTo}`);
    notFound();
  }

  const vars = await listAllTemplateVars();
  const rendered = await renderLegalMarkdownWithDbVars(
    page.bodyMd,
    vars.map((v) => ({ key: v.key, value: v.value, sensitive: v.sensitive })),
    { mode: 'public', now: page.publishedAt ?? page.updatedAt },
  );

  const lastUpdated = page.publishedAt ?? page.updatedAt;
  const hasToc = rendered.headings.length > 2;

  return (
    <main className="bg-creme py-10 sm:py-16">
      <Container width="content">
        {/* Retour — souvent omis sur les pages atterries via Google */}
        <div className="mb-6 print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-encre/70 underline-offset-4 hover:text-encre hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
          >
            <span aria-hidden="true">◀</span> {tChrome('back_home')}
          </Link>
        </div>

        <header className="mb-10 flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <Kicker>{tChrome('kicker')}</Kicker>
            <h1 className="mt-3 font-heading text-4xl text-encre sm:text-5xl">
              {page.title}
            </h1>
            {page.description ? (
              <p className="mt-4 text-base text-encre/70">{page.description}</p>
            ) : null}
            <p className="mt-3 text-xs uppercase tracking-wider text-encre/50">
              {tChrome('last_updated')} :{' '}
              <time dateTime={lastUpdated.toISOString()}>
                {format.dateTime(lastUpdated, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <span aria-hidden="true"> · </span>
              {tChrome('version_prefix')}
              {page.version}
            </p>
          </div>
          <div className="shrink-0 print:hidden">
            <LegalPrintButton />
          </div>
        </header>

        <div
          className={hasToc ? 'grid gap-10 lg:grid-cols-[1fr,16rem]' : 'block'}
        >
          <article
            className="prose-femiglow"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />

          {hasToc ? (
            <nav
              aria-label={tChrome('toc_aria')}
              className="order-first lg:order-last lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto rounded-2xl border border-encre/10 bg-white/60 p-5 print:hidden"
            >
              <p className="text-xs uppercase tracking-wider text-encre/50">
                {tChrome('toc')}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {rendered.headings.map((h) => (
                  <li key={h.id} className={h.depth === 3 ? 'pl-4' : ''}>
                    <a
                      href={`#${h.id}`}
                      className="block rounded-sm text-encre/80 transition-colors hover:text-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        <LegalRelatedLinks currentSlug={page.slug} />
        <LegalContactBlock
          lastUpdated={lastUpdated}
          version={page.version}
        />
      </Container>
    </main>
  );
}
