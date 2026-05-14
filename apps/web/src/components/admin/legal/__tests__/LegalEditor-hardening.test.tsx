/**
 * Hardening — LegalEditor : auto-save timer, dirty state edges, unmount
 * pendant save, erreurs réseau, idempotence.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { defaultLegalState, legalHandlers, legalScenarios } from '@/test/msw/legal-handlers';
import { LegalEditor } from '../LegalEditor';

const baseProps = {
  slug: 'cgv',
  initialTitle: 'CGV',
  initialDescription: 'desc',
  initialBodyMd: '# CGV body content',
  initialIncludeInSearch: false,
  status: 'draft' as const,
  version: 1,
  initialUpdatedAtMs: 1_700_000_000_000,
  templateVars: [],
  placements: [],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

beforeEach(() => {
  const state = JSON.parse(JSON.stringify(defaultLegalState)) as typeof defaultLegalState;
  state.pages.cgv = { slug: 'cgv', version: 1, status: 'draft' };
  state.vars = {};
  server.use(...legalHandlers(state));
});

describe('LegalEditor — dirty state', () => {
  it('Save désactivé après save réussi (snapshot mis à jour)', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'CGV nouveau');

    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    // ✓ Enregistré confirme que la sauvegarde s'est bien faite, puis
    // le bouton repasse à disabled (snapshot.current === state).
    await waitFor(() => expect(screen.getByText('✓ Enregistré')).toBeInTheDocument());
    await waitFor(
      () => expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled(),
      { timeout: 3000 },
    );
  });

  it('Modifier puis revenir à la valeur initiale → bouton désactivé', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.type(titleInput, ' edited');
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeEnabled();
    // Revient à 'CGV'
    await user.clear(titleInput);
    await user.type(titleInput, 'CGV');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled(),
    );
  });

  it('Modifier description seul rend dirty', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const descInput = screen.getByDisplayValue('desc') as HTMLInputElement;
    await user.type(descInput, ' v2');
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeEnabled();
  });

  it('Toggle include_in_search rend dirty', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    await user.click(screen.getByRole('checkbox', { name: /sitemap/i }));
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeEnabled();
  });
});

describe('LegalEditor — error recovery', () => {
  it('après erreur 500, on peut re-cliquer Save (handler intermittent → 2e succès)', async () => {
    server.use(legalScenarios.intermittentFailure('cgv'));
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'CGV updated');

    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() =>
      expect(screen.getByText(/Erreur de sauvegarde/)).toBeInTheDocument(),
    );

    // Retry → succès
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(screen.getByText('✓ Enregistré')).toBeInTheDocument());
  });

  it('erreur réseau (fetch failed) → état error', async () => {
    server.use(
      http.patch('/api/admin/legal/cgv', () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.type(titleInput, ' changed');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() =>
      expect(screen.getByText(/Erreur de sauvegarde/)).toBeInTheDocument(),
    );
  });

  it('après 409, on reste dirty (changes locaux préservés)', async () => {
    server.use(legalScenarios.patchConflict('cgv'));
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'CGV local change');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Conflit de version/i })).toBeInTheDocument(),
    );
    // Save toujours actif (dirty préservé)
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeEnabled();
    expect(titleInput.value).toBe('CGV local change');
  });
});

describe('LegalEditor — auto-save', () => {
  it('auto-save déclenché après 30s d\'inactivité', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let saveCalled = 0;
    server.use(
      http.patch('/api/admin/legal/cgv', () => {
        saveCalled += 1;
        return HttpResponse.json({
          id: 'lp_x',
          slug: 'cgv',
          title: 'auto',
          description: null,
          body_md: 'x',
          status: 'draft',
          version: 2,
          updated_at: new Date().toISOString(),
        });
      }),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'auto');

    // Tick 30 secondes
    vi.advanceTimersByTime(30_000);
    await waitFor(() => expect(saveCalled).toBe(1), { timeout: 2000 });
  });
});

describe('LegalEditor — unmount safety', () => {
  it('unmount pendant le save ne crashe pas (suppression composant + setState)', async () => {
    let resolveFetch: (() => void) | undefined;
    server.use(
      http.patch('/api/admin/legal/cgv', async () => {
        await new Promise<void>((r) => {
          resolveFetch = r;
        });
        return HttpResponse.json({
          id: 'lp_x',
          slug: 'cgv',
          title: 'X',
          description: null,
          body_md: 'x',
          status: 'draft',
          version: 1,
          updated_at: new Date().toISOString(),
        });
      }),
    );

    const user = userEvent.setup();
    const { unmount } = render(<LegalEditor {...baseProps} />);
    const titleInput = screen.getByDisplayValue('CGV') as HTMLInputElement;
    await user.type(titleInput, ' x');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    // Unmount avant la fin du fetch
    unmount();
    if (resolveFetch) resolveFetch();

    // Si on a survécu, le test passe (pas d'unhandled exception)
    expect(true).toBe(true);
  });
});

describe('LegalEditor — preview', () => {
  it('preview est mise à jour à chaque édition du body', async () => {
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    const textarea = screen.getByDisplayValue(/# CGV body content/) as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, '## Section nouvelle');

    await waitFor(() => {
      // Preview doit refléter h2
      const preview = document.querySelector('[class*="overflow-y-auto"][class*="bg-stone-50"]');
      expect(preview?.innerHTML).toContain('<h2>Section nouvelle</h2>');
    });
  });
});

describe('LegalEditor — historique', () => {
  it('bouton Historique ouvre le drawer', async () => {
    server.use(
      http.get('/api/admin/legal/cgv/history', () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(<LegalEditor {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /Historique/ }));
    expect(
      screen.getByRole('dialog', { name: /Historique — cgv/i }),
    ).toBeInTheDocument();
  });
});
