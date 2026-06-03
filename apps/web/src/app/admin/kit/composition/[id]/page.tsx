/**
 * `/admin/kit/composition/[id]` — éditeur dédié pour un sous-produit.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitCompositionEditor } from '@/components/admin/kit-composition/KitCompositionEditor';
import { resolveKitCompositionItemDraft } from '@/lib/kit/composition/resolver';
import { getKitCompositionOverride } from '@/lib/kit/composition/store';
import {
  KIT_COMPOSITION_SUB_PRODUCT_IDS,
  type KitCompositionSubProductId,
} from '@/lib/kit/composition/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function AdminKitCompositionEditorPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const session = await requireAdmin(`/admin/kit/composition/${params.id}`);

  if (
    !(KIT_COMPOSITION_SUB_PRODUCT_IDS as readonly string[]).includes(params.id)
  ) {
    notFound();
  }
  const subProductId = params.id as KitCompositionSubProductId;

  const override = getKitCompositionOverride(subProductId);
  const resolved = resolveKitCompositionItemDraft(subProductId);
  if (!resolved) notFound();

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          <Link href="/admin/kit/composition" className="hover:underline">
            ← Composition /kit
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          {resolved.subProduct.name} — {resolved.subProduct.volume}
        </h1>
      </header>

      <KitCompositionEditor
        subProductId={subProductId}
        initial={override}
        baseSubProduct={resolved.subProduct}
        source={resolved.meta.source}
      />
    </AdminShell>
  );
}
