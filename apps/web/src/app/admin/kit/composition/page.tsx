/**
 * `/admin/kit/composition` — liste des 3 sous-produits (1-paste, 2-powder,
 * polissoir-step-4) avec leur statut Mock/Brouillon/Publié. Chaque card
 * pointe vers `/admin/kit/composition/[id]` pour l'éditeur dédié.
 */
import Link from 'next/link';

import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { resolveKitCompositionDraft } from '@/lib/kit/composition/resolver';

export const dynamic = 'force-dynamic';

export default async function AdminKitCompositionListPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/kit/composition');
  const items = resolveKitCompositionDraft();

  return (
    <AdminShell adminEmail={session.email} active="kit-composition">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Composition `/kit`
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Éditeur par sous-produit (paste · powder · polissoir). Cascade :
          <em> override publié → mock</em>. Reset = retour au mock du repo
          pour ce sous-produit uniquement.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => {
          const sub = item.subProduct;
          const source = item.meta.source;
          const updatedAt = item.meta.updatedAt;
          const statusLabel =
            source === 'override-published'
              ? 'Publié'
              : source === 'override-draft'
                ? 'Brouillon'
                : 'Mock par défaut';
          return (
            <li
              key={sub.id}
              className="rounded-md border border-stone-200 bg-white p-4"
              data-testid={`kit-composition-list-${sub.id}`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {sub.name}
              </p>
              <p className="mt-1 text-sm text-stone-700">{sub.volume}</p>
              <p className="mt-3 text-xs text-stone-500">
                Statut : <strong>{statusLabel}</strong>
                {updatedAt ? (
                  <span className="block mt-1">
                    Modifié le {new Date(updatedAt).toLocaleString('fr-FR')}
                  </span>
                ) : null}
              </p>
              <Link
                href={`/admin/kit/composition/${sub.id}`}
                className="mt-4 inline-block text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
              >
                Éditer →
              </Link>
            </li>
          );
        })}
      </ul>
    </AdminShell>
  );
}
