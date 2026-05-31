import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { SlugRedirectsManager } from '../SlugRedirectsManager';

const SAMPLE = [
  {
    old_slug: 'cgv-old',
    new_slug: 'cgv',
    created_at: '2026-05-01T00:00:00Z',
    created_by: 'adm_X',
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SlugRedirectsManager — rendu', () => {
  it('affiche les redirects initiaux', () => {
    render(<SlugRedirectsManager initial={SAMPLE} />);
    expect(screen.getByText('/legal/cgv-old')).toBeInTheDocument();
    expect(screen.getByText('/legal/cgv')).toBeInTheDocument();
  });

  it('affiche le total', () => {
    render(<SlugRedirectsManager initial={SAMPLE} />);
    expect(screen.getByText(/Redirects existants \(1\)/)).toBeInTheDocument();
  });

  it('si initial=[] affiche message "Aucun"', () => {
    render(<SlugRedirectsManager initial={[]} />);
    expect(screen.getByText(/Aucun redirect configuré/)).toBeInTheDocument();
  });
});

describe('SlugRedirectsManager — création', () => {
  it('POST + ajoute à la table en succès', async () => {
    let createdBody: unknown = null;
    server.use(
      http.post('/api/admin/legal/redirects', async ({ request }) => {
        createdBody = await request.json();
        return HttpResponse.json(
          {
            old_slug: 'nouveau',
            new_slug: 'cible',
            created_at: new Date().toISOString(),
            created_by: 'adm_r',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={[]} />);
    await user.type(screen.getByPlaceholderText('conditions-vente'), 'nouveau');
    await user.type(screen.getByPlaceholderText('cgv'), 'cible');
    await user.click(screen.getByRole('button', { name: /^Créer$/ }));

    await waitFor(() => expect(createdBody).toEqual({ oldSlug: 'nouveau', newSlug: 'cible' }));
    await waitFor(() => expect(screen.getByText('/legal/nouveau')).toBeInTheDocument());
  });

  it('400 identical → message d\'erreur', async () => {
    server.use(
      http.post('/api/admin/legal/redirects', () =>
        HttpResponse.json(
          { error: { code: 'invalid_input', message: 'old_slug et new_slug identiques.' } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={[]} />);
    await user.type(screen.getByPlaceholderText('conditions-vente'), 'same');
    await user.type(screen.getByPlaceholderText('cgv'), 'same');
    await user.click(screen.getByRole('button', { name: /^Créer$/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/identiques/),
    );
  });

  it('409 duplicate → message d\'erreur dédié', async () => {
    server.use(
      http.post('/api/admin/legal/redirects', () =>
        HttpResponse.json(
          { error: { code: 'conflict', message: 'Ce slug a déjà un redirect.' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={[]} />);
    await user.type(screen.getByPlaceholderText('conditions-vente'), 'old-slug');
    await user.type(screen.getByPlaceholderText('cgv'), 'new-slug');
    await user.click(screen.getByRole('button', { name: /^Créer$/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/déjà un redirect/),
    );
  });

  it('Créer désactivé tant qu\'oldSlug ou newSlug vides', () => {
    render(<SlugRedirectsManager initial={[]} />);
    const btn = screen.getByRole('button', { name: /^Créer$/ });
    expect(btn).toBeDisabled();
  });
});

describe('SlugRedirectsManager — suppression', () => {
  it('confirm + DELETE → retire de la table', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.delete('/api/admin/legal/redirects', () => HttpResponse.json({ ok: true })),
    );
    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={SAMPLE} />);
    await user.click(screen.getByRole('button', { name: /Supprimer/ }));
    await waitFor(() =>
      expect(screen.queryByText('/legal/cgv-old')).not.toBeInTheDocument(),
    );
  });

  it('confirm refusé → pas d\'appel API', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    let deleted = false;
    server.use(
      http.delete('/api/admin/legal/redirects', () => {
        deleted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={SAMPLE} />);
    await user.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(deleted).toBe(false);
    expect(screen.getByText('/legal/cgv-old')).toBeInTheDocument();
  });

  it('DELETE 500 → message d\'erreur, ligne reste', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.delete('/api/admin/legal/redirects', () =>
        HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(<SlugRedirectsManager initial={SAMPLE} />);
    await user.click(screen.getByRole('button', { name: /Supprimer/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/HTTP 500/),
    );
    expect(screen.getByText('/legal/cgv-old')).toBeInTheDocument();
  });
});
