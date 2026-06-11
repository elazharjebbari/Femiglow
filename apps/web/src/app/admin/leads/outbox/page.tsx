/**
 * OWBS F11 — Page admin de supervision de l'outbox (`/admin/leads/outbox`).
 *
 * Rend la visibilité des effets durables (tracking serveur / webhooks) : ce qui
 * est en attente, traité, ou en échec définitif (`dead`) — avec rejeu. Auth
 * assurée par le layout admin.
 */
import { OutboxSupervisionContainer } from '@/components/admin/OutboxSupervisionContainer';

export const dynamic = 'force-dynamic';

export default function OutboxSupervisionPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-medium tracking-tight text-stone-900">
          Supervision de l'outbox
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Effets durables des leads (webhooks, tracking serveur). Rejouez les effets
          en échec définitif (dead) après rétablissement de la cible.
        </p>
      </header>
      <OutboxSupervisionContainer />
    </div>
  );
}
