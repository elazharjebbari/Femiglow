'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { GtmConfigPerEnv } from '@/lib/tracking/gtm/config-schema';
import { GtmConfigForm } from './GtmConfigForm';
import {
  GtmConfigVersionList,
  type ConfigVersionSummary,
} from './GtmConfigVersionList';

interface Props {
  initialActiveId: string | null;
  initialVersions: ConfigVersionSummary[];
}

interface CreatePayload {
  name: string;
  notes: string | null;
  perEnv: GtmConfigPerEnv;
}

export function GtmConfigClient({ initialActiveId, initialVersions }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [versions, setVersions] = useState<ConfigVersionSummary[]>(initialVersions);
  const [submitting, setSubmitting] = useState(false);
  const [, startRefresh] = useTransition();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const res = await fetch('/api/admin/tracking/gtm/configs', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { activeId: string | null; versions: ConfigVersionSummary[] };
        setActiveId(data.activeId);
        setVersions(data.versions);
      }
    });
  }, []);

  const handleCreate = useCallback(
    async (payload: CreatePayload) => {
      setSubmitting(true);
      try {
        const res = await fetch('/api/admin/tracking/gtm/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error?.message ?? body?.message ?? `HTTP ${res.status}`,
          );
        }
        refresh();
      } finally {
        setSubmitting(false);
      }
    },
    [refresh],
  );

  const handleActivate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/tracking/gtm/configs/${id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      refresh();
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/tracking/gtm/configs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      refresh();
    },
    [refresh],
  );

  useEffect(() => {
    // Resync au mount au cas où une autre tab a modifié.
    refresh();
  }, [refresh]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <GtmConfigForm onSubmit={handleCreate} submitting={submitting} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium text-stone-900">
          Historique ({versions.length})
        </h3>
        <GtmConfigVersionList
          activeId={activeId}
          versions={versions}
          onActivate={handleActivate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
