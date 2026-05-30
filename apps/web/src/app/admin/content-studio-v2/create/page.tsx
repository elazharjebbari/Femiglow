import { requireAdmin } from '@/lib/auth/require-admin';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { CreateWorkspace } from '@/components/admin/content-studio-v2/create/CreateWorkspace';
import { isMediaStudioEnabled } from '@/lib/content-studio/auth';

export const dynamic = 'force-dynamic';

/**
 * Phase 3 — Mode /create.
 *
 * Server Component: handles admin auth then renders the client-side
 * CreateWorkspace which wraps the StudioProvider + 3-column layout.
 *
 * Cf. plan-content-studio-v2-2026-05-22.md §Phase 3.
 */
export default async function CreatePage() {
  const session = await requireAdmin('/admin/content-studio-v2/create');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <CreateWorkspace mediaStudioEnabled={isMediaStudioEnabled()} />
    </AppShell>
  );
}
