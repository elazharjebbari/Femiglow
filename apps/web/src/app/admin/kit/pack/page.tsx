/**
 * `/admin/kit/pack` — éditeur singleton de la section pack `/kit`.
 *
 * RSC qui charge l'override courant + dérive la source (mock /
 * override-draft / override-published) puis délègue à `KitPackEditor`
 * (client). Auth admin obligatoire.
 *
 * cf. docs/pack-section-optim-2026-05/06-admin-ui-ux-design.md
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitPackEditor } from '@/components/admin/kit-pack/KitPackEditor';
import { getKitPackOverride } from '@/lib/kit/pack/store';
import type { KitPackSource } from '@/lib/kit/pack/types';

export const dynamic = 'force-dynamic';

export default async function AdminKitPackPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/kit/pack');
  const override = getKitPackOverride();
  const source: KitPackSource = !override
    ? 'mock'
    : override.publishedAt !== null
      ? 'override-published'
      : 'override-draft';

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <Link
          href="/admin/components?group=kit"
          className="mb-2 inline-block text-xs text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
        >
          ← Composants /kit
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Pack `/kit`
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Éditeur singleton de la section « Le Pack » Kolenda §4.6 : pricing,
          valueBreakdown, CTA, social proof. Cascade :{' '}
          <em>override publié → mock</em>. Reset = retour au mock du repo.
        </p>
      </header>

      <KitPackEditor initial={override} source={source} />
    </AdminShell>
  );
}
