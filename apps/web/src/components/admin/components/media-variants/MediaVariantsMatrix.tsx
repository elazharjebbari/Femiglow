/**
 * MediaVariantsMatrix — matrice « médias par audience » (présentation).
 *
 *  - lignes : `Défaut`, puis chaque valeur de dimension (angles a…e, témoin) ;
 *  - colonnes : langues d'ensemble (`*` toutes langues, fr, ar, en) ;
 *  - dans chaque cellule, un bouton par slot (primary, secondary) :
 *    vignette(s), « +n secondaires », pastilles (publié vN, brouillon,
 *    programmé <date>, bloqué) et, sans ensemble publié propre, ce que voit
 *    réellement la visiteuse de cette langue (« hérite de : angle e · * »,
 *    « liaison existante », « image produit ») — lu dans la couverture
 *    serveur, calculée avec `selectMediaSet`.
 *
 * Accessibilité : vrai `<table>` (en-têtes de ligne et de colonne), un
 * bouton nommé par sous-cellule, « roving tabindex » (un seul arrêt de
 * tabulation pour toute la matrice), navigation aux flèches entre boutons
 * (← → entre langues, ↑ ↓ entre slots puis lignes), Origine/Fin.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { MediaVariantSlotPolicy } from '@/lib/components/registry';
import {
  WILDCARD,
  cellTitle,
  coverageCellFor,
  displaySet,
  findSetById,
  indexSets,
  inheritanceFor,
  localeLabel,
  matrixRows,
  rowKey,
  rowLabel,
  statusPills,
  tupleKey,
  type Inheritance,
} from './model';
import type { AdminMediaSetJson, MediaSetsListResponse, MediaSetTuple } from './types';
import { Pill, Thumb } from './ui';

interface Props {
  data: MediaSetsListResponse;
  /** Slot affiché (`all` = tous). */
  slotFilter: string;
  /** Slots `component_media_bindings` actifs (repli niveau 7). */
  activeLegacySlots: ReadonlySet<string>;
  onOpenCell: (tuple: MediaSetTuple) => void;
  /** Cellule actuellement ouverte (mise en évidence). */
  activeTuple?: MediaSetTuple | null;
}

export function MediaVariantsMatrix({
  data,
  slotFilter,
  activeLegacySlots,
  onOpenCell,
  activeTuple,
}: Props): JSX.Element {
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = useMemo(() => matrixRows(data.dimensions), [data.dimensions]);
  const bySet = useMemo(() => indexSets(data.sets), [data.sets]);
  const stuckIds = useMemo(
    () => new Set(data.stuckScheduled.map((s) => s.setId)),
    [data.stuckScheduled],
  );
  const slots = data.policy.slots.filter((s) => slotFilter === 'all' || s.key === slotFilter);
  const locales = data.locales;
  const activeKey = activeTuple ? tupleKey(activeTuple) : null;
  /** Bouton qui porte l'unique arrêt de tabulation (index vertical, colonne). */
  const [roving, setRoving] = useState<{ v: number; c: number }>({ v: 0, c: 0 });
  const maxVertical = Math.max(0, rows.length * slots.length - 1);
  const tabV = Math.min(roving.v, maxVertical);
  const tabC = Math.min(roving.c, Math.max(0, locales.length - 1));

  function onKeyDown(e: KeyboardEvent<HTMLTableElement>): void {
    const target = e.target as HTMLElement;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    const s = Number(target.dataset.s);
    if (Number.isNaN(r) || Number.isNaN(c) || Number.isNaN(s)) return;
    const nS = slots.length;
    let v = r * nS + s; // index vertical (ligne × slot)
    let col = c;
    const maxV = rows.length * nS - 1;
    switch (e.key) {
      case 'ArrowRight':
        col = Math.min(locales.length - 1, c + 1);
        break;
      case 'ArrowLeft':
        col = Math.max(0, c - 1);
        break;
      case 'ArrowDown':
        v = Math.min(maxV, v + 1);
        break;
      case 'ArrowUp':
        v = Math.max(0, v - 1);
        break;
      case 'Home':
        col = 0;
        if (e.ctrlKey) v = 0;
        break;
      case 'End':
        col = locales.length - 1;
        if (e.ctrlKey) v = maxV;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nr = Math.floor(v / nS);
    const ns = v % nS;
    setRoving({ v, c: col });
    tableRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-r="${nr}"][data-c="${col}"][data-s="${ns}"]`)
      ?.focus();
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table
        ref={tableRef}
        onKeyDown={onKeyDown}
        aria-label="Matrice des médias par audience"
        aria-describedby="hmv-matrix-help"
        className="w-full min-w-[760px] border-separate border-spacing-0 text-left"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 w-40 border-b border-stone-200 bg-white px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500"
            >
              Audience
            </th>
            {locales.map((loc) => (
              <th
                key={loc}
                scope="col"
                className="border-b border-stone-200 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500"
              >
                {localeLabel(loc)}
                {loc === WILDCARD ? (
                  <span className="ml-1 font-mono font-normal normal-case text-stone-400">*</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const label = rowLabel(row, data.dimensions);
            return (
              <tr key={rowKey(row)} className="align-top">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-stone-100 bg-white px-2 py-2 font-normal"
                >
                  <span className="block text-sm font-semibold text-stone-900">{label.title}</span>
                  {label.hint ? (
                    <span className="block text-[11px] leading-snug text-stone-500">« {label.hint} »</span>
                  ) : null}
                </th>
                {locales.map((loc, c) => (
                  <td key={loc} className="border-b border-stone-100 px-1.5 py-1.5">
                    <div className="flex flex-col gap-1">
                      {slots.map((slotPolicy, s) => {
                        const tuple: MediaSetTuple = {
                          slot: slotPolicy.key,
                          variantDim: row.variantDim,
                          variantKey: row.variantKey,
                          locale: loc,
                        };
                        const key = tupleKey(tuple);
                        const entry = bySet.get(key);
                        const inheritance =
                          loc === WILDCARD
                            ? null
                            : inheritanceFor(
                                coverageCellFor(data.coverage.cells, row, loc, slotPolicy.key),
                                slotPolicy,
                                activeLegacySlots,
                              );
                        return (
                          <MatrixCellButton
                            key={slotPolicy.key}
                            r={r}
                            c={c}
                            s={s}
                            title={cellTitle(row, loc, slotPolicy.key, data.dimensions)}
                            slotPolicy={slotPolicy}
                            showSlotName={slots.length > 1}
                            own={displaySet(entry)}
                            pills={statusPills(entry, stuckIds)}
                            hasPublished={!!entry?.published}
                            inheritance={inheritance}
                            inheritedSet={findSetById(data.sets, inheritance?.setId)}
                            active={activeKey === key}
                            tabStop={r * slots.length + s === tabV && c === tabC}
                            onFocusCell={() => setRoving({ v: r * slots.length + s, c })}
                            onOpen={() => onOpenCell(tuple)}
                          />
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p id="hmv-matrix-help" className="mt-2 text-[11px] text-stone-500">
        Tabulation pour entrer dans la matrice, flèches pour se déplacer entre les cellules, Entrée pour
        ouvrir l’éditeur. « Hérite de »
        décrit ce que voit aujourd’hui une visiteuse de cette langue (ensembles publiés).
      </p>
    </div>
  );
}

interface CellProps {
  r: number;
  c: number;
  s: number;
  title: string;
  slotPolicy: MediaVariantSlotPolicy;
  showSlotName: boolean;
  own: AdminMediaSetJson | null;
  pills: ReturnType<typeof statusPills>;
  hasPublished: boolean;
  inheritance: Inheritance | null;
  inheritedSet: AdminMediaSetJson | null;
  active: boolean;
  /** Seul bouton atteignable à la tabulation (roving tabindex). */
  tabStop: boolean;
  onFocusCell: () => void;
  onOpen: () => void;
}

function MatrixCellButton({
  r,
  c,
  s,
  title,
  slotPolicy,
  showSlotName,
  own,
  pills,
  hasPublished,
  inheritance,
  inheritedSet,
  active,
  tabStop,
  onFocusCell,
  onOpen,
}: CellProps): JSX.Element {
  // Vignettes : l'ensemble propre (publié > programmé > brouillon), sinon
  // l'ensemble hérité, grisé.
  const shown = own ?? (inheritance?.kind === 'inherited' ? inheritedSet : null);
  const dimmed = !own;
  const items = shown?.items ?? [];
  const isList = slotPolicy.kind === 'list';
  const showInheritance = !hasPublished && inheritance && inheritance.kind !== 'own';
  const stateText = pills.length > 0 ? pills.map((p) => p.label).join(', ') : 'aucun ensemble';
  const ariaLabel = [
    title,
    stateText,
    isList && items.length > 0 ? `${items.length} image${items.length > 1 ? 's' : ''}` : null,
    showInheritance ? inheritance!.label : null,
    'ouvrir l’éditeur',
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <button
      type="button"
      data-r={r}
      data-c={c}
      data-s={s}
      onClick={onOpen}
      onFocus={onFocusCell}
      tabIndex={tabStop ? 0 : -1}
      aria-label={ariaLabel}
      aria-current={active ? 'true' : undefined}
      className={`group flex w-full min-w-0 items-start gap-2 rounded-md border px-1.5 py-1.5 text-left transition hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
        active ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white'
      }`}
    >
      <span className="flex shrink-0 items-center">
        {items.length === 0 ? (
          <Thumb src={null} size={isList ? 'sm' : 'md'} dimmed />
        ) : isList ? (
          <span className="flex -space-x-3">
            {items.slice(0, 3).map((it) => (
              <Thumb
                key={it.id}
                src={it.media?.thumbUrl}
                size="sm"
                dimmed={dimmed}
                broken={it.media ? it.media.state !== 'ok' : false}
              />
            ))}
          </span>
        ) : (
          <Thumb
            src={items[0]?.media?.thumbUrl}
            size="md"
            dimmed={dimmed}
            broken={items[0]?.media ? items[0].media.state !== 'ok' : false}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {showSlotName ? (
          <span className="font-mono text-[10px] uppercase tracking-wide text-stone-400">
            {slotPolicy.key}
          </span>
        ) : null}
        {isList && items.length > 0 ? (
          <span className={`text-[11px] ${dimmed ? 'text-stone-500' : 'text-stone-700'}`}>
            +{items.length} secondaire{items.length > 1 ? 's' : ''}
          </span>
        ) : null}
        {pills.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {pills.map((p) => (
              <Pill key={p.label} pill={p} />
            ))}
          </span>
        ) : null}
        {showInheritance ? (
          <span
            className={`text-[11px] leading-snug ${
              inheritance!.kind === 'inherited' ? 'text-sky-700' : 'text-amber-700'
            }`}
          >
            {inheritance!.kind === 'inherited' ? inheritance!.label : `repli : ${inheritance!.label}`}
          </span>
        ) : null}
        {!own && !inheritance ? (
          <span className="text-[11px] text-stone-400">aucun ensemble</span>
        ) : null}
      </span>
    </button>
  );
}
