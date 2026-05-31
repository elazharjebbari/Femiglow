'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Starter = { id: string; name: string; description: string; htmlSource: string };

export function NewTemplateForm() {
  const router = useRouter();
  const [starters, setStarters] = useState<Starter[]>([]);
  const [selectedStarter, setSelectedStarter] = useState<string>('default-femiglow');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/admin/emails/templates/starters')
      .then((r) => r.json())
      .then((data: Starter[]) => setStarters(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const starter = starters.find((s) => s.id === selectedStarter);
    try {
      const res = await fetch('/api/admin/emails/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          subjectTmpl: subject,
          htmlSource:
            starter?.htmlSource ??
            '<!doctype html><html><body><p>{{firstName}}…</p></body></html>',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { template: { id: string } };
      router.push(`/admin/emails/templates/${data.template.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <section className="rounded border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-stone-700">Point de départ</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {starters.length === 0 && (
            <p className="text-xs text-stone-500">Chargement…</p>
          )}
          {starters.map((s) => (
            <label
              key={s.id}
              className={`cursor-pointer rounded border p-3 ${
                selectedStarter === s.id
                  ? 'border-stone-900 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name="starter"
                value={s.id}
                checked={selectedStarter === s.id}
                onChange={() => setSelectedStarter(s.id)}
                className="sr-only"
              />
              <p className="font-medium text-stone-800">{s.name}</p>
              <p className="text-xs text-stone-500">{s.description}</p>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-medium text-stone-700">Métadonnées</h2>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            Nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Bienvenue — onboarding J0"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            Slug (immuable)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
            }
            required
            pattern="^[a-z][a-z0-9-]*$"
            placeholder="welcome-j0"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            Sujet (Handlebars)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Bienvenue {{firstName}} ✨"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </section>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !slug || !name || !subject}
          className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {submitting ? '...' : 'Créer le template'}
        </button>
      </div>
    </form>
  );
}
