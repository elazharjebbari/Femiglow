import Link from 'next/link';
import type { ConfigMeta } from '@/lib/admin-config/types';

interface SectionCardProps {
  href: string;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  meta: ConfigMeta;
}

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t === 0) return '—';
  const diff = Date.now() - t;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

export function SectionCard({
  href,
  title,
  description,
  count,
  countLabel,
  meta,
}: SectionCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-md border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold tracking-tight text-stone-900">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            meta.isDefault
              ? 'bg-stone-100 text-stone-600'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {meta.isDefault ? 'Valeur défaut' : 'Modifié'}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-600">{description}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-stone-900">{count}</span>
        <span className="text-xs uppercase tracking-wide text-stone-500">{countLabel}</span>
      </div>
      <p className="mt-4 text-xs text-stone-500">
        {meta.isDefault
          ? 'Aucune modification.'
          : `Modifié ${relativeTime(meta.updatedAt)}${
              meta.updatedBy ? ` · ${meta.updatedBy.email}` : ''
            }`}
      </p>
    </Link>
  );
}
