/**
 * <CouponsManager/> — UI opérateur de gestion des coupons (client).
 *
 * Liste + création + transitions de statut + consultation des stats
 * d'incrémentalité, via les routes /api/admin/coupons/**. Feedback explicite
 * sur chaque état réseau (succès / 4xx / erreur).
 * cf. docs/coupons-qa-2026-06-02/{10,11,12}-*.
 */
'use client';

import { useState } from 'react';

interface SerializedCoupon {
  id: string;
  label: string;
  code: string | null;
  type: string;
  mode: string;
  status: string;
  valueKind: string;
  valueAmount: number;
  holdoutPct: number;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

interface GrantRow {
  id: string;
  code: string;
  phone: string;
  valueCents: number;
  status: string;
  activatesAt: string | null;
  expiresAt: string | null;
}

interface CouponStats {
  exposed: { treatment: number; holdout: number };
  converted: { treatment: number; holdout: number };
  conversionRate: { treatment: number | null; holdout: number | null };
  upliftAbsolute: number | null;
  upliftRelative: number | null;
  noControl: boolean;
  lowSample: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  paused: 'En pause',
  archived: 'Archivé',
};

export function CouponsManager({
  initialCoupons,
}: {
  initialCoupons: SerializedCoupon[];
}): JSX.Element {
  const [coupons, setCoupons] = useState<SerializedCoupon[]>(initialCoupons);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, CouponStats>>({});

  // Formulaire de création (minimal — valeurs par défaut côté serveur).
  const [label, setLabel] = useState('Geste d’accueil');
  const [valueAmount, setValueAmount] = useState(9000);

  // Codes de fidélité émis (Phase 3) — chargés à la demande.
  const [grants, setGrants] = useState<GrantRow[] | null>(null);
  async function loadGrants() {
    const res = await fetch('/api/admin/coupons/grants', { credentials: 'include' });
    if (res.ok) setGrants(((await res.json()) as { items: GrantRow[] }).items);
  }

  async function refresh() {
    const res = await fetch('/api/admin/coupons', { credentials: 'include' });
    if (res.ok) {
      const json = (await res.json()) as { items: SerializedCoupon[] };
      setCoupons(json.items);
    }
  }

  async function createCoupon() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label,
          type: 'welcome_auto',
          mode: 'auto',
          status: 'draft',
          valueKind: 'fixed_amount',
          valueAmount,
          target: 'product_price',
          currency: 'MAD',
        }),
      });
      if (!res.ok) {
        setError(`Création refusée (HTTP ${res.status}).`);
        return;
      }
      await refresh();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError(`Transition refusée (HTTP ${res.status}).`);
        return;
      }
      await refresh();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  }

  async function loadStats(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}/stats`, { credentials: 'include' });
    if (res.ok) {
      const json = (await res.json()) as { stats: CouponStats };
      setStats((s) => ({ ...s, [id]: json.stats }));
    }
  }

  return (
    <div className="space-y-6" data-testid="coupons-manager">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-encre">Coupons</h1>
      </header>

      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Création rapide d'un coupon d'accueil */}
      <section className="rounded-md border border-sauge/30 bg-creme/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-encre">Nouveau coupon d’accueil</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-encre/70">Libellé</span>
            <input
              aria-label="Libellé"
              className="mt-1 rounded border border-encre/20 px-2 py-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block text-encre/70">Montant offert (centimes)</span>
            <input
              aria-label="Montant offert"
              type="number"
              className="mt-1 w-40 rounded border border-encre/20 px-2 py-1"
              value={valueAmount}
              onChange={(e) => setValueAmount(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={createCoupon}
            className="rounded bg-encre px-3 py-1.5 text-sm text-creme disabled:opacity-50"
          >
            Créer (brouillon)
          </button>
        </div>
      </section>

      {/* Liste */}
      <table className="w-full border-collapse text-sm" data-testid="coupons-table">
        <thead>
          <tr className="border-b border-encre/15 text-left text-encre/60">
            <th className="py-2">Libellé</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Valeur</th>
            <th>Holdout</th>
            <th>Usage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-encre/50">
                Aucun coupon.
              </td>
            </tr>
          )}
          {coupons.map((c) => (
            <tr key={c.id} className="border-b border-encre/10" data-testid={`coupon-row-${c.id}`}>
              <td className="py-2">{c.label}</td>
              <td>{c.type}</td>
              <td data-testid={`coupon-status-${c.id}`}>{STATUS_LABEL[c.status] ?? c.status}</td>
              <td>
                {c.valueKind === 'percent'
                  ? `${c.valueAmount} %`
                  : `${(c.valueAmount / 100).toFixed(0)} MAD`}
              </td>
              <td>{c.holdoutPct} %</td>
              <td>{c.usageCount}</td>
              <td className="space-x-2 whitespace-nowrap">
                {c.status !== 'active' && c.status !== 'archived' && (
                  <button type="button" disabled={busy} onClick={() => setStatus(c.id, 'active')} className="text-sauge underline">
                    Activer
                  </button>
                )}
                {c.status === 'active' && (
                  <button type="button" disabled={busy} onClick={() => setStatus(c.id, 'paused')} className="text-encre/70 underline">
                    Pauser
                  </button>
                )}
                {c.status !== 'archived' && (
                  <button type="button" disabled={busy} onClick={() => setStatus(c.id, 'archived')} className="text-encre/50 underline">
                    Archiver
                  </button>
                )}
                <button type="button" onClick={() => loadStats(c.id)} className="text-encre/70 underline">
                  Stats
                </button>
                {stats[c.id] && (
                  <span data-testid={`coupon-stats-${c.id}`} className="ml-2 text-xs text-encre/60">
                    uplift:{' '}
                    {stats[c.id]!.upliftAbsolute === null
                      ? '—'
                      : `${(stats[c.id]!.upliftAbsolute! * 100).toFixed(1)} pts`}
                    {stats[c.id]!.noControl ? ' (pas de contrôle)' : ''}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Codes de fidélité émis (Phase 3) — téléphone masqué (PII). */}
      <section className="space-y-2" data-testid="coupons-grants-section">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-encre">Codes de fidélité émis</h2>
          <button type="button" onClick={loadGrants} className="text-xs text-sauge underline">
            {grants === null ? 'Charger' : 'Rafraîchir'}
          </button>
        </div>
        {grants !== null && (
          <table className="w-full border-collapse text-xs" data-testid="coupons-grants-table">
            <thead>
              <tr className="border-b border-encre/15 text-left text-encre/60">
                <th className="py-1">Code</th>
                <th>Téléphone</th>
                <th>Valeur</th>
                <th>Statut</th>
                <th>Activation</th>
                <th>Expiration</th>
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-encre/50">Aucun code émis.</td></tr>
              )}
              {grants.map((g) => (
                <tr key={g.id} className="border-b border-encre/10" data-testid={`grant-row-${g.id}`}>
                  <td className="py-1 font-mono">{g.code}</td>
                  <td>{g.phone}</td>
                  <td>{(g.valueCents / 100).toFixed(0)} MAD</td>
                  <td>{g.status}</td>
                  <td>{g.activatesAt ? new Date(g.activatesAt).toLocaleDateString('fr-MA') : '—'}</td>
                  <td>{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString('fr-MA') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
