'use client';

import { useEffect, useId, useState } from 'react';
import type {
  ComponentMediaBindingWithMedia,
  MediaObjectFit,
  MediaObjectPosition,
} from '@/lib/db/types';

interface Props {
  binding: ComponentMediaBindingWithMedia;
  onClose: () => void;
  onApply: (input: {
    objectFit: MediaObjectFit;
    objectPosition: MediaObjectPosition;
    focalX: number | null;
    focalY: number | null;
  }) => void | Promise<void>;
  busy?: boolean;
}

const FIT_OPTIONS: Array<{ value: MediaObjectFit; label: string; hint: string }> = [
  { value: 'cover', label: 'Remplir', hint: 'Remplit le cadre, peut rogner.' },
  { value: 'contain', label: 'Entier', hint: 'Affiche toute l’image, lettrebox possible.' },
  { value: 'fill', label: 'Étirer', hint: 'Étire (déforme) pour remplir.' },
  { value: 'none', label: 'Naturel', hint: 'Taille naturelle de l’image.' },
  { value: 'scale-down', label: 'Réduit', hint: 'Contain ou none, le plus petit.' },
];

const POS_OPTIONS: Array<{ value: MediaObjectPosition; label: string }> = [
  { value: 'top left', label: '↖' },
  { value: 'top', label: '↑' },
  { value: 'top right', label: '↗' },
  { value: 'left', label: '←' },
  { value: 'center', label: '·' },
  { value: 'right', label: '→' },
  { value: 'bottom left', label: '↙' },
  { value: 'bottom', label: '↓' },
  { value: 'bottom right', label: '↘' },
];

/**
 * Panneau de réglage des modes d'affichage d'un binding.
 *
 *  - Doctrine : l'image s'adapte au cadre, jamais l'inverse.
 *  - Choix discrets (cover / contain / …) + position (9 options) + focal X/Y
 *    fin (0-100 %).
 *  - L'aperçu en haut visualise le rendu effectif.
 */
export function DisplayModePanel({ binding, onClose, onApply, busy }: Props) {
  const titleId = useId();
  const [fit, setFit] = useState<MediaObjectFit>(binding.objectFit);
  const [pos, setPos] = useState<MediaObjectPosition>(binding.objectPosition);
  const [focalX, setFocalX] = useState<number | null>(binding.focalX);
  const [focalY, setFocalY] = useState<number | null>(binding.focalY);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const previewSrc = binding.media?.originalUrl ?? undefined;
  const previewBg = binding.media?.palette?.[0]?.hex ?? '#f3ede4';
  const positionStyle =
    typeof focalX === 'number' && typeof focalY === 'number'
      ? `${focalX}% ${focalY}%`
      : pos;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-30 flex items-center justify-center bg-stone-900/40 p-4"
    >
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={titleId} className="text-base font-semibold text-stone-900">
            Réglages d&apos;affichage
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-stone-500 hover:bg-stone-100"
          >
            ✕
          </button>
        </div>

        <div
          aria-hidden="true"
          className="mt-3 overflow-hidden rounded-md border border-stone-200"
          style={{ backgroundColor: previewBg, aspectRatio: '16 / 9' }}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: fit,
                objectPosition: positionStyle,
                display: 'block',
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-500">
              Aperçu indisponible
            </div>
          )}
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Mode d&apos;adaptation
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FIT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col rounded-md border p-2 text-xs ${
                  fit === opt.value
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="object-fit"
                  value={opt.value}
                  checked={fit === opt.value}
                  onChange={() => setFit(opt.value)}
                  className="sr-only"
                />
                <span className="font-semibold text-stone-900">{opt.label}</span>
                <span className="mt-0.5 text-[10px] text-stone-600">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Position (centre par défaut)
          </legend>
          <div className="mt-2 grid w-fit grid-cols-3 gap-1">
            {POS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-label={`Position ${opt.value}`}
                onClick={() => {
                  setPos(opt.value);
                  setFocalX(null);
                  setFocalY(null);
                }}
                className={`h-9 w-9 rounded border text-sm ${
                  pos === opt.value &&
                  focalX === null &&
                  focalY === null
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Focal point fin (override position)
          </legend>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              X{' '}
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={focalX ?? ''}
                onChange={(e) =>
                  setFocalX(e.target.value === '' ? null : Number(e.target.value))
                }
                className="w-16 rounded-md border border-stone-300 px-2 py-1"
                placeholder="–"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              Y{' '}
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={focalY ?? ''}
                onChange={(e) =>
                  setFocalY(e.target.value === '' ? null : Number(e.target.value))
                }
                className="w-16 rounded-md border border-stone-300 px-2 py-1"
                placeholder="–"
              />
              %
            </label>
          </div>
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onApply({
                objectFit: fit,
                objectPosition: pos,
                focalX,
                focalY,
              })
            }
            className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
