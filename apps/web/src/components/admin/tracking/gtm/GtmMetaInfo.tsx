'use client';

import { useState } from 'react';
import type { GtmMeta } from '@/lib/tracking/gtm/exporter';
import { IconCopy, IconCheck } from './GtmIcons';

interface Props {
  meta: GtmMeta;
  onCopySha?: (sha: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return 'à l’instant';
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `il y a ${hour} h`;
  const day = Math.round(hour / 24);
  return `il y a ${day} j`;
}

export function GtmMetaInfo({ meta, onCopySha }: Props) {
  const [copied, setCopied] = useState(false);

  async function copySha() {
    try {
      await navigator.clipboard.writeText(meta.sha256);
      setCopied(true);
      onCopySha?.(meta.sha256);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* silencieux : pas de presse-papier */
    }
  }

  const items = [
    { label: 'Taille', value: formatBytes(meta.sizeBytes), tone: 'plain' as const },
    {
      label: 'Lignes',
      value: meta.lineCount.toLocaleString('fr-FR'),
      tone: 'plain' as const,
    },
    { label: 'Version', value: meta.version, tone: 'plain' as const },
  ];

  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-xs">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2">
          <dt className="uppercase tracking-wide text-stone-500">{it.label}</dt>
          <dd className="font-mono text-stone-900">{it.value}</dd>
        </div>
      ))}

      <div className="flex items-baseline gap-2">
        <dt className="uppercase tracking-wide text-stone-500">Généré</dt>
        <dd
          className="text-stone-700"
          title={new Date(meta.generatedAt).toLocaleString('fr-FR')}
        >
          {formatRelative(meta.generatedAt)}
        </dd>
      </div>

      <div className="flex items-baseline gap-2">
        <dt className="uppercase tracking-wide text-stone-500">SHA-256</dt>
        <dd>
          <button
            type="button"
            onClick={copySha}
            title={`${meta.sha256} — clic pour copier`}
            aria-label="Copier le SHA-256 complet"
            className="group inline-flex items-center gap-1 rounded font-mono text-[#7A6940] transition-colors duration-150 hover:bg-[#C8A876]/15 hover:text-[#5C4F2E] focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            <span>{copied ? meta.sha256.slice(0, 12) + '…' : meta.sha256.slice(0, 12) + '…'}</span>
            <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center text-stone-400 group-hover:text-stone-700">
              {copied ? <IconCheck className="h-3.5 w-3.5 text-[#4F6B4D]" /> : <IconCopy className="h-3.5 w-3.5" />}
            </span>
          </button>
          <span className="visually-hidden" aria-live="polite">
            {copied ? 'SHA-256 copié dans le presse-papier' : ''}
          </span>
        </dd>
      </div>
    </dl>
  );
}
