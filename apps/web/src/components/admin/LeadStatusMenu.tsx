'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LeadStatus } from '@/lib/db/types';

interface LeadStatusMenuProps {
  leadId: string;
  current: LeadStatus;
  options: LeadStatus[];
}

const LABEL: Record<LeadStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  converted: 'Converti',
  lost: 'Perdu',
  archived: 'Archivé',
};

export function LeadStatusMenu({ leadId, current, options }: LeadStatusMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(target: LeadStatus) {
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: target }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? 'Mise à jour impossible');
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-stone-500">Statut</span>
      <select
        aria-label="Changer le statut"
        value={current}
        onChange={(e) => changeStatus(e.target.value as LeadStatus)}
        disabled={isPending || options.length === 0}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-50"
      >
        <option value={current}>{LABEL[current]}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            → {LABEL[opt]}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
