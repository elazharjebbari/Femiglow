/**
 * /admin/analytics/live — Onglet Live.
 * cf. docs/analytics/05-onglets-specs.md §2
 *
 * RSC qui pré-charge un snapshot initial (zero-flicker), puis remet la main
 * au LiveDashboard client qui se branche sur SSE / polling.
 */
import { LiveDashboard } from '@/components/admin/analytics/live';
import { readLiveSnapshot } from '@/lib/analytics/queries/live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalyticsLivePage() {
  // Le snapshot initial est utile en SSR : la page n'est plus vide pendant la
  // phase de connexion SSE (souvent 50-200 ms).
  let initialSnapshot = null;
  try {
    initialSnapshot = await readLiveSnapshot({ window: '1h' });
  } catch {
    // En cas de souci côté DB, le client lui-même tentera la connexion live.
    initialSnapshot = null;
  }

  return (
    <LiveDashboard initialSnapshot={initialSnapshot} initialWindow="1h" />
  );
}
