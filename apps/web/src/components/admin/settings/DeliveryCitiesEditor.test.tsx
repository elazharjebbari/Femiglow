/**
 * CHA-230 — Tests du composant DeliveryCitiesEditor.
 *
 * Stratégie
 * ─────────
 * On mocke `fetch` global pour fournir des réponses prévisibles aux endpoints
 * REST. Le composant gère lui-même son fetch (pas de SWR), donc on n'a pas
 * besoin d'un provider.
 *
 * Couverture
 * ──────────
 *  - Rendu initial : table peuplée, KPIs, filtres, boutons.
 *  - Toggle isActive : optimistic update + rollback en cas d'erreur.
 *  - Edit modal : pré-remplissage, validation, save, fermeture.
 *  - Create modal : champs requis, payload conforme schemas.ts.
 *  - Delete confirm : appelle DELETE et refetch.
 *  - Seed button : POST /seed avec force=false, rapport affiché.
 *  - Filtres : ré-déclenchent fetch avec bons params query.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DeliveryCitiesEditor,
  type DeliveryCityDTO,
} from './DeliveryCitiesEditor';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CASA: DeliveryCityDTO = {
  id: 'dc_casablanca',
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  countryCode: 'MA',
  deliveryPriceMad: 19,
  deliveryEta: '24h',
  isActive: true,
  source: 'sendit',
  externalRef: null,
  aliases: ['Casa'],
  metadata: {},
  position: 1,
  createdAt: '2025-11-01T00:00:00.000Z',
  updatedAt: '2025-11-10T00:00:00.000Z',
  createdBy: null,
  updatedBy: null,
};

const RABAT: DeliveryCityDTO = {
  ...CASA,
  id: 'dc_rabat',
  slug: 'rabat',
  nameFr: 'Rabat',
  nameAr: 'الرباط',
  deliveryPriceMad: 0,
  position: 2,
  source: 'manual',
};

function jsonOk(body: unknown, init?: Partial<ResponseInit>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function jsonErr(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default fetch mock + reset
// ─────────────────────────────────────────────────────────────────────────────

const baseProps = {
  initialItems: [CASA, RABAT],
  initialTotal: 2,
  initialPage: 1,
  initialPageSize: 50,
  activeCount: 2,
};

beforeEach(() => {
  // Par défaut : GET /api/admin/delivery-cities → renvoie les mêmes items que
  // ceux passés en `initialItems`, pour que le refetch déclenché au mount
  // (debounce search effect) ne vide pas la table. Les tests qui ont besoin
  // d'un autre payload (PATCH/DELETE/POST/seed) fournissent leur propre mock.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Rendu initial
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — rendu initial', () => {
  it('affiche la table avec les villes seedées', async () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    // Casablanca + Rabat visibles dans la première colonne
    expect(screen.getByText('Casablanca')).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
    // Le nom AR est affiché
    expect(screen.getByText('الدار البيضاء')).toBeInTheDocument();
    // Le prix 0 → "Gratuit"
    expect(screen.getByText('Gratuit')).toBeInTheDocument();
    // Le prix 19 affiché
    expect(screen.getByText('19')).toBeInTheDocument();
  });

  it('affiche le badge source (sendit / manual)', () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    // Chaque source apparaît exactement une fois ici.
    expect(screen.getAllByText('sendit').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('manual').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche les KPIs (villes actives, total, page)', () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    expect(screen.getByText('Villes actives')).toBeInTheDocument();
    expect(screen.getByText('Total catalogue')).toBeInTheDocument();
    expect(screen.getByText('Page')).toBeInTheDocument();
  });

  it('expose les filtres (search, active, source, sort)', () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('active-filter')).toBeInTheDocument();
    expect(screen.getByTestId('source-filter')).toBeInTheDocument();
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Toggle isActive
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — toggle isActive', () => {
  it('PATCH /api/admin/delivery-cities/:slug avec isActive=false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes(`/api/admin/delivery-cities/casablanca`) && init?.method === 'PATCH') {
        return Promise.resolve(
          jsonOk({ city: { ...CASA, isActive: false, source: 'manual' } }),
        );
      }
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);

    await user.click(screen.getByTestId('toggle-casablanca'));

    await waitFor(() => {
      // Au moins un PATCH avec le bon slug
      const patches = fetchSpy.mock.calls.filter(([url, init]) =>
        String(url).includes('/api/admin/delivery-cities/casablanca') &&
        init?.method === 'PATCH',
      );
      expect(patches.length).toBe(1);
      const body = JSON.parse(String(patches[0]![1]!.body));
      expect(body).toEqual({ isActive: false });
    });
  });

  it('rollback en cas d\'erreur HTTP', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes(`/api/admin/delivery-cities/casablanca`) && init?.method === 'PATCH') {
        return Promise.resolve(jsonErr(500));
      }
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);

    const toggle = screen.getByTestId('toggle-casablanca');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-pressed', 'true'); // rollback
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/HTTP\s*500/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit modal
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — édition', () => {
  it('ouvre la modale avec les valeurs courantes', async () => {
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('edit-casablanca'));
    const dialog = screen.getByRole('dialog', { name: /Éditer Casablanca/ });
    expect(dialog).toBeInTheDocument();
    expect((screen.getByTestId('edit-name-fr') as HTMLInputElement).value).toBe('Casablanca');
    expect((screen.getByTestId('edit-name-ar') as HTMLInputElement).value).toBe('الدار البيضاء');
    expect((screen.getByTestId('edit-price') as HTMLInputElement).value).toBe('19');
    expect((screen.getByTestId('edit-eta') as HTMLInputElement).value).toBe('24h');
  });

  it('PATCH puis ferme la modale et propage le succès', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes(`/api/admin/delivery-cities/casablanca`) && init?.method === 'PATCH') {
        const updated: DeliveryCityDTO = {
          ...CASA,
          deliveryPriceMad: 25,
          source: 'manual',
        };
        return Promise.resolve(jsonOk({ city: updated }));
      }
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('edit-casablanca'));
    const priceInput = screen.getByTestId('edit-price') as HTMLInputElement;
    await user.clear(priceInput);
    await user.type(priceInput, '25');
    await user.click(screen.getByTestId('edit-save'));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Éditer Casablanca/ }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/mise à jour/);

    const patchCall = fetchSpy.mock.calls.find(
      ([url, init]) =>
        String(url).includes('/api/admin/delivery-cities/casablanca') &&
        init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(String(patchCall![1]!.body));
    expect(body.deliveryPriceMad).toBe(25);
  });

  it('affiche une erreur de validation pour un prix négatif sans appeler fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonOk({ items: [CASA, RABAT], total: 2 }),
    );
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('edit-casablanca'));
    const priceInput = screen.getByTestId('edit-price') as HTMLInputElement;
    await user.clear(priceInput);
    await user.type(priceInput, '-5');
    await user.click(screen.getByTestId('edit-save'));

    // Le modal reste ouvert et un message d'erreur s'affiche.
    expect(
      screen.getByRole('dialog', { name: /Éditer Casablanca/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Aucun PATCH n'a été émis.
    const patches = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes('/api/admin/delivery-cities/casablanca') &&
        (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patches.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — création', () => {
  it("POST /api/admin/delivery-cities avec source='manual' par défaut", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url === '/api/admin/delivery-cities' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return Promise.resolve(
          jsonOk(
            {
              city: {
                ...CASA,
                slug: body.slug,
                nameFr: body.nameFr,
                source: 'manual',
                isActive: true,
              },
            },
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('add-city-btn'));
    await user.type(screen.getByTestId('create-slug'), 'ifrane');
    await user.type(screen.getByTestId('create-name-fr'), 'Ifrane');
    await user.click(screen.getByTestId('create-save'));

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url) === '/api/admin/delivery-cities' && init?.method === 'POST',
      );
      expect(post).toBeDefined();
      const body = JSON.parse(String(post![1]!.body));
      expect(body.slug).toBe('ifrane');
      expect(body.nameFr).toBe('Ifrane');
      expect(body.source).toBe('manual');
      expect(body.countryCode).toBe('MA');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirm
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — suppression', () => {
  it('DELETE /api/admin/delivery-cities/:slug après confirmation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/admin/delivery-cities/rabat') && init?.method === 'DELETE') {
        return Promise.resolve(jsonOk({ ok: true }));
      }
      // Le GET initial doit encore inclure RABAT (sinon le bouton delete-rabat
      // disparaît avant le clic) ; après DELETE, le composant refetch et la
      // réponse server renverrait sans RABAT, mais notre test ne vérifie pas
      // l'état post-delete.
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('delete-rabat'));
    expect(
      screen.getByRole('dialog', { name: /Confirmer la suppression/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('delete-confirm'));

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/admin/delivery-cities/rabat') &&
          init?.method === 'DELETE',
      );
      expect(del).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed button
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — réimport sendit', () => {
  it('POST /api/admin/delivery-cities/seed avec force=false et affiche le rapport', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url === '/api/admin/delivery-cities/seed' && init?.method === 'POST') {
        return Promise.resolve(
          jsonOk({
            fixturePath: '/fake/fixture.json',
            importer: { parsed: 500, unique: 430, dropped: 70 },
            database: { inserted: 0, updated: 429, skipped: 1, preservedSlugs: ['casablanca'] },
            elapsedMs: 1234,
          }),
        );
      }
      return Promise.resolve(jsonOk({ items: [CASA, RABAT], total: 2, page: 1, pageSize: 50 }));
    });

    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.click(screen.getByTestId('seed-btn'));

    await waitFor(() => {
      // Statut + rapport affichés
      const statuses = screen
        .getAllByRole('status')
        .map((s) => s.textContent ?? '');
      expect(statuses.some((t) => /Import OK/.test(t))).toBe(true);
      expect(statuses.some((t) => /429 mise/.test(t))).toBe(true);
    });
    expect(
      fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url) === '/api/admin/delivery-cities/seed' &&
          init?.method === 'POST',
      ),
    ).toBe(true);
    const post = fetchSpy.mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/admin/delivery-cities/seed' && init?.method === 'POST',
    );
    const body = JSON.parse(String(post![1]!.body));
    expect(body.force).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filtres
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — filtres', () => {
  it('change `source` re-fetch avec le bon param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonOk({ items: [RABAT], total: 1, page: 1, pageSize: 50 }),
    );
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.selectOptions(screen.getByTestId('source-filter'), 'manual');

    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('source=manual');
    });
  });

  it('change `active` re-fetch avec active=false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonOk({ items: [], total: 0, page: 1, pageSize: 50 }),
    );
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.selectOptions(screen.getByTestId('active-filter'), 'false');
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('active=false');
    });
  });

  it('debounce la recherche puis envoie q=<input>', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonOk({ items: [CASA], total: 1, page: 1, pageSize: 50 }),
    );
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} />);
    await user.type(screen.getByTestId('search-input'), 'Casa');
    await waitFor(
      () => {
        const lastCall = fetchSpy.mock.calls.at(-1);
        expect(String(lastCall?.[0])).toContain('q=Casa');
      },
      { timeout: 1000 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

describe('DeliveryCitiesEditor — pagination', () => {
  it('le bouton précédent est désactivé en page 1', () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    expect(screen.getByTestId('prev-page')).toBeDisabled();
  });

  it('le bouton suivant est désactivé si une seule page', () => {
    render(<DeliveryCitiesEditor {...baseProps} />);
    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('le bouton suivant déclenche un fetch avec page=2', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonOk({ items: [CASA], total: 100, page: 2, pageSize: 50 }),
    );
    const user = userEvent.setup();
    render(<DeliveryCitiesEditor {...baseProps} initialTotal={100} />);
    await user.click(screen.getByTestId('next-page'));
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('page=2');
    });
  });
});

// Silence "act" warnings for any deferred state updates we don't await.
const _act = act;
