'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PatchAdminStockInput,
  PatchAdminStockResponse,
  StockStatus,
} from '@/lib/checkout/schemas/stock';
import { toAdminStockView, type AdminStockView } from '@/lib/checkout/stock-status';

interface VariantStockPanelProps {
  /** Compteur lu côté serveur ; `null` s'il n'existe pas ou s'il est illisible. */
  initialStock: AdminStockView | null;
  readable: boolean;
}

/** Plafond de saisie : au-delà, la colonne `integer` ferait échouer l'écriture. */
const MAX_STOCK_VALUE = 1_000_000;

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_STOCK_VALUE ? value : null;
}

/** La route renvoie aussi 404 quand la session admin a expiré. */
async function describeFailure(res: Response): Promise<string> {
  if (res.status === 404) {
    return 'Compteur introuvable ou session admin expirée. Recharge la page puis réessaie.';
  }
  if (res.status === 503) {
    return 'Base de données indisponible. Vérifie la valeur affichée avant de réessayer.';
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return `${data?.error?.message ?? 'Erreur serveur'} (${res.status}). Vérifie la valeur affichée avant de réessayer.`;
}

function ordersWarning(stock: AdminStockView): string {
  return stock.effective <= 0
    ? '\n\nAttention : le stock effectif reste à 0 ou moins, les commandes resteront refusées.'
    : '';
}

export function VariantStockPanel({ initialStock, readable }: VariantStockPanelProps) {
  const router = useRouter();
  const [stock, setStock] = useState<AdminStockView | null>(initialStock);
  const [target, setTarget] = useState('');
  const [delta, setDelta] = useState('');
  const [threshold, setThreshold] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // `router.refresh()` repasse ici la valeur relue en base.
  useEffect(() => {
    setStock(initialStock);
  }, [initialStock]);

  if (!stock) {
    return (
      <div
        role="alert"
        className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
      >
        {readable
          ? "Aucun compteur de stock pour cette variante : toute commande est refusée. Cette page ne peut pas le créer, il s'ajoute côté serveur."
          : 'Compteur de stock illisible pour le moment. Recharge la page.'}
      </div>
    );
  }
  const current = stock;

  function reject(message: string) {
    setFeedback(null);
    setError(message);
  }

  async function applyChange(
    action: PatchAdminStockInput['action'],
    value: number,
    confirmMessage: string,
    resetInput: () => void,
  ) {
    if (!confirm(confirmMessage)) return;
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/products/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: current.variantId, action, value }),
      });
      if (!res.ok) {
        setError(await describeFailure(res));
        router.refresh();
        return;
      }
      const data = (await res.json()) as PatchAdminStockResponse;
      const next = toAdminStockView({ ...data, sku: current.sku });
      setStock(next);
      resetInput();
      setFeedback(
        `Stock mis à jour : disponible ${next.available}, effectif ${next.effective}, seuil ${next.thresholdLow}.`,
      );
      router.refresh();
    } catch {
      setError('Le serveur ne répond pas. Vérifie la valeur affichée avant de réessayer.');
    } finally {
      setBusy(false);
    }
  }

  function submitSet() {
    const value = parseQuantity(target);
    if (value === null) {
      reject(`Saisis un entier entre 0 et ${MAX_STOCK_VALUE}.`);
      return;
    }
    const after = toAdminStockView({ ...current, available: value });
    void applyChange(
      'set',
      value,
      `Définir le stock disponible de ${current.sku} : ${current.available} → ${value} ?\n` +
        `Stock effectif après : ${after.effective}.${ordersWarning(after)}`,
      () => setTarget(''),
    );
  }

  function submitDelta(direction: 1 | -1) {
    const value = parseQuantity(delta);
    if (value === null || value === 0) {
      reject(`Saisis un entier entre 1 et ${MAX_STOCK_VALUE}.`);
      return;
    }
    // La base ramène silencieusement à 0 : on refuse plutôt que d'annoncer un
    // retrait qui n'aurait pas lieu en entier.
    if (direction === -1 && value > current.available) {
      reject(
        `Impossible de retirer ${value} : seulement ${current.available} disponible(s).`,
      );
      return;
    }
    const available = current.available + direction * value;
    const after = toAdminStockView({ ...current, available });
    void applyChange(
      'increment',
      direction * value,
      `${direction === 1 ? 'Ajouter' : 'Retirer'} ${value} au stock de ${current.sku} : ` +
        `${current.available} → ${available} ?\n` +
        `Stock effectif après : ${after.effective}.${ordersWarning(after)}`,
      () => setDelta(''),
    );
  }

  function submitThreshold() {
    const value = parseQuantity(threshold);
    if (value === null) {
      reject(`Saisis un entier entre 0 et ${MAX_STOCK_VALUE}.`);
      return;
    }
    void applyChange(
      'set_threshold',
      value,
      `Modifier le seuil de ${current.sku} : ${current.thresholdLow} → ${value} ?\n` +
        `Le seuil règle l'alerte et la mention « derniers exemplaires », pas la quantité vendable.`,
      () => setThreshold(''),
    );
  }

  return (
    <div
      data-testid={`variant-stock-${current.sku}`}
      className="mt-3 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-2 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium uppercase tracking-wide text-stone-500">
          Stock réel (commandes)
        </span>
        <StockStatusBadge status={current.status} />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center">
        <StockFigure label="Disponible" value={current.available} />
        <StockFigure label="Réservé" value={current.reserved} />
        <StockFigure label="Effectif" value={current.effective} strong />
        <StockFigure label="Seuil" value={current.thresholdLow} />
      </dl>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-800"
        >
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800"
        >
          {feedback}
        </div>
      ) : null}

      <StockControl
        label="Définir le disponible"
        value={target}
        onChange={setTarget}
        busy={busy}
      >
        <StockButton onClick={submitSet} busy={busy}>
          Définir
        </StockButton>
      </StockControl>
      <StockControl label="Ajouter ou retirer" value={delta} onChange={setDelta} busy={busy}>
        <StockButton onClick={() => submitDelta(1)} busy={busy}>
          Ajouter
        </StockButton>
        <StockButton onClick={() => submitDelta(-1)} busy={busy}>
          Retirer
        </StockButton>
      </StockControl>
      <StockControl
        label="Seuil de stock bas"
        value={threshold}
        onChange={setThreshold}
        busy={busy}
      >
        <StockButton onClick={submitThreshold} busy={busy}>
          Modifier
        </StockButton>
      </StockControl>
      <p className="text-stone-500">
        Pour un réassort, préfère « Ajouter » : « Définir » écrase la valeur, y compris
        les ventes passées entre-temps.
      </p>
    </div>
  );
}

function StockFigure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded border border-stone-200 bg-white px-1 py-1">
      <dt className="text-[10px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className={`text-sm ${strong ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
        {value}
      </dd>
    </div>
  );
}

function StockControl({
  label,
  value,
  onChange,
  busy,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-stone-600">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
      </label>
      {children}
    </div>
  );
}

function StockButton({
  onClick,
  busy,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function StockStatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, string> = {
    in_stock: 'bg-emerald-100 text-emerald-800',
    low_stock: 'bg-amber-100 text-amber-800',
    out_of_stock: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${map[status]}`}
    >
      {status}
    </span>
  );
}
