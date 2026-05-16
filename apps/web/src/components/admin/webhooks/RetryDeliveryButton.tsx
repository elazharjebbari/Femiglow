'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconRefresh } from '@/components/admin/icons';

interface RetryDeliveryButtonProps {
  deliveryId: string;
  disabled?: boolean;
}

export function RetryDeliveryButton({ deliveryId, disabled }: RetryDeliveryButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!res.ok) {
        setError(data?.error?.message ?? 'Relance impossible');
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={retry}
        disabled={disabled || submitting}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <IconRefresh className={submitting ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        {submitting ? 'Relance…' : 'Relancer'}
      </button>
      {error ? <p className="max-w-44 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
