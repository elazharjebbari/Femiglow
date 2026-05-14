'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
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

interface FullVersion {
  id: string;
  name: string;
  notes: string | null;
  perEnv: GtmConfigPerEnv;
}

export function GtmConfigClient({ initialActiveId, initialVersions }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [versions, setVersions] = useState<ConfigVersionSummary[]>(initialVersions);
  const [submitting, setSubmitting] = useState(false);
  const [editingPrefill, setEditingPrefill] = useState<FullVersion | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
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
        // Reset prefill so the next submit starts from a clean slate.
        setEditingPrefill(null);
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

  const handleDeactivate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/tracking/gtm/configs/${id}/deactivate`, {
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

  const handleEdit = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/tracking/gtm/configs/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
    }
    const full = (await res.json()) as FullVersion;
    setEditingPrefill(full);
    // Scroll smooth vers le formulaire (UX : l'utilisateur voit que l'édition
    // est en mode "création basée sur cette version").
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  useEffect(() => {
    // Resync au mount au cas où une autre tab a modifié.
    refresh();
  }, [refresh]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div ref={formRef}>
        {editingPrefill ? (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <span className="font-medium">
              Édition basée sur « {editingPrefill.name} »
            </span>
            <span className="text-sky-700">— une nouvelle version sera créée au submit.</span>
            <button
              type="button"
              onClick={() => setEditingPrefill(null)}
              className="ml-auto rounded px-1.5 py-0.5 text-sky-700 hover:bg-sky-100"
            >
              Annuler
            </button>
          </div>
        ) : null}
        <GtmConfigForm
          key={editingPrefill?.id ?? 'fresh'}
          initial={editingPrefill?.perEnv}
          initialName={
            editingPrefill ? `${editingPrefill.name} (édition)` : undefined
          }
          initialNotes={editingPrefill?.notes ?? undefined}
          seedFrom={editingPrefill ? 'version' : undefined}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium text-stone-900">
          Historique ({versions.length})
        </h3>
        <GtmConfigVersionList
          activeId={activeId}
          versions={versions}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
}
