'use client';

/**
 * AudienceRowActions — actions par ligne de la liste audiences :
 *  - « Modifier » → page d'édition [id]/edit (UX-AUD-001) ;
 *  - « Dupliquer » → clone rules+exclusions dans une nouvelle audience
 *    (slug suggéré « -copie ») puis redirige (UX-AUD-008) ;
 *  - « Détail » → page read-only [id] ;
 *  - « Supprimer » → DELETE avec confirmation explicite.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  audienceId: string;
  audienceName: string;
}

/** Suggère un slug de copie unique-ish : "vip" → "vip-copie", "x-copie" → "x-copie-2". */
function suggestCopySlug(slug: string): string {
  const m = /^(.*)-copie(?:-(\d+))?$/.exec(slug);
  if (m) {
    const n = m[2] ? Number(m[2]) + 1 : 2;
    return `${m[1]}-copie-${n}`;
  }
  return `${slug}-copie`.slice(0, 80);
}

export function AudienceRowActions({ audienceId, audienceName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? body?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setPending(false);
    }
  }

  async function handleDuplicate() {
    if (duplicating) return; // anti double-clic
    setDuplicating(true);
    setError(null);
    try {
      const src = await fetch(`/api/admin/emails/audiences/${audienceId}`, {
        credentials: 'include',
      });
      if (!src.ok) throw new Error(`HTTP ${src.status}`);
      const audience = (await src.json()) as {
        slug: string;
        name: string;
        description?: string | null;
        rules: unknown;
        exclusionFlags?: unknown;
        evaluationMode?: 'static' | 'dynamic';
      };

      const res = await fetch('/api/admin/emails/audiences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug: suggestCopySlug(audience.slug),
          name: `${audience.name} (copie)`,
          description: audience.description ?? undefined,
          rules: audience.rules,
          exclusionFlags: audience.exclusionFlags ?? undefined,
          evaluationMode: audience.evaluationMode ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      router.push(`/admin/emails/audiences/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setDuplicating(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? '…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          Annuler
        </button>
        {error && (
          <span className="ml-2 text-xs text-red-700" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/admin/emails/audiences/${audienceId}/edit`}
        className="rounded px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
        title={`Modifier « ${audienceName} »`}
        data-testid="row-edit-link"
      >
        Modifier
      </Link>
      <Link
        href={`/admin/emails/audiences/${audienceId}`}
        className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
        title={`Détail « ${audienceName} »`}
      >
        Détail
      </Link>
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={duplicating}
        className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-50"
        title="Dupliquer cette audience"
        data-testid="row-duplicate-btn"
      >
        {duplicating ? 'Duplication…' : 'Dupliquer'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-red-50 hover:text-red-700"
        title="Supprimer (avec confirmation)"
      >
        Supprimer
      </button>
      {error && (
        <span className="ml-2 text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
