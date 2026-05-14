/**
 * Hardening — LegalHistoryDrawer : clics rapides sur versions, erreurs
 * réseau, refus de restore, rapid double-click sur Restaurer.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { LegalHistoryDrawer } from '../LegalHistoryDrawer';

const HISTORY = [
  {
    id: 'lph_1',
    version: 1,
    published_at: '2026-04-01T00:00:00Z',
    published_by: 'adm_1',
    title: 'v1',
    body_md_excerpt: '...',
    git_commit_sha: null,
  },
  {
    id: 'lph_2',
    version: 2,
    published_at: '2026-04-15T00:00:00Z',
    published_by: 'adm_1',
    title: 'v2',
    body_md_excerpt: '...',
    git_commit_sha: null,
  },
];

const DIFF = (v: number) => ({
  from: { version: v, publishedAt: '2026-04-01T00:00:00Z' },
  to: { version: 3, publishedAt: '2026-05-01T00:00:00Z' },
  added: 1,
  removed: 0,
  hunks: [
    {
      fromStart: 1,
      toStart: 1,
      lines: [{ op: 'add', text: `added v${v}` }],
    },
  ],
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function defaults() {
  server.use(
    http.get('/api/admin/legal/cgv/history', () => HttpResponse.json(HISTORY)),
    http.get('/api/admin/legal/cgv/diff/:v1/:v2', ({ params }) =>
      HttpResponse.json(DIFF(Number(params.v1))),
    ),
    http.post('/api/admin/legal/cgv/restore/:v', () => HttpResponse.json({ ok: true })),
  );
}

describe('Drawer — switch rapide entre versions', () => {
  it('cliquer v1 puis v2 affiche le diff v2 (et pas v1 stale)', async () => {
    defaults();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('v1')).toBeInTheDocument());
    await user.click(screen.getByText('v1'));
    await user.click(screen.getByText('v2'));

    // Le contenu final doit refléter v2
    await waitFor(() => expect(screen.getByText(/added v2/)).toBeInTheDocument());
    expect(screen.queryByText(/added v1/)).not.toBeInTheDocument();
  });
});

describe('Drawer — erreurs réseau', () => {
  it('history fetch fail → affiche message d\'erreur', async () => {
    server.use(
      http.get('/api/admin/legal/cgv/history', () =>
        HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 }),
      ),
    );
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/HTTP 500/)).toBeInTheDocument());
  });

  it('diff fetch fail → affiche erreur sans crasher', async () => {
    server.use(
      http.get('/api/admin/legal/cgv/history', () => HttpResponse.json(HISTORY)),
      http.get('/api/admin/legal/cgv/diff/:v1/:v2', () =>
        HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    await user.click(await screen.findByText('v1'));
    await waitFor(() => expect(screen.getByText(/HTTP 404/)).toBeInTheDocument());
  });
});

describe('Drawer — restore confirmation', () => {
  it('confirm refusé → aucun POST + onRestored pas appelé', async () => {
    defaults();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    let restorePosted = false;
    server.use(
      http.post('/api/admin/legal/cgv/restore/:v', () => {
        restorePosted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const onRestored = vi.fn();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={onRestored}
      />,
    );
    await user.click(await screen.findByText('v1'));
    await waitFor(() => expect(screen.getByText(/added v1/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Restaurer v1/ }));

    expect(restorePosted).toBe(false);
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('restore échoue (500) → message d\'erreur, onRestored pas appelé', async () => {
    defaults();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.post('/api/admin/legal/cgv/restore/:v', () =>
        HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 }),
      ),
    );
    const onRestored = vi.fn();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={onRestored}
      />,
    );
    await user.click(await screen.findByText('v1'));
    await waitFor(() => expect(screen.getByText(/added v1/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Restaurer v1/ }));

    await waitFor(() => expect(screen.getByText(/HTTP 500/)).toBeInTheDocument());
    expect(onRestored).not.toHaveBeenCalled();
  });
});

describe('Drawer — accessibilité', () => {
  it('a role="dialog" et aria-labelledby pointant vers le titre', async () => {
    defaults();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'legal-history-title');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('bouton Fermer a aria-label explicite', async () => {
    defaults();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Fermer l'historique/)).toBeInTheDocument();
  });
});
