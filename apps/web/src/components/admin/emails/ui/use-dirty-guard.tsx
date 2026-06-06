'use client';

/**
 * Garde « modifications non enregistrées » (SOC-F07 / TRV-10).
 *
 * Deux niveaux complémentaires :
 *   - `useBeforeUnloadGuard(isDirty)` : fermeture d'onglet / navigation dure
 *     → invite native du navigateur (handler armé UNIQUEMENT si sale) ;
 *   - `<UnsavedChangesGuard isDirty>` : navigation in-app (clic sur un lien
 *     interne) → intercepte en phase capture et ouvre un ConfirmDialog
 *     « Modifications non enregistrées » ; la navigation ne part que si
 *     l'opérateur confirme « Quitter sans enregistrer ».
 *
 * Consommateurs : éditeur de templates, wizards (campagne/automation/audience).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './ConfirmDialog';

/** Arme l'invite native beforeunload tant que `isDirty` est vrai. */
export function useBeforeUnloadGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome exige returnValue pour afficher l'invite.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

export function UnsavedChangesGuard({ isDirty }: { isDirty: boolean }) {
  useBeforeUnloadGuard(isDirty);
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Interception capture des clics sur liens INTERNES quand le formulaire est
  // sale. Les modificateurs (nouvel onglet…) et liens externes passent.
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/')) return; // interne uniquement
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      title="Modifications non enregistrées"
      body={
        <p>
          Vos modifications n&apos;ont pas été enregistrées et seront perdues si
          vous quittez cette page.
        </p>
      }
      confirmLabel="Quitter sans enregistrer"
      cancelLabel="Rester"
      variant="danger"
      onConfirm={() => {
        const href = pendingHref!;
        setPendingHref(null);
        router.push(href);
      }}
      onCancel={() => setPendingHref(null)}
    />
  );
}
