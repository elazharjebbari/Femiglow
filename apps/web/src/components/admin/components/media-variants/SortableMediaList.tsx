/**
 * SortableMediaList — liste ordonnée des images d'un ensemble.
 *
 * Tri par glisser-déposer (`@dnd-kit/sortable`, poignée, clavier : Espace
 * pour saisir, flèches, Espace pour poser) ET boutons « Monter/Descendre »
 * pour un tri accessible sans glisser. Par image : version mobile 3:4,
 * alt FR/AR/EN (AR en `dir="rtl"`, avertissement si l'alt de la langue de
 * la cellule manque), point focal (clic sur la vignette ou champs X/Y en %)
 * et cadrage (`object-position`).
 */
'use client';

import type { CSSProperties, MouseEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { MediaObjectPosition } from '@/lib/db/types';
import {
  ALT_LOCALES,
  OBJECT_POSITIONS,
  OBJECT_POSITION_LABEL,
  missingAltLocales,
  moveItem,
  parseFocal,
  type AltLocale,
  type EditorItem,
} from './editor-model';
import type { MediaSetIssueJson } from './types';
import { Thumb, btn } from './ui';

const ALT_LABEL: Record<AltLocale, string> = { fr: 'Alt FR', ar: 'Alt AR', en: 'Alt EN' };

interface Props {
  items: EditorItem[];
  cellLocale: string;
  onChange: (items: EditorItem[]) => void;
  onPickMobile: (uid: string) => void;
  /** Problèmes 422 rattachés à une image par son `uid` (stable au réordonnancement). */
  issues?: Array<MediaSetIssueJson & { uid?: string }>;
  disabled?: boolean;
}

export function SortableMediaList({
  items,
  cellLocale,
  onChange,
  onPickMobile,
  issues = [],
  disabled = false,
}: Props): JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent): void {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.uid === active.id);
    const to = items.findIndex((i) => i.uid === over.id);
    if (from < 0 || to < 0) return;
    onChange(moveItem(items, from, to));
  }

  function update(uid: string, patch: Partial<EditorItem>): void {
    onChange(items.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  const position = (id: string | number) => items.findIndex((i) => i.uid === id) + 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Pour déplacer une image, appuyez sur Espace, utilisez les flèches haut et bas, puis Espace pour la poser ou Échap pour annuler.',
        },
        announcements: {
          onDragStart: ({ active }) => `Image ${position(active.id)} saisie.`,
          onDragOver: ({ over }) => (over ? `Au-dessus de la position ${position(over.id)}.` : ''),
          onDragEnd: ({ over }) => (over ? `Image posée en position ${position(over.id)}.` : 'Image posée.'),
          onDragCancel: () => 'Déplacement annulé.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
        <ol aria-label="Images de l’ensemble, dans l’ordre d’affichage" className="flex flex-col gap-3">
          {items.map((item, index) => (
            <SortableRow
              key={item.uid}
              item={item}
              index={index}
              count={items.length}
              cellLocale={cellLocale}
              disabled={disabled}
              issues={issues.filter((iss) => iss.uid === item.uid)}
              onUpdate={(patch) => update(item.uid, patch)}
              onMove={(to) => onChange(moveItem(items, index, to))}
              onRemove={() => onChange(items.filter((i) => i.uid !== item.uid))}
              onPickMobile={() => onPickMobile(item.uid)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  item: EditorItem;
  index: number;
  count: number;
  cellLocale: string;
  disabled: boolean;
  issues: MediaSetIssueJson[];
  onUpdate: (patch: Partial<EditorItem>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onPickMobile: () => void;
}

function SortableRow({
  item,
  index,
  count,
  cellLocale,
  disabled,
  issues,
  onUpdate,
  onMove,
  onRemove,
  onPickMobile,
}: RowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uid, disabled });
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  const n = index + 1;
  const missing = missingAltLocales(item, cellLocale);
  const idBase = `hmv-item-${item.uid}`;

  function setFocalFromClick(e: MouseEvent<HTMLButtonElement>): void {
    // Activation clavier (Entrée/Espace : `detail === 0`) : pas de position
    // de pointeur ; on envoie vers le champ X pour une saisie précise.
    if (e.detail === 0) {
      document.getElementById(`${idBase}-focal-x`)?.focus();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onUpdate({ focalX: Math.max(0, Math.min(100, x)), focalY: Math.max(0, Math.min(100, y)) });
  }

  const hasFocal = item.focalX !== null && item.focalY !== null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      aria-label={`Image ${n} sur ${count}`}
      className={`rounded-lg border bg-white p-3 shadow-sm ${
        issues.length > 0 ? 'border-rose-300' : 'border-stone-200'
      } ${isDragging ? 'opacity-80 ring-2 ring-stone-900' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={`Déplacer l’image ${n}`}
            className="cursor-grab rounded px-1.5 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 active:cursor-grabbing"
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <span className="text-xs font-semibold text-stone-700">
            {n === 1 ? 'Image 1 (affichée en premier)' : `Image ${n}`}
          </span>
          {item.state !== 'ok' ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-medium text-rose-800">
              média {item.state === 'not_ready' ? 'pas prêt' : 'supprimé'}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btn('ghost', 'px-2')}
            onClick={() => onMove(index - 1)}
            disabled={disabled || index === 0}
            aria-label={`Monter l’image ${n}`}
          >
            ↑
          </button>
          <button
            type="button"
            className={btn('ghost', 'px-2')}
            onClick={() => onMove(index + 1)}
            disabled={disabled || index === count - 1}
            aria-label={`Descendre l’image ${n}`}
          >
            ↓
          </button>
          <button
            type="button"
            className={btn('danger', 'px-2')}
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Retirer l’image ${n}`}
          >
            Retirer
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={setFocalFromClick}
              disabled={disabled}
              aria-label={`Placer le point focal de l’image ${n} (clic sur la vignette ; au clavier, champs X et Y)`}
              className="relative block overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <Thumb src={item.thumbUrl} size="lg" broken={item.state !== 'ok'} />
              {hasFocal ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-600 shadow"
                  style={{ left: `${item.focalX}%`, top: `${item.focalY}%` }}
                />
              ) : null}
            </button>
            <span className="text-[10px] text-stone-500">desktop 4:5</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {item.mobileMediaId ? (
              <>
                <Thumb src={item.mobileThumbUrl} size="lg" broken={item.mobileState !== null && item.mobileState !== 'ok'} />
                <span className="text-[10px] text-stone-500">mobile 3:4</span>
                <span className="flex gap-1">
                  <button type="button" className={btn('ghost', 'px-1.5 py-0.5 text-[11px]')} onClick={onPickMobile} disabled={disabled}>
                    Changer
                  </button>
                  <button
                    type="button"
                    className={btn('ghost', 'px-1.5 py-0.5 text-[11px] text-rose-700')}
                    onClick={() => onUpdate({ mobileMediaId: null, mobileThumbUrl: null, mobileState: null })}
                    disabled={disabled}
                    aria-label={`Retirer la version mobile de l’image ${n}`}
                  >
                    Retirer
                  </button>
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={onPickMobile}
                disabled={disabled}
                className="flex h-28 w-[90px] flex-col items-center justify-center gap-1 rounded border border-dashed border-stone-300 px-1 text-center text-[11px] text-stone-600 hover:border-stone-500 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              >
                <span aria-hidden="true">＋</span>
                Version mobile 3:4
                <span className="text-[10px] text-stone-400">(facultatif)</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {ALT_LOCALES.map((loc) => {
            const isMissing = missing.includes(loc);
            const inputId = `${idBase}-alt-${loc}`;
            const hintId = `${inputId}-hint`;
            return (
              <div key={loc} className="flex flex-col gap-0.5">
                <label htmlFor={inputId} className="text-[11px] font-medium text-stone-700">
                  {ALT_LABEL[loc]}
                  <span className="sr-only"> — image {n}</span>
                </label>
                {loc === 'fr' && item.libraryAlt ? (
                  <span className="text-[11px] text-stone-400">Médiathèque : « {item.libraryAlt} »</span>
                ) : null}
                <input
                  id={inputId}
                  type="text"
                  dir={loc === 'ar' ? 'rtl' : 'ltr'}
                  lang={loc}
                  maxLength={300}
                  value={item.alt[loc]}
                  disabled={disabled}
                  aria-invalid={isMissing ? true : undefined}
                  aria-describedby={isMissing ? hintId : undefined}
                  onChange={(e) => onUpdate({ alt: { ...item.alt, [loc]: e.target.value } })}
                  className={`w-full rounded-md border px-2 py-1 text-sm text-stone-900 focus:border-stone-900 focus:outline-none ${
                    isMissing ? 'border-amber-400 bg-amber-50/40' : 'border-stone-300'
                  }`}
                />
                {isMissing ? (
                  <p id={hintId} className="text-[11px] text-amber-700">
                    Alt {loc.toUpperCase()} manquant pour cette cellule
                    {loc === 'fr' && item.libraryAlt
                      ? ' : l’alt de la médiathèque sera utilisé.'
                      : ' : le texte alternatif sera vide pour les lectrices d’écran.'}
                  </p>
                ) : null}
              </div>
            );
          })}

          <fieldset className="mt-1 grid grid-cols-3 gap-2">
            <legend className="sr-only">Cadrage de l’image {n}</legend>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-stone-700">
              <span>
                Point focal X (%)<span className="sr-only"> — image {n}</span>
              </span>
              <input
                id={`${idBase}-focal-x`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={item.focalX ?? ''}
                disabled={disabled}
                onChange={(e) => onUpdate({ focalX: parseFocal(e.target.value) })}
                className="rounded-md border border-stone-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-stone-700">
              <span>
                Point focal Y (%)<span className="sr-only"> — image {n}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={item.focalY ?? ''}
                disabled={disabled}
                onChange={(e) => onUpdate({ focalY: parseFocal(e.target.value) })}
                className="rounded-md border border-stone-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-stone-700">
              <span>
                Cadrage<span className="sr-only"> — image {n}</span>
              </span>
              <select
                value={item.objectPosition ?? ''}
                disabled={disabled}
                onChange={(e) =>
                  onUpdate({ objectPosition: (e.target.value || null) as MediaObjectPosition | null })
                }
                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">Auto</option>
                {OBJECT_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {OBJECT_POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          {hasFocal ? (
            <button
              type="button"
              className="self-start text-[11px] text-stone-500 underline hover:text-stone-800"
              onClick={() => onUpdate({ focalX: null, focalY: null })}
              disabled={disabled}
            >
              Effacer le point focal
            </button>
          ) : null}

          {issues.length > 0 ? (
            <ul role="list" className="mt-1 space-y-0.5 text-[11px] text-rose-700">
              {issues.map((iss, i) => (
                <li key={`${iss.code}-${i}`}>{iss.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}
