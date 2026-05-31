/**
 * Éditeur moteur de suggestion (lot L11) — pilotage sans redéploiement (INV-18).
 *
 * Colonne gauche : interrupteur global (`engineEnabled`, OFF par défaut —
 * INV-13), pilotage des profils livrés (enabled / surface / minConfidence /
 * priorité), seuils & budget. Colonne droite : simulateur dry-run sticky.
 * Publication optimiste `PUT /api/admin/i18n/config` avec `If-Match` ; gère
 * 200 / 422 (règles) / 409 (conflit version) / 401.
 *
 * Le plancher zone calme (checkout/form) est **structurel** dans la politique
 * L9 : non pilotable ici, rappelé en lecture seule (INV-14).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/admin-feature-spec.md
 */
'use client';

import { useState } from 'react';

import { type ResolvedEngineConfig } from '@/lib/i18n/engine-config-schema';

import { EngineSimulator } from './EngineSimulator';

export interface EngineEditorMeta {
  version: number;
  updatedAt: string;
  updatedBy: { id: string; email: string } | null;
  isDefault: boolean;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'conflict'; currentVersion: number }
  | { kind: 'invalid'; issues: { path: (string | number)[]; message: string }[] }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function EngineEditor({
  initialConfig,
  meta: initialMeta,
}: {
  initialConfig: ResolvedEngineConfig;
  meta: EngineEditorMeta;
}): JSX.Element {
  const [draft, setDraft] = useState<ResolvedEngineConfig>(initialConfig);
  const [version, setVersion] = useState(initialMeta.version);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  const nevers = draft.profiles.filter((p) => p.kind === 'never');
  const triggers = draft.profiles.filter((p) => p.kind === 'trigger');

  function patch(next: Partial<ResolvedEngineConfig>) {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
    setSave({ kind: 'idle' });
  }

  function patchProfile(id: string, next: Record<string, unknown>) {
    setDraft((d) => ({
      ...d,
      profiles: d.profiles.map((p) => (p.id === id ? { ...p, ...next } : p)),
    }));
    setDirty(true);
    setSave({ kind: 'idle' });
  }

  async function publish() {
    setSave({ kind: 'saving' });
    try {
      const res = await fetch('/api/admin/i18n/config', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'If-Match': String(version),
        },
        body: JSON.stringify({ payload: draft, note: note || undefined }),
      });
      if (res.status === 200) {
        const body = (await res.json()) as { meta: { version: number } };
        setVersion(body.meta.version);
        setDirty(false);
        setNote('');
        setSave({ kind: 'saved' });
        return;
      }
      if (res.status === 401) {
        setSave({ kind: 'unauthorized' });
        return;
      }
      if (res.status === 409) {
        const body = (await res.json()) as {
          error: { details: { currentVersion: number } };
        };
        setSave({ kind: 'conflict', currentVersion: body.error.details.currentVersion });
        return;
      }
      if (res.status === 422) {
        const body = (await res.json()) as {
          error: { details: { path: (string | number)[]; message: string }[] };
        };
        setSave({ kind: 'invalid', issues: body.error.details });
        return;
      }
      setSave({ kind: 'error' });
    } catch {
      setSave({ kind: 'error' });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <header className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-stone-900">
                Moteur de suggestion de langue
              </h1>
              <p className="mt-1 text-xs text-stone-500">
                Version {version}
                {initialMeta.updatedBy
                  ? ` · dernier éditeur ${initialMeta.updatedBy.email}`
                  : ''}
              </p>
            </div>
            <span
              data-testid="engine-state-badge"
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                draft.engineEnabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {draft.engineEnabled ? 'Moteur actif' : 'Moteur inactif'}
            </span>
          </div>

          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              data-testid="toggle-engine-enabled"
              checked={draft.engineEnabled}
              onChange={(e) => patch({ engineEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-stone-800">
              Activer le moteur
            </span>
          </label>
          <p className="mt-1 text-[11px] leading-snug text-stone-500">
            OFF par défaut — aucune suggestion tant qu'un déclenchement n'est pas
            activé (INV-13).
          </p>
        </header>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">
            Seuils &amp; budget
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-medium text-stone-700">
              Plancher de confiance
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                data-testid="input-confidence-floor"
                value={draft.globalConfidenceFloor}
                onChange={(e) =>
                  patch({
                    globalConfidenceFloor: clamp(Number(e.target.value), 0, 1),
                  })
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              Impressions max / visiteur
              <input
                type="number"
                step="1"
                min={0}
                max={3}
                data-testid="input-max-impressions"
                value={draft.maxImpressionsPerVisitor}
                onChange={(e) =>
                  patch({
                    maxImpressionsPerVisitor: clamp(Number(e.target.value), 0, 3),
                  })
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              TTL defer (ms)
              <input
                type="number"
                step="500"
                min={0}
                max={60000}
                data-testid="input-defer-ttl"
                value={draft.deferTtlMs}
                onChange={(e) =>
                  patch({ deferTtlMs: clamp(Number(e.target.value), 0, 60000) })
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Profils</h2>

          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
            Zones calmes <strong>NEVER-CHECKOUT</strong> et{' '}
            <strong>NEVER-FORM</strong> : plancher inviolable, appliqué par la
            politique — non désactivable ici (INV-14).
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Exclusions (never)
          </h3>
          <ul className="mt-2 divide-y divide-stone-100">
            {nevers.map((p) => (
              <li
                key={p.id}
                data-testid={`profile-${p.id}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="font-mono text-xs text-stone-700">{p.id}</span>
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    data-testid={`toggle-${p.id}`}
                    checked={p.enabled}
                    onChange={(e) =>
                      patchProfile(p.id, { enabled: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Actif
                </label>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Déclenchements (trigger)
          </h3>
          <ul className="mt-2 divide-y divide-stone-100">
            {triggers.map((p) => (
              <li
                key={p.id}
                data-testid={`profile-${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="font-mono text-xs text-stone-700">{p.id}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-xs text-stone-600">
                    Confiance
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={1}
                      data-testid={`min-confidence-${p.id}`}
                      value={p.minConfidence ?? 0}
                      onChange={(e) =>
                        patchProfile(p.id, {
                          minConfidence: clamp(Number(e.target.value), 0, 1),
                        })
                      }
                      className="w-16 rounded-md border border-stone-300 px-1.5 py-1 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-stone-600">
                    Surface
                    <select
                      data-testid={`surface-${p.id}`}
                      value={p.surface ?? 'pearl'}
                      onChange={(e) =>
                        patchProfile(p.id, { surface: e.target.value })
                      }
                      className="rounded-md border border-stone-300 px-1.5 py-1 text-xs"
                    >
                      <option value="pearl">Perle</option>
                      <option value="toast">Toast</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      data-testid={`toggle-${p.id}`}
                      checked={p.enabled}
                      onChange={(e) =>
                        patchProfile(p.id, { enabled: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    Actif
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <label className="block text-xs font-medium text-stone-700">
            Note d'audit (optionnel)
            <input
              type="text"
              data-testid="input-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex. active TRIG-ENTRY-MISMATCH en A/B 50%"
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              data-testid="publish-button"
              disabled={!dirty || save.kind === 'saving'}
              onClick={publish}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {save.kind === 'saving' ? 'Publication…' : 'Publier'}
            </button>
            <SaveStatus state={save} />
          </div>
        </section>
      </div>

      <EngineSimulator config={draft} />
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }): JSX.Element | null {
  if (state.kind === 'idle' || state.kind === 'saving') return null;
  if (state.kind === 'saved') {
    return (
      <span role="status" data-testid="save-status" className="text-xs text-emerald-700">
        Publié.
      </span>
    );
  }
  if (state.kind === 'conflict') {
    return (
      <span role="alert" data-testid="save-status" className="text-xs text-amber-700">
        Un autre admin a modifié cette config (v{state.currentVersion}).
        Recharger.
      </span>
    );
  }
  if (state.kind === 'unauthorized') {
    return (
      <span role="alert" data-testid="save-status" className="text-xs text-red-700">
        Session expirée — reconnexion requise.
      </span>
    );
  }
  if (state.kind === 'invalid') {
    return (
      <span role="alert" data-testid="save-status" className="text-xs text-red-700">
        Configuration invalide ({state.issues.length} erreur
        {state.issues.length > 1 ? 's' : ''}).
      </span>
    );
  }
  return (
    <span role="alert" data-testid="save-status" className="text-xs text-red-700">
      Échec de la publication.
    </span>
  );
}
