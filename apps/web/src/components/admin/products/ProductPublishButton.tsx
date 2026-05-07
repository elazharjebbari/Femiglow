'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/products/types';

interface ProductPublishButtonProps {
  slug: string;
  status: Product['status'];
  variantsCount: number;
}

type Action =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'restore-status'
  | 'hard-delete';

interface ActionConfig {
  url: string;
  method: 'POST' | 'DELETE';
  confirm: string;
  successMsg: string;
  prompt?: string;
}

function actionConfig(action: Action, slug: string): ActionConfig {
  switch (action) {
    case 'publish':
      return {
        url: `/api/admin/products/${slug}/publish`,
        method: 'POST',
        confirm: `Publier "${slug}" ? Un snapshot sera créé.`,
        successMsg: 'Produit publié.',
        prompt: 'Note de publication (optionnel)',
      };
    case 'unpublish':
      return {
        url: `/api/admin/products/${slug}/unpublish`,
        method: 'POST',
        confirm: `Dépublier "${slug}" ? Le statut repasse en draft (le produit n'est plus visible publiquement).`,
        successMsg: 'Produit dépublié.',
      };
    case 'archive':
      return {
        url: `/api/admin/products/${slug}`,
        method: 'DELETE',
        confirm: `Archiver "${slug}" ? Le produit sera caché du catalogue.`,
        successMsg: 'Produit archivé.',
      };
    case 'restore-status':
      return {
        url: `/api/admin/products/${slug}/restore-status`,
        method: 'POST',
        confirm: `Restaurer "${slug}" en draft ?`,
        successMsg: 'Produit restauré (draft).',
      };
    case 'hard-delete':
      return {
        url: `/api/admin/products/${slug}/hard-delete`,
        method: 'DELETE',
        confirm: `SUPPRIMER DÉFINITIVEMENT "${slug}" ?\nLe produit, ses variantes et ses snapshots seront effacés. Cette action est irréversible.`,
        successMsg: 'Produit supprimé.',
      };
  }
}

export function ProductPublishButton({
  slug,
  status,
  variantsCount,
}: ProductPublishButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const blockedPublish = variantsCount === 0;

  async function run(action: Action) {
    const cfg = actionConfig(action, slug);
    if (!confirm(cfg.confirm)) return;
    let body: BodyInit | undefined;
    if (cfg.prompt) {
      const note = window.prompt(cfg.prompt) || undefined;
      body = JSON.stringify(note ? { note } : {});
    }
    setBusy(action);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(cfg.url, {
        method: cfg.method,
        headers: cfg.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? `Erreur ${action}.`);
        return;
      }
      setSuccess(cfg.successMsg);
      if (action === 'hard-delete') {
        router.push('/admin/products');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== 'archived' ? (
          <button
            type="button"
            onClick={() => run('publish')}
            disabled={busy !== null || blockedPublish}
            title={
              blockedPublish
                ? 'Ajoute au moins une variante avant de publier.'
                : 'Publie le produit + crée un snapshot.'
            }
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300 disabled:text-stone-500"
          >
            {busy === 'publish'
              ? 'Publication…'
              : status === 'published'
                ? 'Re-publier'
                : 'Publier'}
          </button>
        ) : null}

        {status === 'published' ? (
          <button
            type="button"
            onClick={() => run('unpublish')}
            disabled={busy !== null}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === 'unpublish' ? 'Dépublication…' : 'Dépublier'}
          </button>
        ) : null}

        {status !== 'archived' ? (
          <button
            type="button"
            onClick={() => run('archive')}
            disabled={busy !== null}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {busy === 'archive' ? 'Archivage…' : 'Archiver'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => run('restore-status')}
              disabled={busy !== null}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {busy === 'restore-status' ? 'Restauration…' : 'Restaurer (draft)'}
            </button>
            <button
              type="button"
              onClick={() => run('hard-delete')}
              disabled={busy !== null}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              {busy === 'hard-delete' ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </>
        )}
      </div>
      <div className="w-full text-right">
        {error ? (
          <span className="text-xs text-rose-700" role="alert">
            {error}
          </span>
        ) : null}
        {success ? (
          <span className="text-xs text-emerald-700" role="status">
            {success}
          </span>
        ) : null}
        {blockedPublish && status !== 'archived' ? (
          <span className="block text-xs text-stone-500">
            Ajoute une variante pour activer la publication.
          </span>
        ) : null}
      </div>
    </div>
  );
}
