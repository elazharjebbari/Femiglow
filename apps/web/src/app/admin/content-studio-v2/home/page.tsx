import Link from 'next/link';
import { Activity, Sparkles, LayoutGrid, CalendarDays } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { buildDashboardSnapshot } from '@/lib/content-studio/dashboard';
import { listRecentAuditEvents } from '@/lib/audit/list-events';
import { listRecentBrandReviews } from '@/lib/content-studio/repository';
import {
  HomeClient,
  computeRecentActivity,
  computeBrandHealth,
} from '@/components/admin/content-studio-v2/home';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await requireAdmin('/admin/content-studio-v2/home');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  const enabled = env.CONTENT_STUDIO_V2_ENABLED === 'true';

  if (!enabled) {
    return (
      <AppShell userEmail={session.email} userInitials={initials}>
        <EmptyState
          eyebrow="Studio v2"
          illustration={<Activity size={28} />}
          title="Module désactivé"
          description={
            <>
              Activez <code style={{ fontFamily: 'var(--cs-font-mono)' }}>CONTENT_STUDIO_V2_ENABLED=true</code> pour utiliser cette interface.
            </>
          }
          actions={
            <>
              <Link href="/admin/content-studio-v2/create" style={{ textDecoration: 'none' }}>
                <Button leftIcon={<Sparkles size={14} />}>Créer un post</Button>
              </Link>
              <Link href="/admin/content-studio-v2/library" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" leftIcon={<LayoutGrid size={14} />}>Bibliothèque</Button>
              </Link>
              <Link href="/admin/content-studio-v2/plan" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" leftIcon={<CalendarDays size={14} />}>Planning</Button>
              </Link>
            </>
          }
        />
      </AppShell>
    );
  }

  // Parallelise the three I/O calls — none depend on each other.
  const now = new Date();
  const [snapshot, auditEvents, brandReviews] = await Promise.all([
    buildDashboardSnapshot(now),
    listRecentAuditEvents(10),
    listRecentBrandReviews(200),
  ]);

  const activity = computeRecentActivity(auditEvents, now);
  const brandHealth = computeBrandHealth(brandReviews, now);

  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <HomeClient snapshot={snapshot} activity={activity} brandHealth={brandHealth} />
    </AppShell>
  );
}
