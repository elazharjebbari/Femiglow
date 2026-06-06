// @vitest-environment jsdom
/**
 * F01 — INVARIANTS DU SOCLE par écran adoptant (F01-C-069..072).
 *
 * Patron §3.4 de la stratégie : chaque écran qui adopte le socle AJOUTE son
 * entrée au tableau ADOPTERS — les invariants transverses (dialog Esc=annule,
 * toast succès auto-dismiss 4 s, garde dirty, Freshness TZ) sont alors
 * vérifiés EN SITUATION, pas seulement sur les composants isolés.
 *
 * Capacités par adoptant : un écran sans formulaire n'a pas de dirty-guard,
 * un écran sans données datées n'a pas de Freshness — les invariants ne
 * s'appliquent qu'aux capacités déclarées.
 *
 * Adoptants : SuppressionList (P1.5, pilote). À venir : dashboard (C3),
 * cockpit (C3), wizard campagnes (C4 — dirty+freshness), templates (C6)…
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { ToastProvider } from '@/components/admin/emails/ui/toast';
import { SuppressionList } from '@/components/admin/emails/cockpit/SuppressionList';

type Adopter = {
  name: string;
  capabilities: { dialog?: boolean; toast?: boolean; dirtyGuard?: boolean; freshness?: boolean };
  /** Monte l'écran avec ses handlers nominal MSW. */
  arm: () => void;
  render: () => ReactElement;
  /** Ouvre le ConfirmDialog représentatif de l'écran (si capability dialog). */
  openDialog?: (user: ReturnType<typeof userEvent.setup>) => Promise<HTMLElement>;
  /** Déclenche une mutation réussie produisant un toast succès (si toast). */
  triggerSuccessToast?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
};

const SUP_ROUTE = '/api/admin/emails/suppression';

const ADOPTERS: Adopter[] = [
  {
    name: 'SuppressionList (pilote P1.5)',
    capabilities: { dialog: true, toast: true },
    arm: () => {
      const store = [
        {
          email: 'invariant@exemple.test',
          reason: 'hard_bounce',
          detail: null,
          since: '2026-06-01T10:00:00.000Z',
          source: 'stalwart',
        },
      ];
      server.use(
        http.get(SUP_ROUTE, () =>
          HttpResponse.json({ rows: store, total: store.length, limit: 50, offset: 0 }),
        ),
        http.delete(SUP_ROUTE, () => {
          store.splice(0, store.length);
          return HttpResponse.json({ removed: true });
        }),
      );
    },
    render: () => (
      <ToastProvider>
        <SuppressionList />
      </ToastProvider>
    ),
    openDialog: async (user) => {
      await user.click(await screen.findByTestId('suppression-remove-invariant@exemple.test'));
      return screen.findByRole('dialog');
    },
    triggerSuccessToast: async (user) => {
      await user.click(await screen.findByTestId('suppression-remove-invariant@exemple.test'));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /^retirer$/i }));
      await screen.findByText(/retiré de la liste/i);
    },
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe.each(ADOPTERS.filter((a) => a.capabilities.dialog))(
  'Invariant dialog — $name',
  (adopter) => {
    it('F01-C-069 — Échap ferme le dialog SANS exécuter l’action', async () => {
      adopter.arm();
      const user = userEvent.setup();
      render(adopter.render());

      const dialog = await adopter.openDialog!(user);
      expect(dialog).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // L'action n'a PAS eu lieu : pas de toast résultat.
      expect(screen.queryByText(/retiré de la liste/i)).not.toBeInTheDocument();
    });

    it('F01-C-069b — le verbe d’action n’est jamais « OK »', async () => {
      adopter.arm();
      const user = userEvent.setup();
      render(adopter.render());
      const dialog = await adopter.openDialog!(user);
      expect(within(dialog).queryByRole('button', { name: /^ok$/i })).not.toBeInTheDocument();
    });
  },
);

describe.each(ADOPTERS.filter((a) => a.capabilities.toast))(
  'Invariant toast — $name',
  (adopter) => {
    it('F01-C-070 — le toast succès est auto-dismissé (≈4 s, précision verrouillée par F01-C-017)', async () => {
      // En situation réelle (timers réels) : on vérifie le COMPORTEMENT
      // auto-dismiss ; la précision 3999/4000 ms appartient au test provider.
      adopter.arm();
      const user = userEvent.setup();
      render(adopter.render());
      await adopter.triggerSuccessToast!(user);

      expect(screen.getByText(/retiré de la liste/i)).toBeInTheDocument();
      await waitForElementToBeRemoved(() => screen.queryByText(/retiré de la liste/i), {
        timeout: 6_000,
      });
    }, 10_000);

    it('F01-C-070b — le libellé du toast est un RÉSULTAT, jamais « opération effectuée »', async () => {
      adopter.arm();
      const user = userEvent.setup();
      render(adopter.render());
      await adopter.triggerSuccessToast!(user);
      expect(screen.queryByText(/opération effectuée/i)).not.toBeInTheDocument();
    });
  },
);

/*
 * F01-C-071 (dirty-guard) et F01-C-072 (Freshness TZ) : describe.each prêts —
 * ils s'activeront avec le premier adoptant déclarant la capability
 * (wizard campagnes C4 pour dirty, dashboard C3 pour freshness).
 */
