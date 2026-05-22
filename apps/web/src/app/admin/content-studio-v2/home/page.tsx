import Link from 'next/link';
import { Activity, Sparkles, LayoutGrid, CalendarDays } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Button } from '@/components/admin/content-studio-v2/primitives';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await requireAdmin('/admin/content-studio-v2/home');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  const enabled = env.CONTENT_STUDIO_V2_ENABLED === 'true';

  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      {!enabled ? (
        <EmptyState
          eyebrow="Studio v2"
          title="Module désactivé"
          description={<>Activez <code style={{ fontFamily: 'var(--cs-font-mono)' }}>CONTENT_STUDIO_V2_ENABLED=true</code> pour utiliser cette interface.</>}
        />
      ) : (
        <EmptyState
          eyebrow="Accueil"
          illustration={<Activity size={28} />}
          title="Le tableau de bord arrivera en Phase 6"
          description="Cette zone hébergera les KPIs (posts cette semaine, taux de succès jobs, brouillons en attente, coût IA) et les raccourcis vers les autres modes. En attendant, attaque par la Création."
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
      )}
    </AppShell>
  );
}
