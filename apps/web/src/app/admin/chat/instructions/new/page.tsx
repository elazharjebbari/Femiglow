/**
 * CHA-109 — Création d'une nouvelle version d'instruction (FR + AR + AR-MA).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { ImportFromFileButton } from '@/components/admin/chat/ImportFromFileButton';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function NewInstructionPage() {
  const session = await requireAdmin('/admin/chat/instructions/new');
  const active = await instructionRepo.active('default').catch(() => null);

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="instructions" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Nouvelle instruction</h1>
        <p className="mt-1 text-sm text-stone-600">
          Créer une nouvelle version. La précédente reste active jusqu'à
          activation manuelle de celle-ci.
        </p>
      </header>

      <form
        method="post"
        action="/api/admin/chat/instructions"
        className="space-y-4 rounded-md border border-stone-200 bg-white p-6"
      >
        <input type="hidden" name="scope" value="default" />
        <Field name="body" label="Corps FR (50–20 000 chars)">
          <textarea
            id="body"
            name="body"
            required
            minLength={50}
            maxLength={20000}
            defaultValue={active?.body ?? ''}
            rows={10}
            className="w-full rounded-md border border-stone-300 p-2 text-sm font-mono"
          />
          <div className="mt-2">
            <ImportFromFileButton targetId="body" label="Importer FR depuis un fichier" />
          </div>
        </Field>
        <Field name="bodyAr" label="Corps AR (optionnel, RTL)">
          <textarea
            id="bodyAr"
            name="bodyAr"
            dir="rtl"
            defaultValue={active?.bodyAr ?? ''}
            rows={6}
            className="w-full rounded-md border border-stone-300 p-2 text-sm font-mono"
          />
          <div className="mt-2">
            <ImportFromFileButton targetId="bodyAr" label="Importer AR depuis un fichier" />
          </div>
        </Field>
        <Field name="bodyArMa" label="Corps Darija (optionnel, latinisé)">
          <textarea
            id="bodyArMa"
            name="bodyArMa"
            defaultValue={active?.bodyArMa ?? ''}
            rows={6}
            className="w-full rounded-md border border-stone-300 p-2 text-sm font-mono"
          />
          <div className="mt-2">
            <ImportFromFileButton targetId="bodyArMa" label="Importer Darija depuis un fichier" />
          </div>
        </Field>
        <Field name="notes" label="Notes éditoriales">
          <input
            type="text"
            name="notes"
            maxLength={500}
            className="w-full rounded-md border border-stone-300 p-2 text-sm"
          />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Créer
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

function Field({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}
