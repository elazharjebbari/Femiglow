/**
 * /admin/components/scheduled — dashboard des champs programmés.
 *
 * Liste tous les bindings `status = 'scheduled'` triés par date prévue,
 * avec lien vers le composant + indicateur "en retard" si le cron a
 * raté un tick (`scheduledAt < now`).
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P10.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listAllScheduled } from '@/lib/db/queries/component-fields';
import { getSiteComponentById } from '@/lib/db/queries/site-components';

export const dynamic = 'force-dynamic';

const TZ = 'Europe/Paris';

function formatParis(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function relativeFrom(d: Date, now: Date): string {
  const diffMs = d.getTime() - now.getTime();
  const sign = diffMs >= 0 ? 'dans' : 'il y a';
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60_000);
  if (min < 60) return `${sign} ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 48) return `${sign} ${hours} h`;
  const days = Math.round(hours / 24);
  return `${sign} ${days} j`;
}

export default async function ScheduledFieldsPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/components/scheduled');
  const items = await listAllScheduled(200);
  const now = new Date();

  // Résolution des componentKey/labels en parallèle.
  const enriched = await Promise.all(
    items.map(async (b) => {
      const cmp = await getSiteComponentById(b.componentId);
      const fieldDef = cmp?.fields?.find((f) => f.key === b.fieldKey);
      return {
        binding: b,
        componentKey: cmp?.key ?? '',
        componentName: cmp?.name ?? '?',
        fieldLabel: fieldDef?.label ?? b.fieldKey,
        scheduledAt: b.scheduledAt ?? null,
      };
    }),
  );

  const lateCount = enriched.filter(
    (e) => e.scheduledAt && e.scheduledAt < now,
  ).length;

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <nav aria-label="Fil d'Ariane" className="mb-2 text-xs text-stone-500">
          <Link href="/admin/components" className="hover:text-stone-900">
            ← Composants
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Publications programmées
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {enriched.length === 0 ? (
            <>Aucune publication programmée.</>
          ) : (
            <>
              {enriched.length} publication{enriched.length === 1 ? '' : 's'} en
              attente — fuseau <code className="font-mono">Europe/Paris</code>.
              {lateCount > 0 ? (
                <span className="ml-2 inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                  {lateCount} en retard
                </span>
              ) : null}
            </>
          )}
        </p>
      </header>

      {enriched.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
          Quand vous programmez un brouillon, il apparaîtra ici jusqu'à
          sa publication.
        </p>
      ) : (
        <table className="w-full table-auto border-collapse text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="px-3 py-2">Composant</th>
              <th scope="col" className="px-3 py-2">Champ</th>
              <th scope="col" className="px-3 py-2">Locale</th>
              <th scope="col" className="px-3 py-2">Programmé pour</th>
              <th scope="col" className="px-3 py-2">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {enriched.map((e) => {
              const late = e.scheduledAt && e.scheduledAt < now;
              return (
                <tr key={e.binding.id}>
                  <td className="px-3 py-2 align-top">
                    {e.componentKey ? (
                      <Link
                        href={`/admin/components/${e.componentKey}`}
                        className="text-stone-900 hover:underline"
                      >
                        {e.componentName}
                      </Link>
                    ) : (
                      <span>{e.componentName}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className="font-mono text-xs text-stone-700">
                      {e.fieldLabel}
                    </code>
                  </td>
                  <td className="px-3 py-2 align-top text-stone-600">
                    {e.binding.locale}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {e.scheduledAt ? (
                      <>
                        {formatParis(e.scheduledAt)}{' '}
                        <span className="text-xs text-stone-500">
                          ({relativeFrom(e.scheduledAt, now)})
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {late ? (
                      <span className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        En retard
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        À venir
                      </span>
                    )}
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
