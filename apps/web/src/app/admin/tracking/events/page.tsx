import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { listEventDefinitions } from '@/lib/db/queries/tracking/event-definitions';
import { ensureEventDefinitionsSeeded } from '@/lib/tracking/seed-events';
import { ReseedEventsButton } from '@/components/admin/tracking/ReseedEventsButton';

export const dynamic = 'force-dynamic';

export default async function TrackingEventsPage() {
  const session = await requireAdmin('/admin/tracking/events');
  // Seed lazy : si la base est vide (premier déploiement, environnement
  // mémoire fraîchement bootté…), on injecte automatiquement le catalogue
  // FemiGlow pour que l'écran ne reste jamais vide.
  await ensureEventDefinitionsSeeded();
  const definitions = await listEventDefinitions();
  const grouped = new Map<string, typeof definitions>();
  for (const d of definitions) {
    const arr = grouped.get(d.category) ?? [];
    arr.push(d);
    grouped.set(d.category, arr);
  }
  const categories = Array.from(grouped.keys()).sort();

  return (
    <TrackingShell
      adminEmail={session.email}
      active="events"
      title="Catalogue d’événements"
      description="Référentiel des events suivis (taxonomie GA4 + custom)."
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-stone-600">
          {definitions.length} événement{definitions.length > 1 ? 's' : ''} en
          base. Le catalogue se synchronise automatiquement à la première
          visite ; utiliser « Re-seed » pour forcer la mise à jour après une
          modification du code.
        </p>
        <ReseedEventsButton />
      </div>
      {definitions.length === 0 ? (
        <p className="text-sm text-stone-500">
          Aucun événement défini. Le seed automatique a échoué — utilise
          le bouton « Re-seed » ci-dessus ou lance{' '}
          <code className="font-mono text-xs">pnpm --filter @femiglow/web seed:tracking</code>.
        </p>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="mb-8">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
              {cat}
            </h2>
            <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Scope</th>
                    <th className="px-3 py-2 font-medium">Conv.</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Providers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(grouped.get(cat) ?? []).map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-stone-900">
                        {d.name}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-600">{d.scope}</td>
                      <td className="px-3 py-2 text-xs">
                        {d.isConversion ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            oui
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-stone-700">{d.description}</td>
                      <td className="px-3 py-2 text-xs text-stone-600">
                        {(d.defaultProviders ?? []).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </TrackingShell>
  );
}
