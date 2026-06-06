// @vitest-environment jsdom
/**
 * F01 — ToastProvider/useToast (SOC-F02 / TRV-02) : batterie F01-C-016..027
 * + F01-A-028. Réf : technique/fonctionnalites/F01-socle-feedback/.
 *
 * Harnais = consommateur CANONIQUE « zéro faux succès » : le bouton déclenche
 * la mutation MSW ; toast.success UNIQUEMENT si res.ok, sinon toast.error avec
 * onRetry rejouant la MÊME action (mêmes ids).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { expectNoAxeViolations } from '@/test/axe';

import { ToastProvider, useToast } from '@/components/admin/emails/ui/toast';

const ACTION = '/api/admin/emails/transactional/bulk-retry';

let posts: Array<unknown> = [];
function armAction(status = 200) {
  server.use(
    http.post(ACTION, async ({ request }) => {
      posts.push(await request.json().catch(() => null));
      if (status !== 200) return HttpResponse.json({ error: 'x' }, { status });
      return HttpResponse.json({ retried: 3, skipped: 0, skippedIds: [] });
    }),
  );
}

/** Consommateur canonique : mutation réseau → toast honnête. */
function RetryButton() {
  const toast = useToast();
  const run = async () => {
    const ids = ['a', 'b', 'c'];
    const res = await fetch(ACTION, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      const body = (await res.json()) as { retried: number };
      toast.success(`${body.retried} emails relancés`);
    } else {
      toast.error(`Échec de la relance (HTTP ${res.status}). Réessaie.`, { onRetry: run });
    }
  };
  return (
    <button type="button" onClick={run}>
      Relancer (3)
    </button>
  );
}

/** Émetteur direct pour les tests de pile/timing (labels déterministes). */
let emitSeq = 0;
function Emitter() {
  const toast = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          emitSeq += 1;
          toast.success(`succès ${emitSeq}`);
        }}
      >
        emit-success
      </button>
      <button type="button" onClick={() => toast.error('erreur persistante. Consigne : réessaie.')}>
        emit-error
      </button>
    </div>
  );
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  posts = [];
  vi.clearAllMocks();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('Toast — succès honnêtes', () => {
  it('F01-C-016 — succès formulé RÉSULTAT (« 3 emails relancés »)', async () => {
    armAction();
    const user = userEvent.setup();
    renderWithProvider(<RetryButton />);
    await user.click(screen.getByRole('button', { name: /relancer/i }));
    expect(await screen.findByText('3 emails relancés')).toBeInTheDocument();
  });

  it('F01-C-017 — auto-dismiss à 4000 ms exactement', () => {
    // Horloge ENTIÈREMENT contrôlée : émission via l'API (pas d'userEvent,
    // dont les délais internes pendent sous fake timers purs) — seule façon
    // d'asserter le 3999/4000 à la milliseconde.
    vi.useFakeTimers();
    let api: ReturnType<typeof useToast> | null = null;
    function Capture() {
      api = useToast();
      return null;
    }
    renderWithProvider(<Capture />);
    act(() => {
      api!.success('succès chrono');
    });
    const card = screen.getByText('succès chrono');

    act(() => vi.advanceTimersByTime(3_999));
    expect(card).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('succès chrono')).not.toBeInTheDocument();
  });

  it('F01-C-018 — jamais de libellé générique « opération effectuée »', async () => {
    armAction();
    const user = userEvent.setup();
    renderWithProvider(<RetryButton />);
    await user.click(screen.getByRole('button', { name: /relancer/i }));
    await screen.findByText('3 emails relancés');
    expect(screen.queryByText(/opération effectuée/i)).not.toBeInTheDocument();
  });

  it('F01-C-022 — res.ok=false (422) : AUCUN toast succès, un toast erreur', async () => {
    armAction(422);
    const user = userEvent.setup();
    renderWithProvider(<RetryButton />);
    await user.click(screen.getByRole('button', { name: /relancer/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/échec de la relance \(http 422\)/i);
    expect(screen.queryByText(/relancés/)).not.toBeInTheDocument();
  });
});

describe('Toast — erreurs persistantes + retry', () => {
  it('F01-C-019 — erreur toujours visible après 10 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Emitter />);
    await user.click(screen.getByRole('button', { name: 'emit-error' }));
    await screen.findByRole('alert');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('alert')).toHaveTextContent(/erreur persistante/i);
  });

  it('F01-C-020 — erreur en role=alert avec consigne actionnable', async () => {
    armAction(500);
    const user = userEvent.setup();
    renderWithProvider(<RetryButton />);
    await user.click(screen.getByRole('button', { name: /relancer/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/réessaie/i);
  });

  it('F01-C-021 — Réessayer rejoue la MÊME action (mêmes ids)', async () => {
    armAction(500);
    const user = userEvent.setup();
    renderWithProvider(<RetryButton />);
    await user.click(screen.getByRole('button', { name: /relancer/i }));
    const alert = await screen.findByRole('alert');

    armAction(200); // le serveur est revenu
    await user.click(within(alert).getByRole('button', { name: /réessayer/i }));
    expect(await screen.findByText('3 emails relancés')).toBeInTheDocument();
    expect(posts).toHaveLength(2);
    expect(posts[1]).toEqual(posts[0]); // MÊME payload
  });
});

describe('Toast — pile', () => {
  it('F01-C-023 — 3 succès : 3 cartes, la plus récente en tête', async () => {
    const seqStart = emitSeq;
    const user = userEvent.setup();
    renderWithProvider(<Emitter />);
    const btn = screen.getByRole('button', { name: 'emit-success' });
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    // Ordre DOM du viewport = plus récent en tête (3, 2, 1).
    const viewport = screen.getByTestId('toast-viewport');
    const texts = within(viewport)
      .getAllByText(/^succès /)
      .map((el) => el.textContent);
    expect(texts).toEqual([
      `succès ${seqStart + 3}`,
      `succès ${seqStart + 2}`,
      `succès ${seqStart + 1}`,
    ]);
  });

  it('F01-C-024 — cap 3 : le 4e succès évince le plus ancien', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Emitter />);
    const btn = screen.getByRole('button', { name: 'emit-success' });
    await user.click(btn);
    const first = screen.getByText(/^succès /).textContent;
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    const texts = screen.getAllByText(/^succès /).map((el) => el.textContent);
    expect(texts).toHaveLength(3);
    expect(texts).not.toContain(first);
  });

  it('F01-C-025 — une erreur n’est JAMAIS évincée par le cap', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Emitter />);
    await user.click(screen.getByRole('button', { name: 'emit-error' }));
    const btn = screen.getByRole('button', { name: 'emit-success' });
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    expect(screen.getByRole('alert')).toHaveTextContent(/erreur persistante/i);
  });

  it('F01-C-027 — la croix ferme la carte ciblée, les autres restent', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Emitter />);
    await user.click(screen.getByRole('button', { name: 'emit-success' }));
    await user.click(screen.getByRole('button', { name: 'emit-error' }));

    const alert = screen.getByRole('alert');
    await user.click(within(alert).getByRole('button', { name: /^fermer$/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/^succès /)).toBeInTheDocument();
  });
});

describe('Toast — live regions & a11y', () => {
  it('F01-C-026 — UNE seule live-region polite dans le provider', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider(<Emitter />);
    await user.click(screen.getByRole('button', { name: 'emit-success' }));
    const polite = container.querySelectorAll('[aria-live="polite"]');
    expect(polite).toHaveLength(1);
  });

  it('F01-A-028 — axe : 0 violation sur une pile de 2 toasts', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider(<Emitter />);
    await user.click(screen.getByRole('button', { name: 'emit-success' }));
    await user.click(screen.getByRole('button', { name: 'emit-error' }));
    await expectNoAxeViolations(container);
  });
});
