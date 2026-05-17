'use client';

import type { ContentPostizDelivery } from '@/lib/content-studio/types';

function DeliveryStatusBadge({ status }: { status: ContentPostizDelivery['status'] }) {
  const cls =
    status === 'sent'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'failed' || status === 'auth_failed'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-stone-200 bg-white text-stone-600';
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {status === 'sent'
        ? 'Envoyé'
        : status === 'failed'
          ? 'Échec'
          : status === 'auth_failed'
            ? 'Auth Postiz'
            : 'En attente'}
    </span>
  );
}

export { DeliveryStatusBadge };