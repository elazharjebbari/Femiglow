'use client';

import { useState } from 'react';
import type { RunFunction } from './types';
import { postJson } from './api';

export function RejectDialog({
  draftId,
  disabled,
  onRejected,
  run,
}: {
  draftId: string;
  disabled: boolean;
  onRejected: (draft: { id: string; status: string; rejectionReason: string | null }) => void;
  run: RunFunction;
}) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-950 disabled:opacity-50"
      >
        Rejeter
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-900">Rejeter ce brouillon ?</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        placeholder="Raison du rejet (optionnel)"
        className="mt-2 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            run(
              async () =>
                postJson<{ draft: { id: string; status: string; rejectionReason: string | null } }>(
                  `/api/admin/content-studio/drafts/${draftId}/reject`,
                  { reason: reason || undefined },
                ),
              (value) => {
                setOpen(false);
                setReason('');
                onRejected(value.draft);
              },
            );
          }}
          className="rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Confirmer le rejet
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason('');
          }}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}