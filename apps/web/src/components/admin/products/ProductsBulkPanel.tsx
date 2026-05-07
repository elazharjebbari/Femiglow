'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductListItem, ProductStatus } from '@/lib/products/types';
import { formatPrice as formatPriceUtil } from '@/lib/utils/format-price';
import { SelectAllCheckbox } from '../components/SelectAllCheckbox';
import {
  ProductsBulkActionBar,
  type ProductBulkAction,
} from './ProductsBulkActionBar';

export interface ProductsBulkPanelProps {
  items: ProductListItem[];
}

interface BulkResponse {
  ok?: boolean;
  action?: ProductBulkAction;
  summary?: { processed: number; succeeded: number; skipped: number; failed: number };
  results?: Array<{ slug: string; ok: boolean; reason?: string }>;
  error?: { message?: string };
}

// Note : la liste produits ne porte pas la devise par variante — on
// affiche dans la devise par défaut. Si demain la liste expose
// `primaryCurrency`, il suffira de la propager ici.
function formatPrice(cents: number | null) {
  if (cents === null) return '—';
  return formatPriceUtil(cents);
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const map: Record<ProductStatus, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-stone-200 text-stone-700',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${map[status]}`}
    >
      {status}
    </span>
  );
}

export function ProductsBulkPanel({ items }: ProductsBulkPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSlugs = useMemo(() => items.map((it) => it.slug), [items]);

  const stats = useMemo(() => {
    let drafts = 0;
    let published = 0;
    let archived = 0;
    for (const it of items) {
      if (!selected.has(it.slug)) continue;
      if (it.status === 'draft') drafts++;
      else if (it.status === 'published') published++;
      else if (it.status === 'archived') archived++;
    }
    return { drafts, published, archived };
  }, [items, selected]);

  function toggleAll(next: boolean) {
    if (next) setSelected(new Set(allSlugs));
    else setSelected(new Set());
  }

  function toggleOne(slug: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(slug);
      else copy.delete(slug);
      return copy;
    });
  }

  async function runBulk(action: ProductBulkAction) {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          slugs: Array.from(selected),
        }),
      });
      const body = (await res.json().catch(() => null)) as BulkResponse | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? 'Erreur lors de l’opération groupée');
        return;
      }
      const s = body.summary ?? { processed: 0, succeeded: 0, skipped: 0, failed: 0 };
      const verb: Record<ProductBulkAction, string> = {
        publish: 'publié(s)',
        unpublish: 'dépublié(s)',
        archive: 'archivé(s)',
        'restore-status': 'restauré(s) en draft',
        'hard-delete': 'supprimé(s)',
      };
      const skippedNote = s.skipped > 0 ? `, ${s.skipped} ignoré(s)` : '';
      const failedNote = s.failed > 0 ? `, ${s.failed} introuvable(s)` : '';
      setFeedback(
        `${s.succeeded} produit(s) ${verb[action]} sur ${s.processed}${skippedNote}${failedNote}.`,
      );
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-2">
        <SelectAllCheckbox
          totalCount={allSlugs.length}
          selectedCount={selected.size}
          onChange={toggleAll}
          label={`Tout sélectionner (${allSlugs.length})`}
        />
        {selected.size > 0 && (
          <p className="text-xs text-stone-600" data-testid="products-bulk-summary">
            {selected.size} produit{selected.size > 1 ? 's' : ''} · {stats.drafts} draft ·{' '}
            {stats.published} pub · {stats.archived} arch
          </p>
        )}
      </div>

      <ProductsBulkActionBar
        count={selected.size}
        drafts={stats.drafts}
        published={stats.published}
        archived={stats.archived}
        busy={busy}
        onPublish={() => runBulk('publish')}
        onUnpublish={() => runBulk('unpublish')}
        onArchive={() => runBulk('archive')}
        onRestore={() => runBulk('restore-status')}
        onHardDelete={() => runBulk('hard-delete')}
        onClear={() => setSelected(new Set())}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {feedback}
        </p>
      )}

      <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <span className="sr-only">Sélection</span>
              </th>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left">Titre</th>
              <th className="px-3 py-2 text-left">Catégorie</th>
              <th className="px-3 py-2 text-right">Prix</th>
              <th className="px-3 py-2 text-center">Variantes</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-right">Maj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-500">
                  Aucun produit.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const checked = selected.has(it.slug);
                return (
                  <tr
                    key={it.id}
                    className={checked ? 'bg-stone-50' : undefined}
                    data-testid="products-row"
                    data-slug={it.slug}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${it.slug}`}
                        checked={checked}
                        onChange={(e) => toggleOne(it.slug, e.currentTarget.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-stone-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/admin/products/${it.slug}`}
                        className="text-stone-900 underline-offset-2 hover:underline"
                      >
                        {it.slug}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-stone-900">{it.title}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {it.category ?? <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-700">
                      {formatPrice(it.primaryPriceCents)}
                    </td>
                    <td className="px-3 py-2 text-center text-stone-700">
                      {it.variantCount}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-stone-500">
                      {new Date(it.updatedAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
