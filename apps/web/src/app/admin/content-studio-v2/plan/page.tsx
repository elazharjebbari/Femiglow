import { CalendarDays } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Button } from '@/components/admin/content-studio-v2/primitives';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const session = await requireAdmin('/admin/content-studio-v2/plan');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <EmptyState
        eyebrow="Planning"
        illustration={<CalendarDays size={28} />}
        title="Le calendrier interactif arrive en Phase 5"
        description="Vues semaine / mois / liste, drag-and-drop pour reprogrammer un post (@dnd-kit), drawer édition rapide, queue des jobs en attente / publishing / failed."
        actions={<Button disabled>Voir queue jobs (Phase 5)</Button>}
      />
    </AppShell>
  );
}
