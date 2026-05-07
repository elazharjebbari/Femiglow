import type { GtmMeta } from '@/lib/tracking/gtm/exporter';

interface Props {
  meta: GtmMeta;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function GtmMetaInfo({ meta }: Props) {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Taille', value: formatBytes(meta.sizeBytes) },
    { label: 'Lignes', value: meta.lineCount.toLocaleString('fr-FR') },
    { label: 'Version', value: meta.version },
    { label: 'Généré le', value: new Date(meta.generatedAt).toLocaleString('fr-FR') },
    { label: 'SHA-256', value: meta.sha256.slice(0, 12) + '…' },
  ];
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-600">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2">
          <dt className="uppercase tracking-wide text-stone-500">{it.label}</dt>
          <dd className="font-mono text-stone-900" title={it.label === 'SHA-256' ? meta.sha256 : undefined}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
