import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getMediaWithRelations, findMediaBySlug } from '@/lib/db/queries/media';
import { listUsagesForMedia } from '@/lib/db/queries/media-usages';
import { listJobsByMedia } from '@/lib/db/queries/media-jobs';
import { listAuditEventsForResource } from '@/lib/audit/list-events';
import { MediaDetailActions } from '@/components/admin/media/MediaDetailActions';
import { MediaUpdateForm } from '@/components/admin/media/MediaUpdateForm';

export const dynamic = 'force-dynamic';

interface Params {
  id: string;
}

export default async function MediaDetailPage({ params }: { params: Params }) {
  const session = await requireAdmin(`/admin/media/${params.id}`);
  let media = params.id.startsWith('me_')
    ? await getMediaWithRelations(params.id)
    : null;
  if (!media) {
    const bySlug = await findMediaBySlug(params.id);
    if (bySlug) media = await getMediaWithRelations(bySlug.id);
  }
  if (!media) notFound();

  const [usages, jobs, audits] = await Promise.all([
    listUsagesForMedia(media.id),
    listJobsByMedia(media.id),
    listAuditEventsForResource('media', media.id),
  ]);

  const totalSize = media.variants.reduce((s, v) => s + (v.sizeBytes ?? 0), 0);
  const originalSize = media.originalSizeBytes ?? 0;
  const savings =
    originalSize > 0 && totalSize > 0
      ? Math.max(0, Math.round((1 - totalSize / (originalSize * media.variants.length || 1)) * 100))
      : null;

  return (
    <AdminShell adminEmail={session.email} active="media">
      <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-stone-500">
        <Link href="/admin/media" className="hover:underline">
          Médias
        </Link>{' '}
        <span aria-hidden="true">/</span> {media.slug}
      </nav>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{media.slug}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {media.kind} · {media.status} · {media.id}
          </p>
        </div>
        <MediaDetailActions mediaId={media.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="info-title" className="rounded-md border border-stone-200 bg-white p-5">
          <h2 id="info-title" className="text-base font-semibold text-stone-900">
            Métadonnées
          </h2>
          <MediaUpdateForm media={media} />
        </section>

        <section
          aria-labelledby="variants-title"
          className="rounded-md border border-stone-200 bg-white p-5"
        >
          <h2 id="variants-title" className="text-base font-semibold text-stone-900">
            Variantes générées ({media.variants.length})
          </h2>
          {savings !== null && (
            <p className="mt-1 text-xs text-stone-500">
              Économie moyenne ~{savings}% vs original
            </p>
          )}
          {media.variants.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Aucune variante.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-1">Format</th>
                  <th className="py-1">Breakpoint</th>
                  <th className="py-1">Taille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {media.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="py-1.5">{v.format}</td>
                    <td className="py-1.5">{v.breakpoint ?? '—'}</td>
                    <td className="py-1.5">{Math.round((v.sizeBytes ?? 0) / 1024)} kB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="usages-title" className="rounded-md border border-stone-200 bg-white p-5">
          <h2 id="usages-title" className="text-base font-semibold text-stone-900">
            Usages ({usages.length})
          </h2>
          {usages.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              Aucun usage tracé. Le tracking s'active dès que le média est rendu côté serveur.
            </p>
          ) : (
            <ul role="list" className="mt-3 space-y-1 text-sm">
              {usages.map((u) => (
                <li key={u.id} className="text-stone-700">
                  <code className="text-xs">{u.route}</code> · {u.component} ({u.context})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="journal-title" className="rounded-md border border-stone-200 bg-white p-5">
          <h2 id="journal-title" className="text-base font-semibold text-stone-900">
            Journal
          </h2>
          <ol role="list" className="mt-3 space-y-2 text-sm">
            {jobs.slice(0, 10).map((j) => (
              <li key={j.id} className="text-stone-700">
                <span className="text-xs text-stone-500">
                  {j.createdAt.toLocaleString('fr-FR')}
                </span>{' '}
                — job <code className="text-xs">{j.kind}</code> · {j.status}
                {j.errorMessage ? ` — ${j.errorMessage}` : ''}
              </li>
            ))}
            {audits.slice(0, 10).map((a) => (
              <li key={a.id} className="text-stone-700">
                <span className="text-xs text-stone-500">
                  {a.createdAt.toLocaleString('fr-FR')}
                </span>{' '}
                — <code className="text-xs">{a.action}</code>
              </li>
            ))}
            {jobs.length === 0 && audits.length === 0 && (
              <li className="text-sm text-stone-500">Aucune entrée.</li>
            )}
          </ol>
        </section>
      </div>
    </AdminShell>
  );
}
