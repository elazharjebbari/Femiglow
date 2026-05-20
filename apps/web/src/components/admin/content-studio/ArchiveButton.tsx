'use client';

import { useState } from 'react';
import type { RunFunction } from './types';
import { postJson } from './api';

type EntityType = 'idea' | 'draft' | 'post';

export function ArchiveButton({
  entityType,
  entityId,
  disabled,
  onArchived,
  run,
}: {
  entityType: EntityType;
  entityId: string;
  disabled: boolean;
  onArchived: () => void;
  run: RunFunction;
}) {
  const [confirming, setConfirming] = useState(false);

  const label = entityType === 'idea' ? 'l\'idée' : entityType === 'draft' ? 'le brouillon' : 'le post';

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-600">Archiver {label} ?</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            run(
              async () =>
                postJson<{ idea?: unknown; draft?: unknown; post?: unknown }>(
                  `/api/admin/content-studio/${entityType === 'idea' ? 'ideas' : entityType === 'draft' ? 'drafts' : 'posts'}/${entityId}/archive`,
                  {},
                ),
              () => {
                setConfirming(false);
                onArchived();
              },
            );
          }}
          className="rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Confirmer
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700"
        >
          Non
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setConfirming(true)}
      className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 disabled:opacity-50"
    >
      Archiver
    </button>
  );
}