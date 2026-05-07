'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductVariant, InventoryStatus } from '@/lib/products/types';
import { INVENTORY_STATUSES } from '@/lib/products/types';
import {
  productVariantUpsertSchema,
  productVariantPatchSchema,
} from '@/lib/products/schemas';
import {
  CURRENCY_DESCRIPTORS,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  describeCurrency,
} from '@/lib/products/currency';
import { formatPrice as formatPriceUtil } from '@/lib/utils/format-price';
import { PriceDisplay } from '@/components/commerce/PriceDisplay';
import { VariantPriceInput } from './VariantPriceInput';

interface VariantsEditorProps {
  slug: string;
  initialVariants: ProductVariant[];
  /**
   * Quand le produit est exposé sur une page publique (ex. /kit), on
   * affiche un bandeau « Vitrine » au-dessus des variantes avec un lien
   * direct vers la page publique. La valeur est l'URL relative (« /kit »).
   */
  publicShowcaseHref?: string;
}

interface DraftState {
  sku: string;
  label: string;
  priceCents: number;
  promoPriceCents: number | null;
  currency: string;
  inventoryStatus: InventoryStatus;
  weightG: number | null;
  position: number;
}

function emptyDraft(): DraftState {
  return {
    sku: '',
    label: '',
    priceCents: 0,
    promoPriceCents: null,
    currency: DEFAULT_CURRENCY,
    inventoryStatus: 'available',
    weightG: null,
    position: 0,
  };
}

function fromVariant(v: ProductVariant): DraftState {
  return {
    sku: v.sku,
    label: v.label,
    priceCents: v.priceCents,
    promoPriceCents: v.promoPriceCents,
    currency: v.currency,
    inventoryStatus: v.inventoryStatus,
    weightG: v.weightG,
    position: v.position,
  };
}

// Wrapper local pour conserver la signature historique (cents + string libre)
// tout en déléguant à l'utilitaire centralisé qui sait gérer MAD/AED comme
// les devises ISO classiques.
function formatPrice(cents: number, currency: string) {
  return formatPriceUtil(cents, currency);
}

export function VariantsEditor({
  slug,
  initialVariants,
  publicShowcaseHref,
}: VariantsEditorProps) {
  const router = useRouter();
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // ----- Synthèse vitrine -----------------------------------------------
  // La page publique consomme la 1ʳᵉ variante (position 0). Cette synthèse
  // sert de double-vérification visuelle pour l'admin.
  const primary = variants[0] ?? null;
  const distinctCurrencies = useMemo(() => {
    return Array.from(new Set(variants.map((v) => v.currency)));
  }, [variants]);
  const mixedCurrencies = distinctCurrencies.length > 1;

  /**
   * Applique la devise donnée à toutes les variantes (PATCH en série).
   * Utile lorsque l'admin veut basculer un catalogue d'EUR vers MAD sans
   * re-saisir chaque ligne. Les centimes ne sont PAS reconvertis (le
   * passage 29,00 EUR → 29 MAD est un acte commercial à valider par
   * l'admin) — on se contente d'aligner le code devise.
   */
  async function applyCurrencyToAll(target: string) {
    const targets = variants.filter((v) => v.currency !== target);
    if (targets.length === 0) {
      setFeedback(`Toutes les variantes sont déjà en ${target}.`);
      return;
    }
    if (
      !confirm(
        `Aligner ${targets.length} variante${targets.length > 1 ? 's' : ''} sur ${target} ? ` +
          `Les montants en centimes ne sont pas convertis automatiquement.`,
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    setBusy(true);
    let updated = 0;
    try {
      for (const v of targets) {
        const res = await fetch(`/api/admin/products/${slug}/variants/${v.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency: target }),
        });
        if (res.ok) {
          const data = (await res.json()) as { variant: ProductVariant };
          setVariants((list) =>
            list.map((x) => (x.id === data.variant.id ? data.variant : x)),
          );
          updated += 1;
        }
      }
      setFeedback(`${updated} variante(s) alignée(s) sur ${target}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditingId('__new__');
    setDraft({
      ...emptyDraft(),
      position: variants.length,
    });
    setError(null);
  }

  function openEdit(v: ProductVariant) {
    setEditingId(v.id);
    setDraft(fromVariant(v));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveDraft() {
    if (!draft || !editingId) return;
    setError(null);
    const isNew = editingId === '__new__';
    const schema = isNew ? productVariantUpsertSchema : productVariantPatchSchema;
    const payload = {
      sku: draft.sku.trim().toUpperCase(),
      label: draft.label.trim(),
      priceCents: Math.round(draft.priceCents),
      promoPriceCents:
        draft.promoPriceCents === null || draft.promoPriceCents === 0
          ? null
          : Math.round(draft.promoPriceCents),
      currency: draft.currency.toUpperCase(),
      inventoryStatus: draft.inventoryStatus,
      weightG:
        draft.weightG === null || draft.weightG === 0 ? null : Math.round(draft.weightG),
      attributes: {},
      position: Math.round(draft.position),
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setBusy(true);
    try {
      const url = isNew
        ? `/api/admin/products/${slug}/variants`
        : `/api/admin/products/${slug}/variants/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur sauvegarde.');
        return;
      }
      const data = (await res.json()) as { variant: ProductVariant };
      setVariants((list) => {
        if (isNew) return [...list, data.variant];
        return list.map((v) => (v.id === data.variant.id ? data.variant : v));
      });
      cancelEdit();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteVariant(id: string) {
    if (!confirm('Supprimer cette variante ? Cette action est irréversible.'))
      return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${slug}/variants/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur suppression.');
        return;
      }
      setVariants((list) => list.filter((v) => v.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function moveVariant(id: string, dir: -1 | 1) {
    const idx = variants.findIndex((v) => v.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= variants.length) return;
    const reordered = [...variants];
    const [moved] = reordered.splice(idx, 1);
    if (!moved) return;
    reordered.splice(next, 0, moved);
    const orderedIds = reordered.map((v) => v.id);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${slug}/variants/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedVariantIds: orderedIds }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur réorganisation.');
        return;
      }
      const data = (await res.json()) as { variants: ProductVariant[] };
      setVariants(data.variants);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Panneau « Vitrine » : récapitulatif du prix public + lien externe. */}
      {primary ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="font-semibold uppercase tracking-wide">Vitrine</span>
              <span className="ml-2 inline-flex flex-wrap items-baseline gap-2 text-emerald-800">
                <span>Prix affiché côté public :</span>
                {/*
                  Réutilise <PriceDisplay> côté admin pour offrir un aperçu
                  exact de ce que voit le client (même typo Cormorant, même
                  contraste prix actif/barré + label « Économisez … »).
                  Source de vérité visuelle unique = pas de divergence
                  admin/public.
                */}
                <PriceDisplay
                  priceCents={primary.priceCents}
                  promoPriceCents={primary.promoPriceCents}
                  currency={primary.currency}
                  size="sm"
                  layout="inline"
                  showSavings
                />
                <span className="text-emerald-700">
                  · variante <span className="font-mono">{primary.sku}</span>
                </span>
              </span>
            </div>
            {publicShowcaseHref ? (
              <a
                href={publicShowcaseHref}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-800 underline-offset-2 hover:underline"
              >
                Voir {publicShowcaseHref} ↗
              </a>
            ) : null}
          </div>
          {mixedCurrencies ? (
            <p className="mt-1 text-amber-800">
              ⚠ Devises hétérogènes ({distinctCurrencies.join(', ')}). Le tracking
              et JSON-LD utilisent la devise de la variante vitrine ({primary.currency}).
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Action : aligner toutes les variantes sur une devise commune. */}
      {variants.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            Devise globale
          </span>
          <select
            value={primary?.currency ?? DEFAULT_CURRENCY}
            onChange={(e) => applyCurrencyToAll(e.target.value)}
            disabled={busy}
            className="rounded border border-stone-200 bg-white px-2 py-1 font-mono uppercase"
            aria-label="Aligner toutes les variantes sur cette devise"
          >
            {SUPPORTED_CURRENCIES.map((code) => {
              const d = CURRENCY_DESCRIPTORS[code];
              return (
                <option key={code} value={code}>
                  {code} — {d.label}
                </option>
              );
            })}
          </select>
          <span className="text-stone-500">
            change la devise de toutes les variantes (montants conservés tels
            quels en centimes — à ajuster ensuite si besoin).
          </span>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          {feedback}
        </div>
      ) : null}

      <ul className="space-y-2">
        {variants.length === 0 && editingId !== '__new__' ? (
          <li className="rounded-md border border-dashed border-stone-300 bg-white px-3 py-6 text-center text-sm text-stone-500">
            Aucune variante. Crée-en une.
          </li>
        ) : null}
        {variants.map((v, i) => (
          <li
            key={v.id}
            className="rounded-md border border-stone-200 bg-white p-3 text-sm"
          >
            {editingId === v.id && draft ? (
              <VariantForm
                draft={draft}
                onChange={setDraft}
                onCancel={cancelEdit}
                onSave={saveDraft}
                busy={busy}
                isNew={false}
              />
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveVariant(v.id, -1)}
                    disabled={busy || i === 0}
                    className="rounded border border-stone-200 px-1 text-xs hover:bg-stone-50 disabled:opacity-30"
                    aria-label="Monter"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveVariant(v.id, 1)}
                    disabled={busy || i === variants.length - 1}
                    className="rounded border border-stone-200 px-1 text-xs hover:bg-stone-50 disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    ▼
                  </button>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-stone-600">
                      {v.sku}
                    </span>
                    <span className="text-stone-900">{v.label}</span>
                    <InventoryBadge status={v.inventoryStatus} />
                    {i === 0 ? (
                      <span
                        title="Variante vitrine — son prix est utilisé sur la page publique."
                        className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                      >
                        Vitrine
                      </span>
                    ) : null}
                    <span
                      className="rounded border border-stone-200 bg-stone-50 px-1 font-mono text-[10px] uppercase text-stone-600"
                      title={describeCurrency(v.currency).label}
                    >
                      {v.currency}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-stone-600">
                    {v.promoPriceCents ? (
                      <>
                        <span className="font-medium text-emerald-700">
                          {formatPrice(v.promoPriceCents, v.currency)}
                        </span>
                        <span className="ml-2 text-stone-400 line-through">
                          {formatPrice(v.priceCents, v.currency)}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-stone-700">
                        {formatPrice(v.priceCents, v.currency)}
                      </span>
                    )}
                    {v.weightG ? (
                      <span className="ml-2 text-stone-500">{v.weightG}g</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    disabled={busy}
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-40"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVariant(v.id)}
                    disabled={busy}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {editingId === '__new__' && draft ? (
          <li className="rounded-md border border-stone-300 bg-stone-50 p-3 text-sm">
            <VariantForm
              draft={draft}
              onChange={setDraft}
              onCancel={cancelEdit}
              onSave={saveDraft}
              busy={busy}
              isNew
            />
          </li>
        ) : null}
      </ul>

      {editingId === null ? (
        <button
          type="button"
          onClick={openCreate}
          className="w-full rounded-md border border-dashed border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          + Ajouter une variante
        </button>
      ) : null}
    </div>
  );
}

function VariantForm({
  draft,
  onChange,
  onCancel,
  onSave,
  busy,
  isNew,
}: {
  draft: DraftState;
  onChange: (d: DraftState) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  isNew: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            SKU
          </span>
          <input
            type="text"
            value={draft.sku}
            onChange={(e) => onChange({ ...draft, sku: e.target.value })}
            placeholder="KIT-FEMI-30ML"
            className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            Label
          </span>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            placeholder="30 mL"
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <VariantPriceInput
          label="Prix"
          currency={draft.currency}
          cents={draft.priceCents}
          onChange={(next) => onChange({ ...draft, priceCents: next ?? 0 })}
          disabled={busy}
        />
        <VariantPriceInput
          label="Promo"
          optional
          currency={draft.currency}
          cents={draft.promoPriceCents}
          onChange={(next) => onChange({ ...draft, promoPriceCents: next })}
          disabled={busy}
          invalid={
            draft.promoPriceCents !== null &&
            draft.promoPriceCents >= draft.priceCents
          }
          hint={
            draft.promoPriceCents !== null && draft.promoPriceCents >= draft.priceCents
              ? 'La promo doit être strictement < prix.'
              : null
          }
        />
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            Devise
          </span>
          <select
            value={
              (SUPPORTED_CURRENCIES as readonly string[]).includes(draft.currency)
                ? draft.currency
                : DEFAULT_CURRENCY
            }
            onChange={(e) => onChange({ ...draft, currency: e.target.value })}
            className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-sm uppercase"
          >
            {SUPPORTED_CURRENCIES.map((code) => {
              const d = CURRENCY_DESCRIPTORS[code];
              return (
                <option key={code} value={code}>
                  {code} — {d.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            Stock
          </span>
          <select
            value={draft.inventoryStatus}
            onChange={(e) =>
              onChange({
                ...draft,
                inventoryStatus: e.target.value as InventoryStatus,
              })
            }
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          >
            {INVENTORY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium uppercase tracking-wide text-stone-500">
            Poids (g, opt.)
          </span>
          <input
            type="number"
            value={draft.weightG ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                weightG: e.target.value ? e.target.valueAsNumber : null,
              })
            }
            min={0}
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {busy ? 'Sauvegarde…' : isNew ? 'Créer' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs hover:bg-stone-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function InventoryBadge({ status }: { status: InventoryStatus }) {
  const map: Record<InventoryStatus, string> = {
    available: 'bg-emerald-100 text-emerald-800',
    low_stock: 'bg-amber-100 text-amber-800',
    out_of_stock: 'bg-red-100 text-red-800',
    preorder: 'bg-sky-100 text-sky-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${map[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
