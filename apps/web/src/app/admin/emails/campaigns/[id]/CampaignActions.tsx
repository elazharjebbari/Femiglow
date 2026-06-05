'use client';

/**
 * UX-CAMP-002 / UX-CAMP-006 / UX-CAMP-015 — barre d'actions du détail campagne.
 *
 *  - Pause / Reprise / Annulation d'urgence (selon statut, transitions légales).
 *  - Rafraîchir les métriques (poll Listmonk à la demande).
 *  - Suppression d'un brouillon, désormais CONFIRMÉE.
 *
 * Chaque mutation est anti-double-clic (`useFormStatus`). Les actions
 * destructives (Annuler l'envoi, Supprimer le brouillon) exigent une
 * confirmation explicite rappelant le nom de la campagne.
 */
import { useFormStatus } from 'react-dom';
import {
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  refreshCampaignMetrics,
  discardCampaign,
} from '@/lib/admin/emails/wizard-actions';

type Caps = {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canDiscard: boolean;
};

function PendingButton({
  children,
  className,
  ariaLabel,
  confirmMessage,
}: {
  children: React.ReactNode;
  className: string;
  ariaLabel?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      onClick={(e) => {
        // Confirmation des actions destructives (chiffrée par le message).
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export function CampaignActions({
  id,
  name,
  caps,
}: {
  id: string;
  name: string;
  caps: Caps;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <form action={refreshCampaignMetrics}>
        <input type="hidden" name="id" value={id} />
        <PendingButton className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40">
          ↻ Rafraîchir les métriques
        </PendingButton>
      </form>

      {caps.canPause ? (
        <form action={pauseCampaign}>
          <input type="hidden" name="id" value={id} />
          <PendingButton
            ariaLabel="Mettre la campagne en pause"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40"
          >
            ⏸ Mettre en pause
          </PendingButton>
        </form>
      ) : null}

      {caps.canResume ? (
        <form action={resumeCampaign}>
          <input type="hidden" name="id" value={id} />
          <PendingButton
            ariaLabel="Reprendre l’envoi de la campagne"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            ▶ Reprendre l’envoi
          </PendingButton>
        </form>
      ) : null}

      {caps.canCancel ? (
        <form action={cancelCampaign}>
          <input type="hidden" name="id" value={id} />
          <PendingButton
            ariaLabel="Annuler définitivement la campagne"
            confirmMessage={`Annuler définitivement la campagne « ${name} » ? L’envoi en cours sera stoppé. Cette action est irréversible.`}
            className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-40"
          >
            ⛔ Annuler l’envoi
          </PendingButton>
        </form>
      ) : null}

      {caps.canDiscard ? (
        <form action={discardCampaign}>
          <input type="hidden" name="id" value={id} />
          <PendingButton
            ariaLabel="Supprimer le brouillon"
            confirmMessage={`Supprimer le brouillon « ${name} » ? Il disparaîtra de la liste principale.`}
            className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            🗑 Supprimer ce brouillon
          </PendingButton>
        </form>
      ) : null}
    </div>
  );
}
