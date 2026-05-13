import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResetWizard } from '@/components/admin/settings/reset/ResetWizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset — Console FemiGlow' };

export default async function AdminResetPage() {
  const session = await requireAdmin('/admin/settings/reset');
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Reset de l&apos;environnement
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Ramène la base, les médias et le cache à un état canonique. Wizard
          guidé, backup auto, rollback intégré.
        </p>
      </header>
      <ResetWizard />
    </AdminShell>
  );
}
