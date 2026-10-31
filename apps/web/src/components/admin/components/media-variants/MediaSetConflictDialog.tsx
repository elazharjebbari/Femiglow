/**
 * MediaSetConflictDialog — résolution d'un 409 `version_conflict`.
 *
 * Même logique que `fields/ConflictModal` (pas de fusion automatique) :
 * on montre « votre version » et « la version sur le serveur », puis
 *  - « Reprendre la version du serveur » : recharge la cellule ;
 *  - « Écraser avec ma version » (enregistrement seulement) : renvoie le
 *    brouillon avec `If-Match` = l'horodatage serveur.
 */
'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { formatParis } from './model';
import type { AdminMediaSetJson } from './types';
import { Thumb, btn } from './ui';

export interface MediaSetConflictState {
  /** Action qui a échoué (libellé). */
  action: string;
  local: { thumbs: (string | null)[]; crossLocale: boolean } | null;
  remote: AdminMediaSetJson | null;
  remoteUpdatedAt: string | null;
  /** Vrai si l'écrasement a un sens (enregistrement d'un brouillon). */
  canOverwrite: boolean;
}

const STATUS_FR: Record<string, string> = {
  draft: 'brouillon',
  published: 'publié',
  scheduled: 'programmé',
  archived: 'archivé',
};

interface Props {
  conflict: MediaSetConflictState | null;
  /** Vignettes connues par id de média (la réponse 409 n'est pas enrichie). */
  thumbFor: (mediaId: string) => string | null;
  busy?: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onClose: () => void;
}

export function MediaSetConflictDialog({
  conflict,
  thumbFor,
  busy = false,
  onReload,
  onOverwrite,
  onClose,
}: Props): JSX.Element {
  const remote = conflict?.remote ?? null;
  return (
    <RadixDialog.Root open={!!conflict} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-stone-900/50" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <RadixDialog.Title className="text-lg font-semibold text-stone-900">
            Conflit de version
          </RadixDialog.Title>
          <RadixDialog.Description className="mt-1 text-sm text-stone-600">
            « {conflict?.action} » n’a pas été appliqué : une autre modification a été enregistrée
            {conflict?.remoteUpdatedAt ? (
              <>
                {' '}
                le <time dateTime={conflict.remoteUpdatedAt}>{formatParis(conflict.remoteUpdatedAt, 'long')}</time>
              </>
            ) : null}
            .
          </RadixDialog.Description>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <section aria-labelledby="hmv-conflict-local" className="rounded-md border border-stone-200 p-3">
              <h3 id="hmv-conflict-local" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Votre version
              </h3>
              {conflict?.local ? (
                <>
                  <p className="mt-1 text-sm text-stone-700">
                    {conflict.local.thumbs.length} image{conflict.local.thumbs.length > 1 ? 's' : ''}
                    {conflict.local.crossLocale ? ' · sans texte' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {conflict.local.thumbs.map((t, i) => (
                      <Thumb key={i} src={t} size="sm" />
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-stone-500">Action sur l’état affiché.</p>
              )}
            </section>
            <section aria-labelledby="hmv-conflict-remote" className="rounded-md border border-sky-200 bg-sky-50/40 p-3">
              <h3 id="hmv-conflict-remote" className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Version sur le serveur
              </h3>
              {remote ? (
                <>
                  <p className="mt-1 text-sm text-stone-700">
                    {STATUS_FR[remote.status] ?? remote.status} v{remote.version} · {remote.items.length} image
                    {remote.items.length > 1 ? 's' : ''}
                    {remote.crossLocale ? ' · sans texte' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...remote.items]
                      .sort((a, b) => a.position - b.position)
                      .map((it) => (
                        <Thumb key={it.id} src={it.media?.thumbUrl ?? thumbFor(it.mediaId)} size="sm" />
                      ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-stone-500">
                  L’ensemble n’existe plus sous cette forme (publié, programmé ou abandonné).
                </p>
              )}
            </section>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className={btn('secondary')} onClick={onClose} disabled={busy}>
              Fermer
            </button>
            {conflict?.canOverwrite ? (
              <button type="button" className={btn('danger')} onClick={onOverwrite} disabled={busy}>
                Écraser avec ma version
              </button>
            ) : null}
            <button type="button" className={btn('primary')} onClick={onReload} disabled={busy}>
              Reprendre la version du serveur
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
