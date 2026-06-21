'use client';

/**
 * UX-CAMP-002 / UX-CAMP-006 / UX-CAMP-015 — barre d'actions du détail campagne.
 *
 *  - Pause / Reprise / Annulation d'urgence (selon statut, transitions légales) ;
 *  - Rafraîchir les métriques (poll Listmonk à la demande) ;
 *  - Suppression d'un brouillon, CONFIRMÉE.
 *
 * P3.3-d (socle v2) : `window.confirm` → `ConfirmDialog` accessible ; boutons →
 * primitive `Button` (couleurs via tokens) ; feedback → toasts. Anti-double-clic
 * via `useTransition` / l'état `busy` du dialog. Les actions destructives
 * (Annuler l'envoi, Supprimer) exigent une confirmation rappelant le nom.
 */
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  refreshCampaignMetrics,
  discardCampaign,
} from '@/lib/admin/emails/wizard-actions';
import { Button, ConfirmDialog, useOptionalToast } from '@/components/admin/emails/ui';

type Caps = {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canDiscard: boolean;
};

/** FormData minimal attendu par les server actions (`formData.get('id')`). */
function idForm(id: string): FormData {
  const f = new FormData();
  f.set('id', id);
  return f;
}

export function CampaignActions({ id, name, caps }: { id: string; name: string; caps: Caps }) {
  const router = useRouter();
  const toast = useOptionalToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | 'cancel' | 'discard'>(null);
  // Suppression : on garde la sémantique de form server-action (redirect natif
  // vers la liste) — le dialog déclenche `requestSubmit()`.
  const discardFormRef = useRef<HTMLFormElement>(null);

  /** Action non destructive (reste sur la page) : feedback toast + refresh. */
  function runDirect(action: (f: FormData) => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await action(idForm(id));
        toast?.success(okMsg);
        router.refresh();
      } catch (err) {
        toast?.error(err instanceof Error ? err.message : 'Action échouée. Réessaie.');
      }
    });
  }

  /** onConfirm du dialog d'annulation : un throw laisse le dialog ouvert (erreur affichée). */
  async function confirmCancel() {
    await cancelCampaign(idForm(id));
    toast?.success('Envoi annulé.');
    setDialog(null);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        busy={pending}
        busyLabel="Rafraîchissement…"
        onClick={() => runDirect(refreshCampaignMetrics, 'Métriques rafraîchies.')}
      >
        ↻ Rafraîchir les métriques
      </Button>

      {caps.canPause ? (
        <Button
          variant="secondary"
          disabled={pending}
          aria-label="Mettre la campagne en pause"
          onClick={() => runDirect(pauseCampaign, 'Campagne mise en pause.')}
        >
          ⏸ Mettre en pause
        </Button>
      ) : null}

      {caps.canResume ? (
        <Button
          variant="secondary"
          disabled={pending}
          aria-label="Reprendre l’envoi de la campagne"
          onClick={() => runDirect(resumeCampaign, 'Envoi repris.')}
        >
          ▶ Reprendre l’envoi
        </Button>
      ) : null}

      {caps.canCancel ? (
        <Button
          variant="danger"
          aria-label="Annuler définitivement la campagne"
          onClick={() => setDialog('cancel')}
        >
          ⛔ Annuler l’envoi
        </Button>
      ) : null}

      {caps.canDiscard ? (
        <form ref={discardFormRef} action={discardCampaign}>
          <input type="hidden" name="id" value={id} />
          <Button
            type="submit"
            variant="secondary"
            aria-label="Supprimer le brouillon"
            onClick={(e) => {
              e.preventDefault(); // on confirme d'abord ; requestSubmit() soumettra.
              setDialog('discard');
            }}
          >
            🗑 Supprimer ce brouillon
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={dialog === 'cancel'}
        variant="danger"
        title="Annuler l’envoi ?"
        body={
          <>
            Annuler définitivement la campagne «&nbsp;<strong>{name}</strong>&nbsp;» ? L’envoi en
            cours sera stoppé. Cette action est irréversible.
          </>
        }
        confirmLabel="Annuler l’envoi"
        cancelLabel="Revenir"
        onConfirm={confirmCancel}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'discard'}
        variant="danger"
        title="Supprimer le brouillon ?"
        body={
          <>
            Supprimer le brouillon «&nbsp;<strong>{name}</strong>&nbsp;» ? Il disparaîtra de la
            liste principale.
          </>
        }
        confirmLabel="Supprimer"
        cancelLabel="Revenir"
        onConfirm={() => {
          discardFormRef.current?.requestSubmit();
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
