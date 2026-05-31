/**
 * /admin/emails/automation/new — Create automation via wizard.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';
import { NewAutomationPageClient } from './NewAutomationPageClient';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage() {
  const session = await requireAdmin('/admin/emails/automation/new');
  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails/automation" className="text-sm text-stone-500 underline">
          ← Automations
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-stone-800">Nouvelle automation</h1>
      </header>
      <NewAutomationPageClient
        eventsCatalog={AUTOMATION_EVENT_CATALOG as unknown as Array<{
          name: string;
          category: string;
          description: string;
        }>}
      />
    </AdminShell>
  );
}
