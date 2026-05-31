'use client';

import { useState } from 'react';
import type { RunFunction } from './types';
import { postJson } from './api';

export function CancelDialog({
  postId,
  disabled,
  onCancelled,
  run,
}: {
  postId: string;
  disabled: boolean;
  onCancelled: (post: { id: string; status: string }) => void;
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
        className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
      >
        Annuler la publication
      </button>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Annuler la publication planifiée ?</p>
      <p className="mt-1 text-xs text-amber-800">Le post reviendra au statut « approuvé ».</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        placeholder="Raison de l'annulation (optionnel)"
        className="mt-2 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            run(
              async () =>
                postJson<{ post: { id: string; status: string } }>(
                  `/api/admin/content-studio/posts/${postId}/cancel`,
                  { reason: reason || undefined },
                ),
              (value) => {
                setOpen(false);
                setReason('');
                onCancelled(value.post);
              },
            );
          }}
          className="rounded-md bg-amber-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Confirmer l&apos;annulation
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason('');
          }}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
        >
          Garder la publication
        </button>
      </div>
    </div>
  );
}