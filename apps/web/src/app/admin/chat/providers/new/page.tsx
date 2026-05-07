/**
 * CHA-115 — Formulaire de création d'un provider chat (OpenAI, etc.).
 *
 * La page reste un Server Component (auth + feature flag) qui monte le
 * `<ProviderForm>` client (auto-completion des modèles via fetch).
 * Form-encoded → POST /api/admin/chat/providers → redirect 303.
 * La clé API est chiffrée AES-256-GCM côté serveur.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { ProviderForm } from '@/components/admin/chat/ProviderForm';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function NewProviderPage() {
  const session = await requireAdmin('/admin/chat/providers/new');
  const enabled = isChatEnabled();

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="providers" />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Nouveau provider
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Ajouter une clé API LLM. La clé est chiffrée AES-256-GCM avant
          stockage et n'est jamais renvoyée par le GET. Les modèles
          disponibles sont auto-complétés à partir de l'API du provider dès
          que la clé est saisie.
        </p>
      </header>

      <ProviderForm chatEnabled={enabled} />
    </AdminShell>
  );
}
