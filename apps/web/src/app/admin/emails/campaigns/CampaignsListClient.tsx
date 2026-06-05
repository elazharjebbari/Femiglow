'use client';

/**
 * UX-CAMP-012 — barre de filtres de la liste des campagnes : recherche texte,
 * filtre par statut et pagination, le tout porté par l'URL via `useUrlFilters`
 * (vue partageable / bookmarkable). Composant présentationnel : la donnée est
 * chargée côté RSC depuis les `searchParams`, ici on ne fait qu'écrire l'URL.
 */
import { useState } from 'react';
import { useUrlFilters } from '@/components/admin/emails/common/use-url-filters';
import { CAMPAIGN_STATUSES } from '@/lib/admin/emails/campaigns-shared';

const STATUS_FR: Record<string, string> = {
  all: 'Tous les statuts',
  draft: 'Brouillon',
  scheduled: 'Planifiée',
  sending: 'En cours d’envoi',
  paused: 'En pause',
  sent: 'Envoyée',
  cancelled: 'Annulée',
  failed: 'Échec',
};

export function CampaignsFilterBar() {
  const { filters, setFilters } = useUrlFilters({ status: 'all', q: '', page: '1' });
  const [draftQ, setDraftQ] = useState(filters.q);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Recherche</span>
        <input
          type="search"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setFilters({ q: draftQ, page: '1' });
          }}
          onBlur={() => {
            if (draftQ !== filters.q) setFilters({ q: draftQ, page: '1' });
          }}
          placeholder="Nom ou sujet…"
          aria-label="Rechercher une campagne"
          className="mt-1 w-64 rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Statut</span>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value, page: '1' })}
          aria-label="Filtrer par statut"
          className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">{STATUS_FR.all}</option>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_FR[s] ?? s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Pagination simple (préc./suiv.) portée par l'URL. */
export function CampaignsPagination({ page, pageCount }: { page: number; pageCount: number }) {
  const { setFilters } = useUrlFilters({ status: 'all', q: '', page: '1' });
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination des campagnes">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setFilters({ page: String(page - 1) })}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 disabled:opacity-40"
      >
        ← Précédent
      </button>
      <span className="text-stone-600" aria-live="polite">
        Page {page} / {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => setFilters({ page: String(page + 1) })}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 disabled:opacity-40"
      >
        Suivant →
      </button>
    </nav>
  );
}

/** Badge de statut campagne (FR, palette cohérente). */
export function CampaignStatusBadge({ status }: { status: string }) {
  const cls =
    {
      draft: 'bg-stone-100 text-stone-700',
      scheduled: 'bg-blue-50 text-blue-700',
      sending: 'bg-amber-50 text-amber-700',
      paused: 'bg-amber-100 text-amber-800',
      sent: 'bg-emerald-50 text-emerald-700',
      cancelled: 'bg-rose-50 text-rose-700',
      failed: 'bg-rose-100 text-rose-800',
    }[status] ?? 'bg-stone-100 text-stone-700';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      role="status"
      data-status={status}
    >
      {STATUS_FR[status] ?? status}
    </span>
  );
}
