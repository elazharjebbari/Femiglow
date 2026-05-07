'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ComponentAnimation,
  ComponentAnimationBindingWithAnimation,
  ComponentMediaBindingWithMedia,
  MediaObjectFit,
  MediaObjectPosition,
  SiteComponent,
} from '@/lib/db/types';
import { SlotCard } from './SlotCard';
import { MediaPickerDrawer } from './MediaPickerDrawer';
import { AnimationProfileSelector } from './AnimationProfileSelector';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { BulkActionBar } from './BulkActionBar';
import { DisplayModePanel } from './DisplayModePanel';
import { IconImage, IconInfo } from '@/components/admin/icons';

interface Props {
  component: SiteComponent;
  bindings: ComponentMediaBindingWithMedia[];
  animations: ComponentAnimationBindingWithAnimation[];
  allAnimations: ComponentAnimation[];
}

export function ComponentDetailPanel({
  component,
  bindings,
  animations,
  allAnimations,
}: Props) {
  const router = useRouter();
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [displayBinding, setDisplayBinding] =
    useState<ComponentMediaBindingWithMedia | null>(null);

  function bindingFor(slotKey: string): ComponentMediaBindingWithMedia | undefined {
    return bindings.find((b) => b.slot === slotKey);
  }

  /** IDs sélectionnables : seulement les slots ayant un binding existant. */
  const selectableIds = useMemo(() => bindings.map((b) => b.id), [bindings]);
  const allSelected =
    selectableIds.length > 0 && selectedIds.size === selectableIds.length;

  function toggleSelectAll(next: boolean) {
    if (next) setSelectedIds(new Set(selectableIds));
    else setSelectedIds(new Set());
  }
  function toggleOne(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  async function handleAssign(slot: string, mediaId: string | null) {
    setBusy(slot);
    setError(null);
    const res = await fetch(`/api/admin/components/${component.key}/bindings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slot, mediaId }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors de l’assignation');
      return;
    }
    setPickerSlot(null);
    router.refresh();
  }

  async function handleToggleActive(bindingId: string, isActive: boolean) {
    setBusy(bindingId);
    setError(null);
    const res = await fetch(
      `/api/admin/components/${component.key}/bindings/${bindingId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive }),
      },
    );
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors de l’activation');
      return;
    }
    router.refresh();
  }

  async function handleDelete(bindingId: string) {
    if (!confirm('Supprimer ce binding ?')) return;
    setBusy(bindingId);
    setError(null);
    const res = await fetch(
      `/api/admin/components/${component.key}/bindings/${bindingId}`,
      { method: 'DELETE' },
    );
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors de la suppression');
      return;
    }
    router.refresh();
  }

  async function handleSetAnimation(animationKey: string, isDefault: boolean) {
    setBusy('animation');
    setError(null);
    const res = await fetch(`/api/admin/components/${component.key}/animations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ animationKey, isDefault }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors du changement d’animation');
      return;
    }
    router.refresh();
  }

  async function handleApplyDisplay(
    bindingId: string,
    input: {
      objectFit: MediaObjectFit;
      objectPosition: MediaObjectPosition;
      focalX: number | null;
      focalY: number | null;
    },
  ) {
    setBusy(bindingId);
    setError(null);
    const res = await fetch(
      `/api/admin/components/${component.key}/bindings/${bindingId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors de la mise à jour');
      return;
    }
    setDisplayBinding(null);
    router.refresh();
  }

  async function handleBulk(
    action: 'activate' | 'deactivate' | 'delete' | 'update',
    patch?: Record<string, unknown>,
  ) {
    if (selectedIds.size === 0) return;
    setBusy('bulk');
    setError(null);
    const res = await fetch('/api/admin/components/bindings/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        ids: Array.from(selectedIds),
        ...(patch ? { patch } : {}),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Erreur lors de l’opération groupée');
      return;
    }
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section aria-labelledby="slots-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="slots-heading"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500"
          >
            <IconImage className="h-3.5 w-3.5" />
            Slots média ({component.slots.length})
          </h2>
          {selectableIds.length > 0 && (
            <SelectAllCheckbox
              totalCount={selectableIds.length}
              selectedCount={selectedIds.size}
              onChange={toggleSelectAll}
              label={`Tout sélectionner (${selectableIds.length})`}
            />
          )}
        </div>

        <BulkActionBar
          count={selectedIds.size}
          busy={busy === 'bulk'}
          onActivate={() => handleBulk('activate')}
          onDeactivate={() => handleBulk('deactivate')}
          onDelete={() => handleBulk('delete')}
          onSetDisplay={(fit, pos) =>
            handleBulk('update', { objectFit: fit, objectPosition: pos })
          }
          onClear={() => setSelectedIds(new Set())}
        />

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        {component.slots.length === 0 ? (
          <p className="text-sm text-stone-500">Pas de slot défini pour ce composant.</p>
        ) : (
          <ul className="space-y-3">
            {component.slots.map((slot) => {
              const b = bindingFor(slot.key) ?? null;
              return (
                <SlotCard
                  key={slot.key}
                  slot={slot}
                  binding={b}
                  fallbackSvg={component.defaultSvgFallback}
                  busy={busy === slot.key || (b && busy === b.id) || busy === 'bulk'}
                  selectable={!!b}
                  selected={b ? selectedIds.has(b.id) : false}
                  onSelectChange={(next) => b && toggleOne(b.id, next)}
                  onPick={() => setPickerSlot(slot.key)}
                  onUnassign={() => handleAssign(slot.key, null)}
                  onToggleActive={(active) => {
                    if (b) handleToggleActive(b.id, active);
                  }}
                  onDelete={() => {
                    if (b) handleDelete(b.id);
                  }}
                  onOpenDisplay={
                    b
                      ? () => setDisplayBinding(b)
                      : undefined
                  }
                />
              );
            })}
          </ul>
        )}
        {allSelected && selectableIds.length > 0 && (
          <p
            data-testid="select-all-voyant"
            className="mt-2 text-xs font-medium text-emerald-700"
            role="status"
          >
            ● Tout est sélectionné ({selectedIds.size})
          </p>
        )}
      </section>

      <aside aria-label="Animations & métadonnées" className="space-y-6">
        <AnimationProfileSelector
          allAnimations={allAnimations}
          bindings={animations}
          busy={busy === 'animation'}
          onSelect={(key) => handleSetAnimation(key, true)}
        />
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <IconInfo className="h-3.5 w-3.5" />
            Détails techniques
          </h3>
          <dl className="mt-3 space-y-2 text-xs text-stone-700">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Catégorie</dt>
              <dd className="font-mono">{component.category}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Page</dt>
              <dd className="font-mono">{component.pageGroup}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Loading par défaut</dt>
              <dd className="font-mono">{component.defaultLoadingStrategy}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Fetch priority</dt>
              <dd className="font-mono">{component.defaultFetchPriority}</dd>
            </div>
            {component.filePath && (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">Fichier</dt>
                <dd className="break-all font-mono text-[11px]">{component.filePath}</dd>
              </div>
            )}
            {component.defaultSvgFallback && (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">SVG fallback</dt>
                <dd className="break-all font-mono text-[11px]">
                  {component.defaultSvgFallback}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </aside>

      {pickerSlot && (() => {
        const slotDef = component.slots.find((s) => s.key === pickerSlot);
        return (
          <MediaPickerDrawer
            slotKey={pickerSlot}
            slotLabel={slotDef?.label ?? pickerSlot}
            acceptKinds={slotDef?.acceptKinds}
            onClose={() => setPickerSlot(null)}
            onPick={(mediaId) => handleAssign(pickerSlot, mediaId)}
          />
        );
      })()}

      {displayBinding && (
        <DisplayModePanel
          binding={displayBinding}
          busy={busy === displayBinding.id}
          onClose={() => setDisplayBinding(null)}
          onApply={(input) => handleApplyDisplay(displayBinding.id, input)}
        />
      )}
    </div>
  );
}
