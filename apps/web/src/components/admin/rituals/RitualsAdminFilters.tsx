'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  countActiveFilters,
  KNOWN_AUTO_FLAGS,
  KNOWN_SOURCES,
  parseAdminFilters,
  serializeAdminFilters,
  type AdminFilters,
  type KnownAutoFlag,
} from '@/lib/admin/admin-filters';
import type { RitualSource } from '@/lib/db/types';

interface RitualsAdminFiltersProps {
  /** Paramètres URL préservés en plus des filtres (ex. `?status=PENDING`). */
  preserveParams?: Record<string, string>;
}

const FLAG_LABEL: Record<KnownAutoFlag, string> = {
  emoji_detected: 'Emoji',
  link_external: 'Lien externe',
  forbidden_word: 'Mot interdit',
  all_caps: 'Majuscules',
  face_detected: 'Visage',
  duplicate_strict: 'Doublon strict',
  duplicate_loose: 'Doublon proche',
};

const SOURCE_LABEL: Record<RitualSource, string> = {
  web: 'Web',
  email_j45: 'E-mail J+45',
  manual: 'Manuel',
  import_csv: 'Import CSV',
  import_json: 'Import JSON',
  import_zip: 'Import ZIP',
};

export function RitualsAdminFilters({ preserveParams = {} }: RitualsAdminFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentFilters = useMemo<AdminFilters>(
    () => parseAdminFilters(searchParams as unknown as URLSearchParams),
    [searchParams],
  );
  const [draft, setDraft] = useState<AdminFilters>(currentFilters);
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(currentFilters);

  function apply(next: AdminFilters) {
    const params = serializeAdminFilters(next);
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v) params.set(k, v);
    }
    // Conserve aussi tout paramètre courant non couvert par les filtres (ex. ?status=PENDING déjà posé via Link)
    for (const [k, v] of (searchParams as unknown as URLSearchParams).entries()) {
      const fieldKeys = ['flags', 'source', 'from', 'to', 'author', 'verified'];
      if (!fieldKeys.includes(k) && !params.has(k)) {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function toggleFlag(flag: KnownAutoFlag) {
    const next = draft.flags.includes(flag)
      ? draft.flags.filter((f) => f !== flag)
      : [...draft.flags, flag];
    setDraft({ ...draft, flags: next });
  }

  function toggleSource(s: RitualSource) {
    const next = draft.sources.includes(s)
      ? draft.sources.filter((x) => x !== s)
      : [...draft.sources, s];
    setDraft({ ...draft, sources: next });
  }

  function reset() {
    const empty: AdminFilters = {
      flags: [],
      sources: [],
      dateFrom: null,
      dateTo: null,
      authorQuery: null,
      verified: null,
    };
    setDraft(empty);
    apply(empty);
  }

  return (
    <section
      aria-label="Filtres avancés"
      className="mb-4 rounded border border-stone-200 bg-white"
      data-testid="admin-filters"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-medium text-stone-900"
          data-testid="admin-filters-toggle"
        >
          Filtres {activeCount > 0 ? `(${activeCount} actif${activeCount > 1 ? 's' : ''})` : ''}
          <span className="ml-2 text-stone-500">{open ? '▾' : '▸'}</span>
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-stone-600 underline"
            data-testid="admin-filters-reset"
          >
            Réinitialiser
          </button>
        )}
      </header>

      {open && (
        <div className="border-t border-stone-200 px-4 py-3 space-y-3 text-sm">
          <fieldset>
            <legend className="font-medium text-stone-700">Auto-flags</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {KNOWN_AUTO_FLAGS.map((flag) => {
                const active = draft.flags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleFlag(flag)}
                    className={`border px-2 py-1 text-xs ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 hover:bg-stone-100'
                    }`}
                    data-testid={`admin-filter-flag-${flag}`}
                    aria-pressed={active}
                  >
                    {FLAG_LABEL[flag]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-medium text-stone-700">Sources</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {KNOWN_SOURCES.map((s) => {
                const active = draft.sources.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSource(s)}
                    className={`border px-2 py-1 text-xs ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 hover:bg-stone-100'
                    }`}
                    data-testid={`admin-filter-source-${s}`}
                    aria-pressed={active}
                  >
                    {SOURCE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-wrap gap-3">
            <legend className="block w-full font-medium text-stone-700">Période</legend>
            <label className="flex items-center gap-2 text-xs">
              Du
              <input
                type="date"
                value={draft.dateFrom ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, dateFrom: e.target.value || null })
                }
                className="border border-stone-300 px-2 py-1"
                data-testid="admin-filter-date-from"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              Au
              <input
                type="date"
                value={draft.dateTo ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, dateTo: e.target.value || null })
                }
                className="border border-stone-300 px-2 py-1"
                data-testid="admin-filter-date-to"
              />
            </label>
          </fieldset>

          <fieldset className="flex flex-wrap gap-3">
            <legend className="block w-full font-medium text-stone-700">Auteur</legend>
            <input
              type="text"
              placeholder="Prénom ou hash…"
              value={draft.authorQuery ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, authorQuery: e.target.value || null })
              }
              className="w-full border border-stone-300 px-2 py-1 text-sm sm:w-64"
              data-testid="admin-filter-author"
            />
          </fieldset>

          <fieldset>
            <legend className="font-medium text-stone-700">Vérifiée</legend>
            <div className="mt-1 flex gap-2 text-xs">
              {(['all', 'true', 'false'] as const).map((v) => {
                const isActive =
                  (v === 'all' && draft.verified === null) ||
                  (v === 'true' && draft.verified === true) ||
                  (v === 'false' && draft.verified === false);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        verified: v === 'all' ? null : v === 'true',
                      })
                    }
                    className={`border px-2 py-1 ${
                      isActive
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 hover:bg-stone-100'
                    }`}
                    aria-pressed={isActive}
                  >
                    {v === 'all' ? 'Toutes' : v === 'true' ? 'Vérifiée' : 'Non vérifiée'}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(currentFilters);
                setOpen(false);
              }}
              className="border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                apply(draft);
                setOpen(false);
              }}
              className="bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800"
              data-testid="admin-filters-apply"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
