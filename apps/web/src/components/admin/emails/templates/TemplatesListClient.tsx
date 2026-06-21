'use client';

/**
 * TemplatesListClient — liste interactive des templates (F07 P3.4-l, Lot 6) :
 * recherche, tri par colonne, EmptyState socle, et actions par ligne
 * (Éditer / Dupliquer / Supprimer). La suppression passe par ConfirmDialog et
 * gère le 409 « template encore câblé à une automation » (affiche les
 * automations bloquantes au lieu d'un échec muet).
 *
 * Couleurs neutres uniquement (stone) — tonalité danger via le socle (Button
 * variant=danger / Banner), conforme au verrou G10.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  useOptionalToast,
  formatAbsolute,
} from '@/components/admin/emails/ui';
import {
  filterTemplates,
  sortTemplates,
  type SortDir,
  type SortKey,
  type TemplateListItem,
} from './template-list';

type BlockingAutomation = { id: string; slug: string; name: string; active: boolean };

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'slug', label: 'Slug' },
  { key: 'name', label: 'Nom' },
  { key: 'updatedAt', label: 'Modifié' },
];

export function TemplatesListClient({ initialItems }: { initialItems: TemplateListItem[] }) {
  const router = useRouter();
  const toast = useOptionalToast();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'updatedAt',
    dir: 'desc',
  });
  const [deleteTarget, setDeleteTarget] = useState<TemplateListItem | null>(null);
  const [blockedBy, setBlockedBy] = useState<{
    slug: string;
    automations: BlockingAutomation[];
  } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const visible = useMemo(
    () => sortTemplates(filterTemplates(items, query), sort.key, sort.dir),
    [items, query, sort],
  );

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'updatedAt' ? 'desc' : 'asc' },
    );
  }

  async function handleDuplicate(item: TemplateListItem) {
    setDuplicatingId(item.id);
    try {
      const res = await fetch(`/api/admin/emails/templates/${item.id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast?.error((data as { error?: string })?.error ?? `Erreur ${res.status}`);
        return;
      }
      const created = data as { id: string; slug: string };
      toast?.success(`Copie créée : ${created.slug}`);
      router.push(`/admin/emails/templates/${created.id}/edit`);
    } catch (err) {
      toast?.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmDelete() {
    const t = deleteTarget;
    if (!t) return;
    try {
      const res = await fetch(`/api/admin/emails/templates/${t.id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          automations?: BlockingAutomation[];
        };
        setBlockedBy({ slug: t.slug, automations: data.automations ?? [] });
        setDeleteTarget(null);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast?.error(data.error ?? `Erreur ${res.status}`);
        setDeleteTarget(null);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== t.id));
      toast?.success(`Template « ${t.slug} » supprimé`);
      setDeleteTarget(null);
    } catch (err) {
      toast?.error(err instanceof Error ? err.message : String(err));
      setDeleteTarget(null);
    }
  }

  const hasTemplates = items.length > 0;
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '');

  return (
    <>
      {blockedBy ? (
        <Banner tone="danger" className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                « {blockedBy.slug} » est encore utilisé — suppression refusée.
              </p>
              <p className="mt-1 text-stone-600">
                Détache-le d’abord de ces automations (étape « envoyer ») :
              </p>
              <ul className="mt-1 list-disc pl-5">
                {blockedBy.automations.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/emails/automation/${a.slug}`}
                      className="text-stone-800 underline"
                    >
                      {a.name}
                    </Link>
                    {a.active ? ' (active)' : ' (inactive)'}
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBlockedBy(null)}>
              Fermer
            </Button>
          </div>
        </Banner>
      ) : null}

      {hasTemplates ? (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (slug, nom, sujet)…"
            aria-label="Rechercher un template"
            className="w-full max-w-sm rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
      ) : null}

      {!hasTemplates ? (
        <EmptyState
          icon="✉️"
          title="Aucun template"
          body="Crée ton premier template HTML pour composer des e-mails personnalisés."
          cta={{ label: '+ Nouveau template', href: '/admin/emails/templates/new' }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          variant="filtered"
          title="Aucun résultat"
          body={`Aucun template ne correspond à « ${query.trim()} ».`}
          cta={{ label: 'Réinitialiser la recherche', onClick: () => setQuery('') }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={
                      sort.key === col.key
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className="px-3 py-2 text-left font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-stone-900"
                    >
                      {col.label}
                      <span aria-hidden="true" className="text-stone-400">
                        {arrow(col.key)}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium">Sujet</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {visible.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/admin/emails/templates/${t.id}/edit`} className="hover:underline">
                      {t.slug}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium text-stone-900">{t.name}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{formatAbsolute(t.updatedAt)}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{t.subjectTmpl}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/emails/templates/${t.id}/edit`}
                        className="rounded px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 hover:underline"
                      >
                        Éditer
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        busy={duplicatingId === t.id}
                        busyLabel="…"
                        onClick={() => handleDuplicate(t)}
                      >
                        Dupliquer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(t)}
                        aria-label={`Supprimer ${t.slug}`}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title={deleteTarget ? `Supprimer « ${deleteTarget.slug} » ?` : 'Supprimer'}
        body={
          <p>
            Le template sera archivé (soft-delete) et masqué de la liste. Refusé s’il est encore
            câblé à une automation.
          </p>
        }
        confirmLabel="Supprimer"
        busyLabel="Suppression…"
        cancelLabel="Annuler"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
