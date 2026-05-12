/**
 * Card form-config pour le hub `/admin/settings` et la liste
 * `/admin/settings/form-config`. Mirror du pattern delivery-cities
 * (inline Link dans settings/page.tsx) — extrait en composant réutilisable
 * pour ne pas dupliquer le markup.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §3
 */
import Link from 'next/link';

interface FormConfigCardProps {
  href: string;
  label: string;
  description: string;
  version: number;
  active: boolean;
  updatedAt: string;
  updatedBy?: string | null;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t === 0) return '—';
  const diff = Date.now() - t;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

export function FormConfigCard({
  href,
  label,
  description,
  version,
  active,
  updatedAt,
  updatedBy,
}: FormConfigCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-md border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold tracking-tight text-stone-900">
          {label}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            active
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-stone-100 text-stone-600'
          }`}
        >
          {active ? `Actif · v${version}` : 'Inactif'}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-600">{description}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-stone-900">
          {version}
        </span>
        <span className="text-xs uppercase tracking-wide text-stone-500">
          version courante
        </span>
      </div>
      <p className="mt-4 text-xs text-stone-500">
        Dernière édition {relativeTime(updatedAt)}
        {updatedBy ? ` · ${updatedBy}` : ''}
      </p>
    </Link>
  );
}
