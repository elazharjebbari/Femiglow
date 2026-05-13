'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import type { MappingVersion, Mappings } from '@/lib/tracking/mappings/types';
import { MappingMatrix } from './MappingMatrix';
import { MappingTestModal } from './MappingTestModal';
import { MappingExportButton } from './MappingExportButton';

/**
 * Éditeur de version : matrice éditable + actions (save, test, export).
 * D-001 : Sauvegarder crée une nouvelle version draft (clone).
 */
export function MappingVersionEditor({ initial }: { initial: MappingVersion }) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Mappings>(initial.mappings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const handleChange = (next: Mappings) => {
    setMappings(next);
    setDirty(true);
  };

  async function handleSave() {
    if (!dirty) return;
    if (!confirm("Sauvegarder créera une NOUVELLE version draft (D-001). Continuer ?")) return;
    setSaving(true);
    setError(null);
    try {
      const created = await mappingsClient.update(initial.id, { mappings });
      router.push(`/admin/tracking/events/mappings/${created.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof MappingApiError) setError(`${err.code}: ${err.message}`);
      else setError('Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!confirm("Annuler les modifications en attente ?")) return;
    setMappings(initial.mappings);
    setDirty(false);
  }

  return (
    <div className="space-y-4">
      {initial.isDefault ? (
        <div role="status" className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          ⚠ La version __default__ est en lecture seule. Pour modifier, créer une nouvelle version à partir d'elle.
        </div>
      ) : (
        <div role="status" className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
          ℹ Édition de <strong>{initial.name}</strong> ({initial.status}). Sauvegarder créera une nouvelle version draft (D-001).
        </div>
      )}
      {error ? <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

      <MappingMatrix mappings={mappings} readOnly={initial.isDefault} onChange={handleChange} />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
        <div className="text-xs text-stone-500">
          {dirty ? <span className="text-amber-700">Modifications en attente.</span> : <span>Aucune modification.</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowTest(true)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">
            Tester
          </button>
          <MappingExportButton versionId={initial.id} versionName={initial.name} />
          {dirty ? (
            <button type="button" onClick={handleDiscard} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">
              Annuler les modifs
            </button>
          ) : null}
          {!initial.isDefault ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              data-testid="btn-save-edit"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Sauvegarde…' : '💾 Sauvegarder → nouvelle version draft'}
            </button>
          ) : null}
        </div>
      </footer>

      {showTest ? (
        <MappingTestModal
          versionId={initial.id}
          eventNames={Object.keys(mappings)}
          onClose={() => setShowTest(false)}
        />
      ) : null}
    </div>
  );
}
