import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/Kicker';
import { env } from '@/lib/env';
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
  if (!page) notFound();

  const vars = await listAllTemplateVars();
  const rendered = await renderLegalMarkdownWithDbVars(
    page.bodyMd,
    vars.map((v) => ({ key: v.key, value: v.value })),
    { mode: 'public', now: page.publishedAt ?? page.updatedAt },
  );

  const lastUpdated = page.publishedAt ?? page.updatedAt;

  return (
    <main className="bg-creme py-16 sm:py-20">
      <Container width="content">
        <header className="mb-12 max-w-2xl">
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
        </header>

        {rendered.headings.length > 2 ? (
          <nav
            aria-label="Sommaire"
            className="mb-10 rounded-2xl border border-encre/10 bg-white/60 p-5"
          >
            <p className="text-xs uppercase tracking-wider text-encre/50">Sommaire</p>
            <ul className="mt-3 space-y-1 text-sm">
              {rendered.headings.map((h) => (
                <li key={h.id} className={h.depth === 3 ? 'pl-4' : ''}>
                  <a href={`#${h.id}`} className="text-encre/80 hover:text-encre">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <article
          className="prose-femiglow"
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
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
