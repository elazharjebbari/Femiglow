/**
 * AUD-AC-001..004 — Autocomplétions du builder d'audiences (tags, produits,
 * templates) sous MSW.
 *
 * Oracle central anti-« faux résultats » : sur succès, les suggestions de
 * l'API apparaissent dans le `<datalist>` ; sur erreur 500, AUCUNE suggestion
 * fantôme (datalist vide) et l'input reste libre/utilisable.
 *
 * Détail harnais : ces composants mémoïsent leur fetch dans un cache au niveau
 * MODULE (`let cache`). Pour isoler chaque test (succès vs erreur), on importe
 * le composant via `vi.resetModules()` + import dynamique → cache frais à chaque
 * fois. Lifecycle MSW par fichier (cf. conventions §8).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
  describe,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';

const TAGS_URL = '/api/admin/leads/tags/autocomplete';
const PRODUCTS_URL = '/api/admin/catalog/products/autocomplete';
const TEMPLATES_URL = '/api/admin/emails/templates/autocomplete';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.resetModules(); // cache module des autocompletes remis à zéro
});

/** Compte les <option> rendues dans le datalist du composant. */
function optionValues(): string[] {
  return Array.from(document.querySelectorAll('datalist option')).map(
    (o) => (o as HTMLOptionElement).value,
  );
}

// ── AUD-AC-001 / 002 — TagAutocomplete ──────────────────────────────────
describe('TagAutocomplete', () => {
  it('AUD-AC-001 : succès → propose les tags de l’API dans le datalist', async () => {
    server.use(
      http.get(TAGS_URL, () =>
        HttpResponse.json({ tags: [{ tag: 'vip', count: 12 }, { tag: 'premium', count: 3 }] }),
      ),
    );
    const { TagAutocomplete } = await import('./TagAutocomplete');
    render(<TagAutocomplete value="" onChange={vi.fn()} />);

    await waitFor(() => expect(optionValues()).toContain('vip'));
    expect(optionValues()).toEqual(expect.arrayContaining(['vip', 'premium']));
  });

  it('AUD-AC-002 : erreur 500 → AUCUNE suggestion fantôme (datalist vide), input toujours présent', async () => {
    let hits = 0;
    server.use(
      http.get(TAGS_URL, () => {
        hits += 1;
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
    );
    const { TagAutocomplete } = await import('./TagAutocomplete');
    render(<TagAutocomplete value="" onChange={vi.fn()} placeholder="vip" />);

    // Oracle déterministe : le fetch a bien été tenté (chemin d'erreur exécuté)
    // → aucune option fantôme, input toujours présent (saisie libre possible).
    await waitFor(() => expect(hits).toBeGreaterThan(0));
    expect(optionValues()).toEqual([]);
    expect(screen.getByPlaceholderText('vip')).toBeInTheDocument();
  });
});

// ── AUD-AC-003 — ProductAutocomplete ────────────────────────────────────
describe('ProductAutocomplete', () => {
  it('AUD-AC-003 : succès → propose les produits filtrés de l’API', async () => {
    server.use(
      http.get(PRODUCTS_URL, () =>
        HttpResponse.json({
          products: [
            { id: 'p1', slug: 'serum-eclat', title: 'Sérum éclat', status: 'active' },
            { id: 'p2', slug: 'masque-nuit', title: 'Masque nuit', status: 'draft' },
          ],
        }),
      ),
    );
    const { ProductAutocomplete } = await import('./ProductAutocomplete');
    render(<ProductAutocomplete value="" onChange={vi.fn()} />);

    await waitFor(() => expect(optionValues().length).toBeGreaterThan(0));
    // L'option value est le SLUG (pas l'id) — c'est ce que consomme le builder.
    expect(optionValues()).toEqual(expect.arrayContaining(['serum-eclat', 'masque-nuit']));
  });

  it('ProductAutocomplete : erreur 500 → pas de produit fantôme (fetch tenté, datalist vide)', async () => {
    let hits = 0;
    server.use(
      http.get(PRODUCTS_URL, () => {
        hits += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const { ProductAutocomplete } = await import('./ProductAutocomplete');
    render(<ProductAutocomplete value="" onChange={vi.fn()} placeholder="kit" />);

    // Oracle déterministe : on attend que le fetch ait BIEN été tenté (hits>0),
    // ce qui garantit que le chemin d'erreur a été exécuté — puis on prouve
    // qu'aucune option fantôme n'a été injectée et que l'input reste utilisable.
    await waitFor(() => expect(hits).toBeGreaterThan(0));
    expect(optionValues()).toEqual([]);
    expect(screen.getByPlaceholderText('kit')).toBeInTheDocument();
  });
});

// ── AUD-AC-004 — TemplateAutocomplete ───────────────────────────────────
describe('TemplateAutocomplete', () => {
  it('AUD-AC-004 : succès → propose les templates de l’API', async () => {
    server.use(
      http.get(TEMPLATES_URL, () =>
        HttpResponse.json({
          templates: [
            { slug: 'welcome', name: 'Bienvenue', source: 'system' },
            { slug: 'order-confirmation', name: 'Confirmation', source: 'custom' },
          ],
        }),
      ),
    );
    const { TemplateAutocomplete } = await import('./TemplateAutocomplete');
    render(<TemplateAutocomplete value="" onChange={vi.fn()} />);

    await waitFor(() => expect(optionValues().length).toBeGreaterThan(0));
    expect(optionValues()).toEqual(expect.arrayContaining(['welcome', 'order-confirmation']));
  });
});
