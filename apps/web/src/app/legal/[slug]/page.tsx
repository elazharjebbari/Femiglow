import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/Kicker';
import { LegalContactBlock } from '@/components/legal/LegalContactBlock';
import { LegalPrintButton } from '@/components/legal/LegalPrintButton';
import { LegalRelatedLinks } from '@/components/legal/LegalRelatedLinks';
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

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const slugs = await listPublishedSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPublishedLegalPage(params.slug);
  if (!page) return { title: 'Page introuvable' };
  const robots = page.includeInSearch
    ? { index: true, follow: true }
    : { index: false, follow: true };
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    title: page.title,
    description: page.description ?? undefined,
    alternates: { canonical: page.canonicalUrl ?? `${base}/legal/${page.slug}` },
    robots,
  };
}

export default async function LegalPage({ params }: PageProps) {
  const page = await getPublishedLegalPage(params.slug);
  if (!page) {
    const redirectTo = await lookupSlugRedirect(params.slug);
    if (redirectTo) permanentRedirect(`/legal/${redirectTo}`);
    notFound();
  }

  const vars = await listAllTemplateVars();
  const rendered = await renderLegalMarkdownWithDbVars(
    page.bodyMd,
    // LEGAL-V2 — `sensitive` est nécessaire pour que buildPublicVarMap
    // applique le placeholder "information sur demande" sur les vars
    // sensibles (ICE, COMPANY_RC, etc.).
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
            <span aria-hidden="true">◀</span> Retour à l&apos;accueil
          </Link>
        </div>

        <header className="mb-10 flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <Kicker>Pages légales</Kicker>
            <h1 className="mt-3 font-heading text-4xl text-encre sm:text-5xl">{page.title}</h1>
            {page.description ? (
              <p className="mt-4 text-base text-encre/70">{page.description}</p>
            ) : null}
            <p className="mt-3 text-xs uppercase tracking-wider text-encre/50">
              Dernière mise à jour :{' '}
              <time dateTime={lastUpdated.toISOString()}>{formatFrenchDate(lastUpdated)}</time>
              <span aria-hidden="true"> · </span>v{page.version}
            </p>
          </div>
          <div className="shrink-0 print:hidden">
            <LegalPrintButton />
          </div>
        </header>

        <div
          className={
            hasToc
              ? 'grid gap-10 lg:grid-cols-[1fr,16rem]'
              : 'block'
          }
        >
          <article
            className="prose-femiglow"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />

          {hasToc ? (
            <nav
              aria-label="Sommaire"
              className="order-first lg:order-last lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto rounded-2xl border border-encre/10 bg-white/60 p-5 print:hidden"
            >
              <p className="text-xs uppercase tracking-wider text-encre/50">Sommaire</p>
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
        <LegalContactBlock lastUpdated={lastUpdated} version={page.version} />
      </Container>
    </main>
  );
}

const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatFrenchDate(d: Date): string {
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
