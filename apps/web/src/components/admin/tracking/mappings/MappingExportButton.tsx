'use client';

import { useState } from 'react';
import { mappingsClient } from '@/lib/admin/mappings-client';

/**
 * Bouton "Exporter vers GTM" → modal env + download JSON.
 * cf. ADR-003 + F.11
 */
export function MappingExportButton({ versionId, versionName }: { versionId: string; versionName: string }) {
  const [open, setOpen] = useState(false);
  const [env, setEnv] = useState<'production' | 'stage' | 'preview' | 'dev'>('production');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await mappingsClient.exportGtm(versionId, env);
      const blob = new Blob([JSON.stringify(res.containerJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `femiglow-gtm-${versionName.replace(/[^a-z0-9]+/gi, '-')}-${env}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="btn-export-gtm"
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
      >
        📥 Exporter GTM
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Exporter {versionName} vers GTM</h2>
            <p className="mt-2 text-xs text-stone-500">
              Génère un fichier .json importable directement dans GTM Web via Admin → Container → Importer un container.
            </p>
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-stone-700">Environnement cible</span>
              <select value={env} onChange={(e) => setEnv(e.target.value as typeof env)} className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
                <option value="production">production</option>
                <option value="stage">stage</option>
                <option value="preview">preview</option>
                <option value="dev">dev</option>
              </select>
            </label>
            <p className="mt-3 rounded bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
              ℹ L'export ne contient pas les Pixel IDs ni les Conv labels — à configurer dans /admin/tracking/plans (envProfiles) avant d'importer.
            </p>
            <footer className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Annuler</button>
              <button onClick={handleExport} disabled={exporting} data-testid="btn-export-confirm" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                {exporting ? 'Export…' : '📥 Télécharger le JSON'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
