'use client';

import type { ComponentMediaBindingWithMedia, SlotDefinition } from '@/lib/db/types';
import { previewThumbUrl } from '@/lib/media/preview-thumb';
import {
  IconEye,
  IconEyeOff,
  IconImage,
  IconSettings,
  IconSwap,
  IconTrash,
  IconUnlink,
  IconUpload,
} from '@/components/admin/icons';

interface SlotCardProps {
  slot: SlotDefinition;
  binding: ComponentMediaBindingWithMedia | null;
  fallbackSvg: string | null;
  busy: boolean | undefined;
  onPick: () => void;
  onUnassign: () => void;
  onToggleActive: (isActive: boolean) => void;
  onDelete: () => void;
  /** Si fourni, affiche une checkbox de sélection multiple. */
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (next: boolean) => void;
  /** Bouton « Réglages d'affichage ». Optionnel ; nécessite un binding. */
  onOpenDisplay?: () => void;
}

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  pending: { text: 'En attente', tone: 'bg-stone-200 text-stone-700' },
  processing: { text: 'Traitement', tone: 'bg-amber-100 text-amber-800' },
  ready: { text: 'Prêt', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { text: 'Échec', tone: 'bg-rose-100 text-rose-800' },
  passthrough: { text: 'Passthrough', tone: 'bg-sky-100 text-sky-800' },
};

/**
 * Bouton-icône pour les actions secondaires (tooltip via `title`).
 * Conserve un `aria-label` explicite pour les a11y/tests.
 */
function IconButton({
  label,
  onClick,
  disabled,
  tone = 'neutral',
  testId,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  testId?: string;
  children: React.ReactNode;
}) {
  const palette =
    tone === 'danger'
      ? 'border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300'
      : 'border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:cursor-not-allowed disabled:opacity-50 ${palette}`}
    >
      {children}
    </button>
  );
}

export function SlotCard({
  slot,
  binding,
  fallbackSvg,
  busy,
  onPick,
  onUnassign,
  onToggleActive,
  onDelete,
  selectable,
  selected,
  onSelectChange,
  onOpenDisplay,
}: SlotCardProps) {
  const media = binding?.media ?? null;
  const status = media ? STATUS_LABEL[media.status] : null;
  const bg = media?.palette?.[0]?.hex ?? '#f3ede4';
  const aspect =
    media?.originalWidth && media.originalHeight
      ? `${media.originalWidth} / ${media.originalHeight}`
      : (slot.aspectRatioHint ?? '4 / 3');
  const thumb = media ? (media.thumbUrl ?? previewThumbUrl(media)) : null;

  return (
    <li
      className={`group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow ${
        selected
          ? 'border-emerald-400 ring-2 ring-emerald-200'
          : 'border-stone-200'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {selectable && binding && (
          <label className="flex shrink-0 items-start pt-1">
            <span className="sr-only">Sélectionner le slot {slot.label}</span>
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelectChange?.(e.currentTarget.checked)}
              aria-label={`Sélectionner ${slot.label}`}
              data-testid={`slot-select-${slot.key}`}
              className="h-4 w-4 cursor-pointer rounded border-stone-300"
            />
          </label>
        )}

        {/* Vignette média */}
        <div
          className="relative w-full shrink-0 overflow-hidden rounded-lg border border-stone-100 sm:w-44"
          style={{ aspectRatio: aspect, backgroundColor: bg }}
        >
          {media && media.kind === 'image' && thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {!media && fallbackSvg && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-stone-400">
              <IconImage className="h-6 w-6" />
              <span className="text-[10px] uppercase tracking-wider">SVG</span>
            </div>
          )}
          {!media && !fallbackSvg && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-stone-400">
              <IconImage className="h-6 w-6" />
              <span className="text-[10px] uppercase tracking-wider">vide</span>
            </div>
          )}
          {/* Badge statut overlay (unique pour visuel + lecteur d'écran). */}
          {binding && (
            <span
              className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur ${
                binding.isActive
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-stone-700/80 text-white'
              }`}
            >
              {binding.isActive ? (
                <IconEye className="h-3 w-3" aria-hidden="true" />
              ) : (
                <IconEyeOff className="h-3 w-3" aria-hidden="true" />
              )}
              {binding.isActive ? 'Actif' : 'Inactif'}
            </span>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-stone-900">{slot.label}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
                <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-stone-600">
                  {slot.key}
                </code>
                {slot.required && (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700">
                    requis
                  </span>
                )}
                {slot.acceptKinds?.length ? (
                  <span className="text-stone-500">{slot.acceptKinds.join('/')}</span>
                ) : null}
              </p>
            </div>
            {/* Le statut actif/inactif est porté par le badge overlay
                ci-dessus (visuel + a11y). Pas de duplication ici. */}
          </div>

          {slot.description && (
            <p className="mt-1.5 text-xs text-stone-600">{slot.description}</p>
          )}

          {media ? (
            <>
              {status && (
                <p className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 ${status.tone}`}>
                    {status.text}
                  </span>
                </p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-stone-600">
                <div className="col-span-2 flex justify-between gap-2">
                  <dt className="text-stone-500">Slug</dt>
                  <dd className="truncate font-mono text-stone-700">{media.slug}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Loading</dt>
                  <dd className="font-mono">{binding!.loadingStrategy}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Priority</dt>
                  <dd className="font-mono">{binding!.fetchPriority}</dd>
                </div>
                <div className="col-span-2 flex justify-between gap-2">
                  <dt className="text-stone-500">Alt</dt>
                  <dd className="truncate text-right text-stone-700">
                    {binding!.customAlt ?? media.alt}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone-500">
              <IconImage className="h-3.5 w-3.5" />
              Aucun média assigné — fallback SVG utilisé.
            </p>
          )}

          {/* Action row : primaire à gauche, secondaires icônes, danger isolé à droite */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onPick}
              className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {media ? (
                <>
                  <IconSwap className="h-3.5 w-3.5" />
                  Changer
                </>
              ) : (
                <>
                  <IconUpload className="h-3.5 w-3.5" />
                  Choisir un média
                </>
              )}
            </button>

            {binding && (
              <>
                <IconButton
                  label={binding.isActive ? 'Désactiver' : 'Activer'}
                  onClick={() => onToggleActive(!binding.isActive)}
                  disabled={busy}
                  testId={`slot-toggle-${slot.key}`}
                >
                  {binding.isActive ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </IconButton>

                {onOpenDisplay && (
                  <IconButton
                    label="Réglages d'affichage"
                    onClick={onOpenDisplay}
                    disabled={busy}
                    testId={`slot-display-${slot.key}`}
                  >
                    <IconSettings className="h-4 w-4" />
                  </IconButton>
                )}

                <IconButton
                  label="Détacher"
                  onClick={onUnassign}
                  disabled={busy}
                  testId={`slot-unassign-${slot.key}`}
                >
                  <IconUnlink className="h-4 w-4" />
                </IconButton>

                <span className="ml-auto" />

                <IconButton
                  label="Supprimer"
                  onClick={onDelete}
                  disabled={busy}
                  tone="danger"
                  testId={`slot-delete-${slot.key}`}
                >
                  <IconTrash className="h-4 w-4" />
                </IconButton>
              </>
            )}
            {busy && (
              <span className="text-xs text-stone-500" role="status">
                …
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
