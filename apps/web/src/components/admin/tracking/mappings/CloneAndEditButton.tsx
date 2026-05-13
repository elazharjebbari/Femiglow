'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import { useConfirm } from './useConfirm';

/**
 * Bouton "Cloner et éditer" — workflow direct depuis une version active ou
 * __default__ pour entrer en mode édition en 1 click (clone + redirect).
 *
 * Justification D-001 : on ne peut pas éditer la version active ni __default__
 * directement (immutable). Ce bouton fait :
 *   1. Crée une nouvelle version draft clonée
 *   2. Redirige vers /[newId]/edit
 *
 * L'utilisateur ne voit qu'un seul click ; le clone+redirect est transparent.
 */
export function CloneAndEditButton(props: {
  sourceId: string;
  sourceName: string;
  /** Texte du bouton (par défaut '✏ Cloner et éditer'). */
  label?: string;
  /** Variante visuelle. */
  variant?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const { confirm, ConfirmHost } = useConfirm();
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const defaultName = `${props.sourceName} (édition ${today})`;
    const ok = await confirm({
      title: 'Cloner cette version pour l\'éditer',
      message: (
        <span>
          Une nouvelle version <strong>draft</strong> sera créée à partir de{' '}
          <span className="font-mono text-xs">{props.sourceName}</span>. Tu pourras
          modifier les mappings, puis l'activer pour la mettre en production.
        </span>
      ),
      details: `Nom proposé : « ${defaultName} » (modifiable plus tard via Réglages).`,
      confirmLabel: '✏ Créer la draft et ouvrir l\'éditeur',
      variant: 'default',
    });
    if (!ok) return;
    setCloning(true);
    setError(null);
    try {
      const created = await mappingsClient.create({
        name: defaultName,
        source: { kind: 'clone', sourceId: props.sourceId },
      });
      router.push(`/admin/tracking/events/mappings/${created.id}/edit`);
      router.refresh();
    } catch (err) {
      if (err instanceof MappingApiError) setError(`${err.code}: ${err.message}`);
      else setError('Erreur clone');
      setCloning(false);
    }
  }

  const isPrimary = (props.variant ?? 'primary') === 'primary';

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={cloning}
        data-testid="btn-clone-and-edit"
        className={
          isPrimary
            ? 'rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50'
            : 'rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50'
        }
      >
        {cloning ? 'Clone…' : (props.label ?? '✏ Cloner et éditer')}
      </button>
      {error ? (
        <span role="alert" className="ml-2 text-xs text-red-700">{error}</span>
      ) : null}
      <ConfirmHost />
    </>
  );
}
