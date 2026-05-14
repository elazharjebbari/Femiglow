/**
 * CHA-303 — Nouvelle FAQ. Server Component qui monte `<FaqForm>` côté
 * client. La création POSTe vers `/api/admin/chat/faq` et embed la
 * question canonique côté serveur.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { FaqForm } from '@/components/admin/chat/FaqForm';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function NewFaqPage() {
  const session = await requireAdmin('/admin/chat/faq/new');
  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="faq" />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Nouvelle FAQ
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          La question canonique est embeddée à la création — provider
          embedding requis (OpenAI). Une fois enregistrée, l'entrée
          participe à la cascade L3 si le seuil de match est atteint.
        </p>
      </header>
      <FaqForm />
    </AdminShell>
  );
}
