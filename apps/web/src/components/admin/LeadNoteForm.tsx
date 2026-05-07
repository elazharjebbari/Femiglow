'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (content.trim().length < 2) {
      setError('Note trop courte');
      return;
    }
    const res = await fetch(`/api/admin/leads/${leadId}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? 'Enregistrement impossible');
      return;
    }
    setContent('');
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <label htmlFor="note" className="sr-only">
        Note interne
      </label>
      <textarea
        id="note"
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Note interne (visible uniquement par l'équipe)"
        className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {pending ? 'Enregistrement…' : 'Ajouter la note'}
      </button>
    </form>
  );
}
