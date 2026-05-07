'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { GtmStats, GtmMeta } from '@/lib/tracking/gtm/exporter';
import { GtmStatsGrid } from './GtmStatsGrid';
import { GtmMetaInfo } from './GtmMetaInfo';
import { GtmJsonPreview } from './GtmJsonPreview';
import { GtmHelpSteps } from './GtmHelpSteps';
import { GtmEnvTabs, envBadge, type GtmEnv } from './GtmEnvTabs';
import { GtmFullscreenPreview } from './GtmFullscreenPreview';
import { IconAlert, IconCheck, IconCopy, IconDownload } from './GtmIcons';

interface ExportPayload {
  pretty: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: GtmEnv;
}

export interface ExportConfigOption {
  id: string;
  name: string;
}

interface Props {
  initial: ExportPayload;
  configs?: ExportConfigOption[];
  activeConfigId?: string | null;
}

export function GtmExportClient({ initial, configs = [], activeConfigId = null }: Props) {
  const [env, setEnv] = useState<GtmEnv>(initial.env);
  const [configId, setConfigId] = useState<string>('defaults');
  const [data, setData] = useState<ExportPayload>(initial);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const fetchEnv = useCallback((nextEnv: GtmEnv, nextConfigId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const u = new URL('/api/admin/tracking/gtm/container', window.location.origin);
        u.searchParams.set('env', nextEnv);
        u.searchParams.set('format', 'pretty');
        if (nextConfigId !== 'defaults') u.searchParams.set('configId', nextConfigId);
        const res = await fetch(u.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as ExportPayload;
        setData({ ...next, env: nextEnv });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau');
      }
    });
  }, []);

  useEffect(() => {
    if (env === initial.env && configId === 'defaults') return;
    fetchEnv(env, configId);
  }, [env, configId, initial.env, fetchEnv]);

  const onDownload = useCallback(() => {
    const u = new URL('/api/admin/tracking/gtm/container', window.location.origin);
    u.searchParams.set('env', env);
    u.searchParams.set('format', 'pretty');
    u.searchParams.set('download', 'true');
    if (configId !== 'defaults') u.searchParams.set('configId', configId);
    window.location.assign(u.toString());
  }, [env, configId]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier dans le presse-papier');
    }
  }, [data.pretty]);

  // Raccourcis clavier — Cmd+S pour télécharger, Cmd+Shift+C pour copier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        onDownload();
      } else if (e.key.toLowerCase() === 'c' && e.shiftKey) {
        e.preventDefault();
        void onCopy();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDownload, onCopy]);

  const badge = envBadge(env);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.classes}`}
          >
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {badge.label}
          </span>
          <p className="text-xs text-stone-500">
            Le conteneur reflète l'état du catalogue d'événements à la
            génération. Re-génère via la sélection ci-dessous.
          </p>
        </div>
        {pending ? (
          <span className="text-xs text-stone-500" role="status" aria-live="polite">
            génération en cours…
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <GtmEnvTabs value={env} onChange={setEnv} disabled={pending} />
        {configs.length > 0 ? (
          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
              Configuration
            </span>
            <select
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
              disabled={pending}
              className="mt-1 block rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
            >
              <option value="defaults">Defaults (sans config)</option>
              {activeConfigId ? (
                <option value="active">
                  Active ({configs.find((c) => c.id === activeConfigId)?.name ?? activeConfigId.slice(0, 6)})
                </option>
              ) : null}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <GtmStatsGrid stats={data.stats} loading={pending} />
      <GtmMetaInfo meta={data.meta} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconDownload className="h-4 w-4" />
          Télécharger .json
          <kbd className="ml-1 rounded border border-stone-700/60 bg-stone-800 px-1 font-mono text-[10px] text-stone-300">
            ⌘S
          </kbd>
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 shadow-sm transition-colors duration-150 hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? (
            <span className="motion-safe:animate-[fg-pop-in_220ms_ease-out_both] inline-flex items-center gap-2 text-[#4F6B4D]">
              <IconCheck className="h-4 w-4" />
              Copié
            </span>
          ) : (
            <>
              <IconCopy className="h-4 w-4" />
              Copier le JSON
            </>
          )}
        </button>
        <span className="visually-hidden" aria-live="polite">
          {copied ? 'Container JSON copié dans le presse-papier' : ''}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="motion-safe:animate-[fg-fade-in_180ms_ease-out_both] flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900"
        >
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div className="flex-1">
            <p className="font-medium">Échec du chargement</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchEnv(env, configId)}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <GtmJsonPreview
        json={data.pretty}
        onRequestFullscreen={() => setFullscreen(true)}
      />

      <GtmHelpSteps />

      <GtmFullscreenPreview
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={`container.${env}.json`}
      >
        <div className="h-full p-4">
          <GtmJsonPreview json={data.pretty} fullHeight />
        </div>
      </GtmFullscreenPreview>
    </div>
  );
}
