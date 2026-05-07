'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SeoOverride } from '@/lib/seo/types';
import { SelectAllCheckbox } from '../components/SelectAllCheckbox';
import { SeoBulkActionBar, type SeoBulkAction } from './SeoBulkActionBar';

export interface SeoBulkPanelProps {
  items: SeoOverride[];
}

interface BulkResponse {
  ok?: boolean;
  action?: SeoBulkAction;
  summary?: { processed: number; succeeded: number; skipped: number; failed: number };
  results?: Array<{ id: string; ok: boolean; reason?: string }>;
  error?: { message?: string };
}

export function SeoBulkPanel({ items }: SeoBulkPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allIds = useMemo(() => items.map((it) => it.id), [items]);

  const stats = useMemo(() => {
    let drafts = 0;
    let published = 0;
    for (const it of items) {
      if (!selected.has(it.id)) continue;
      if (it.publishedAt) published++;
      else drafts++;
    }
    return { drafts, published };
  }, [items, selected]);

  function toggleAll(next: boolean) {
    if (next) setSelected(new Set(allIds));
    else setSelected(new Set());
  }

  function toggleOne(id: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  async function runBulk(action: SeoBulkAction) {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/seo/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selected) }),
      });
      const body = (await res.json().catch(() => null)) as BulkResponse | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? 'Erreur lors de l’opération groupée');
        return;
      }
      const s = body.summary ?? { processed: 0, succeeded: 0, skipped: 0, failed: 0 };
      const verb: Record<SeoBulkAction, string> = {
        publish: 'publié(s)',
        unpublish: 'dépublié(s)',
        delete: 'supprimé(s)',
      };
      const skipped = s.skipped > 0 ? `, ${s.skipped} ignoré(s)` : '';
      const failed = s.failed > 0 ? `, ${s.failed} introuvable(s)` : '';
      setFeedback(
        `${s.succeeded} override(s) ${verb[action]} sur ${s.processed}${skipped}${failed}.`,
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
          totalCount={allIds.length}
          selectedCount={selected.size}
          onChange={toggleAll}
          label={`Tout sélectionner (${allIds.length})`}
        />
        {selected.size > 0 && (
          <p className="text-xs text-stone-600" data-testid="seo-bulk-summary">
            {selected.size} override{selected.size > 1 ? 's' : ''} · {stats.drafts} draft ·{' '}
            {stats.published} publié{stats.published > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <SeoBulkActionBar
        count={selected.size}
        drafts={stats.drafts}
        published={stats.published}
        busy={busy}
        onPublish={() => runBulk('publish')}
        onUnpublish={() => runBulk('unpublish')}
        onDelete={() => runBulk('delete')}
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
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-left">Cible</th>
              <th className="px-3 py-2 text-left">Locale</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">État</th>
              <th className="px-3 py-2 text-right">Maj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-500">
                  Aucun override.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const checked = selected.has(it.id);
                return (
                  <tr
                    key={it.id}
                    className={checked ? 'bg-stone-50' : undefined}
                    data-testid="seo-row"
                    data-id={it.id}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${it.targetKey}`}
                        checked={checked}
                        onChange={(e) => toggleOne(it.id, e.currentTarget.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-stone-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.scope}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/seo/${it.id}`}
                        className="text-stone-900 underline-offset-2 hover:underline"
                      >
                        {it.targetKey}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-stone-600">{it.locale}</td>
                    <td className="px-3 py-2 text-stone-700">
                      {it.title ?? <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {it.publishedAt ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
                          Publié
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                          Draft
                        </span>
                      )}
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
