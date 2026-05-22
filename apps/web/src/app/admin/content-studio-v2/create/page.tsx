import { Sparkles } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Button } from '@/components/admin/content-studio-v2/primitives';

export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  const session = await requireAdmin('/admin/content-studio-v2/create');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <EmptyState
        eyebrow="Création"
        illustration={<Sparkles size={28} />}
        title="L'éditeur arrive en Phase 3"
        description="Cette page abritera le stepper Cadrer → Générer → Visuel → Valider, les 3 variants à comparer, le studio média avec upload + cropping + génération IA, et la preview multi-plateforme."
        actions={<Button disabled>Nouvelle idée (Phase 3)</Button>}
      />
    </AppShell>
  );
}
