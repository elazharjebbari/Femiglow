import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listMedia } from '@/lib/db/queries/media';
import { hammingDistance } from '@/lib/media/pipeline/phash';

export const dynamic = 'force-dynamic';

interface Cluster {
  reference: { id: string; slug: string };
  matches: Array<{ id: string; slug: string; distance: number }>;
}

const SIMILARITY_THRESHOLD = 6;

function buildClusters(rows: Array<{ id: string; slug: string; phash: string | null }>): Cluster[] {
  const clusters: Cluster[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (!a || !a.phash || seen.has(a.id)) continue;
    const cluster: Cluster = { reference: { id: a.id, slug: a.slug }, matches: [] };
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (!b || !b.phash || seen.has(b.id)) continue;
      const d = hammingDistance(a.phash, b.phash);
      if (d <= SIMILARITY_THRESHOLD) {
        cluster.matches.push({ id: b.id, slug: b.slug, distance: d });
        seen.add(b.id);
      }
    }
    if (cluster.matches.length > 0) {
      clusters.push(cluster);
      seen.add(a.id);
    }
  }
  return clusters;
}

export default async function MediaDuplicatesPage() {
  const session = await requireAdmin('/admin/media/duplicates');
  const { rows } = await listMedia({ limit: 100, kind: 'image' });
  const clusters = buildClusters(
    rows.map((r) => ({ id: r.id, slug: r.slug, phash: r.phash })),
  );

  return (
    <AdminShell adminEmail={session.email} active="media">
      <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-stone-500">
        <Link href="/admin/media" className="hover:underline">
          Médias
        </Link>{' '}
        <span aria-hidden="true">/</span> Doublons
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Doublons potentiels
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Détection par hash perceptuel (distance ≤ {SIMILARITY_THRESHOLD}).
        </p>
      </header>
      {clusters.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun doublon détecté.
        </p>
      ) : (
        <ul role="list" className="space-y-4">
          {clusters.map((c) => (
            <li
              key={c.reference.id}
              className="rounded-md border border-stone-200 bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-stone-900">
                <Link href={`/admin/media/${c.reference.id}`} className="hover:underline">
                  {c.reference.slug}
                </Link>
              </h2>
              <ul role="list" className="mt-2 space-y-1 text-sm">
                {c.matches.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/media/${m.id}`} className="text-stone-700 hover:underline">
                      {m.slug}
                    </Link>{' '}
                    <span className="text-xs text-stone-500">distance {m.distance}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
