import { LayoutGrid } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Button } from '@/components/admin/content-studio-v2/primitives';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await requireAdmin('/admin/content-studio-v2/library');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <EmptyState
        eyebrow="Bibliothèque"
        illustration={<LayoutGrid size={28} />}
        title="La bibliothèque arrive en Phase 4"
        description="Grid de vignettes (4-col desktop), filtres URL-synced (statut, plateforme, pilier, date), recherche debounced, et bulk actions (approuver / programmer / archiver)."
        actions={<Button disabled>Filtrer (Phase 4)</Button>}
      />
    </AppShell>
  );
}
