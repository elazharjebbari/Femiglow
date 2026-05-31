'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface DeleteProviderButtonProps {
  id: string;
  label: string;
}

/**
 * Suppression d'un provider chat via `fetch(..., method: 'DELETE')`.
 *
 * Pourquoi `fetch` plutôt qu'un `<form action>` :
 * Chromium applique la CSP `form-action 'self'` aussi sur les redirects
 * 3xx — un POST suivi d'un 303 same-origin était parfois bloqué par le
 * navigateur dans cette config. `fetch()` passe par `connect-src 'self'`,
 * qui autorise déjà les routes API sans frottement.
 *
 * L'historique des messages reste préservé (le repo passe `provider_id`
 * à NULL avant la suppression), donc l'opération n'est pas destructrice
 * de data — un simple `window.confirm` suffit.
 */
export function DeleteProviderButton({ id, label }: DeleteProviderButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    const ok = window.confirm(
      `Supprimer le provider « ${label} » ?\n\nLes messages déjà envoyés via ce provider sont conservés (le lien sera détaché).`,
    );
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/providers/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      // Navigation côté client : on rentre sur la liste avec un flash code,
      // `router.refresh()` recharge le RSC pour re-fetcher la table.
      router.replace('/admin/chat/providers?ok=deleted');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-md border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Supprimer le provider ${label}`}
      >
        {submitting ? 'Suppression…' : 'Supprimer'}
      </button>
      {error ? (
        <span role="alert" className="text-[10px] text-rose-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
