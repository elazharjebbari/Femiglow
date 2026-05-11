import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getAdminRitualById,
  listAuditEntries,
} from '@/lib/db/queries/rituals-admin';
import { RitualActionsClient } from '@/components/admin/rituals/RitualActionsClient';

export const dynamic = 'force-dynamic';

export default async function AdminRitualDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/rituals/${params.id}`);
  const ritual = await getAdminRitualById(params.id);
  if (!ritual) notFound();

  const audit = await listAuditEntries(ritual.id);

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Rituel — {ritual.publicSlug}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {ritual.status} · {ritual.source} ·{' '}
          {new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(ritual.createdAt)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section
          aria-labelledby="ritual-preview-title"
          className="space-y-4 rounded border border-stone-200 bg-white p-6"
        >
          <h2 id="ritual-preview-title" className="text-sm font-medium text-stone-700">
            Preview
          </h2>
          <blockquote className="font-serif text-lg italic leading-relaxed text-stone-900">
            « {ritual.body} »
          </blockquote>
          <p className="text-sm text-stone-600">
            — {ritual.authorFirstName ?? 'Une initiée'}
            {ritual.authorCity ? `, ${ritual.authorCity}` : ''}
            {ritual.initiatedSince && (
              <span> · Initiée depuis {ritual.initiatedSince}</span>
            )}
          </p>
          {ritual.ritualTags.length > 0 && (
            <p className="text-xs text-emerald-800">
              Tags : {ritual.ritualTags.join(' · ')}
            </p>
          )}
          {ritual.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {ritual.photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="space-y-1"
                  data-testid="admin-ritual-photo"
                >
                  <div
                    className={`relative aspect-square border ${
                      photo.facesStatus === 'REJECTED_FACE'
                        ? 'border-rose-500'
                        : photo.facesStatus === 'MANUAL_REVIEW'
                          ? 'border-amber-500'
                          : 'border-stone-200'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.alt ?? `Photo ${photo.position}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="text-xs text-stone-600">
                    {photo.facesStatus === 'OK' && 'Photo OK'}
                    {photo.facesStatus === 'MANUAL_REVIEW' &&
                      `Relecture humaine (${photo.facesCount} visage(s))`}
                    {photo.facesStatus === 'REJECTED_FACE' &&
                      `Visage frontal détecté`}
                    {photo.facesStatus === 'PENDING_CHECK' && 'Vérification en cours…'}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <RitualActionsClient
            id={ritual.id}
            status={ritual.status}
            featured={ritual.featured}
          />

          <section
            aria-labelledby="ritual-meta-title"
            className="rounded border border-stone-200 bg-white p-4"
          >
            <h2 id="ritual-meta-title" className="mb-2 text-sm font-medium text-stone-700">
              Métadonnées
            </h2>
            <dl className="space-y-1 text-xs text-stone-600">
              <div>
                <dt className="inline font-medium">Auto-flags : </dt>
                <dd className="inline">
                  {ritual.autoFlags.length === 0 ? 'aucun' : ritual.autoFlags.join(', ')}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Vérifiée : </dt>
                <dd className="inline">{ritual.verifiedPurchase ? 'oui' : 'non'}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Featured : </dt>
                <dd className="inline">{ritual.featured ? 'oui' : 'non'}</dd>
              </div>
              {ritual.moderationNote && (
                <div>
                  <dt className="inline font-medium">Note : </dt>
                  <dd className="inline">{ritual.moderationNote}</dd>
                </div>
              )}
            </dl>
          </section>

          <section
            aria-labelledby="ritual-audit-title"
            className="rounded border border-stone-200 bg-white p-4"
          >
            <h2
              id="ritual-audit-title"
              className="mb-2 text-sm font-medium text-stone-700"
            >
              Journal d'audit
            </h2>
            {audit.length === 0 ? (
              <p className="text-xs text-stone-500">Aucune action enregistrée.</p>
            ) : (
              <ol className="space-y-2 text-xs">
                {audit.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-stone-300 pl-2">
                    <p className="font-medium text-stone-700">{entry.action}</p>
                    <p className="text-stone-500">
                      {entry.actorId ?? 'système'} ·{' '}
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(entry.createdAt)}
                    </p>
                    {entry.note && <p className="mt-1 text-stone-600">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
