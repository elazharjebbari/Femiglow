'use client';

/**
 * error.tsx du segment /admin/emails (UX-TRANSVERSE-007 / UX-DASH-003).
 *
 * Error boundary LOCAL à la zone emails. Sans lui, une panne DB du dashboard
 * (getOutboxKpi() → requireDb() throw) faisait planter le rendu RSC AVANT que le
 * badge santé ne s'affiche, et remontait au boundary GLOBAL (message générique,
 * pas de retry in-context). Le composant censé signaler la panne DB ne
 * s'affichait jamais lors d'une panne DB — paradoxe corrigé ici.
 *
 * Message FR actionnable, `role="alert"`, bouton « Réessayer » câblé sur
 * `reset()` (re-render du segment) et lien retour dashboard.
 */
import { useEffect } from 'react';
import Link from 'next/link';

interface EmailsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EmailsError({ error, reset }: EmailsErrorProps) {
  useEffect(() => {
    // Trace côté client pour corréler avec les logs serveur (digest).
    console.error('[admin/emails/error.tsx]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800"
      >
        <h1 className="text-lg font-semibold">Tableau de bord emails indisponible</h1>
        <p className="mt-2 text-sm">
          Une erreur est survenue lors du chargement des données emailing (souvent
          une base de données momentanément injoignable). Les envois ne sont pas
          affectés ; seule cette vue est touchée.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-rose-500">
            Référence : {error.digest}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Réessayer
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Retour à l'admin
          </Link>
        </div>
      </div>
    </div>
  );
}
