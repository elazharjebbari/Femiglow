# Testing — Handlers MSW

Mock Service Worker pour les tests Vitest et le mode dev navigateur.

Fichier : `apps/web/src/test/msw/handlers/admin-config.ts`.

## Handlers exposés

```ts
import { http, HttpResponse } from 'msw';
import {
  defaultsFixture, makeConfigMetaFixture, makeSnapshotFixture,
} from '../fixtures/admin-config';

export const adminConfigHandlers = [
  http.get('/api/admin/settings', () => {
    return HttpResponse.json({
      nav: defaultsFixture.nav,
      flags: defaultsFixture.flags,
      rbac: defaultsFixture.rbac,
      branding: defaultsFixture.branding,
      meta: {
        nav: makeConfigMetaFixture({ isDefault: true }),
        flags: makeConfigMetaFixture({ isDefault: true }),
        rbac: makeConfigMetaFixture({ isDefault: true }),
        branding: makeConfigMetaFixture({ isDefault: true }),
      },
    });
  }),

  http.get('/api/admin/settings/:section', ({ params }) => {
    const section = params.section as Section;
    return HttpResponse.json({
      section,
      payload: defaultsFixture[section],
      meta: makeConfigMetaFixture({ isDefault: true }),
    });
  }),

  http.patch('/api/admin/settings/:section', async ({ request, params }) => {
    const section = params.section as Section;
    const body = await request.json();

    const ifMatch = request.headers.get('If-Match');
    if (ifMatch === '999') {
      // simulate stale version
      return HttpResponse.json(
        { ok: false, error: { code: 'STALE_VERSION', message: 'Version stale.' } },
        { status: 409 },
      );
    }

    return HttpResponse.json({
      payload: body,
      meta: makeConfigMetaFixture({
        version: Number(ifMatch ?? 1) + 1,
        isDefault: false,
      }),
      snapshotId: 'snap_test_1',
    });
  }),

  http.get('/api/admin/settings/:section/snapshots', ({ params }) => {
    return HttpResponse.json({
      items: [
        makeSnapshotFixture({ section: params.section as Section, version: 3 }),
        makeSnapshotFixture({ section: params.section as Section, version: 2 }),
      ],
      total: 2,
    });
  }),

  http.post('/api/admin/settings/:section/restore', async ({ request, params }) => {
    const section = params.section as Section;
    const body = await request.json() as { snapshotId: string };
    return HttpResponse.json({
      payload: defaultsFixture[section],
      meta: makeConfigMetaFixture({ version: 5, isDefault: false }),
      snapshotId: body.snapshotId,
    });
  }),
];
```

## Fixtures (`apps/web/src/test/fixtures/admin-config.ts`)

```ts
export const defaultsFixture = {
  nav: {
    items: [
      { key: 'home', label: 'Accueil', href: '/admin', icon: 'home', position: 0 },
      { key: 'comp', label: 'Composants', href: '/admin/components', icon: 'box', position: 1 },
    ],
  },
  flags: {
    flags: { newComposer: false, betaSeo: true },
  },
  rbac: {
    matrix: {
      superadmin: {
        components: ['read', 'write', 'publish', 'delete'],
        seo: ['read', 'write', 'publish', 'delete'],
        products: ['read', 'write', 'publish', 'delete'],
        media: ['read', 'write', 'publish', 'delete'],
        users: ['read', 'write', 'publish', 'delete'],
        'app-config': ['read', 'write', 'publish', 'delete'],
      },
      admin: {
        components: ['read', 'write', 'publish'],
        seo: ['read', 'write', 'publish'],
        products: ['read', 'write', 'publish'],
        media: ['read', 'write', 'publish'],
        users: ['read'],
        'app-config': ['read', 'write'],
      },
    },
  },
  branding: {
    colors: {
      primary: '#A8B5A0',
      accent: '#D4B896',
      bg: '#FAF6EE',
      text: '#2A2620',
    },
    fonts: {
      heading: 'Cormorant Garamond',
      body: 'Inter',
    },
    logoMediaId: null,
  },
};

export function makeConfigMetaFixture(overrides: Partial<ConfigMeta> = {}): ConfigMeta {
  return {
    version: overrides.version ?? 1,
    updatedAt: overrides.updatedAt ?? '2026-04-12T08:00:00Z',
    updatedBy: overrides.updatedBy ?? { id: 'usr_admin_test', email: 'admin@femiglow.test' },
    isDefault: overrides.isDefault ?? false,
  };
}

export function makeSnapshotFixture(overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot {
  return {
    id: overrides.id ?? `snap_${Date.now()}`,
    section: overrides.section ?? 'nav',
    capturedAt: overrides.capturedAt ?? '2026-04-12T08:00:00Z',
    version: overrides.version ?? 1,
    actor: overrides.actor ?? { id: 'usr_admin_test', email: 'admin@femiglow.test' },
    note: overrides.note ?? null,
  };
}
```

## Cas couverts

| Cas                           | Forçage |
|-------------------------------|---------|
| Section en valeur défaut      | par défaut, `isDefault: true` |
| Section modifiée              | override `isDefault: false` |
| 422 Zod fail                  | resolver renvoie 422 + issues |
| 409 If-Match stale            | header `If-Match: 999` (sentinelle) |
| 403 sur flags/rbac            | resolver renvoie 403 si role test |
| Restore d'un snapshot         | résolveur POST renvoie payload original |

## Mode override par test

```ts
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

test('UI montre erreur 409 sur version stale', async () => {
  server.use(
    http.patch('/api/admin/settings/nav', () =>
      HttpResponse.json(
        { ok: false, error: { code: 'STALE_VERSION', message: '...' } },
        { status: 409 },
      ),
    ),
  );
  // ...
});
```

## Conventions

- Un handler par méthode/route (pas de switch interne)
- Body validé contre les schémas Zod réels
- `If-Match` reconnu (sentinelle `'999'` = stale)
- IDs déterministes
