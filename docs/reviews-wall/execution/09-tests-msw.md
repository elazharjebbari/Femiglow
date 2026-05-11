# 09 — Tests MSW : handlers et scénarios d'intégration

Catalogue des handlers MSW pour simuler l'API du composant « Rituels partagés », et scénarios d'intégration des composants front avec ces handlers. MSW v2 (Mock Service Worker) intercepte les requêtes `fetch` au runtime, permettant de tester les composants `*Bound` et les hooks sans backend réel.

## 1. Setup MSW

### 1.1 Server

`apps/web/src/test/msw/server.ts` :

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 1.2 Vitest setup

`apps/web/vitest.setup.ts` :

```ts
import { server } from './src/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 1.3 Browser worker (pour Storybook ou dev mock)

`apps/web/src/test/msw/browser.ts` :

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

Démarré via `if (process.env.NEXT_PUBLIC_MSW === 'true') worker.start()` dans un effet de mount.

### 1.4 Structure du dossier handlers

```
apps/web/src/test/msw/
├── server.ts
├── browser.ts
├── handlers/
│   ├── index.ts           ← agrège tous les handlers
│   ├── rituals.ts          ← public
│   ├── rituals-admin.ts    ← admin
│   ├── upload.ts           ← upload-photo
│   └── shared.ts           ← utilitaires (cursor encode, etc.)
└── fixtures/
    └── (utilise src/test/fixtures/rituals.ts)
```

## 2. Handlers — API publique

### 2.1 `handlers/rituals.ts`

```ts
import { http, HttpResponse, delay } from 'msw';
import { ritualFixtures, makeRitualListFixture } from '@/test/fixtures/rituals';

const API = 'http://localhost:3000/api/rituals';

export const ritualHandlers = {
  /** Cas nominal : 26 rituels, 24 oui */
  default: [
    http.get(`${API}/summary`, () => {
      return HttpResponse.json({
        data: {
          productKey: 'pack-femiglow',
          totalCount: 26,
          ouiCount: 24,
          hesiteCount: 1,
          nonCount: 1,
          withPhotosCount: 18,
          topTags: [
            { tag: 'ongles-plus-lisses', count: 17 },
            { tag: 'plaque-souple', count: 14 },
            { tag: 'cuticules-apaisees', count: 11 },
          ],
          lastPublishedAt: '2026-05-08T14:32:00Z',
        },
      });
    }),
    http.get(`${API}/list`, ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      const limit = Number(url.searchParams.get('limit') ?? 12);
      const allItems = makeRitualListFixture(26);
      const startIdx = cursor ? decodeCursor(cursor).index : 0;
      const items = allItems.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + limit < allItems.length;
      const nextCursor = hasMore ? encodeCursor({ index: startIdx + limit }) : null;
      return HttpResponse.json({ data: items, meta: { nextCursor, hasMore, total: allItems.length } });
    }),
    http.get(`${API}/policy`, () => {
      return HttpResponse.json({
        data: { text: '# Comment ces rituels partagés sont vérifiés\n\n...' },
      });
    }),
    http.post(`${API}/submit`, async ({ request }) => {
      const body = await request.json();
      await delay(50); // simulate network
      return HttpResponse.json(
        { data: { publicSlug: 'new-slug', status: 'PENDING', estimatedPublishHours: 48 } },
        { status: 202 }
      );
    }),
    http.post(`${API}/upload-photo`, async ({ request }) => {
      await delay(200);
      return HttpResponse.json({
        data: {
          blobKey: 'fake-blob-key',
          url: 'https://example.com/photo-full.webp',
          thumbUrl: 'https://example.com/photo-thumb.webp',
          width: 800,
          height: 1000,
        },
      });
    }),
  ],

  /** Cas : 0 rituel (empty state) */
  empty: [
    http.get(`${API}/summary`, () => HttpResponse.json({
      data: { totalCount: 0, ouiCount: 0, hesiteCount: 0, nonCount: 0, withPhotosCount: 0, topTags: [], lastPublishedAt: null }
    })),
    http.get(`${API}/list`, () => HttpResponse.json({ data: [], meta: { nextCursor: null, hasMore: false, total: 0 } })),
  ],

  /** Cas : exactement 1 rituel (singulier) */
  singleton: [
    http.get(`${API}/summary`, () => HttpResponse.json({
      data: { totalCount: 1, ouiCount: 1, hesiteCount: 0, nonCount: 0, withPhotosCount: 1, topTags: [], lastPublishedAt: '2026-05-01T10:00:00Z' }
    })),
    http.get(`${API}/list`, () => HttpResponse.json({ data: [ritualFixtures.basic], meta: { nextCursor: null, hasMore: false, total: 1 } })),
  ],

  /** Cas : erreur réseau 500 */
  serverError: [
    http.get(`${API}/summary`, () => HttpResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })),
    http.get(`${API}/list`, () => HttpResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })),
  ],

  /** Cas : timeout (latence > UI) */
  slow: [
    http.get(`${API}/summary`, async () => { await delay(5000); return HttpResponse.json({ data: {...} }); }),
    http.get(`${API}/list`, async () => { await delay(5000); return HttpResponse.json({ data: [], meta: { nextCursor: null, hasMore: false, total: 0 } }); }),
  ],

  /** Cas : submit rate-limit */
  submitRateLimited: [
    http.post(`${API}/submit`, () => HttpResponse.json({
      error: { code: 'RATE_LIMIT', message: 'La maison a déjà reçu votre voix récemment.' }
    }, { status: 429 })),
  ],

  /** Cas : submit validation error */
  submitValidationError: [
    http.post(`${API}/submit`, () => HttpResponse.json({
      error: { code: 'VALIDATION_ERROR', message: 'Body too short' }
    }, { status: 400 })),
  ],

  /** Cas : upload photo trop grosse */
  uploadTooBig: [
    http.post(`${API}/upload-photo`, () => HttpResponse.json({
      error: { code: 'PHOTO_TOO_LARGE' }
    }, { status: 400 })),
  ],

  /** Cas : upload photo avec face détecté */
  uploadFaceDetected: [
    http.post(`${API}/upload-photo`, () => HttpResponse.json({
      data: {
        blobKey: 'fake-key',
        url: '...',
        thumbUrl: '...',
        facesStatus: 'REJECTED_FACE',
      },
    })),
  ],

  /** Cas : pagination cursor */
  listPaginatedPage1: [
    http.get(`${API}/list`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('cursor')) return passthrough();
      return HttpResponse.json({ data: makeRitualListFixture(12), meta: { nextCursor: 'cursor-page-2', hasMore: true, total: 24 } });
    }),
  ],

  listPaginatedPage2: [
    http.get(`${API}/list`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('cursor') !== 'cursor-page-2') return passthrough();
      return HttpResponse.json({ data: makeRitualListFixture(12, 12), meta: { nextCursor: null, hasMore: false, total: 24 } });
    }),
  ],

  /** Cas : filtre with_photos retourne 18 */
  listWithPhotosOnly: [
    http.get(`${API}/list`, ({ request }) => {
      const url = new URL(request.url);
      const withPhotos = url.searchParams.get('with_photos') === '1';
      const items = makeRitualListFixture(withPhotos ? 18 : 26);
      return HttpResponse.json({ data: items.slice(0, 12), meta: { nextCursor: 'next', hasMore: true, total: items.length } });
    }),
  ],

  /** Cas : email token valide → décodé */
  decodeEmailTokenValid: [
    http.post(`${API}/decode-email-token`, async ({ request }) => {
      const { token } = await request.json();
      if (token === 'valid-token') {
        return HttpResponse.json({
          data: { productKey: 'pack-femiglow', customerFirstName: 'Amal', customerCity: 'Rabat' }
        });
      }
      return HttpResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 401 });
    }),
  ],
};
```

### 2.2 `handlers/rituals-admin.ts`

```ts
import { http, HttpResponse } from 'msw';
import { ritualFixtures, makeRitualListFixture } from '@/test/fixtures/rituals';

const ADMIN = 'http://localhost:3000/api/admin/rituals';

export const ritualAdminHandlers = {
  /** Default authed admin */
  authedAdmin: [
    http.get(`${ADMIN}/queue`, () => {
      return HttpResponse.json({
        data: makeRitualListFixture(3, { status: 'PENDING' }),
        meta: { pendingCount: 3, totalPending: 3 },
      });
    }),
    http.get(`${ADMIN}/:id`, ({ params }) => {
      return HttpResponse.json({
        data: ritualFixtures.basic,
      });
    }),
    http.patch(`${ADMIN}/:id`, async ({ params, request }) => {
      const body = await request.json();
      return HttpResponse.json({
        data: { ...ritualFixtures.basic, id: params.id, status: actionToStatus(body.action) },
      });
    }),
    http.post(`${ADMIN}/:id/photos/:photoId/recheck`, () => {
      return HttpResponse.json({ data: { facesStatus: 'OK', facesCount: 0 } });
    }),
    http.get(`${ADMIN}/audit/:id`, () => {
      return HttpResponse.json({
        data: [
          { id: '1', action: 'created', actorName: 'système', createdAt: '...' },
          { id: '2', action: 'auto_flag_face_detected', actorName: 'système', createdAt: '...' },
        ],
      });
    }),
    http.get(`${ADMIN}/insights`, () => {
      return HttpResponse.json({
        data: {
          totalApproved: 26,
          totalPending: 3,
          totalRejected: 1,
          totalHidden: 0,
          slaWarningCount: 0,
          slaBreachCount: 0,
          topTags: [
            { tag: 'ongles-plus-lisses', count: 17 },
            { tag: 'plaque-souple', count: 14 },
          ],
        },
      });
    }),
    http.patch(`${ADMIN}/policy`, async () => {
      return HttpResponse.json({ data: { ok: true, version: 5 } });
    }),
  ],

  /** Cas : non auth → 401 */
  unauthorized: [
    http.get(`${ADMIN}/queue`, () => HttpResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })),
  ],

  /** Cas : moderator (rôle limité) */
  moderator: [
    http.patch(`${ADMIN}/:id`, async ({ request }) => {
      const body = await request.json();
      if (body.action === 'feature') {
        return HttpResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
      }
      return HttpResponse.json({ data: { ...ritualFixtures.basic } });
    }),
  ],

  /** Cas : photo face detected */
  photoFaceDetected: [
    http.get(`${ADMIN}/:id`, () => {
      return HttpResponse.json({
        data: {
          ...ritualFixtures.basic,
          photos: [{ ...photoFixture, facesStatus: 'REJECTED_FACE', facesCount: 1 }],
          autoFlags: ['face_detected'],
        },
      });
    }),
  ],
};
```

## 3. Scénarios d'intégration — composants front

### 3.1 `RitualsModuleBound` avec MSW

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { server } from '@/test/msw/server';
import { ritualHandlers } from '@/test/msw/handlers/rituals';
import { RitualsModuleBound } from '../RitualsModuleBound';

describe('RitualsModuleBound integration', () => {
  it('rend 3 cards depuis l’API', async () => {
    server.use(...ritualHandlers.default);
    render(await RitualsModuleBound({ productKey: 'pack-femiglow' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  it('rend null si 0 témoignages', async () => {
    server.use(...ritualHandlers.empty);
    const result = await RitualsModuleBound({ productKey: 'pack-femiglow' });
    expect(result).toBeNull();
  });

  it('singularise si 1 témoignage', async () => {
    server.use(...ritualHandlers.singleton);
    render(await RitualsModuleBound({ productKey: 'pack-femiglow' }));
    expect(await screen.findByText(/Une initiée a partagé/)).toBeInTheDocument();
  });
});
```

### 3.2 `RitualsWallDrawer` avec MSW

```ts
describe('RitualsWallDrawer integration', () => {
  it('charge summary + first page au mount', async () => {
    server.use(...ritualHandlers.default);
    render(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    await waitFor(() => expect(screen.getByText('26 initiées ont partagé.')).toBeInTheDocument());
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });

  it('filtre with_photos déclenche fetch + retourne 18', async () => {
    server.use(...ritualHandlers.listWithPhotosOnly);
    render(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    await userEvent.click(await screen.findByRole('button', { name: 'Avec photos' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
  });

  it('load more charge la 2e page', async () => {
    server.use(...ritualHandlers.listPaginatedPage1, ...ritualHandlers.listPaginatedPage2);
    render(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    await screen.findByText(/12 \/ 24/);
    await userEvent.click(screen.getByRole('button', { name: /Afficher plus/ }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(24));
  });

  it('affiche état erreur si API 500', async () => {
    server.use(...ritualHandlers.serverError);
    render(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    expect(await screen.findByText(/La maison n'a pas pu/)).toBeInTheDocument();
  });

  it('affiche skeleton pendant fetch lent', async () => {
    server.use(...ritualHandlers.slow);
    render(<RitualsWallDrawer />, { searchParams: '?wall=open' });
    expect(screen.getAllByTestId('ritual-skeleton')).toHaveLength(12);
  });
});
```

### 3.3 `RitualsWizard` avec MSW

```ts
describe('RitualsWizard integration submit', () => {
  it('submit success → confirmation visible', async () => {
    server.use(...ritualHandlers.default);
    const { user } = render(<RitualsWizard onClose={vi.fn()} onSuccess={vi.fn()} />);

    // Étape 1
    await user.type(screen.getByRole('textbox'), 'Trois mois et l’ongle a retrouvé sa nervure.'.repeat(3));
    await user.click(screen.getByLabelText('Oui, sans hésiter'));
    await user.click(screen.getByRole('button', { name: 'Continuer →' }));

    // Étape 2 — skip
    await user.click(screen.getByText('Passer cette étape →'));

    // Étape 3 — skip
    await user.click(screen.getByText('Passer cette étape →'));

    expect(await screen.findByText(/La maison reçoit votre rituel/)).toBeInTheDocument();
  });

  it('submit rate limit → message d’erreur doux', async () => {
    server.use(...ritualHandlers.submitRateLimited);
    const { user } = render(<RitualsWizard onClose={vi.fn()} onSuccess={vi.fn()} />);
    // … parcours
    await user.click(screen.getByRole('button', { name: /Partager mon rituel/ }));
    expect(await screen.findByText(/La maison a déjà reçu votre voix/)).toBeInTheDocument();
  });

  it('upload photo face detected ouvre modal', async () => {
    server.use(...ritualHandlers.uploadFaceDetected);
    const { user } = render(<RitualsWizard onClose={vi.fn()} onSuccess={vi.fn()} />);
    // Aller en étape 2
    await user.type(screen.getByRole('textbox'), 'a'.repeat(50));
    await user.click(screen.getByLabelText('Oui, sans hésiter'));
    await user.click(screen.getByRole('button', { name: 'Continuer →' }));
    // Upload
    const file = new File([new Uint8Array(1000)], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/Glisser ou choisir/), file);
    expect(await screen.findByText(/La photo contient un visage/)).toBeInTheDocument();
  });

  it('upload photo trop grande → message d’erreur', async () => {
    server.use(...ritualHandlers.uploadTooBig);
    // … (similar)
    expect(await screen.findByText(/Votre photo est généreuse/)).toBeInTheDocument();
  });

  it('pré-remplissage depuis email token', async () => {
    server.use(...ritualHandlers.decodeEmailTokenValid);
    render(<RitualsWizard onClose={vi.fn()} onSuccess={vi.fn()} />, { searchParams: '?wall=share&order=x&hash=valid-token' });
    await waitFor(() => expect(screen.getByLabelText(/Prénom/)).toHaveValue('Amal'));
  });
});
```

### 3.4 Admin queue avec MSW

```ts
describe('AdminQueuePage integration', () => {
  it('rend les PENDING', async () => {
    server.use(...ritualAdminHandlers.authedAdmin);
    render(await QueuePage({ searchParams: {} }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  it('action approuver → PATCH appelé', async () => {
    let patchCalled = false;
    server.use(
      ...ritualAdminHandlers.authedAdmin,
      http.patch('http://localhost/api/admin/rituals/:id', async ({ request }) => {
        const body = await request.json();
        patchCalled = body.action === 'approve';
        return HttpResponse.json({ data: { ok: true } });
      })
    );
    const { user } = render(await DetailPage({ params: { id: 'fixture-001' } }));
    await user.click(screen.getByText('Approuver'));
    await user.click(screen.getByText('Confirmer'));
    await waitFor(() => expect(patchCalled).toBe(true));
  });

  it('moderator → feature action 403', async () => {
    server.use(...ritualAdminHandlers.moderator);
    const { user } = render(await DetailPage({ params: { id: 'fixture-001' } }), { session: { role: 'moderator' } });
    // Le bouton ne doit même pas être visible pour moderator
    expect(screen.queryByText('Mettre en avant')).not.toBeInTheDocument();
  });

  it('photo face detected affiche overlay rouge', async () => {
    server.use(...ritualAdminHandlers.photoFaceDetected);
    render(await DetailPage({ params: { id: 'fixture-001' } }));
    expect(await screen.findByTestId('face-overlay')).toBeInTheDocument();
  });
});
```

## 4. Helpers MSW

### 4.1 `apps/web/src/test/msw/helpers.ts`

```ts
export function encodeCursor(payload: any): string {
  return btoa(JSON.stringify(payload));
}

export function decodeCursor(cursor: string): any {
  return JSON.parse(atob(cursor));
}

export function withDelay<T>(ms: number, fn: () => T): () => Promise<T> {
  return async () => {
    await delay(ms);
    return fn();
  };
}

export function passthrough(): Response {
  return new Response(null, { status: 204 });
}

export function actionToStatus(action: string): string {
  const map = { approve: 'APPROVED', reject: 'REJECTED', hide: 'HIDDEN', restore: 'APPROVED' };
  return map[action] ?? 'PENDING';
}
```

## 5. Scénarios par fonctionnalité

| # | Scénario | Handlers utilisés | Composant testé |
| --- | --- | --- | --- |
| S1 | Module compact : 3 cards | `ritualHandlers.default` | `RitualsModuleBound` |
| S2 | Module compact : empty | `ritualHandlers.empty` | `RitualsModuleBound` |
| S3 | Module compact : singleton | `ritualHandlers.singleton` | `RitualsModuleBound` |
| S4 | Drawer : ouverture initiale | `ritualHandlers.default` | `RitualsWallDrawer` |
| S5 | Drawer : empty | `ritualHandlers.empty` | `RitualsWallDrawer` |
| S6 | Drawer : erreur 500 | `ritualHandlers.serverError` | `RitualsWallDrawer` |
| S7 | Drawer : lent | `ritualHandlers.slow` | `RitualsWallDrawer` |
| S8 | Drawer : filtre avec photos | `ritualHandlers.listWithPhotosOnly` | `RitualsWallFilters` + `RitualsWallList` |
| S9 | Drawer : load more page 2 | `ritualHandlers.listPaginatedPage1`/`Page2` | `RitualsWallLoadMore` |
| S10 | Wizard : submit success | `ritualHandlers.default` | `RitualsWizard` |
| S11 | Wizard : rate-limit | `ritualHandlers.submitRateLimited` | `RitualsWizard` |
| S12 | Wizard : body validation | `ritualHandlers.submitValidationError` | `RitualsWizard` |
| S13 | Wizard : upload too big | `ritualHandlers.uploadTooBig` | `Step2Details` |
| S14 | Wizard : upload face detected | `ritualHandlers.uploadFaceDetected` | `WizardFaceAlertModal` |
| S15 | Wizard : pré-remplissage email | `ritualHandlers.decodeEmailTokenValid` | `Step3Signature` |
| S16 | Admin : queue PENDING | `ritualAdminHandlers.authedAdmin` | `AdminQueuePage` |
| S17 | Admin : approve action | (custom inline) | `AdminDetailPage` |
| S18 | Admin : moderator forbidden | `ritualAdminHandlers.moderator` | `RitualDetailActions` |
| S19 | Admin : photo face detected | `ritualAdminHandlers.photoFaceDetected` | `RitualPhotosPanel` |
| S20 | Admin : audit log | `ritualAdminHandlers.authedAdmin` | `AuditLogList` |
| S21 | Admin : insights | `ritualAdminHandlers.authedAdmin` | `InsightsDashboard` |
| S22 | Admin : policy editor | `ritualAdminHandlers.authedAdmin` | `PolicyEditor` |

## 6. Convention de nommage handlers

| Préfixe | Sens |
| --- | --- |
| `default` | Cas nominal, succès, données crédibles |
| `empty` | Aucun résultat |
| `singleton` | Exactement 1 résultat |
| `slow` | Latence simulée (test skeleton, debounce) |
| `serverError` | Erreur 5xx |
| `validationError` | Erreur 400 |
| `rateLimit` | 429 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `paginatedPage1`, `paginatedPage2` | Pagination spécifique |

## 7. Storybook avec MSW

Pour développer les composants en isolation avec API simulée, intégrer `msw-storybook-addon` :

```tsx
// apps/web/.storybook/preview.tsx
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '@/test/msw/handlers';

initialize();
export const decorators = [mswLoader];
export const parameters = { msw: { handlers } };
```

Et dans une story :

```tsx
export const Default: Story = {
  parameters: {
    msw: { handlers: ritualHandlers.default },
  },
};

export const Empty: Story = {
  parameters: {
    msw: { handlers: ritualHandlers.empty },
  },
};
```

Permet à Souheila ou un designer de naviguer dans Storybook avec des données crédibles sans toucher au backend.

## 8. Mock développement runtime

Pour tester l'UI en dev sans BDD prête :

```ts
// apps/web/src/app/layout.tsx (ou un wrapper client)
'use client';
useEffect(() => {
  if (process.env.NEXT_PUBLIC_MSW === 'true') {
    import('@/test/msw/browser').then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }));
  }
}, []);
```

Activer via `NEXT_PUBLIC_MSW=true pnpm dev`.

## 9. Anti-patterns à éviter

| Anti-pattern | Pourquoi |
| --- | --- |
| Mocker `fetch` global avec `vi.fn()` | MSW est plus expressif et reste proche du runtime réel |
| Handlers inlinés dans chaque test | Préférer les groupes nommés dans `ritualHandlers` pour réutilisation |
| Oublier `server.resetHandlers()` après chaque test | Cause des cas fantômes entre tests |
| Mocker des routes inexistantes | Conduit à des tests qui passent par erreur quand la route change |
| Réutiliser MSW pour tester la logique métier | MSW est pour les frontières HTTP, pas pour le domaine |

## 10. Récapitulatif

- **22 scénarios** d'intégration couvrant les composants `*Bound`, hooks de fetch, wizard, admin.
- **Handlers regroupés** par cas dans `ritualHandlers` et `ritualAdminHandlers`.
- **Setup global** dans `vitest.setup.ts` (listen / reset / close).
- **Browser worker** pour Storybook et dev mock optionnel.
- **Aucun `fetch` réel** dans la suite unit + integration.
- **Réutilisation des fixtures** centralisées dans `test/fixtures/rituals.ts`.

## 11. Synthèse — règles d'or MSW

1. **Un seul `server` MSW** pour toute la suite Vitest, configuré dans `vitest.setup.ts`.
2. **`server.resetHandlers()` après chaque test** (déjà global dans setup).
3. **Handlers groupés par scénario** dans `ritualHandlers.{default, empty, slow, ...}`.
4. **Tests des composants `*Bound` toujours via MSW** plutôt qu'en mock direct.
5. **Storybook reuse les handlers** pour stories réalistes.
6. **Dev runtime mock optionnel** via `NEXT_PUBLIC_MSW=true`.
7. **Latence simulée** (handlers `slow`) pour tester les skeletons.
8. **Aucun handler ne renvoie de vraies images** ; les URLs sont fictives.
9. **Les handlers ne contiennent pas de logique métier** ; ils retournent des réponses canoniques.
10. **`onUnhandledRequest: 'error'`** en CI pour ne pas masquer un fetch oublié.
