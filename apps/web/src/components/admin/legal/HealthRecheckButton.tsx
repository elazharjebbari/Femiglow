'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function HealthRecheckButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/legal/health/recheck', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error('legal health recheck', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-40"
    >
      {busy ? 'Vérification…' : 'Lancer une vérification'}
    </button>
  );
}
