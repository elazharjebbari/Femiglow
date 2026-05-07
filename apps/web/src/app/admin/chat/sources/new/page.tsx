/**
 * CHA-113 — Création + ingestion live d'une source RAG.
 *
 * NB : `ImportFromFileButton` permet d'injecter le contenu d'un `.md`/`.txt`
 * dans le textarea `body` sans devoir copier-coller manuellement.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { ImportFromFileButton } from '@/components/admin/chat/ImportFromFileButton';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function NewSourcePage() {
  const session = await requireAdmin('/admin/chat/sources/new');

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="sources" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Nouvelle source</h1>
        <p className="text-sm text-stone-600">
          Markdown / URL / FAQ. L'ingestion split + embed et persiste dans
          pgvector.
        </p>
      </header>

      <form
        method="post"
        action="/api/admin/chat/sources"
        encType="application/x-www-form-urlencoded"
        className="space-y-4 rounded-md border border-stone-200 bg-white p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label" name="label">
            <input
              required
              minLength={2}
              maxLength={160}
              name="label"
              className="w-full rounded-md border border-stone-300 p-2 text-sm"
            />
          </Field>
          <Field label="Kind" name="kind">
            <select
              name="kind"
              defaultValue="markdown"
              className="w-full rounded-md border border-stone-300 p-2 text-sm"
            >
              <option value="markdown">markdown</option>
              <option value="snippet">snippet</option>
              <option value="url">url</option>
              <option value="faq">faq</option>
            </select>
          </Field>
          <Field label="Langue" name="language">
            <select
              name="language"
              defaultValue="fr"
              className="w-full rounded-md border border-stone-300 p-2 text-sm"
            >
              <option value="fr">fr</option>
              <option value="ar">ar</option>
              <option value="ar-MA">ar-MA</option>
            </select>
          </Field>
          <Field label="Audience" name="audience">
            <select
              name="audience"
              defaultValue="all"
              className="w-full rounded-md border border-stone-300 p-2 text-sm"
            >
              <option value="all">all</option>
              <option value="public">public</option>
              <option value="b2b">b2b</option>
            </select>
          </Field>
          <Field label="Locator (URL pour kind=url)" name="locator">
            <input
              name="locator"
              maxLength={2048}
              className="w-full rounded-md border border-stone-300 p-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Body markdown / snippet" name="body">
          <textarea
            id="body"
            name="body"
            rows={14}
            maxLength={200000}
            className="w-full rounded-md border border-stone-300 p-2 font-mono text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ImportFromFileButton
              targetId="body"
              label="Importer un fichier .md / .txt"
            />
            <span className="text-[11px] text-stone-400">
              Astuce : un fichier markdown peut peser jusqu'à 200 KB.
            </span>
          </div>
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Ingérer
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
