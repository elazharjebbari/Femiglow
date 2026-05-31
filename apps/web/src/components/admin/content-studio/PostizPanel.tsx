'use client';

import type { ContentIdea } from '@/lib/content-studio/types';
import type { Integration, RunFunction } from './types';
import { SectionTitle } from './SectionTitle';
import { postJson } from './api';

export function PostizPanel({
  integrations,
  setIntegrations,
  disabled,
  run,
}: {
  integrations: Integration[];
  setIntegrations: (items: Integration[]) => void;
  disabled: boolean;
  run: RunFunction;
}) {
  return (
    <div className="rounded-md border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          eyebrow="Connexions"
          title="Comptes Postiz"
          tone="violet"
          description="Synchroniser les destinations sociales."
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            run(
              async () =>
                postJson<{ integrations: Integration[] }>(
                  '/api/admin/content-studio/postiz/integrations/sync',
                  {},
                ),
              (value) => setIntegrations(value.integrations),
            )
          }
          className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-950"
        >
          Sync
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {integrations.length === 0 ? (
          <li className="text-sm text-stone-500">Aucun compte synchronisé.</li>
        ) : (
          integrations.map((integration) => (
            <li key={integration.id} className="rounded border border-violet-100 bg-white px-3 py-2 text-sm">
              <span className="font-medium">{integration.provider}</span>{' '}
              <span className="text-stone-500">{integration.name ?? integration.identifier}</span>
              {integration.disabled ? <span className="text-red-600"> désactivé</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}