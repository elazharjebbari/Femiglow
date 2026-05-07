'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { GraphDescriptor } from '@/lib/tracking/gtm/viz/descriptor';
import { GtmEnvTabs, envBadge, type GtmEnv } from './GtmEnvTabs';
import { GtmGraphCanvas } from './GtmGraphCanvas';
import { GtmFullscreenPreview } from './GtmFullscreenPreview';
import { IconCopy, IconCheck, IconDownload, IconExpand, IconAlert } from './GtmIcons';
import type { ConfigVersionSummary } from './GtmConfigVersionList';

interface Props {
  initialDescriptor: GraphDescriptor;
  initialEnv: GtmEnv;
  configs: ConfigVersionSummary[];
  activeConfigId: string | null;
}

interface VizPayload {
  descriptor: GraphDescriptor;
  env: GtmEnv;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export function GtmVisualizationClient({
  initialDescriptor,
  initialEnv,
  configs,
  activeConfigId,
}: Props) {
  const [env, setEnv] = useState<GtmEnv>(initialEnv);
  const [configId, setConfigId] = useState<string>('defaults');
  const [data, setData] = useState<VizPayload>({
    descriptor: initialDescriptor,
    env: initialEnv,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const fetchViz = useCallback((nextEnv: GtmEnv, nextConfigId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const u = new URL('/api/admin/tracking/gtm/visualization', window.location.origin);
        u.searchParams.set('env', nextEnv);
        u.searchParams.set('format', 'json');
        if (nextConfigId !== 'defaults') u.searchParams.set('configId', nextConfigId);
        const res = await fetch(u.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { descriptor: GraphDescriptor; env: GtmEnv };
        setData({ descriptor: body.descriptor, env: nextEnv });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }, []);

  useEffect(() => {
    if (env === initialEnv && configId === 'defaults') return;
    fetchViz(env, configId);
  }, [env, configId, initialEnv, fetchViz]);

  const onDownloadSvg = useCallback(() => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-viz-${env}-${TODAY()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [env]);

  const onDownloadPng = useCallback(async () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      const loaded = new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('img-load-failed'));
      });
      img.src = url;
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(svgRef.current.clientWidth || 1280, 4096);
      canvas.height = Math.min(svgRef.current.clientHeight || 800, 4096);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-2d-unavailable');
      ctx.fillStyle = '#FBF8F1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob-null'))), 'image/png'),
      );
      const dl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dl;
      a.download = `gtm-viz-${env}-${TODAY()}.png`;
      a.click();
      URL.revokeObjectURL(dl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'png-export-failed');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [env]);

  const onCopyMermaid = useCallback(async () => {
    try {
      const u = new URL('/api/admin/tracking/gtm/visualization', window.location.origin);
      u.searchParams.set('env', env);
      u.searchParams.set('format', 'mermaid');
      if (configId !== 'defaults') u.searchParams.set('configId', configId);
      const res = await fetch(u.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedMermaid(true);
      setTimeout(() => setCopiedMermaid(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'mermaid-copy-failed');
    }
  }, [env, configId]);

  const badge = envBadge(env);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.classes}`}
          >
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {badge.label}
          </span>
          <p className="text-xs text-stone-500">
            Représentation des dossiers, tags et triggers du conteneur courant.
          </p>
        </div>
        {pending ? (
          <span className="text-xs text-stone-500" role="status">
            génération…
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <GtmEnvTabs value={env} onChange={setEnv} disabled={pending} />
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
            {activeConfigId ? <option value="active">Active ({configs.find((c) => c.id === activeConfigId)?.name ?? activeConfigId.slice(0, 6)})</option> : null}
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownloadSvg}
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          <IconDownload className="h-3.5 w-3.5" />
          SVG
        </button>
        <button
          type="button"
          onClick={onDownloadPng}
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          <IconDownload className="h-3.5 w-3.5" />
          PNG
        </button>
        <button
          type="button"
          onClick={onCopyMermaid}
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          {copiedMermaid ? (
            <>
              <IconCheck className="h-3.5 w-3.5 text-[#4F6B4D]" />
              Mermaid copié
            </>
          ) : (
            <>
              <IconCopy className="h-3.5 w-3.5" />
              Mermaid
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          <IconExpand className="h-3.5 w-3.5" />
          Plein écran
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      ) : null}

      <GtmGraphCanvas ref={svgRef} descriptor={data.descriptor} />

      <GtmFullscreenPreview
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={`Visualisation — ${env}`}
      >
        <div className="h-full p-4">
          <GtmGraphCanvas descriptor={data.descriptor} fullHeight />
        </div>
      </GtmFullscreenPreview>
    </div>
  );
}
