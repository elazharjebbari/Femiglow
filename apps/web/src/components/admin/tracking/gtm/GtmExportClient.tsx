'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { GtmStats, GtmMeta } from '@/lib/tracking/gtm/exporter';
import { GtmStatsGrid } from './GtmStatsGrid';
import { GtmMetaInfo } from './GtmMetaInfo';
import { GtmJsonPreview } from './GtmJsonPreview';

const ENVS = ['production', 'stage', 'preview', 'dev'] as const;
type Env = (typeof ENVS)[number];

interface ExportPayload {
  pretty: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: Env;
}

interface Props {
  initial: ExportPayload;
}

const ENV_LABELS: Record<Env, string> = {
  production: 'Production',
  stage: 'Stage',
  preview: 'Preview',
  dev: 'Dev local',
};

export function GtmExportClient({ initial }: Props) {
  const [env, setEnv] = useState<Env>(initial.env);
  const [data, setData] = useState<ExportPayload>(initial);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (env === initial.env) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/tracking/gtm/container?env=${env}&format=pretty`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as ExportPayload;
        setData({ ...next, env });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'erreur');
      }
    });
  }, [env, initial.env]);

  const onDownload = useCallback(() => {
    const url = `/api/admin/tracking/gtm/container?env=${env}&format=pretty&download=true`;
    window.location.assign(url);
  }, [env]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier dans le presse-papier');
    }
  }, [data.pretty]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-stone-500">
            Environnement
          </span>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as Env)}
            className="mt-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            disabled={pending}
          >
            {ENVS.map((e) => (
              <option key={e} value={e}>
                {ENV_LABELS[e]}
              </option>
            ))}
          </select>
        </label>
        {pending ? (
          <span className="text-xs text-stone-500" role="status">
            chargement…
          </span>
        ) : null}
      </div>

      <GtmStatsGrid stats={data.stats} />
      <GtmMetaInfo meta={data.meta} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60"
          disabled={pending}
        >
          Télécharger .json
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-60"
          disabled={pending}
        >
          {copied ? '✓ Copié' : 'Copier le JSON'}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <GtmJsonPreview json={data.pretty} />

      <section className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Comment importer dans GTM
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Ouvre Google Tag Manager → ton compte → ton conteneur web.</li>
          <li>Admin → Import Container.</li>
          <li>Choisis le fichier téléchargé.</li>
          <li>
            Workspace : crée <em>feature/auto-import-{new Date().toISOString().slice(0, 10)}</em>.
          </li>
          <li>
            Mode : <strong>Merge</strong> (recommandé) ou <strong>Overwrite</strong> pour un reset complet.
          </li>
          <li>Confirme. Vérifie en Tag Assistant Preview avant publication.</li>
        </ol>
      </section>
    </div>
  );
}
