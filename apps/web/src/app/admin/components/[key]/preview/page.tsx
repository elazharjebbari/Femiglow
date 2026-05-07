/**
 * Route preview RSC dédiée à la live preview admin (F4 / P9).
 *
 * - Servie via iframe depuis `/admin/components/[key]`.
 * - Résout les champs via la cascade DRAFT (non cachée).
 * - Délègue le rendu à `renderComponentByKey` qui mappe le `key` vers
 *   le composant RSC migré (placeholder pour les non-migrés).
 *
 * Sécurité : l'auth admin est vérifiée comme sur la page parente.
 *
 * Cf. docs/components-cms/frontend/04-live-preview.md
 */
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { resolveComponentFieldsDraft } from '@/lib/components/field-resolver';
import { renderComponentByKey } from '@/lib/components/render-by-key';
import { PreviewListener } from '@/components/admin/components/PreviewListener';
import type { PreviewWidth } from '@/components/admin/components/preview-protocol';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { key: string };
  searchParams: { w?: string; locale?: string };
}

function isWidth(v: string | undefined): v is PreviewWidth {
  return v === 'mobile' || v === 'tablet' || v === 'desktop';
}

export default async function ComponentPreviewPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  // Auth admin obligatoire pour ne pas exposer les drafts au public.
  await requireAdmin(`/admin/components/${params.key}/preview`);

  const component = await getSiteComponentByKey(params.key);
  if (!component) notFound();

  const locale = searchParams.locale ?? 'fr';
  const width: PreviewWidth = isWidth(searchParams.w) ? searchParams.w : 'desktop';
  const fields = await resolveComponentFieldsDraft(params.key, locale);

  return (
    <div
      className="preview-root min-h-screen bg-white"
      data-preview="true"
      data-width={width}
      data-component-key={params.key}
    >
      <main className={`preview preview--${width}`}>
        {await renderComponentByKey(params.key, { fields })}
      </main>
      <PreviewListener componentKey={params.key} />
    </div>
  );
}
