'use client';

/**
 * TransactionalCockpit — orchestrateur client-side du cockpit (M5.1.7).
 *
 * Compose KpiHeader + CommandPalette + SavedViewsSidebar + FilteredTable
 * + BulkActionsBar. Gère :
 *  - l'état des filtres (synchronisé URL)
 *  - la sélection multi-ligne
 *  - les appels API (search + summary + bulk actions + views CRUD)
 *  - les confirmations destructives
 *
 * Cf. docs/emailing/admin-evolution/04-ui-ux/01-wizard-spec-master.md §1
 *    docs/emailing/admin-evolution/04-ui-ux/02-mockups/transactional-inbox.txt
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deserializeFilters,
  parseFilters,
  serializeFilters,
  type ParseResult,
} from '@/lib/mail/transactional/filters-parser';
import type { OutboxSearchRow, SearchSort } from '@/lib/mail/transactional/search';
import { formatSkipReasons } from '@/lib/mail/transactional/skip-reasons';
import { CommandPalette } from './CommandPalette';
import { KpiHeader, useSummary } from './KpiHeader';
import { SavedViewsSidebar, type SidebarView } from './SavedViewsSidebar';
import { FilteredTable } from './FilteredTable';
import { BulkActionsBar } from './BulkActionsBar';

const PAGE_SIZE = 50;

type SearchResultDto = {
  rows: OutboxSearchRow[];
  total: number;
  window: 'matched' | 'truncated';
};

type BulkResultDto = {
  retried?: number;
  skipped?: number;
  skippedIds?: { id: string; reason: string }[];
  suppressed?: number;
};

type BulkNetworkAction = 'retry' | 'suppress';

export type TransactionalCockpitProps = {
  initialViews: SidebarView[];
};

/**
 * Traduit une réponse HTTP en échec en message opérateur lisible. Couvre les
 * formes renvoyées par les routes admin emails : 401 (texte « Unauthorized »),
 * 422 ({ error, issues }), 500 ({ ok:false, error }). Ne lève jamais : si le
 * corps n'est pas exploitable, retombe sur un message générique par statut.
 */
async function describeHttpError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return 'Session expirée ou non autorisée — reconnecte-toi puis réessaie.';
  }
  let detail: string | null = null;
  try {
    const text = await res.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { error?: unknown; detail?: unknown };
        const raw = body.error ?? body.detail;
        if (typeof raw === 'string' && raw.trim()) detail = raw.trim();
      } catch {
        if (text.trim() && text.trim().toLowerCase() !== 'unauthorized') detail = text.trim();
      }
    }
  } catch {
    /* corps illisible : on reste sur le générique */
  }
  if (res.status === 422) {
    return `Données invalides : ${detail ?? 'la requête a été rejetée par la validation.'}`;
  }
  return detail ?? `Erreur serveur (HTTP ${res.status}). Réessaie dans un instant.`;
}

/**
 * Convertit le `filterState` persisté d'une vue ({ filters:{status:[…],
 * to:…, attempts:{operator,value}, … } }) en une chaîne Cmd-K que `parseFilters`
 * sait re-parser. Robuste aux formes partielles : ignore les clés vides/inconnues.
 */
function filterStateToQuery(filterState?: SidebarView['filterState']): string {
  const filters = filterState?.filters;
  if (!filters || typeof filters !== 'object') return '';
  const segments: string[] = [];
  for (const [key, raw] of Object.entries(filters)) {
    if (raw == null) continue;
    if (key === 'status' || key === 'source' || key === 'template' || key === 'to') {
      const value = Array.isArray(raw) ? raw.join(',') : String(raw);
      if (value.trim().length === 0) continue;
      const needsQuote = /\s/.test(value);
      segments.push(`${key}:${needsQuote ? `"${value}"` : value}`);
    } else if (key === 'after' || key === 'before') {
      segments.push(`${key}:${String(raw)}`);
    } else if (key === 'attempts' && typeof raw === 'object') {
      const a = raw as { operator?: string; value?: number };
      if (a.value != null) segments.push(`attempts:${a.operator ?? '='}${a.value}`);
    } else if (key === 'has' && (raw === 'error' || raw === true)) {
      segments.push('has:error');
    }
  }
  return segments.join(' ');
}

/**
 * Échappe un champ CSV selon RFC 4180 : si le champ contient une virgule, un
 * guillemet ou un retour ligne, on l'entoure de guillemets et on double les
 * guillemets internes. `null`/`undefined` → champ vide.
 */
function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = ['id', 'date', 'destinataire', 'nom', 'template', 'sujet', 'statut', 'tentatives'] as const;

/** Construit le contenu CSV (BOM UTF-8 + en-têtes + lignes) pour les rows. */
function buildCsv(rows: OutboxSearchRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt),
        csvEscape(r.toEmail),
        csvEscape(r.toName),
        csvEscape(r.template),
        csvEscape(r.subject),
        csvEscape(r.status),
        csvEscape(`${r.attempts}/${r.maxAttempts}`),
      ].join(','),
    );
  }
  // BOM UTF-8 (U+FEFF) pour qu'Excel fr lise correctement les accents.
  return `﻿${lines.join('\r\n')}`;
}

export function TransactionalCockpit({ initialViews }: TransactionalCockpitProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── État filtres (initialisé depuis URL) ─────────────────────────────
  const [parseResult, setParseResult] = useState<ParseResult>(() =>
    deserializeFilters(new URLSearchParams(searchParams.toString())),
  );
  const [sort, setSort] = useState<SearchSort>('date_desc');
  const [offset, setOffset] = useState(0);

  // ── Données search ───────────────────────────────────────────────────
  const [searchResult, setSearchResult] = useState<SearchResultDto | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/admin/emails/transactional/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filters: parseResult.filters,
          freetext: parseResult.freetext,
          pagination: { limit: PAGE_SIZE, offset },
          sort,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SearchResultDto;
      setSearchResult(body);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  }, [parseResult, offset, sort]);

  useEffect(() => {
    void fetchSearch();
  }, [fetchSearch]);

  // ── KPI summary (auto-refresh 5s) ────────────────────────────────────
  const summary = useSummary({ window: '1h', refreshIntervalMs: 5_000 });

  // ── Sélection ────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Feedback des actions bulk (anti faux-succès) ─────────────────────
  // `bulkBusy` = action réseau en vol (verrou anti double-soumission).
  // `bulkError` = message d'échec visible (role=alert), sélection conservée.
  // `bulkResult` = résultat HONNÊTE d'un succès (retried/skipped/suppressed).
  const [bulkBusy, setBulkBusy] = useState<BulkNetworkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  // Dernière action bulk tentée → permet à « réessayer » de rejouer la bonne.
  const lastBulkActionRef = useRef<BulkNetworkAction | null>(null);

  // Reset selection on filter change
  useEffect(() => {
    setSelected(new Set());
    setBulkError(null);
    setBulkResult(null);
  }, [parseResult.filters.length, parseResult.freetext, sort]);

  // ── Feedback des actions sur les vues (rename/delete) ────────────────
  const [viewsError, setViewsError] = useState<string | null>(null);

  // ── Saved views ──────────────────────────────────────────────────────
  const [views, setViews] = useState<SidebarView[]>(initialViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  // Formulaire de création de vue (remplace l'ancien window.alert stub).
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState('');
  const [createViewBusy, setCreateViewBusy] = useState(false);

  // ── Sync filtres → URL ───────────────────────────────────────────────
  useEffect(() => {
    const params = serializeFilters(parseResult.filters);
    if (parseResult.freetext) params.set('q', parseResult.freetext);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [parseResult, router]);

  // ── Actions ──────────────────────────────────────────────────────────

  const applyParseResult = useCallback((result: ParseResult) => {
    setParseResult(result);
    setOffset(0);
    setActiveViewId(null);
  }, []);

  // ── Tri : changer le tri ramène à la page 1 (offset 0) ────────────────
  // Sans ce reset, on resterait à un offset au-delà des résultats du nouveau
  // tri (ex. page 3 d'un tri, page 3 d'un autre → lignes incohérentes).
  const handleSortChange = useCallback((next: SearchSort) => {
    setSort(next);
    setOffset(0);
  }, []);

  // ── Pagination (F-011) ────────────────────────────────────────────────
  // L'API search expose `pagination:{limit,offset}` ; on pilote `offset` par
  // pas de PAGE_SIZE. Bornes : pas de page < 0, pas de page au-delà du total.
  const total = searchResult?.total ?? 0;
  const rowsLength = searchResult?.rows.length ?? 0;
  const canPrev = offset > 0;
  const canNext = offset + rowsLength < total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = offset + rowsLength;

  const goPrev = useCallback(() => {
    setOffset((o) => Math.max(0, o - PAGE_SIZE));
  }, []);
  const goNext = useCallback(() => {
    setOffset((o) => o + PAGE_SIZE);
  }, []);

  const handleKpiClick = useCallback(
    (kind: 'delivered' | 'queued' | 'failed' | 'hardBounced') => {
      const statusByKind = {
        delivered: 'status:delivered',
        queued: 'status:pending,sending',
        failed: 'status:failed,dlq',
        hardBounced: 'status:bounced_permanent',
      };
      applyParseResult(parseFilters(statusByKind[kind]));
    },
    [applyParseResult],
  );

  // ── Filtres rapides (presets) — UX-COCKPIT-004 ───────────────────────
  // La carte KPI « Échecs » route vers status:failed,dlq et aucun chemin ne
  // mène à DLQ seul ni à bounced_soft (statut RELANÇABLE via bulkRetry mais
  // jusque-là inatteignable en un clic). Ces presets isolent ces files en un
  // clic pour les piloter (Requeue DLQ / relance des soft bounces).
  const QUICK_FILTERS = useMemo(
    () =>
      [
        { id: 'dlq', label: 'DLQ', query: 'status:dlq' },
        { id: 'bounced_soft', label: 'Soft bounces', query: 'status:bounced_soft' },
      ] as const,
    [],
  );
  const applyQuickFilter = useCallback(
    (query: string) => applyParseResult(parseFilters(query)),
    [applyParseResult],
  );

  // ── « Libérer les envois bloqués » (reaper) — UX-COCKPIT-004 ──────────
  const [reapBusy, setReapBusy] = useState(false);
  const [reapFeedback, setReapFeedback] = useState<string | null>(null);
  const [reapError, setReapError] = useState<string | null>(null);
  const handleReapStuck = useCallback(async () => {
    if (reapBusy) return; // anti double-clic
    const ok = window.confirm(
      'Libérer les envois bloqués en « envoi » ?\n\n' +
        'Les lignes figées (process crashé) repasseront en file (ou en DLQ au plafond de tentatives). ' +
        'Action sûre, sans perte de message.',
    );
    if (!ok) return;
    setReapBusy(true);
    setReapError(null);
    setReapFeedback(null);
    try {
      const res = await fetch('/api/admin/emails/transactional/reap-stuck', { method: 'POST' });
      if (!res.ok) {
        setReapError(await describeHttpError(res));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reaped?: number };
      const n = body.reaped ?? 0;
      setReapFeedback(
        n === 0
          ? 'Aucun envoi bloqué à libérer.'
          : `${n} envoi${n > 1 ? 's' : ''} bloqué${n > 1 ? 's' : ''} libéré${n > 1 ? 's' : ''}.`,
      );
      await fetchSearch();
      await summary.refresh();
    } catch {
      setReapError('Échec réseau : impossible de joindre le serveur. Réessaie.');
    } finally {
      setReapBusy(false);
    }
  }, [reapBusy, fetchSearch, summary]);

  const handleSelectView = useCallback(
    (viewId: string) => {
      const v = views.find((x) => x.id === viewId);
      if (!v) return;
      // Applique RÉELLEMENT le filterState de la vue (F-016) : on reconstruit
      // une requête Cmd-K depuis le filterState persisté, on la re-parse, et on
      // applique filtres + tri. Reset à la page 1. Sans filterState (compat),
      // on retombe sur un highlight seul.
      const query = filterStateToQuery(v.filterState);
      setParseResult(parseFilters(query));
      const sortFromView = v.filterState?.sort;
      if (
        sortFromView === 'date_desc' ||
        sortFromView === 'date_asc' ||
        sortFromView === 'status' ||
        sortFromView === 'template' ||
        sortFromView === 'attempts_desc'
      ) {
        setSort(sortFromView);
      }
      setOffset(0);
      setActiveViewId(viewId);
    },
    [views],
  );

  /**
   * Persiste une nouvelle vue depuis l'état de filtres courant (F-016).
   * Construit le `filterState` à partir des filtres actifs + tri, POST /views,
   * puis injecte la vue créée dans la sidebar. Échec → message visible, pas de
   * faux succès (le formulaire reste ouvert).
   */
  const submitCreateView = useCallback(async () => {
    const name = createViewName.trim();
    if (name.length === 0 || createViewBusy) return;
    // filters → record { status:[…], to:…, attempts:{operator,value}, has:'error' }
    const filtersRecord: Record<string, unknown> = {};
    for (const f of parseResult.filters) {
      if (f.key === 'status') filtersRecord.status = f.value;
      else if (f.key === 'after' || f.key === 'before') filtersRecord[f.key] = f.value.toISOString();
      else if (f.key === 'attempts') filtersRecord.attempts = { operator: f.operator, value: f.value };
      else if (f.key === 'has') filtersRecord.has = 'error';
      else filtersRecord[f.key] = f.value;
    }
    setCreateViewBusy(true);
    setViewsError(null);
    try {
      const res = await fetch('/api/admin/emails/views', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          scope: 'transactional',
          filterState: { filters: filtersRecord, sort, cols: [] },
        }),
      });
      if (!res.ok) {
        setViewsError(await describeHttpError(res));
        return; // formulaire conservé, pas de faux succès.
      }
      const created = (await res.json().catch(() => null)) as
        | { id?: string; name?: string; isSystem?: boolean; filterState?: SidebarView['filterState'] }
        | null;
      if (created?.id) {
        setViews((vs) => [
          ...vs,
          {
            id: created.id!,
            name: created.name ?? name,
            isSystem: created.isSystem ?? false,
            filterState: created.filterState ?? { filters: filtersRecord, sort, cols: [] },
          },
        ]);
      }
      setCreateViewOpen(false);
      setCreateViewName('');
    } catch {
      setViewsError('Échec réseau : la vue n’a pas pu être créée.');
    } finally {
      setCreateViewBusy(false);
    }
  }, [createViewName, createViewBusy, parseResult.filters, sort]);

  /**
   * Exécute UNE action réseau bulk (retry/suppress) avec garde-fous :
   *  - lit `res.ok` systématiquement → JAMAIS de faux succès ;
   *  - sur échec : message visible (bulkError), sélection CONSERVÉE, pas de
   *    re-fetch masquant ;
   *  - sur succès : feedback honnête (retried/skipped/suppressed), sélection
   *    vidée puis re-fetch + refresh summary ;
   *  - verrou `bulkBusy` = anti double-soumission (bouton désactivé pendant).
   * `ids` est figé à l'appel pour permettre un « réessayer » fidèle.
   */
  const runBulkNetworkAction = useCallback(
    async (action: BulkNetworkAction, ids: string[]) => {
      if (ids.length === 0 || bulkBusy) return;
      const url =
        action === 'retry'
          ? '/api/admin/emails/transactional/bulk-retry'
          : '/api/admin/emails/transactional/bulk-suppress';

      lastBulkActionRef.current = action;
      setBulkBusy(action);
      setBulkError(null);
      setBulkResult(null);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          setBulkError(await describeHttpError(res));
          return; // sélection CONSERVÉE, pas de re-fetch.
        }
        const body = (await res.json().catch(() => ({}))) as BulkResultDto;

        if (action === 'retry') {
          const retried = body.retried ?? 0;
          const skipped = body.skipped ?? 0;
          const parts = [`${retried} relancé${retried > 1 ? 's' : ''}`];
          if (skipped > 0) {
            // CKPT-02 : raisons traduites (not_found → « non trouvé », etc.)
            const reasons = formatSkipReasons(body.skippedIds);
            parts.push(
              `${skipped} ignoré${skipped > 1 ? 's' : ''}${reasons ? ` (${reasons})` : ''}`,
            );
          }
          setBulkResult(parts.join(' · '));
        } else {
          const suppressed = body.suppressed ?? 0;
          const skipped = body.skipped ?? 0;
          const parts = [`${suppressed} mis en suppression`];
          if (skipped > 0) parts.push(`${skipped} ignoré${skipped > 1 ? 's' : ''}`);
          setBulkResult(parts.join(' · '));
        }

        // Succès confirmé (res.ok) : on vide la sélection et on rafraîchit.
        setSelected(new Set());
        await fetchSearch();
        await summary.refresh();
      } catch {
        // Erreur réseau (fetch rejette) : message visible, sélection conservée.
        setBulkError(
          'Échec réseau : impossible de joindre le serveur. Vérifie ta connexion puis réessaie.',
        );
      } finally {
        setBulkBusy(null);
      }
    },
    [bulkBusy, fetchSearch, summary],
  );

  /**
   * Export CSV des lignes sélectionnées (F-017) — remplace le window.alert
   * stub. Génère un Blob CSV (BOM UTF-8, échappement RFC 4180) et déclenche un
   * téléchargement via un <a download> éphémère. N'exporte que les lignes
   * présentes dans la page courante correspondant à la sélection.
   */
  const exportSelectedCsv = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const rows = (searchResult?.rows ?? []).filter((r) => idSet.has(String(r.id)));
      if (rows.length === 0) return;
      const csv = buildCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emails-transactionnels-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [searchResult],
  );

  const handleBulkAction = useCallback(
    (id: 'retry' | 'suppress' | 'export' | 'clear') => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      if (bulkBusy) return; // verrou anti double-soumission

      if (id === 'clear') {
        setSelected(new Set());
        setBulkError(null);
        setBulkResult(null);
        return;
      }
      if (id === 'export') {
        exportSelectedCsv(ids);
        return;
      }
      if (id === 'suppress') {
        // UX-COCKPIT-007 : compter les ADRESSES DISTINCTES (plusieurs lignes
        // outbox peuvent partager un destinataire) et expliciter le périmètre
        // humain + la propagation (transactionnel ET campagnes) + la réversibilité
        // via la liste de suppression (UX-COCKPIT-001).
        const idSet = new Set(ids);
        const distinctAddresses = new Set(
          (searchResult?.rows ?? [])
            .filter((r) => idSet.has(String(r.id)))
            .map((r) => r.toEmail.toLowerCase()),
        );
        const n = distinctAddresses.size || ids.length;
        const ok = window.confirm(
          `Bloquer ${n} adresse${n > 1 ? 's' : ''} distincte${n > 1 ? 's' : ''} ?\n\n` +
            `Elle${n > 1 ? 's' : ''} ne recevra${n > 1 ? 'ont' : ''} plus AUCUN email ` +
            `(transactionnel ET campagnes). ` +
            `Action réversible uniquement via la liste de suppression.`,
        );
        if (!ok) return; // confirmation annulée : aucun POST, sélection conservée.
      }
      void runBulkNetworkAction(id, ids);
    },
    [selected, bulkBusy, runBulkNetworkAction, exportSelectedCsv, searchResult],
  );

  // Réessayer la dernière action échouée (bouton dans l'alerte d'erreur).
  const retryLastBulk = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !bulkError) return;
    // L'action est déduite du verrou nominal : on relit le dernier type via le
    // libellé n'est pas fiable → on réessaie l'action courante stockée.
    void runBulkNetworkAction(lastBulkActionRef.current ?? 'retry', ids);
  }, [selected, bulkError, runBulkNetworkAction]);

  const memoActions = useMemo(
    () => [
      { id: 'retry' as const, label: `Retry (${selected.size})` },
      { id: 'suppress' as const, label: 'Marquer en suppression', danger: true },
      { id: 'export' as const, label: 'Exporter CSV' },
    ],
    [selected.size],
  );

  // ── Actions de la palette ⌘K (UX-COCKPIT-009) ────────────────────────
  // « Enregistrer la vue » est toujours disponible ; les actions sur la
  // sélection n'apparaissent que quand au moins une ligne est cochée.
  const paletteActions = useMemo(() => {
    const list: { id: 'retry' | 'suppress' | 'export' | 'save-view'; label: string }[] = [
      { id: 'save-view', label: 'Enregistrer la vue actuelle' },
    ];
    if (selected.size > 0) {
      list.push(
        { id: 'retry', label: `Relancer la sélection (${selected.size})` },
        { id: 'suppress', label: `Marquer en suppression (${selected.size})` },
        { id: 'export', label: `Exporter la sélection en CSV (${selected.size})` },
      );
    }
    return list;
  }, [selected.size]);

  const handlePaletteAction = useCallback(
    (actionId: 'retry' | 'suppress' | 'export' | 'save-view') => {
      if (actionId === 'save-view') {
        setCreateViewName('');
        setViewsError(null);
        setCreateViewOpen(true);
        return;
      }
      handleBulkAction(actionId);
    },
    [handleBulkAction],
  );

  return (
    <div>
      {/* Header KPI */}
      <div className="mb-6">
        <KpiHeader
          data={summary.data}
          isLoading={summary.isLoading}
          isRefreshing={summary.isRefreshing}
          error={summary.error}
          onRefresh={summary.refresh}
          onKpiClick={handleKpiClick}
        />
      </div>

      {/* Help bar : Cmd+K + filtres rapides + filtres résolus */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
        <span>
          <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono">⌘K</kbd>{' '}
          pour filtrer
        </span>
        <span className="text-stone-300">·</span>
        {/* Filtres rapides DLQ / Soft bounces (UX-COCKPIT-004) */}
        <div className="flex items-center gap-1" role="group" aria-label="Filtres rapides">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.id}
              type="button"
              onClick={() => applyQuickFilter(qf.query)}
              data-testid={`quick-filter-${qf.id}`}
              className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium text-stone-700 hover:bg-stone-100"
            >
              {qf.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void handleReapStuck()}
            disabled={reapBusy}
            data-testid="reap-stuck-btn"
            className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            {reapBusy ? 'Libération…' : 'Libérer les envois bloqués'}
          </button>
        </div>
        {parseResult.filters.length > 0 && (
          <>
            <span className="text-stone-300">·</span>
            <span>
              {parseResult.filters.length} filtre{parseResult.filters.length > 1 ? 's' : ''} actif
              {parseResult.filters.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => applyParseResult(parseFilters(''))}
              className="ml-2 text-stone-500 underline-offset-2 hover:underline"
            >
              effacer
            </button>
          </>
        )}
      </div>

      {/* Layout principal : sidebar + tableau */}
      <div className="flex gap-4">
        <SavedViewsSidebar
          views={views}
          activeViewId={activeViewId}
          onSelect={handleSelectView}
          onCreate={() => {
            setCreateViewName('');
            setViewsError(null);
            setCreateViewOpen(true);
          }}
          onDelete={async (id) => {
            if (!window.confirm('Supprimer cette vue ?')) return;
            setViewsError(null);
            try {
              const res = await fetch(`/api/admin/emails/views/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                setViewsError(await describeHttpError(res));
                return; // pas de retrait optimiste sur échec.
              }
              setViews((vs) => vs.filter((v) => v.id !== id));
            } catch {
              setViewsError('Échec réseau : la vue n’a pas pu être supprimée.');
            }
          }}
          onRename={async (id, newName) => {
            setViewsError(null);
            try {
              const res = await fetch(`/api/admin/emails/views/${id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: newName }),
              });
              if (!res.ok) {
                setViewsError(await describeHttpError(res));
                return; // pas de renommage optimiste sur échec.
              }
              setViews((vs) => vs.map((v) => (v.id === id ? { ...v, name: newName } : v)));
            } catch {
              setViewsError('Échec réseau : la vue n’a pas pu être renommée.');
            }
          }}
        />

        {/* Formulaire de création de vue (F-016) — remplace le window.alert
            stub. Persiste l'état de filtres courant comme nouvelle vue. */}
        {createViewOpen && (
          <form
            data-testid="create-view-form"
            aria-label="Créer une vue"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCreateView();
            }}
            className="w-56 shrink-0 space-y-2 rounded-md border border-stone-200 bg-white p-3"
          >
            <label className="block text-xs font-medium text-stone-700" htmlFor="create-view-name">
              Nom de la vue
            </label>
            <input
              id="create-view-name"
              autoFocus
              value={createViewName}
              onChange={(e) => setCreateViewName(e.target.value)}
              placeholder="Ex. Échecs du jour"
              className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createViewBusy || createViewName.trim().length === 0}
                className="rounded bg-sage-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {createViewBusy ? 'Création…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => setCreateViewOpen(false)}
                className="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {viewsError && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700"
          >
            {viewsError}
          </div>
        )}

        <main className="flex-1 space-y-3">
          {selected.size > 0 && (
            <BulkActionsBar
              selectedCount={selected.size}
              actions={memoActions}
              onAction={handleBulkAction}
              onClear={() => setSelected(new Set())}
              busyActionId={bulkBusy}
            />
          )}

          {/* Résultat HONNÊTE d'une action bulk réussie (retried/skipped/suppressed). */}
          {bulkResult && (
            <div
              data-testid="bulk-action-feedback"
              className="rounded-md border border-sage-300 bg-sage-50 p-3 text-sm text-sage-800"
            >
              <span aria-hidden="true" className="mr-1.5">✓</span>
              {bulkResult}
              <button
                type="button"
                onClick={() => setBulkResult(null)}
                aria-label="Masquer le résultat"
                className="ml-3 text-sage-600 underline-offset-2 hover:underline"
              >
                OK
              </button>
            </div>
          )}

          {/* Échec d'une action bulk : message visible + réessayer. Sélection conservée. */}
          {bulkError && (
            <div
              role="alert"
              data-testid="bulk-action-error"
              className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{bulkError}</span>
              <button
                type="button"
                onClick={retryLastBulk}
                disabled={bulkBusy !== null}
                className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
          )}

          {reapFeedback && (
            <div
              role="status"
              data-testid="reap-feedback"
              className="rounded-md border border-sage-300 bg-sage-50 p-3 text-sm text-sage-800"
            >
              <span aria-hidden="true" className="mr-1.5">✓</span>
              {reapFeedback}
            </div>
          )}
          {reapError && (
            <div role="alert" data-testid="reap-error" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {reapError}
            </div>
          )}

          {searchError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              Erreur : {searchError}
            </div>
          )}

          <FilteredTable
            rows={searchResult?.rows ?? []}
            total={searchResult?.total ?? 0}
            isLoading={isSearching}
            selectedIds={selected}
            onSelectionChange={setSelected}
            sort={sort}
            onSortChange={handleSortChange}
            onRowClick={(id) => router.push(`/admin/emails/transactional/${id}`)}
          />

          {/* Pagination (F-011) — visible dès qu'il y a plus d'une page.
              L'opérateur n'est plus aveugle au-delà des 50 premières lignes. */}
          {!isSearching && total > PAGE_SIZE && (
            <nav
              aria-label="Pagination des résultats"
              data-testid="cockpit-pagination"
              className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600"
            >
              <span data-testid="pagination-range">
                {rangeStart.toLocaleString('fr-FR')}–{rangeEnd.toLocaleString('fr-FR')} sur{' '}
                {total.toLocaleString('fr-FR')}
                {searchResult?.window === 'truncated' ? '+' : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canPrev}
                  data-testid="pagination-prev"
                  className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext}
                  data-testid="pagination-next"
                  className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </nav>
          )}
        </main>
      </div>

      {/* Palette ⌘K (toujours montée, contrôlée en interne) */}
      <CommandPalette
        savedViews={views}
        actions={paletteActions}
        onApply={applyParseResult}
        onSelectView={handleSelectView}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
