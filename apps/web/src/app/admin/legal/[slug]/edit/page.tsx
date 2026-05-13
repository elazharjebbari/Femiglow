import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { LegalEditor } from '@/components/admin/legal/LegalEditor';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  getLegalPageBySlug,
  listAllPlacements,
  listAllTemplateVars,
} from '@/lib/legal/repository';
import { detectMissingVars } from '@/lib/legal/vars';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default async function LegalEditPage({ params }: PageProps) {
  const session = await requireAdmin(`/admin/legal/${params.slug}/edit`);
  const page = await getLegalPageBySlug(params.slug);
  if (!page) notFound();

  const [placements, vars] = await Promise.all([listAllPlacements(), listAllTemplateVars()]);
  const pagePlacements = placements.filter((p) => p.pageSlug === page.slug);
  const missing = detectMissingVars(page.bodyMd, vars);

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
            ← Toutes les pages
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            {page.title}
          </h1>
          <p className="mt-1 font-mono text-xs text-stone-500">
            /legal/{page.slug} · v{page.version} · {page.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/legal/${page.slug}`}
            target="_blank"
            rel="noopener"
            className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Aperçu public ↗
          </Link>
        </div>
      </header>

      {missing.length > 0 ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{missing.length} variable(s) à remplir</strong> avant publication :{' '}
          <code>{missing.join(', ')}</code>.{' '}
          <Link href="/admin/legal/template-vars" className="underline">
            Remplir les variables →
          </Link>
        </div>
      ) : null}

      <LegalEditor
        slug={page.slug}
        initialTitle={page.title}
        initialDescription={page.description ?? ''}
        initialBodyMd={page.bodyMd}
        initialIncludeInSearch={page.includeInSearch}
        status={page.status}
        version={page.version}
        templateVars={vars.map((v) => ({ key: v.key, value: v.value, isRequired: v.isRequired }))}
        placements={pagePlacements.map((p) => ({
          zoneKey: p.zoneKey,
          isVisible: p.isVisible,
          displayOrder: p.displayOrder,
          labelOverride: p.labelOverride,
        }))}
      />
    </AdminShell>
  );
}
