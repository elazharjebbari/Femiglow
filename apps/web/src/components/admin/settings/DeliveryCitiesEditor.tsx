/**
 * CHA-230 — DeliveryCitiesEditor
 *
 * Éditeur table-driven du catalogue villes (`delivery_cities`). Wraps :
 *  - Filtres (search FR/AR/slug, active toggle, source).
 *  - Pagination (page / pageSize fixe à 50).
 *  - Toggle `isActive` inline (PATCH).
 *  - Modale d'édition (PATCH avec promotion automatique sendit → manual).
 *  - Modale d'ajout (POST).
 *  - Suppression avec confirmation (DELETE).
 *  - Bouton « Réimporter sendit » (POST /seed, force optionnel via Alt-clic).
 *
 * On parle ici à 4 endpoints REST. Le composant gère lui-même les états
 * de chargement / erreur / succès pour éviter d'introduire un fetcher
 * global juste pour cette page (pas de SWR, pas de tanstack-query).
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deliveryCityCreateSchema,
  deliveryCityPatchSchema,
} from '@/lib/checkout/delivery/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Types — DTO sérialisable (server → client)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeliveryCityDTO {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  countryCode: string;
  deliveryPriceMad: number;
  deliveryEta: string;
  isActive: boolean;
  source: 'sendit' | 'manual' | 'custom';
  externalRef: string | null;
  aliases: string[];
  metadata: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

interface DeliveryCitiesEditorProps {
  initialItems: DeliveryCityDTO[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  activeCount: number;
}

type ActiveFilter = 'all' | 'true' | 'false';
type SourceFilter = 'all' | 'sendit' | 'manual' | 'custom';
type SortKey = 'position' | 'name' | 'price' | 'updated';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

function badgeForSource(source: DeliveryCityDTO['source']): string {
  switch (source) {
    case 'manual':
      return 'bg-amber-100 text-amber-800';
    case 'custom':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-stone-100 text-stone-600';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function DeliveryCitiesEditor({
  initialItems,
  initialTotal,
  initialPage,
  initialPageSize,
  activeCount,
}: DeliveryCitiesEditorProps) {
  const [items, setItems] = useState<DeliveryCityDTO[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Filtres
  const [q, setQ] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modales
  const [editing, setEditing] = useState<DeliveryCityDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DeliveryCityDTO | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState(activeCount);

  // ─── Fetch & re-list ─────────────────────────────────────────────────────
  const refetch = useCallback(
    async (overrides?: Partial<{ page: number; q: string; active: ActiveFilter; source: SourceFilter; sort: SortKey }>) => {
      setLoading(true);
      setError(null);
      const sp = new URLSearchParams();
      const _page = overrides?.page ?? page;
      const _q = overrides?.q ?? q;
      const _active = overrides?.active ?? active;
      const _source = overrides?.source ?? source;
      const _sort = overrides?.sort ?? sort;
      sp.set('page', String(_page));
      sp.set('pageSize', String(pageSize));
      sp.set('sort', _sort);
      sp.set('active', _active);
      sp.set('source', _source);
      if (_q.trim()) sp.set('q', _q.trim());
      try {
        const res = await fetch(`/api/admin/delivery-cities?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          items: Array<DeliveryCityDTO | (Omit<DeliveryCityDTO, 'createdAt' | 'updatedAt'> & { createdAt: string | Date; updatedAt: string | Date })>;
          total: number;
        };
        setItems(
          data.items.map((c) => ({
            ...c,
            createdAt:
              typeof c.createdAt === 'string'
                ? c.createdAt
                : new Date(c.createdAt).toISOString(),
            updatedAt:
              typeof c.updatedAt === 'string'
                ? c.updatedAt
                : new Date(c.updatedAt).toISOString(),
          })),
        );
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau.');
      } finally {
        setLoading(false);
      }
    },
    [page, q, active, source, sort, pageSize],
  );

  // ─── Toggle isActive (PATCH inline) ──────────────────────────────────────
  async function toggleActive(city: DeliveryCityDTO) {
    setError(null);
    setSuccess(null);
    const next = !city.isActive;
    // Optimistic update
    setItems((prev) =>
      prev.map((c) => (c.slug === city.slug ? { ...c, isActive: next } : c)),
    );
    try {
      const res = await fetch(
        `/api/admin/delivery-cities/${encodeURIComponent(city.slug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: next }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { city: DeliveryCityDTO };
      setItems((prev) =>
        prev.map((c) =>
          c.slug === city.slug
            ? {
                ...data.city,
                createdAt:
                  typeof data.city.createdAt === 'string'
                    ? data.city.createdAt
                    : new Date(data.city.createdAt).toISOString(),
                updatedAt:
                  typeof data.city.updatedAt === 'string'
                    ? data.city.updatedAt
                    : new Date(data.city.updatedAt).toISOString(),
              }
            : c,
        ),
      );
      setSuccess(
        next ? `${city.nameFr} activée.` : `${city.nameFr} désactivée.`,
      );
      setActiveKpi((k) => k + (next ? 1 : -1));
    } catch (err) {
      // Rollback
      setItems((prev) =>
        prev.map((c) =>
          c.slug === city.slug ? { ...c, isActive: !next } : c,
        ),
      );
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleting) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/admin/delivery-cities/${encodeURIComponent(deleting.slug)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(`${deleting.nameFr} supprimée.`);
      const wasActive = deleting.isActive;
      setDeleting(null);
      await refetch();
      if (wasActive) setActiveKpi((k) => Math.max(k - 1, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    }
  }

  // ─── Re-seed ─────────────────────────────────────────────────────────────
  async function runSeed(force: boolean) {
    setSeeding(true);
    setError(null);
    setSuccess(null);
    setSeedResult(null);
    try {
      const res = await fetch('/api/admin/delivery-cities/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        importer: { parsed: number; unique: number; dropped: number };
        database: {
          inserted: number;
          updated: number;
          skipped: number;
          preservedSlugs: string[];
        };
        elapsedMs: number;
      };
      setSeedResult(
        `Import OK — ${data.database.inserted} insérée(s), ${data.database.updated} mise(s) à jour, ${data.database.skipped} ignorée(s). Préservées (édition admin) : ${data.database.preservedSlugs.length}. (${data.elapsedMs} ms)`,
      );
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réimport échoué.');
    } finally {
      setSeeding(false);
    }
  }

  // ─── Effect: re-fetch on filter/page change ──────────────────────────────
  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, active, source, sort]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      void refetch({ page: 1 });
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totalPages = useMemo(
    () => Math.max(Math.ceil(total / pageSize), 1),
    [total, pageSize],
  );

  return (
    <div data-testid="delivery-cities-editor">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Villes de livraison
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Catalogue des villes desservies (Maroc). Source initiale : fixture
            sendit (430 villes). Les éditions admin sont préservées lors d'un
            réimport.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runSeed(false)}
            disabled={seeding}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            data-testid="seed-btn"
            title="Réimporte le fixture sendit sans écraser les éditions manuelles."
          >
            {seeding ? 'Import en cours…' : 'Réimporter sendit'}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
            data-testid="add-city-btn"
          >
            + Ajouter une ville
          </button>
        </div>
      </header>

      <div
        className="mb-4 grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 sm:grid-cols-4"
        aria-label="KPI catalogue"
      >
        <Kpi label="Villes actives" value={activeKpi} />
        <Kpi label="Total catalogue" value={total} />
        <Kpi
          label="Sources éditées"
          value={items.filter((c) => c.source !== 'sendit').length}
          hint="visible sur cette page"
        />
        <Kpi label="Page" value={`${page} / ${totalPages}`} />
      </div>

      {seedResult ? (
        <div
          role="status"
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {seedResult}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-white p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">
            Recherche
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom FR, AR, slug…"
            className="w-64 rounded border border-stone-200 bg-white px-2 py-1"
            data-testid="search-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">
            Visibilité
          </span>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as ActiveFilter)}
            className="rounded border border-stone-200 bg-white px-2 py-1"
            data-testid="active-filter"
          >
            <option value="all">Toutes</option>
            <option value="true">Actives</option>
            <option value="false">Inactives</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">
            Source
          </span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="rounded border border-stone-200 bg-white px-2 py-1"
            data-testid="source-filter"
          >
            <option value="all">Toutes</option>
            <option value="sendit">sendit</option>
            <option value="manual">manual</option>
            <option value="custom">custom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">
            Tri
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded border border-stone-200 bg-white px-2 py-1"
            data-testid="sort-select"
          >
            <option value="name">Nom (A→Z)</option>
            <option value="position">Position</option>
            <option value="price">Prix</option>
            <option value="updated">Dernière modif</option>
          </select>
        </label>
        <p className="ml-auto text-xs text-stone-500">
          {loading ? 'Chargement…' : `${total} résultat${total === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Nom FR
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Nom AR
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Slug
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Prix (MAD)
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                ETA
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Source
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Actif
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Modifié
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-stone-500">
                  Aucune ville pour ces filtres.
                </td>
              </tr>
            ) : (
              items.map((city) => (
                <tr key={city.slug} data-testid={`row-${city.slug}`}>
                  <td className="px-3 py-2 font-medium text-stone-900">
                    {city.nameFr}
                  </td>
                  <td
                    className="px-3 py-2 text-stone-700"
                    dir="rtl"
                    lang="ar"
                  >
                    {city.nameAr ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">
                    {city.slug}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {city.deliveryPriceMad === 0
                      ? 'Gratuit'
                      : `${city.deliveryPriceMad}`}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {city.deliveryEta}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeForSource(city.source)}`}
                    >
                      {city.source}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(city)}
                      data-testid={`toggle-${city.slug}`}
                      className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition ${
                        city.isActive ? 'bg-emerald-500' : 'bg-stone-300'
                      }`}
                      aria-pressed={city.isActive}
                      aria-label={
                        city.isActive
                          ? `Désactiver ${city.nameFr}`
                          : `Activer ${city.nameFr}`
                      }
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow transition ${city.isActive ? 'translate-x-4' : ''}`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {relativeTime(city.updatedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(city)}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs hover:bg-stone-50"
                      data-testid={`edit-${city.slug}`}
                    >
                      Éditer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(city)}
                      className="ml-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      data-testid={`delete-${city.slug}`}
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-3 flex items-center justify-between" aria-label="Pagination">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page <= 1 || loading}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          data-testid="prev-page"
        >
          ← Précédent
        </button>
        <p className="text-xs text-stone-500">
          Page {page} sur {totalPages}
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages || loading}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          data-testid="next-page"
        >
          Suivant →
        </button>
      </nav>

      {editing ? (
        <EditCityModal
          city={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) =>
              prev.map((c) =>
                c.slug === updated.slug
                  ? {
                      ...updated,
                      createdAt:
                        typeof updated.createdAt === 'string'
                          ? updated.createdAt
                          : new Date(updated.createdAt).toISOString(),
                      updatedAt:
                        typeof updated.updatedAt === 'string'
                          ? updated.updatedAt
                          : new Date(updated.updatedAt).toISOString(),
                    }
                  : c,
              ),
            );
            setEditing(null);
            setSuccess(`${updated.nameFr} mise à jour.`);
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}

      {creating ? (
        <CreateCityModal
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setSuccess(`${created.nameFr} créée.`);
            void refetch();
            if (created.isActive) setActiveKpi((k) => k + 1);
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteModal
          city={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      {hint ? <p className="text-[11px] text-stone-500">{hint}</p> : null}
    </div>
  );
}

interface EditModalProps {
  city: DeliveryCityDTO;
  onClose: () => void;
  onSaved: (city: DeliveryCityDTO) => void;
  onError: (msg: string) => void;
}

function EditCityModal({ city, onClose, onSaved, onError }: EditModalProps) {
  const [nameFr, setNameFr] = useState(city.nameFr);
  const [nameAr, setNameAr] = useState(city.nameAr ?? '');
  const [price, setPrice] = useState(String(city.deliveryPriceMad));
  const [eta, setEta] = useState(city.deliveryEta);
  const [aliases, setAliases] = useState(city.aliases.join(', '));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSave() {
    setLocalError(null);
    const payload = {
      nameFr,
      nameAr: nameAr.trim() ? nameAr : null,
      deliveryPriceMad: Number.parseInt(price, 10),
      deliveryEta: eta,
      aliases: aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const parsed = deliveryCityPatchSchema.safeParse(payload);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/delivery-cities/${encodeURIComponent(city.slug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { city: DeliveryCityDTO };
      onSaved(data.city);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Éditer ${city.nameFr}`} onClose={onClose}>
      <p className="mb-3 text-xs text-stone-500">
        Slug <code className="rounded bg-stone-100 px-1">{city.slug}</code> ·
        Source actuelle : <strong>{city.source}</strong>. Si tu modifies une
        ville sendit, elle bascule automatiquement en <em>manual</em> pour
        protéger ton édition d'un futur réimport.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom FR">
          <input
            type="text"
            value={nameFr}
            onChange={(e) => setNameFr(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="edit-name-fr"
          />
        </Field>
        <Field label="Nom AR">
          <input
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            dir="rtl"
            lang="ar"
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="edit-name-ar"
          />
        </Field>
        <Field label="Prix MAD (entier)">
          <input
            type="number"
            min={0}
            max={10000}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="edit-price"
          />
        </Field>
        <Field label="ETA">
          <input
            type="text"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="edit-eta"
          />
        </Field>
        <Field label="Aliases (séparés par virgule)" wide>
          <input
            type="text"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            placeholder="Casa, الدار"
            data-testid="edit-aliases"
          />
        </Field>
      </div>
      {localError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          data-testid="edit-save"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}

interface CreateModalProps {
  onClose: () => void;
  onCreated: (city: DeliveryCityDTO) => void;
  onError: (msg: string) => void;
}

function CreateCityModal({ onClose, onCreated, onError }: CreateModalProps) {
  const [slug, setSlug] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [price, setPrice] = useState('0');
  const [eta, setEta] = useState('24h - 48h');
  const [aliases, setAliases] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleCreate() {
    setLocalError(null);
    const payload = {
      slug: slug.trim().toLowerCase(),
      nameFr,
      nameAr: nameAr.trim() ? nameAr : null,
      countryCode: 'MA',
      deliveryPriceMad: Number.parseInt(price, 10),
      deliveryEta: eta,
      aliases: aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isActive: true,
      source: 'manual' as const,
    };
    const parsed = deliveryCityCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/delivery-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { city: DeliveryCityDTO };
      onCreated(data.city);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Ajouter une ville" onClose={onClose}>
      <p className="mb-3 text-xs text-stone-500">
        Source forcée à <strong>manual</strong>. Le slug doit être unique
        (a-z 0-9 tirets uniquement). Préférer le réimport sendit pour les
        villes du fixture officiel.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug (unique)">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1 font-mono text-xs"
            placeholder="ifrane"
            data-testid="create-slug"
          />
        </Field>
        <Field label="Nom FR">
          <input
            type="text"
            value={nameFr}
            onChange={(e) => setNameFr(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="create-name-fr"
          />
        </Field>
        <Field label="Nom AR">
          <input
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            dir="rtl"
            lang="ar"
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="create-name-ar"
          />
        </Field>
        <Field label="Prix MAD (entier)">
          <input
            type="number"
            min={0}
            max={10000}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="create-price"
          />
        </Field>
        <Field label="ETA">
          <input
            type="text"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            data-testid="create-eta"
          />
        </Field>
        <Field label="Aliases (séparés par virgule)" wide>
          <input
            type="text"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            className="w-full rounded border border-stone-200 px-2 py-1"
            placeholder="Variante FR, Variante AR"
            data-testid="create-aliases"
          />
        </Field>
      </div>
      {localError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          data-testid="create-save"
        >
          {saving ? 'Création…' : 'Créer la ville'}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  city,
  onClose,
  onConfirm,
}: {
  city: DeliveryCityDTO;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Confirmer la suppression" onClose={onClose}>
      <p className="text-sm text-stone-700">
        Supprimer définitivement <strong>{city.nameFr}</strong> (slug{' '}
        <code className="rounded bg-stone-100 px-1 text-xs">{city.slug}</code>) ?
        Cette opération est irréversible. Préférer <em>désactiver</em> pour
        conserver l'historique.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          data-testid="delete-confirm"
        >
          Supprimer
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-md bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la modale"
            className="text-stone-500 hover:text-stone-900"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs uppercase tracking-wide text-stone-500">{label}</span>
      {children}
    </label>
  );
}
