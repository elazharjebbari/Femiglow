/**
 * F08 — AudiencePreview, grille réseau (AUD-F07 / AUD-13) :
 *  - debounce (1 seul POST pour 3 changements rapides) — C-057 ;
 *  - preview-size : 200 / 401 / 422 / 500 / hang / network / timeout dédié
 *    — C-058..064 (oracle central : zéro faux succès, échec → role=alert,
 *    jamais un faux 0) ;
 *  - preview-sample (C-065) et preview-breakdown (C-066/067).
 *
 * NB C-057 : le debounce de prod est 800 ms ; on l'injecte à 120 ms via la
 * prop `debounceMs` (même chemin de code) pour garder le test rapide.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { delay, server, http, HttpResponse } from '@/test/msw/server';
import { AudiencePreview, PREVIEW_TIMEOUT_MESSAGE } from '../AudiencePreview';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const RULES: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};

function rulesVariant(n: number): RulesGroup {
  return { kind: 'all', conditions: [{ kind: 'inactive_since', days: n }] };
}

const SIZE_URL = '/api/admin/emails/audiences/preview-size';
const SAMPLE_URL = '/api/admin/emails/audiences/preview-sample';
const BREAKDOWN_URL = '/api/admin/emails/audiences/preview-breakdown';

function sizeOk(size = 42) {
  let calls = 0;
  server.use(
    http.post(SIZE_URL, () => {
      calls += 1;
      return HttpResponse.json({ size, durationMs: 12 });
    }),
  );
  return () => calls;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('F08 — preview-size', () => {
  it("F08-C-057 — 3 changements rapides n'émettent qu'1 POST après le debounce", async () => {
    const calls = sizeOk();
    const { rerender } = render(<AudiencePreview rules={rulesVariant(10)} debounceMs={120} />);
    rerender(<AudiencePreview rules={rulesVariant(20)} debounceMs={120} />);
    rerender(<AudiencePreview rules={rulesVariant(30)} debounceMs={120} />);
    // Pendant la fenêtre de debounce : aucun appel.
    await act(() => sleep(60));
    expect(calls()).toBe(0);
    await waitFor(() => expect(screen.getByTestId('preview-count')).toBeInTheDocument());
    expect(calls()).toBe(1);
  });

  it("F08-C-058 — 200 nominal affiche '🎯 N contacts'", async () => {
    sizeOk(1234);
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    await waitFor(() => expect(screen.getByTestId('preview-count')).toBeInTheDocument());
    expect(screen.getByTestId('preview-count').textContent).toMatch(/🎯\s*1\s*234\s*contacts/);
  });

  it('F08-C-059 — 401 affiche un message role=alert sans compteur', async () => {
    server.use(
      http.post(SIZE_URL, () => HttpResponse.json({ error: 'Non autorisé' }, { status: 401 })),
    );
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    const err = await screen.findByTestId('preview-error');
    expect(err).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('preview-count')).not.toBeInTheDocument();
  });

  it("F08-C-060 — 422 affiche l'erreur de validation", async () => {
    server.use(
      http.post(SIZE_URL, () =>
        HttpResponse.json({ error: 'Validation échouée' }, { status: 422 }),
      ),
    );
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    const err = await screen.findByTestId('preview-error');
    expect(err.textContent).toContain('422');
  });

  it('F08-C-061 — 500 affiche role=alert (jamais un faux compteur)', async () => {
    server.use(http.post(SIZE_URL, () => HttpResponse.json({}, { status: 500 })));
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    await screen.findByTestId('preview-error');
    expect(screen.queryByTestId('preview-count')).not.toBeInTheDocument();
  });

  it("F08-C-062 — hang : « Calcul en cours… » persiste, pas de second POST", async () => {
    let calls = 0;
    server.use(
      http.post(SIZE_URL, async () => {
        calls += 1;
        await delay('infinite');
        return HttpResponse.json({ size: 0, durationMs: 0 });
      }),
    );
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    await screen.findByTestId('preview-loading');
    await act(() => sleep(150));
    expect(screen.getByTestId('preview-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-count')).not.toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('F08-C-063 — erreur réseau affiche role=alert', async () => {
    server.use(http.post(SIZE_URL, () => HttpResponse.error()));
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    const err = await screen.findByTestId('preview-error');
    expect(err).toHaveAttribute('role', 'alert');
  });

  it('F08-C-064 — 504 timeout : message dédié « ⏱ Requête trop lourde… » (pas un faux 0)', async () => {
    server.use(
      http.post(SIZE_URL, () => HttpResponse.json({ error: 'timeout' }, { status: 504 })),
    );
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    const timeout = await screen.findByTestId('preview-timeout');
    expect(timeout).toHaveAttribute('role', 'alert');
    expect(timeout.textContent).toBe(PREVIEW_TIMEOUT_MESSAGE);
    expect(screen.queryByTestId('preview-count')).not.toBeInTheDocument();
    expect(screen.queryByText(/🎯\s*0/)).not.toBeInTheDocument();
  });
});

describe('F08 — preview-sample (grille réseau)', () => {
  async function setupWithCount() {
    sizeOk(42);
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    await waitFor(() => expect(screen.getByTestId('show-samples')).toBeInTheDocument());
  }

  it('F08-C-065 — sample : 200 liste, 401/500/network → alert, hang → rien de faux', async () => {
    // 200 nominal
    await setupWithCount();
    server.use(
      http.post(SAMPLE_URL, () =>
        HttpResponse.json({
          samples: [{ email: 'a@x.com', name: 'A', createdAt: '2026-01-01T00:00:00Z' }],
          size: 42,
        }),
      ),
    );
    fireEvent.click(screen.getByTestId('show-samples'));
    await screen.findByTestId('samples-list');
    expect(screen.getByText('a@x.com')).toBeInTheDocument();

    // 401 / 500 / network → role=alert, pas de liste fantôme.
    for (const respond of [
      () => HttpResponse.json({ error: 'Non autorisé' }, { status: 401 }),
      () => HttpResponse.json({}, { status: 500 }),
      () => HttpResponse.error(),
    ]) {
      document.body.innerHTML = '';
      await setupWithCount();
      server.use(http.post(SAMPLE_URL, respond));
      fireEvent.click(screen.getByTestId('show-samples'));
      const err = await screen.findByTestId('preview-error');
      expect(err).toHaveAttribute('role', 'alert');
      expect(screen.queryByTestId('samples-list')).not.toBeInTheDocument();
    }

    // hang : ni liste ni erreur — l'UI n'invente rien.
    document.body.innerHTML = '';
    await setupWithCount();
    server.use(
      http.post(SAMPLE_URL, async () => {
        await delay('infinite');
        return HttpResponse.json({ samples: [], size: 0 });
      }),
    );
    fireEvent.click(screen.getByTestId('show-samples'));
    await act(() => sleep(120));
    expect(screen.queryByTestId('samples-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-error')).not.toBeInTheDocument();
  });
});

describe('F08 — preview-breakdown', () => {
  async function setupWithCount() {
    sizeOk(42);
    render(<AudiencePreview rules={RULES} debounceMs={5} />);
    await waitFor(() => expect(screen.getByTestId('show-breakdown')).toBeInTheDocument());
  }

  it("F08-C-066 — affiche « N ciblés − M exclus = K envoyables » avec N−M=K", async () => {
    await setupWithCount();
    server.use(
      http.post(BREAKDOWN_URL, () =>
        HttpResponse.json({ matched: 50, excluded: 8, deliverable: 42, durationMs: 9 }),
      ),
    );
    fireEvent.click(screen.getByTestId('show-breakdown'));
    await screen.findByTestId('breakdown');
    expect(screen.getByTestId('breakdown-matched').textContent).toMatch(/50\s*ciblés/);
    expect(screen.getByTestId('breakdown-excluded').textContent).toMatch(/8\s*exclus/);
    expect(screen.getByTestId('breakdown-deliverable').textContent).toMatch(/42\s*envoyables/);
    expect(50 - 8).toBe(42); // arithmétique de l'oracle elle-même cohérente
  });

  it('F08-C-067 — breakdown : 401/422/500/network → alert ; hang → pas de faux chiffres', async () => {
    for (const respond of [
      () => HttpResponse.json({ error: 'Non autorisé' }, { status: 401 }),
      () => HttpResponse.json({ error: 'Validation échouée' }, { status: 422 }),
      () => HttpResponse.json({}, { status: 500 }),
      () => HttpResponse.error(),
    ]) {
      document.body.innerHTML = '';
      await setupWithCount();
      server.use(http.post(BREAKDOWN_URL, respond));
      fireEvent.click(screen.getByTestId('show-breakdown'));
      const err = await screen.findByTestId('preview-error');
      expect(err).toHaveAttribute('role', 'alert');
      expect(screen.queryByTestId('breakdown')).not.toBeInTheDocument();
    }

    document.body.innerHTML = '';
    await setupWithCount();
    server.use(
      http.post(BREAKDOWN_URL, async () => {
        await delay('infinite');
        return HttpResponse.json({ matched: 0, excluded: 0, deliverable: 0 });
      }),
    );
    fireEvent.click(screen.getByTestId('show-breakdown'));
    await act(() => sleep(120));
    expect(screen.queryByTestId('breakdown')).not.toBeInTheDocument();
  });
});
