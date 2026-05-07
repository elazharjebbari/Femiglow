import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { WebhookCreateForm } from '@/components/admin/WebhookCreateForm';

export const dynamic = 'force-dynamic';

export default async function AdminWebhookNewPage() {
  const session = await requireAdmin('/admin/webhooks/new');
  return (
    <AdminShell adminEmail={session.email} active="webhooks">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Nouvel endpoint
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          L'URL doit être en HTTPS. Le secret HMAC sera affiché une seule fois.
        </p>
      </header>
      <WebhookCreateForm />
    </AdminShell>
  );
}
