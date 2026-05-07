/**
 * /admin/audit?resource=componentField — vue cross-composant des events
 * d'audit pour le domaine Components-CMS (P11).
 *
 * v1 : on filtre par `resourceType = 'component_field_binding'` (le type
 * standardisé par `auditFieldChange`). Les colonnes affichées :
 *   - timestamp, action, acteur, composant/champ (parsés depuis meta),
 *     resourceId (binding ID).
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listAuditEventsByResourceType } from '@/lib/audit/list-events';

export const dynamic = 'force-dynamic';

const TZ = 'Europe/Paris';

const RESOURCE_TYPES: Record<string, { type: string; label: string }> = {
  componentField: { type: 'component_field_binding', label: 'Champs de composants' },
  media: { type: 'media', label: 'Médias' },
  componentMediaBinding: {
    type: 'component_media_binding',
    label: 'Bindings médias',
  },
};

function formatParis(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(d);
}

interface PageProps {
  searchParams?: { resource?: string };
}

export default async function AuditPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/audit');
  const resourceKey = searchParams?.resource ?? 'componentField';
  const cfg = RESOURCE_TYPES[resourceKey] ?? RESOURCE_TYPES.componentField!;
  const events = await listAuditEventsByResourceType(cfg.type, 200);

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Audit · {cfg.label}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {events.length} événement{events.length > 1 ? 's' : ''} récents — fuseau{' '}
          <code className="font-mono">Europe/Paris</code>.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(RESOURCE_TYPES).map(([key, c]) => {
            const active = key === resourceKey;
            return (
              <Link
                key={key}
                href={`/admin/audit?resource=${key}`}
                className={`rounded-full px-3 py-1 ${
                  active
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {c.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
          Aucun événement pour ce type de ressource.
        </p>
      ) : (
        <table className="w-full table-auto border-collapse text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="px-3 py-2">Quand</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Acteur</th>
              <th scope="col" className="px-3 py-2">Cible</th>
              <th scope="col" className="px-3 py-2">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {events.map((e) => {
              const meta = (e.meta ?? {}) as Record<string, unknown>;
              const componentKey =
                typeof meta.componentKey === 'string' ? meta.componentKey : null;
              const fieldKey = typeof meta.fieldKey === 'string' ? meta.fieldKey : null;
              return (
                <tr key={e.id} data-action={e.action}>
                  <td className="px-3 py-2 align-top">
                    <time dateTime={e.createdAt.toISOString()} className="text-xs tabular-nums text-stone-700">
                      {formatParis(e.createdAt)}
                    </time>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className="font-mono text-xs text-stone-700">
                      {e.action}
                    </code>
                  </td>
                  <td className="px-3 py-2 align-top text-stone-600">
                    {e.actorId ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {componentKey && fieldKey ? (
                      <Link
                        href={`/admin/components/${componentKey}/fields/${fieldKey}/history`}
                        className="text-stone-900 hover:underline"
                      >
                        {componentKey}.{fieldKey}
                      </Link>
                    ) : (
                      <code className="font-mono text-xs text-stone-500">
                        {e.resourceId ?? '—'}
                      </code>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <details>
                      <summary className="cursor-pointer text-xs text-stone-500">
                        meta
                      </summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-words text-xs text-stone-700">
                        {JSON.stringify(meta, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
