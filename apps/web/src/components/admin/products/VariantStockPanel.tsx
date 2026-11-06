'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { PatchAdminStockInput, PatchAdminStockResponse } from '@/lib/checkout/schemas/stock';
import type {
  AdminStockView,
  StockMovementKind,
} from '@/lib/checkout/stock-status';

interface VariantStockPanelProps {
  variantId: string;
  sku: string;
  label: string;
  /** Compteur lu côté serveur ; `null` s'il n'existe pas encore. */
  initialStock: AdminStockView | null;
  readable: boolean;
}

type Mode = 'restock' | 'count';

const MAX_STOCK_VALUE = 1_000_000;

const MOVEMENT_LABEL: Record<StockMovementKind, string> = {
  restock: 'Réception',
  count: 'Inventaire',
  threshold: 'Seuil modifié',
  policy: 'Règle à 0',
};

const number = new Intl.NumberFormat('fr-FR');
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatStock(value: number): string {
  return value < 0 ? `−${number.format(-value)}` : number.format(value);
}

function formatDelta(value: number): string {
  return value > 0 ? `+${number.format(value)}` : formatStock(value);
}

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_STOCK_VALUE ? value : null;
}

function statePill(stock: AdminStockView | null): { label: string; className: string } {
  const effective = stock?.effective ?? 0;
  if (effective < 0) {
    return { label: 'Stock négatif', className: 'bg-red-100 text-red-800' };
  }
  if (effective === 0) return { label: 'Épuisé', className: 'bg-red-100 text-red-800' };
  const low =
    stock?.status === 'low_stock' || (stock?.daysLeft !== null && (stock?.daysLeft ?? 99) <= 7);
  return low
    ? { label: 'Bientôt épuisé', className: 'bg-amber-100 text-amber-800' }
    : { label: 'En stock', className: 'bg-emerald-100 text-emerald-800' };
}

async function failureMessage(res: Response): Promise<string> {
  // La route répond 404 aussi quand la session admin a expiré.
  if (res.status === 404) {
    return 'Saisie refusée : la session a peut-être expiré. Recharge la page et reconnecte-toi.';
  }
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    /* réponse sans JSON */
  }
  return `La saisie a échoué (erreur ${res.status}). Le stock n'a pas changé.`;
}

/** Bloc Stock d'une variante : un chiffre, deux gestes, un historique. */
export function VariantStockPanel({
  variantId,
  sku,
  label,
  initialStock,
  readable,
}: VariantStockPanelProps) {
  const router = useRouter();
  const uid = useId();
  const [stock, setStock] = useState(initialStock);
  const [mode, setMode] = useState<Mode>('restock');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [threshold, setThreshold] = useState(String(initialStock?.thresholdLow ?? 5));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  // Une saisie = une clé : renvoyer le même formulaire n'applique rien deux fois.
  const [saisieId, setSaisieId] = useState(() => crypto.randomUUID());

  const effective = stock?.effective ?? 0;
  const available = stock?.available ?? 0;
  const reserved = stock?.reserved ?? 0;
  const parsed = parseQuantity(quantity);
  const pill = statePill(stock);

  const preview = useMemo(() => {
    if (parsed === null) return null;
    if (mode === 'restock' && parsed === 0) return null;
    const after = mode === 'restock' ? available + parsed : parsed;
    return { after: after - reserved };
  }, [parsed, mode, available, reserved]);

  async function send(body: PatchAdminStockInput): Promise<PatchAdminStockResponse | null> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/products/stock', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        const data = (await res.json()) as { error?: { details?: { available?: number } } };
        const current = data.error?.details?.available;
        if (typeof current === 'number') {
          setStock((s) => (s ? { ...s, available: current, effective: current - s.reserved } : s));
        }
        setMessage({
          tone: 'error',
          text: `Des commandes sont passées entre-temps : le stock est maintenant de ${formatStock(
            current ?? available,
          )}. Vérifie ton comptage, puis valide de nouveau.`,
        });
        router.refresh();
        return null;
      }
      if (!res.ok) {
        setMessage({ tone: 'error', text: await failureMessage(res) });
        return null;
      }
      const data = (await res.json()) as PatchAdminStockResponse;
      setStock((s) => ({
        ...(s ?? {
          variantId,
          sku,
          status: 'in_stock',
          soldLast7Days: null,
          daysLeft: null,
          movements: [],
        }),
        available: data.available,
        reserved: data.reserved,
        thresholdLow: data.thresholdLow,
        sellWhenOut: data.sellWhenOut,
        effective: data.available - data.reserved,
      }));
      setSaisieId(crypto.randomUUID());
      router.refresh();
      return data;
    } catch {
      setMessage({
        tone: 'error',
        text: 'Réseau indisponible. Vérifie le chiffre affiché après rechargement avant de réessayer.',
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (parsed === null || preview === null || busy) return;
    const trimmed = note.trim() || undefined;
    const done = await send(
      mode === 'restock'
        ? {
            action: 'restock',
            variantId,
            value: parsed,
            note: trimmed,
            idempotencyKey: saisieId,
          }
        : {
            action: 'count',
            variantId,
            value: parsed,
            expectedAvailable: available,
            note: trimmed,
            idempotencyKey: saisieId,
          },
    );
    if (done) {
      setQuantity('');
      setNote('');
      setMessage({ tone: 'ok', text: `Stock enregistré : ${formatStock(done.available - done.reserved)}.` });
    }
  }

  async function toggleSell(next: boolean) {
    const done = await send({
      action: 'set_sell_when_out',
      variantId,
      value: next,
      idempotencyKey: crypto.randomUUID(),
    });
    if (done) {
      setMessage({
        tone: 'ok',
        text: next ? 'Les ventes continuent à 0.' : 'Les commandes seront refusées à 0.',
      });
    }
  }

  async function saveThreshold() {
    const value = parseQuantity(threshold);
    if (value === null) {
      setMessage({ tone: 'error', text: 'Le seuil doit être un nombre entier positif.' });
      return;
    }
    const done = await send({
      action: 'set_threshold',
      variantId,
      value,
      idempotencyKey: crypto.randomUUID(),
    });
    if (done) setMessage({ tone: 'ok', text: `Seuil enregistré : ${value}.` });
  }

  if (!readable) {
    return (
      <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Le stock de {sku} n&apos;a pas pu être lu. Recharge la page avant toute modification.
      </div>
    );
  }

  const perDay =
    stock?.soldLast7Days !== null && stock?.soldLast7Days !== undefined
      ? Math.round(stock.soldLast7Days / 7)
      : null;

  return (
    <div className="space-y-4 rounded-md border border-stone-200 bg-white p-4" data-testid={`stock-${sku}`}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-stone-500">
            Stock restant · <span className="font-mono">{sku}</span>
            {label && label !== sku ? ` · ${label}` : ''}
          </p>
          <p className="text-4xl font-semibold tabular-nums text-stone-900" data-testid="stock-value">
            {formatStock(effective)}
          </p>
        </div>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-stone-600">
          {perDay !== null ? (
            <div className="flex gap-1">
              <dt>Rythme</dt>
              <dd className="font-medium tabular-nums text-stone-900">≈ {number.format(perDay)} / jour</dd>
            </div>
          ) : null}
          {stock?.daysLeft !== null && stock?.daysLeft !== undefined ? (
            <div className="flex gap-1">
              <dt>Tiendra</dt>
              <dd className="font-medium tabular-nums text-stone-900">
                ≈ {stock.daysLeft} jour{stock.daysLeft > 1 ? 's' : ''}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="sr-only">État</dt>
            <dd className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}>{pill.label}</dd>
          </div>
        </dl>
      </div>

      {!stock ? (
        <p className="text-sm text-amber-800">
          Cette variante n&apos;a pas encore de compteur. La première réception le crée.
        </p>
      ) : null}
      {effective < 0 ? (
        <p className="text-sm text-red-800">
          {number.format(-effective)} commande{effective < -1 ? 's' : ''} à couvrir par ta prochaine réception.
        </p>
      ) : null}

      <div role="tablist" aria-label="Action sur le stock" className="flex flex-wrap gap-2">
        {(
          [
            ['restock', 'Réception'],
            ['count', 'Inventaire'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setQuantity('');
              setMessage(null);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              mode === value
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-stone-600" htmlFor={`${uid}-qty`}>
          {mode === 'restock' ? 'Unités reçues' : 'Quantité comptée'}
          <input
            id={`${uid}-qty`}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={busy}
            className="w-32 rounded-md border border-stone-300 px-2 py-1.5 tabular-nums text-stone-900"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-stone-600" htmlFor={`${uid}-note`}>
          Note (facultatif)
          <input
            id={`${uid}-note`}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            placeholder={mode === 'restock' ? 'Livraison du fournisseur' : 'Comptage de l’entrepôt'}
            className="w-full min-w-48 rounded-md border border-stone-300 px-2 py-1.5 text-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || preview === null}
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Enregistrement…' : mode === 'restock' ? 'Ajouter au stock' : 'Remplacer par ce comptage'}
        </button>
      </form>

      <div aria-live="polite" className="min-h-5 text-sm">
        {preview ? (
          <p className="text-stone-700">
            Résultat : <span className="tabular-nums">{formatStock(effective)}</span> →{' '}
            <span className="font-semibold tabular-nums">{formatStock(preview.after)}</span>
          </p>
        ) : null}
        {message ? (
          <p role={message.tone === 'error' ? 'alert' : undefined} className={message.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}>
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-stone-200 pt-3 text-sm">
        <label className="flex max-w-md items-start gap-2 text-stone-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={stock?.sellWhenOut ?? true}
            disabled={busy}
            onChange={(e) => void toggleSell(e.currentTarget.checked)}
          />
          <span>
            <span className="font-medium">À 0, continuer à vendre</span>
            <span className="block text-xs text-stone-500">
              Le stock passe en négatif et tu es alertée. Décoché, les commandes sont refusées à 0.
            </span>
          </span>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-stone-500" htmlFor={`${uid}-threshold`}>
            Seuil d&apos;alerte
            <input
              id={`${uid}-threshold`}
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={busy}
              className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm tabular-nums text-stone-900"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveThreshold()}
            disabled={busy}
            className="rounded-md border border-stone-300 px-2 py-1 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </div>

      {stock && stock.movements.length > 0 ? (
        <details open className="border-t border-stone-200 pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-stone-800">Historique</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Quand</th>
                  <th className="py-1 pr-3 font-medium">Action</th>
                  <th className="py-1 pr-3 text-right font-medium">Variation</th>
                  <th className="py-1 pr-3 text-right font-medium">Après</th>
                  <th className="py-1 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stock.movements.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap py-1 pr-3 text-stone-600">{dateTime.format(new Date(m.createdAt))}</td>
                    <td className="py-1 pr-3">{MOVEMENT_LABEL[m.kind]}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{m.delta === 0 ? '—' : formatDelta(m.delta)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{formatStock(m.availableAfter)}</td>
                    <td className="py-1 text-stone-600">{m.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
