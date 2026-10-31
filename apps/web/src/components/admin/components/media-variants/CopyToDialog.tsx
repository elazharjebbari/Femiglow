/**
 * CopyToDialog — « Copier vers… » : crée (ou remplace) le BROUILLON d'une
 * autre cellule du même slot avec les mêmes images (ordre, alt, cadrage,
 * version mobile). Rien n'est publié.
 */
'use client';

import { useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { localeLabel, rowKey, rowLabel, tupleKey, type TupleSets } from './model';
import type { MatrixRow, MediaSetTuple, MediaVariantDimensionJson } from './types';
import { btn } from './ui';

interface Props {
  open: boolean;
  source: MediaSetTuple;
  rows: MatrixRow[];
  locales: string[];
  dimensions: MediaVariantDimensionJson[];
  setsByTuple: ReadonlyMap<string, TupleSets>;
  itemCount: number;
  busy: boolean;
  error: string | null;
  onConfirm: (target: MediaSetTuple) => void;
  onClose: () => void;
}

export function CopyToDialog({
  open,
  source,
  rows,
  locales,
  dimensions,
  setsByTuple,
  itemCount,
  busy,
  error,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [rowId, setRowId] = useState<string>('');
  const [locale, setLocale] = useState<string>(source.locale);

  useEffect(() => {
    if (!open) return;
    const firstOther = rows.find((r) => rowKey(r) !== rowKey(source));
    setRowId(firstOther ? rowKey(firstOther) : rowKey(rows[0]!));
    setLocale(source.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const row = rows.find((r) => rowKey(r) === rowId) ?? null;
  const target: MediaSetTuple | null = row
    ? { slot: source.slot, variantDim: row.variantDim, variantKey: row.variantKey, locale }
    : null;
  const same = target ? tupleKey(target) === tupleKey(source) : true;
  const targetEntry = target ? setsByTuple.get(tupleKey(target)) : undefined;

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-stone-900/50" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <RadixDialog.Title className="text-lg font-semibold text-stone-900">Copier vers…</RadixDialog.Title>
          <RadixDialog.Description className="mt-1 text-sm text-stone-600">
            Crée un brouillon avec les {itemCount} image{itemCount > 1 ? 's' : ''} actuelles (slot{' '}
            <code className="font-mono">{source.slot}</code>) dans une autre cellule. Rien n’est publié.
          </RadixDialog.Description>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (target && !same) onConfirm(target);
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
              Audience
              <select
                value={rowId}
                onChange={(e) => setRowId(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
              >
                {rows.map((r) => (
                  <option key={rowKey(r)} value={rowKey(r)}>
                    {rowLabel(r, dimensions).title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
              Langue
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {localeLabel(l)} {l === '*' ? '(*)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {same ? (
              <p className="text-xs text-stone-500">Choisissez une cellule différente de la cellule source.</p>
            ) : targetEntry?.draft ? (
              <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Cette cellule a déjà un brouillon : il sera remplacé.
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className={btn('secondary')} onClick={onClose} disabled={busy}>
                Annuler
              </button>
              <button type="submit" className={btn('primary')} disabled={busy || same || itemCount === 0}>
                Créer le brouillon
              </button>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
