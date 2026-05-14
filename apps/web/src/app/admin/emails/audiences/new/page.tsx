/**
 * /admin/emails/audiences/new — Wizard de création (M5.3.9).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AudienceWizard } from '@/components/admin/emails/audiences/AudienceWizard';

export const dynamic = 'force-dynamic';

export default async function NewAudiencePage() {
  const session = await requireAdmin('/admin/emails/audiences/new');

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Nouvelle audience
          </h1>
        </div>
        <Link href="/admin/emails/audiences" className="text-sm text-stone-500 underline">
          ← Liste
        </Link>
      </header>

      <AudienceWizard />
    </AdminShell>
  );
}
