import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { LegalHistoryDrawer } from '../LegalHistoryDrawer';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const HISTORY_FIXTURE = [
  {
    id: 'lph_1',
    version: 1,
    published_at: '2026-04-01T00:00:00Z',
    published_by: 'adm_1',
    title: 'CGV',
    body_md_excerpt: 'CGV v1 body...',
    git_commit_sha: null,
  },
  {
    id: 'lph_2',
    version: 2,
    published_at: '2026-04-15T00:00:00Z',
    published_by: 'adm_1',
    title: 'CGV',
    body_md_excerpt: 'CGV v2 body...',
    git_commit_sha: null,
  },
];

const DIFF_FIXTURE = {
  from: { version: 1, publishedAt: '2026-04-01T00:00:00Z' },
  to: { version: 3, publishedAt: '2026-05-01T00:00:00Z' },
  added: 2,
  removed: 1,
  hunks: [
    {
      fromStart: 1,
      toStart: 1,
      lines: [
        { op: 'equal', text: 'context line' },
        { op: 'remove', text: 'removed line' },
        { op: 'add', text: 'added line 1' },
        { op: 'add', text: 'added line 2' },
      ],
    },
  ],
};

function defaultHandlers() {
  server.use(
    http.get('/api/admin/legal/cgv/history', () => HttpResponse.json(HISTORY_FIXTURE)),
    http.get('/api/admin/legal/cgv/diff/:v1/:v2', () => HttpResponse.json(DIFF_FIXTURE)),
    http.post('/api/admin/legal/cgv/restore/:v', () => HttpResponse.json({ ok: true })),
  );
}

describe('LegalHistoryDrawer', () => {
  it('ne rend rien si open=false', () => {
    const { container } = render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open={false}
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('charge l\'historique et affiche les versions', async () => {
    defaultHandlers();
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
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('cliquer sur une version charge le diff', async () => {
    defaultHandlers();
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
    await waitFor(() => expect(screen.getByText(/added line 1/)).toBeInTheDocument());
    expect(screen.getByText(/removed line/)).toBeInTheDocument();
    // Stats +2 / -1
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('−1')).toBeInTheDocument();
  });

  it('bouton Restaurer absent si selectedV === currentVersion', async () => {
    defaultHandlers();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={2}
        open
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );
    await user.click(await screen.findByText('v2'));
    await waitFor(() => expect(screen.getByText(/added line 1/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Restaurer v2/ })).not.toBeInTheDocument();
  });

  it('Restaurer appelle l\'API + onRestored', async () => {
    defaultHandlers();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onRestored = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={onClose}
        onRestored={onRestored}
      />,
    );
    await user.click(await screen.findByText('v1'));
    await waitFor(() => expect(screen.getByText(/added line 1/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Restaurer v1/ }));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('appelle onClose au clic sur ✕', async () => {
    defaultHandlers();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <LegalHistoryDrawer
        slug="cgv"
        currentVersion={3}
        open
        onClose={onClose}
        onRestored={() => {}}
      />,
    );
    await user.click(screen.getByLabelText(/Fermer l'historique/));
    expect(onClose).toHaveBeenCalled();
  });
});
