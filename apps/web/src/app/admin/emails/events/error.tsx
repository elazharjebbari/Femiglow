'use client';

/**
 * error.tsx du segment /admin/emails/events (UX-DASH-010).
 *
 * Error boundary LOCAL à la page Events. Sans lui, un échec des requêtes
 * `user_event` (getTotalEvents / getEventCountsByName / getRecentEvents →
 * requireDb() throw) fait planter le rendu RSC et remonte au boundary GLOBAL
 * (message générique, pas de retry in-context).
 *
 * Message FR actionnable, `role="alert"`, bouton « Réessayer » câblé sur
 * `reset()` (re-render du segment) et lien retour vers le tableau de bord.
 */
import { useEffect } from 'react';
import Link from 'next/link';

interface EventsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EventsError({ error, reset }: EventsErrorProps) {
  useEffect(() => {
    // Trace côté client pour corréler avec les logs serveur (digest).
    console.error('[admin/emails/events/error.tsx]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800"
      >
        <h1 className="text-lg font-semibold">Events utilisateur indisponibles</h1>
        <p className="mt-2 text-sm">
          Une erreur est survenue lors du chargement du pipeline{' '}
          <code className="font-mono text-xs">user_event</code> (souvent une base
          de données momentanément injoignable). Le suivi des events n'est pas
          interrompu ; seule cette vue de contrôle est touchée.
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
            href="/admin/emails"
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ← Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
