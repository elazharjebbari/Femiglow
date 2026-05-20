# Tests — Villes prioritaires

## 1. Tests unitaires Vitest

### 1.1 `moroccan-cities.test.ts` — Nouveaux cas

```typescript
describe('searchCities — villes prioritaires', () => {
  it('retourne les villes优先 en tête quand la query est vide', () => {
    const results = searchCities('', 13);
    // Les 13 villes优先 doivent être en tête
    const prioritySlugs = results
      .filter(c => c.position > 0)
      .map(c => c.value);
    expect(prioritySlugs).toEqual([
      'casablanca', 'marrakech', 'tanger', 'agadir',
      'kenitra', 'fes', 'meknes', 'tetouan',
      'dar-bouaza', 'mohammedia', 'el-jadida',
      'bouskoura-ville-verte', 'oujda',
    ]);
  });

  it('trie les villes non优先 alphabétiquement après les优先', () => {
    const results = searchCities('', 50);
    const firstNonPriority = results.find(c => c.position === 0);
    // Les villes优先 ont toutes position > 0
    const priorityCount = results.filter(c => c.position > 0).length;
    expect(priorityCount).toBe(13);
    // Les villes non优先 sont triées alphabétiquement
    const nonPriority = results.slice(priorityCount);
    for (let i = 1; i < nonPriority.length; i++) {
      expect(nonPriority[i].label >= nonPriority[i-1].label).toBe(true);
    }
  });

  it('respecte la limite même avec des villes优先', () => {
    const results = searchCities('', 5);
    expect(results.length).toBe(5);
    expect(results.every(c => c.position > 0)).toBe(true);
  });

  it('les villes优先 restent en tête lors d\'une recherche', () => {
    const results = searchCities('a', 8);
    // Casablanca (pos 1) et Agadir (pos 4) doivent apparaître
    const casaIdx = results.findIndex(c => c.value === 'casablanca');
    const agadirIdx = results.findIndex(c => c.value === 'agadir');
    if (casaIdx !== -1 && agadirIdx !== -1) {
      expect(casaIdx).toBeLessThan(agadirIdx); // position inférieure = en tête
    }
  });
});

describe('matchCity — villes ajoutées', () => {
  it('reconnaît Bouskoura-Ville Verte', () => {
    expect(matchCity('Bouskoura')).not.toBeNull();
    expect(matchCity('Bouskoura')?.value).toBe('bouskoura-ville-verte');
  });

  it('reconnaît Dar Bouaza', () => {
    expect(matchCity('Dar Bouaza')).not.toBeNull();
    expect(matchCity('Dar Bouaza')?.value).toBe('dar-bouaza');
  });
});
```

### 1.2 `delivery-cities.test.ts` — Query `updateDeliveryCityPositions`

```typescript
describe('updateDeliveryCityPositions', () => {
  it('met à jour les positions de plusieurs villes', async () => {
    const result = await updateDeliveryCityPositions([
      { slug: 'casablanca', position: 1 },
      { slug: 'marrakech', position: 2 },
      { slug: 'tanger', position: 3 },
    ], { actorId: 'admin-test' });

    expect(result.updated).toBe(3);
    expect(result.notFound).toEqual([]);
  });

  it('signale les slugs introuvables', async () => {
    const result = await updateDeliveryCityPositions([
      { slug: 'ville-inexistante', position: 99 },
    ]);
    expect(result.updated).toBe(0);
    expect(result.notFound).toEqual(['ville-inexistante']);
  });

  it('préserve les autres champs', async () => {
    await updateDeliveryCityPositions([
      { slug: 'casablanca', position: 1 },
    ]);
    const city = await findDeliveryCityBySlug('casablanca');
    expect(city?.position).toBe(1);
    expect(city?.nameFr).toBe('Casablanca'); // inchangé
    expect(city?.deliveryPriceMad).toBeDefined(); // inchangé
  });
});
```

### 1.3 `positions/route.test.ts` — API endpoint

```typescript
describe('PATCH /api/admin/delivery-cities/positions', () => {
  it('met à jour les positions', async () => {
    const res = await PATCH(new Request('http://localhost/api/admin/delivery-cities/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminSessionHeaders },
      body: JSON.stringify({
        positions: [
          { slug: 'casablanca', position: 1 },
          { slug: 'marrakech', position: 2 },
        ],
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated).toBe(2);
  });

  it('rejette un slug introuvable', async () => {
    const res = await PATCH(new Request('http://localhost/api/admin/delivery-cities/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminSessionHeaders },
      body: JSON.stringify({
        positions: [
          { slug: 'fake-city', position: 1 },
        ],
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notFound).toContain('fake-city');
  });

  it('rejette les positions négatives', async () => {
    const res = await PATCH(new Request('http://localhost/api/admin/delivery-cities/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminSessionHeaders },
      body: JSON.stringify({
        positions: [
          { slug: 'casablanca', position: -1 },
        ],
      }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejette les requêtes non authentifiées', async () => {
    const res = await PATCH(new Request('http://localhost/api/admin/delivery-cities/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions: [{ slug: 'casablanca', position: 1 }],
      }),
    }));
    expect(res.status).toBe(302); // redirect to login
  });
});
```

## 2. Tests Playwright (e2e)

### 2.1 `delivery-cities-priority.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin — Villes优先', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    // ... login as admin
  });

  test('affiche l\'onglet Villes优先', async ({ page }) => {
    await page.goto('/admin/settings/delivery-cities');
    await expect(page.getByRole('tab', { name: /villes优先/i })).toBeVisible();
  });

  test('liste les villes优先 dans l\'ordre', async ({ page }) => {
    await page.goto('/admin/settings/delivery-cities');
    await page.getByRole('tab', { name: /villes优先/i }).click();
    const items = page.getByTestId('priority-item');
    await expect(items).toHaveCount(13);
    // Casablanca en premier
    await expect(items.first()).toContainText('Casablanca');
  });

  test('retire une ville de la liste优先', async ({ page }) => {
    await page.goto('/admin/settings/delivery-cities');
    await page.getByRole('tab', { name: /villes优先/i }).click();
    const tangerRow = page.getByTestId('priority-item').filter({ hasText: 'Tanger' });
    await tangerRow.getByRole('button', { name: /retirer/i }).click();
    await expect(page.getByText(/tanger retirée/i)).toBeVisible();
  });

  test('ajoute une ville à la liste优先', async ({ page }) => {
    await page.goto('/admin/settings/delivery-cities');
    await page.getByRole('tab', { name: /villes优先/i }).click();
    await page.getByRole('button', { name: /ajouter une ville/i }).click();
    // ... type in autocomplete, select city
  });
});

test.describe('Checkout — Autocomplete villes优先', () => {
  test('affiche les villes populaires au focus', async ({ page }) => {
    await page.goto('/kit#commander-femiglow');
    // ... navigate to step 2
    await page.getByLabel(/ville/i).click();
    // Vérifie que le label "Villes populaires" est visible
    await expect(page.getByText(/villes populaires/i)).toBeVisible();
    // Vérifie que Casablanca est en premier
    const options = page.getByRole('option');
    await expect(options.first()).toContainText('Casablanca');
  });
});
```

## 3. Tests MSW (Mock Service Worker)

### 3.1 Handlers pour l'admin

```typescript
// src/mocks/handlers/delivery-cities.ts

import { http, HttpResponse } from 'msw';

export const deliveryCitiesHandlers = [
  // GET /api/admin/delivery-cities?sort=position&active=true
  http.get('/api/admin/delivery-cities', ({ request }) => {
    const url = new URL(request.url);
    const sort = url.searchParams.get('sort');
    const active = url.searchParams.get('active');

    let items = [...mockCities];
    if (active === 'true') items = items.filter(c => c.isActive);
    if (sort === 'position') {
      items.sort((a, b) => {
        if (a.position > 0 && b.position > 0) return a.position - b.position;
        if (a.position > 0) return -1;
        if (b.position > 0) return 1;
        return a.nameFr.localeCompare(b.nameFr);
      });
    }
    return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 50 });
  }),

  // PATCH /api/admin/delivery-cities/positions
  http.patch('/api/admin/delivery-cities/positions', async ({ request }) => {
    const body = await request.json() as { positions: Array<{ slug: string; position: number }> };
    let updated = 0;
    const notFound: string[] = [];
    for (const patch of body.positions) {
      const city = mockCities.find(c => c.slug === patch.slug);
      if (city) {
        city.position = patch.position;
        updated++;
      } else {
        notFound.push(patch.slug);
      }
    }
    return HttpResponse.json({ updated, notFound, positions: body.positions });
  }),
];
```