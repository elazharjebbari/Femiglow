/**
 * OWBS F11 — OutboxSupervisionContainer : flux fetch → rendu → replay → refetch
 * via MSW (chemin réseau réel du conteneur).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server, http, HttpResponse } from '@/test/msw/server';
import { OutboxSupervisionContainer } from './OutboxSupervisionContainer';

// Wildcard origin-agnostique (la base jsdom de vitest n'est pas garantie).
const URL = '*/api/admin/leads/outbox';
const REPLAY_URL = '*/api/admin/leads/outbox/lox_d1/replay';
const DEAD = [{ id: 'lox_d1', type: 'order_webhook', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', attempts: 8, lastError: 'CRM 500' }];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OutboxSupervisionContainer (OWBS F11)', () => {
  it('charge et affiche les compteurs + dead', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json({ counts: { pending: 1, processing: 0, done: 3, dead: 1 }, dead: DEAD, pending: [] })),
    );
    render(<OutboxSupervisionContainer />);
    await waitFor(() => expect(screen.getByTestId('outbox-count-done')).toHaveTextContent('3'));
    expect(screen.getByTestId('outbox-dead-alert')).toBeInTheDocument();
  });

  it('rejouer → POST replay puis refetch (le dead disparaît)', async () => {
    let replayed = false;
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          replayed
            ? { counts: { pending: 1, processing: 0, done: 3, dead: 0 }, dead: [], pending: [] }
            : { counts: { pending: 0, processing: 0, done: 3, dead: 1 }, dead: DEAD, pending: [] },
        ),
      ),
      http.post(REPLAY_URL, () => {
        replayed = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    render(<OutboxSupervisionContainer />);
    await waitFor(() => expect(screen.getByTestId('outbox-replay-lox_d1')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('outbox-replay-lox_d1'));
    await waitFor(() => expect(screen.getByTestId('outbox-empty')).toBeInTheDocument());
    expect(replayed).toBe(true);
  });

  it('erreur de chargement → message d\'erreur', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: { code: 'unauthorized', message: 'x' } }, { status: 401 })));
    render(<OutboxSupervisionContainer />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Erreur de chargement/i));
  });
});
