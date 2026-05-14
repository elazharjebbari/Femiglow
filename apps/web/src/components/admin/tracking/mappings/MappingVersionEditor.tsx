'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import type { MappingVersion, Mappings } from '@/lib/tracking/mappings/types';
import { PROVIDER_KINDS_FOR_MAPPING } from '@/lib/tracking/mappings/types';
import { MappingMatrix } from './MappingMatrix';
import { MappingTestModal } from './MappingTestModal';
import { MappingExportButton } from './MappingExportButton';
import { useConfirm } from './useConfirm';

const AUTOSAVE_KEY_PREFIX = 'femiglow:mapping-draft:';
const AUTOSAVE_INTERVAL_MS = 30_000;
const UNDO_STACK_MAX = 20;

interface DraftSaved {
  mappings: Mappings;
  savedAt: string;
}

function loadDraft(versionId: string): DraftSaved | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${AUTOSAVE_KEY_PREFIX}${versionId}`);
    return raw ? (JSON.parse(raw) as DraftSaved) : null;
  } catch {
    return null;
  }
}

function saveDraft(versionId: string, mappings: Mappings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${AUTOSAVE_KEY_PREFIX}${versionId}`,
      JSON.stringify({ mappings, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore quota errors */
  }
}

function clearDraft(versionId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${AUTOSAVE_KEY_PREFIX}${versionId}`);
  } catch { /* ignore */ }
}

/**
 * Éditeur de version : matrice éditable + actions (save, test, export).
 * D-001 : Sauvegarder crée une nouvelle version draft (clone).
 *
 * Quick wins V1.1 :
 * - C4 Auto-save draft localStorage toutes les 30s
 * - D3 Undo/Redo Ctrl+Z / Ctrl+Shift+Z (max 20 niveaux)
 * - Restore draft proposé au mount si présent
 * - Warning validation : events avec 0 provider activé
 */
export function MappingVersionEditor({ initial }: { initial: MappingVersion }) {
  const router = useRouter();
  const { confirm, ConfirmHost } = useConfirm();

  const [mappings, setMappings] = useState<Mappings>(initial.mappings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);

  // Undo/Redo : stacks d'états passés et futurs
  const undoStack = useRef<Mappings[]>([]);
  const redoStack = useRef<Mappings[]>([]);

  // Restore draft localStorage au mount
  useEffect(() => {
    if (initial.isDefault) return;
    const draft = loadDraft(initial.id);
    if (!draft) return;
    // Si le draft est différent de l'initial, proposer le restore
    const draftStr = JSON.stringify(draft.mappings);
    const initialStr = JSON.stringify(initial.mappings);
    if (draftStr === initialStr) return;
    void confirm({
      title: 'Reprendre votre brouillon ?',
      message: `Un brouillon non sauvegardé a été trouvé pour cette version (auto-save du ${new Date(draft.savedAt).toLocaleString('fr-FR')}).`,
      details: 'Tu peux soit reprendre ces modifications, soit les ignorer et repartir de la version actuelle.',
      confirmLabel: '📝 Reprendre le brouillon',
      cancelLabel: 'Ignorer',
      variant: 'default',
    }).then((ok) => {
      if (ok) {
        setMappings(draft.mappings);
        setDirty(true);
      } else {
        clearDraft(initial.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirm beforeunload si dirty
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  // Auto-save draft toutes les 30s
  useEffect(() => {
    if (!dirty || initial.isDefault) return;
    const t = setInterval(() => {
      saveDraft(initial.id, mappings);
      setLastAutoSaveAt(new Date());
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [dirty, mappings, initial.id, initial.isDefault]);

  // Keyboard shortcuts undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey;
      const isRedo = (e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'));
      if (isUndo) {
        e.preventDefault();
        handleUndo();
      } else if (isRedo) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (next: Mappings) => {
      undoStack.current.push(mappings);
      if (undoStack.current.length > UNDO_STACK_MAX) undoStack.current.shift();
      redoStack.current = [];
      setMappings(next);
      setDirty(true);
    },
    [mappings],
  );

  function handleUndo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(mappings);
    setMappings(prev);
    setDirty(true);
  }

  function handleRedo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(mappings);
    setMappings(next);
    setDirty(true);
  }

  async function handleSave() {
    if (!dirty) return;
    // Warning si events sans aucun provider activé
    const emptyEvents = Object.entries(mappings)
      .filter(([, cells]) =>
        PROVIDER_KINDS_FOR_MAPPING.every((k) => !cells[k]?.isEnabled || !cells[k]?.mappedName),
      )
      .map(([name]) => name);
    let details: React.ReactNode = 'Sauvegarder créera une NOUVELLE version draft (D-001). L\'originale reste intacte.';
    if (emptyEvents.length > 0) {
      details = (
        <div>
          <p>Sauvegarder créera une NOUVELLE version draft (D-001).</p>
          <p className="mt-2 font-medium text-amber-700">
            ⚠ {emptyEvents.length} event(s) n'ont aucun provider activé :
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {emptyEvents.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
            {emptyEvents.length > 5 ? <li>… et {emptyEvents.length - 5} autre(s)</li> : null}
          </ul>
        </div>
      );
    }
    const ok = await confirm({
      title: 'Sauvegarder les modifications ?',
      message: 'Cette action crée une nouvelle version draft que tu pourras activer ensuite.',
      details,
      confirmLabel: '💾 Créer la version draft',
      variant: 'default',
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const created = await mappingsClient.update(initial.id, { mappings });
      clearDraft(initial.id);
      router.push(`/admin/tracking/events/mappings/${created.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof MappingApiError) setError(`${err.code}: ${err.message}`);
      else setError('Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    const ok = await confirm({
      title: 'Annuler les modifications ?',
      message: 'Toutes les modifications en attente seront perdues. Le brouillon auto-save sera aussi effacé.',
      confirmLabel: 'Annuler les modifs',
      variant: 'danger',
    });
    if (!ok) return;
    setMappings(initial.mappings);
    setDirty(false);
    clearDraft(initial.id);
    undoStack.current = [];
    redoStack.current = [];
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
          {lastAutoSaveAt ? (
            <span className="ml-2 text-stone-500">
              · Auto-save : {lastAutoSaveAt.toLocaleTimeString('fr-FR')}
            </span>
          ) : null}
        </div>
      )}
      {error ? <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

      <MappingMatrix mappings={mappings} readOnly={initial.isDefault} onChange={handleChange} />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
        <div className="flex items-center gap-3 text-xs text-stone-500">
          {dirty ? <span className="text-amber-700">Modifications en attente.</span> : <span>Aucune modification.</span>}
          {!initial.isDefault ? (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.current.length === 0}
                title="Annuler (Ctrl+Z)"
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-30"
                data-testid="btn-undo"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.current.length === 0}
                title="Rétablir (Ctrl+Y)"
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs disabled:opacity-30"
                data-testid="btn-redo"
              >
                ↷ Redo
              </button>
            </>
          ) : null}
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
      <ConfirmHost />
    </div>
  );
}
