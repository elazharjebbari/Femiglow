/**
 * CHA-300 — Page admin : création d'une suggestion canned-pair.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { SuggestionForm } from '@/components/admin/chat/SuggestionForm';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function NewSuggestionPage() {
  const session = await requireAdmin('/admin/chat/suggestions/new');
  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="suggestions" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Nouvelle suggestion</h1>
        <p className="text-sm text-stone-600">
          Les 3 traductions sont obligatoires : un visiteur sur la mauvaise
          langue verrait une pill vide.
        </p>
      </header>
      <SuggestionForm />
    </AdminShell>
  );
}
