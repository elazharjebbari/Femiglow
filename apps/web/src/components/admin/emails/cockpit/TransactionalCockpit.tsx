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
import { buildCsvDocument, csvFilename } from '@/lib/mail/transactional/csv';
import { offsetForPage, pageCount, COCKPIT_PAGE_SIZE } from '@/lib/mail/transactional/pagination';
import { BULK_BY_FILTER_CAP } from '@/lib/mail/transactional/schemas';
import { SKIP_REASON_LABELS_FR } from '@/lib/mail/transactional/skip-reasons';
import { ConfirmDialog } from '@/components/admin/emails/ui/ConfirmDialog';
import { useOptionalToast } from '@/components/admin/emails/ui/toast';
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

const PAGE_SIZE = COCKPIT_PAGE_SIZE;

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


/** Déclenche un téléchargement navigateur depuis un Blob (a[download] éphémère). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  // ── Sélection GLOBALE par filtre (CKPT-04) — machine page|filter ──────
  // `filterSelection` non-null = mode filter : les actions portent sur TOUS
  // les résultats du filtre (snapshot = signature du filtre au moment de
  // l'amorce — tout changement de filtre ANNULE, le tri/page SURVIVENT).
  type FilterSelection = { total: number; label: string };
  const [filterSelection, setFilterSelection] = useState<FilterSelection | null>(null);
  const toast = useOptionalToast();
  const filterSignature = useMemo(() => {
    const params = serializeFilters(parseResult.filters);
    if (parseResult.freetext) params.set('q', parseResult.freetext);
    return params.toString();
  }, [parseResult]);

  // ── Feedback des actions bulk (anti faux-succès) ─────────────────────
  // `bulkBusy` = action réseau en vol (verrou anti double-soumission).
  // `bulkError` = message d'échec visible (role=alert), sélection conservée.
  // `bulkResult` = résultat HONNÊTE d'un succès (retried/skipped/suppressed).
  const [bulkBusy, setBulkBusy] = useState<BulkNetworkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  // Dernière action bulk tentée → permet à « réessayer » de rejouer la bonne.
  const lastBulkActionRef = useRef<BulkNetworkAction | null>(null);

  // Changement de FILTRE : reset page + ANNULATION de la sélection-filtre
  // (toast info — l'ensemble visé n'existe plus). Le tri ne touche QUE la
  // sélection page (l'ensemble du filtre est inchangé → la globale survit).
  const prevSignatureRef = useRef(filterSignature);
  useEffect(() => {
    if (prevSignatureRef.current === filterSignature) return;
    prevSignatureRef.current = filterSignature;
    setSelected(new Set());
    setBulkError(null);
    setBulkResult(null);
    setFilterSelection((cur) => {
      if (cur) toast?.success('Sélection globale annulée — les filtres ont changé');
      return null;
    });
  }, [filterSignature, toast]);
  useEffect(() => {
    setSelected(new Set());
  }, [sort]);

  // ── Feedback des actions sur les vues (rename/delete) ────────────────
  const [viewsError, setViewsError] = useState<string | null>(null);

  // ── Export CSV (CKPT-01) — libellé HONNÊTE page vs serveur ────────────
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportCapped, setExportCapped] = useState(false);

  // ── Bannière contexte santé (DASH-12) : ?from=health&check=&at= ───────
  const [healthBanner, setHealthBanner] = useState<{ check: string | null; at: string | null } | null>(
    () =>
      searchParams.get('from') === 'health'
        ? { check: searchParams.get('check'), at: searchParams.get('at') }
        : null,
  );
  const dismissHealthBanner = useCallback(() => {
    setHealthBanner(null);
    // Nettoie l'URL (pas de réapparition au refresh) en préservant les filtres.
    const params = new URLSearchParams(window.location.search);
    params.delete('from');
    params.delete('check');
    params.delete('at');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [router]);

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

  // Saut de page (CKPT-12) : champ contrôlé, resynchronisé quand l'offset
  // change par un autre chemin (Précédent/Suivant, changement de filtre).
  const [pageInput, setPageInput] = useState('1');
  useEffect(() => {
    setPageInput(String(Math.floor(offset / PAGE_SIZE) + 1));
  }, [offset]);

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
      // CKPT-07 : le feedback dit OÙ vont les lignes libérées.
      setReapFeedback(
        n === 0
          ? 'Aucun envoi bloqué à libérer.'
          : `${n} envoi${n > 1 ? 's' : ''} bloqué${n > 1 ? 's' : ''} libéré${n > 1 ? 's' : ''} → re-mis en file (ou DLQ si plafond).`,
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
      const csv = buildCsvDocument(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      triggerDownload(blob, csvFilename());
    },
    [searchResult],
  );

  /**
   * Export CSV de l'ENSEMBLE du filtre (CKPT-01) :
   *  - total <= page → chemin CLIENT (page courante), libellé « (page) » ;
   *  - total > page  → POST /export (stream serveur, keyset, cap 100 000).
   * Anti double-clic (exportBusy) ; échec → message visible + Réessayer ;
   * réponse cappée (X-Export-Capped) → message « affinez les filtres ».
   */
  const handleExportAll = useCallback(async () => {
    if (exportBusy) return;
    setExportError(null);
    setExportCapped(false);

    const rows = searchResult?.rows ?? [];
    if (total <= rows.length) {
      // Page unique : le chemin client suffit (et le dit honnêtement).
      if (rows.length === 0) return;
      triggerDownload(
        new Blob([buildCsvDocument(rows)], { type: 'text/csv;charset=utf-8' }),
        csvFilename(),
      );
      return;
    }

    setExportBusy(true);
    try {
      const res = await fetch('/api/admin/emails/transactional/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filters: parseResult.filters, freetext: parseResult.freetext }),
      });
      if (!res.ok) {
        setExportError(await describeHttpError(res));
        return; // pas de faux téléchargement.
      }
      setExportCapped(res.headers.get('x-export-capped') === 'true');
      const blob = await res.blob();
      triggerDownload(blob, csvFilename());
    } catch {
      setExportError('Échec réseau : impossible de joindre le serveur. Réessaie.');
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, searchResult, total, parseResult]);

  // ── Retry PAR FILTRE : dry-count → ConfirmDialog → exécution ──────────
  const [filterRetryDialog, setFilterRetryDialog] = useState<{ count: number } | null>(null);
  const [filterRetryBusy, setFilterRetryBusy] = useState(false);
  const [filterRetryError, setFilterRetryError] = useState<string | null>(null);
  const [capMessage, setCapMessage] = useState<string | null>(null);

  const startFilterRetry = useCallback(async () => {
    if (filterRetryBusy) return; // anti double-clic (hang : UN SEUL POST)
    setFilterRetryBusy(true);
    setFilterRetryError(null);
    setCapMessage(null);
    try {
      const res = await fetch('/api/admin/emails/transactional/bulk-retry-by-filter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filterState: { filters: parseResult.filters, freetext: parseResult.freetext },
          dry_run: true,
        }),
      });
      if (!res.ok) {
        setFilterRetryError(await describeHttpError(res));
        return;
      }
      const { count } = (await res.json()) as { count: number };
      if (count > BULK_BY_FILTER_CAP) {
        // CKPT-02 : au-delà du cap on BLOQUE avant toute confirmation.
        setCapMessage(
          `${count.toLocaleString('fr-FR')} emails correspondent — au-delà de ${BULK_BY_FILTER_CAP.toLocaleString('fr-FR')}, affinez le filtre.`,
        );
        return;
      }
      setFilterRetryDialog({ count });
    } catch {
      setFilterRetryError('Échec réseau : impossible de joindre le serveur. Réessaie.');
    } finally {
      setFilterRetryBusy(false);
    }
  }, [filterRetryBusy, parseResult]);

  /** Exécutée PAR le ConfirmDialog : un rejet laisse le dialog ouvert avec l'erreur. */
  const confirmFilterRetry = useCallback(async () => {
    const res = await fetch('/api/admin/emails/transactional/bulk-retry-by-filter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filterState: { filters: parseResult.filters, freetext: parseResult.freetext },
        dry_run: false,
      }),
    }).catch(() => {
      throw new Error('Échec réseau : impossible de joindre le serveur. Réessaie.');
    });
    if (!res.ok) {
      throw new Error(await describeHttpError(res));
    }
    const body = (await res.json()) as {
      retried: number;
      skipped: { reason: string; count: number }[];
    };
    setFilterRetryDialog(null);
    const parts = [`${body.retried.toLocaleString('fr-FR')} relancé${body.retried > 1 ? 's' : ''}`];
    for (const sk of body.skipped) {
      parts.push(
        `${sk.count.toLocaleString('fr-FR')} ignoré${sk.count > 1 ? 's' : ''} (${SKIP_REASON_LABELS_FR[sk.reason] ?? sk.reason})`,
      );
    }
    setBulkResult(parts.join(' · '));
    setFilterSelection(null);
    setSelected(new Set());
    await fetchSearch();
    await summary.refresh();
  }, [parseResult, fetchSearch, summary]);

  const handleBulkAction = useCallback(
    (id: 'retry' | 'suppress' | 'export' | 'clear') => {
      // Mode FILTRE : les actions portent sur l'ensemble du filtre.
      if (filterSelection) {
        if (id === 'clear') {
          setFilterSelection(null);
          setSelected(new Set());
          return;
        }
        if (id === 'retry') {
          void startFilterRetry();
          return;
        }
        if (id === 'export') {
          void handleExportAll();
          return;
        }
        return; // suppress par filtre : hors périmètre F04
      }
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
    [
      selected,
      bulkBusy,
      runBulkNetworkAction,
      exportSelectedCsv,
      searchResult,
      filterSelection,
      startFilterRetry,
      handleExportAll,
    ],
  );

  // Réessayer la dernière action échouée (bouton dans l'alerte d'erreur).
  const retryLastBulk = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !bulkError) return;
    // L'action est déduite du verrou nominal : on relit le dernier type via le
    // libellé n'est pas fiable → on réessaie l'action courante stockée.
    void runBulkNetworkAction(lastBulkActionRef.current ?? 'retry', ids);
  }, [selected, bulkError, runBulkNetworkAction]);

  const memoActions = useMemo(() => {
    if (filterSelection) {
      // Mode FILTRE : libellés honnêtes sur l'ENSEMBLE (CKPT-04) ; suppress
      // par filtre hors périmètre F04 (réservé).
      return [
        { id: 'retry' as const, label: `Retry (${filterSelection.total.toLocaleString('fr-FR')})` },
        {
          id: 'export' as const,
          label: `Exporter CSV (serveur, ~${filterSelection.total.toLocaleString('fr-FR')} lignes)`,
        },
      ];
    }
    return [
      { id: 'retry' as const, label: `Retry (${selected.size})` },
      { id: 'suppress' as const, label: 'Marquer en suppression', danger: true },
      { id: 'export' as const, label: 'Exporter CSV' },
    ];
  }, [selected.size, filterSelection]);

  /** Décocher une ligne en mode filtre ROMPT l'exhaustivité (Gmail-like). */
  const handleSelectionChange = useCallback(
    (next: Set<string>) => {
      if (filterSelection && next.size < selected.size) {
        setFilterSelection(null);
      }
      setSelected(next);
    },
    [filterSelection, selected.size],
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
      {/* Bannière contexte santé (DASH-12) — l'opérateur sait POURQUOI il est là. */}
      {healthBanner && (
        <div
          role="status"
          data-testid="health-context-banner"
          className="mb-4 flex items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900"
        >
          <span>
            Vous arrivez depuis le contrôle santé
            {healthBanner.check ? (
              <>
                {' '}
                (raison : <code className="font-mono text-xs">{healthBanner.check}</code>
                {healthBanner.at ? <>, relevé à {new Date(healthBanner.at).toISOString().slice(11, 16)}</> : null})
              </>
            ) : null}
            . La liste est déjà filtrée sur la population concernée.
          </span>
          <button
            type="button"
            onClick={dismissHealthBanner}
            aria-label="Fermer la bannière santé"
            className="shrink-0 rounded border border-sky-300 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
          >
            Fermer
          </button>
        </div>
      )}

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

      {/* Erreurs de parsing VISIBLES (CKPT-03) — les filtres valides restent appliqués. */}
      {parseResult.errors.length > 0 && (
        <div
          role="alert"
          data-testid="filter-parse-errors"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="font-medium">
            {parseResult.errors.length} filtre{parseResult.errors.length > 1 ? 's' : ''} ignoré
            {parseResult.errors.length > 1 ? 's' : ''} — les filtres valides restent appliqués :
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {parseResult.errors.map((err) => (
              <li key={`${err.position}-${err.raw}`}>
                <code className="font-mono text-xs">{err.raw}</code> : {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Export CSV — libellé HONNÊTE sur le périmètre (CKPT-01). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleExportAll()}
          disabled={exportBusy || isSearching || total === 0}
          aria-busy={exportBusy}
          data-testid="export-all-btn"
          className="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
        >
          {exportBusy
            ? "Préparation de l'export…"
            : total > rowsLength
              ? `Exporter CSV (serveur, ~${total.toLocaleString('fr-FR')}${searchResult?.window === 'truncated' ? '+' : ''} lignes)`
              : 'Exporter CSV (page)'}
        </button>
        {exportCapped && (
          <span data-testid="export-capped-msg" className="text-xs text-amber-700">
            Export limité aux 100 000 premières lignes — affinez les filtres.
          </span>
        )}
        {exportError && (
          <span role="alert" data-testid="export-error" className="flex items-center gap-2 text-xs text-red-700">
            {exportError}
            <button
              type="button"
              onClick={() => void handleExportAll()}
              className="rounded border border-red-300 px-2 py-0.5 font-medium hover:bg-red-100"
            >
              Réessayer
            </button>
          </span>
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
          {(selected.size > 0 || filterSelection) && (
            <BulkActionsBar
              selectedCount={filterSelection ? filterSelection.total : selected.size}
              actions={memoActions}
              onAction={handleBulkAction}
              onClear={() => {
                setFilterSelection(null);
                setSelected(new Set());
              }}
              busyActionId={filterRetryBusy ? 'retry' : bulkBusy}
            />
          )}

          {/* Amorce de sélection GLOBALE (CKPT-04) : page entière cochée ET
              d'autres résultats existent au-delà. */}
          {!filterSelection &&
            rowsLength > 0 &&
            selected.size === rowsLength &&
            total > rowsLength && (
              <div
                data-testid="select-all-filter-banner"
                className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
              >
                Les {rowsLength} emails de cette page sont sélectionnés.{' '}
                <button
                  type="button"
                  data-testid="select-all-filter-link"
                  onClick={() =>
                    setFilterSelection({
                      total,
                      label:
                        parseResult.filters.map((f) => f.raw).join(' ') ||
                        parseResult.freetext ||
                        'tous les emails',
                    })
                  }
                  className="font-medium underline underline-offset-2"
                >
                  Sélectionner les {total.toLocaleString('fr-FR')}
                  {searchResult?.window === 'truncated' ? '+' : ''} emails correspondant aux filtres
                </button>
              </div>
            )}

          {/* Bannière du mode FILTRE : périmètre + annulation (sans toast). */}
          {filterSelection && (
            <div
              role="status"
              data-testid="filter-selection-banner"
              className="flex items-center justify-between gap-3 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            >
              <span>
                <strong className="font-semibold">
                  {filterSelection.total.toLocaleString('fr-FR')} emails sélectionnés
                </strong>{' '}
                (filtre : {filterSelection.label})
              </span>
              <button
                type="button"
                data-testid="filter-selection-cancel"
                onClick={() => {
                  setFilterSelection(null);
                  setSelected(new Set());
                }}
                className="shrink-0 rounded border border-sky-300 px-2 py-0.5 text-xs font-medium hover:bg-sky-100"
              >
                annuler
              </button>
            </div>
          )}

          {/* Cap dépassé (CKPT-02) : on BLOQUE et on explique. */}
          {capMessage && (
            <div
              role="alert"
              data-testid="filter-retry-cap"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {capMessage}
            </div>
          )}

          {/* Échec du dry-count : message + Réessayer (grille réseau). */}
          {filterRetryError && (
            <div
              role="alert"
              data-testid="filter-retry-error"
              className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{filterRetryError}</span>
              <button
                type="button"
                onClick={() => void startFilterRetry()}
                disabled={filterRetryBusy}
                className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
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
            onSelectionChange={handleSelectionChange}
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
              <span
                data-testid="pagination-range"
                title={
                  searchResult?.window === 'truncated'
                    ? 'Plus de 5 000 résultats — compte exact non calculé. Affinez.'
                    : undefined
                }
              >
                {rangeStart.toLocaleString('fr-FR')}–{rangeEnd.toLocaleString('fr-FR')} sur{' '}
                {total.toLocaleString('fr-FR')}
                {searchResult?.window === 'truncated' ? '+' : ''}
              </span>
              <div className="flex items-center gap-2">
                {/* Saut de page direct (CKPT-12) — bornes pures, jamais d'erreur. */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const next = offsetForPage(pageInput, total);
                    if (next === null) {
                      setPageInput(String(Math.floor(offset / PAGE_SIZE) + 1)); // non numérique → reset
                      return;
                    }
                    setOffset(next);
                    setPageInput(String(next / PAGE_SIZE + 1));
                  }}
                  className="flex items-center gap-1 text-xs"
                >
                  <label htmlFor="page-jump-input" className="text-stone-500">
                    Aller à :
                  </label>
                  <input
                    id="page-jump-input"
                    data-testid="page-jump-input"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    className="w-12 rounded border border-stone-300 px-1.5 py-0.5 text-center"
                  />
                  <span className="text-stone-400">/ {pageCount(total)}</span>
                </form>
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

      {/* Confirmation du retry PAR FILTRE — dry-count affiché (CKPT-02). */}
      <ConfirmDialog
        open={filterRetryDialog !== null}
        title={`${(filterRetryDialog?.count ?? 0).toLocaleString('fr-FR')} emails seront relancés — confirmer ?`}
        body={
          <p>
            La relance remet ces emails en file d&apos;attente (statut « En attente »,
            tentatives remises à zéro). Les lignes non relançables du filtre seront
            ignorées et comptées dans le résultat.
          </p>
        }
        confirmLabel="Relancer"
        busyLabel="Relance…"
        onConfirm={confirmFilterRetry}
        onCancel={() => setFilterRetryDialog(null)}
      />

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
