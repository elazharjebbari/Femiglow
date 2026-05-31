# 70.4 — MSW handlers

## Usage

Réutiliser et étendre `src/test/msw/tracking-providers-handlers.ts` (existant — créé chantier précédent).

Pour les tests intégration côté admin mappings, on a besoin de :
- Mock des routes admin tracking (pour tests UI offline)
- Re-utiliser les mocks providers vendor (pour le test ULTIMATE)

## `src/test/msw/mapping-admin-handlers.ts` (nouveau)

```typescript
import { http, HttpResponse } from 'msw';
import type { MappingVersion, MappingVersionListItem } from '@/lib/tracking/mappings/types';

// State mutable pour les tests
const state: {
  versions: Map<string, MappingVersion>;
  activeId: string | null;
} = { versions: new Map(), activeId: null };

export function resetMappingState(initial: MappingVersion[] = []) {
  state.versions.clear();
  state.activeId = null;
  for (const v of initial) {
    state.versions.set(v.id, v);
    if (v.isActive) state.activeId = v.id;
  }
}

export const mappingAdminHandlers = [
  http.get('/api/admin/tracking/events/mappings', () => {
    return HttpResponse.json({
      versions: Array.from(state.versions.values()).map(toListItem),
      activeId: state.activeId,
      defaultId: '__default__',
    });
  }),
  
  http.get('/api/admin/tracking/events/mappings/:id', ({ params }) => {
    const v = state.versions.get(String(params.id));
    if (!v) return HttpResponse.json({ error: { code: 'not_found', message: 'Version not found' } }, { status: 404 });
    return HttpResponse.json(v);
  }),
  
  http.post('/api/admin/tracking/events/mappings', async ({ request }) => {
    const body = await request.json() as any;
    const id = `emv_test_${Date.now()}`;
    const v: MappingVersion = {
      id,
      name: body.name,
      status: 'draft',
      isActive: false,
      isDefault: false,
      mappings: body.source.kind === 'import' ? body.source.mappings : {},
      clonedFrom: body.source.kind === 'clone' ? body.source.sourceId : null,
      createdBy: 'test_admin',
      createdAt: new Date().toISOString(),
      activatedAt: null,
      archivedAt: null,
      deletedAt: null,
      notes: body.notes ?? null,
    };
    state.versions.set(id, v);
    return HttpResponse.json(v, { status: 201 });
  }),
  
  http.put('/api/admin/tracking/events/mappings/:id', async ({ params, request }) => {
    const sourceId = String(params.id);
    if (!state.versions.has(sourceId)) {
      return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (sourceId === '__default__') {
      return HttpResponse.json({ error: { code: 'cannot_edit_default' } }, { status: 403 });
    }
    const body = await request.json() as any;
    // Clone le source en nouvelle version
    const newId = `emv_test_${Date.now()}`;
    const v: MappingVersion = {
      ...state.versions.get(sourceId)!,
      id: newId,
      status: 'draft',
      isActive: false,
      mappings: body.mappings,
      clonedFrom: sourceId,
      createdAt: new Date().toISOString(),
    };
    state.versions.set(newId, v);
    return HttpResponse.json(v, { status: 201 });
  }),
  
  http.post('/api/admin/tracking/events/mappings/:id/activate', ({ params }) => {
    const id = String(params.id);
    if (!state.versions.has(id)) {
      return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (state.activeId) {
      const prev = state.versions.get(state.activeId)!;
      state.versions.set(state.activeId, { ...prev, isActive: false, status: 'archived', archivedAt: new Date().toISOString() });
    }
    const v = state.versions.get(id)!;
    state.versions.set(id, { ...v, isActive: true, status: 'active', activatedAt: new Date().toISOString() });
    state.activeId = id;
    return HttpResponse.json(state.versions.get(id));
  }),
  
  http.delete('/api/admin/tracking/events/mappings/:id', ({ params }) => {
    const id = String(params.id);
    const v = state.versions.get(id);
    if (!v) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    if (v.isActive) return HttpResponse.json({ error: { code: 'cannot_delete_active' } }, { status: 403 });
    if (v.isDefault) return HttpResponse.json({ error: { code: 'cannot_delete_default' } }, { status: 403 });
    state.versions.set(id, { ...v, status: 'deleted', deletedAt: new Date().toISOString() });
    return HttpResponse.json({ ok: true });
  }),
  
  http.post('/api/admin/tracking/events/mappings/:id/test', async ({ params, request }) => {
    const body = await request.json() as any;
    const v = state.versions.get(String(params.id));
    if (!v) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    const cells = v.mappings[body.eventName] ?? {};
    const results: Record<string, any> = {};
    for (const kind of ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest']) {
      const cell = (cells as any)[kind];
      results[kind] = cell?.isEnabled && cell?.mappedName
        ? { wouldDispatch: true, mappedName: cell.mappedName, isCustom: cell.isCustom }
        : { wouldDispatch: false, mappedName: null, skipReason: cell ? 'disabled' : 'no_mapping' };
    }
    return HttpResponse.json({ results });
  }),
  
  http.post('/api/admin/tracking/events/mappings/:id/export-gtm', async ({ params, request }) => {
    const v = state.versions.get(String(params.id));
    if (!v) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    return HttpResponse.json({
      containerJson: { exportFormatVersion: 2, /* mocked */ },
      meta: { sha256: 'mock_sha', eventsCount: Object.keys(v.mappings).length, tagsCount: 0, env: 'production' },
    });
  }),
  
  http.post('/api/admin/tracking/events/mappings/reset-default', () => {
    if (state.versions.has('__default__')) {
      // Activate __default__ via le handler
    }
    return HttpResponse.json(state.versions.get('__default__'));
  }),
];

function toListItem(v: MappingVersion): MappingVersionListItem {
  const { mappings, ...rest } = v;
  return { ...rest, eventsCount: Object.keys(mappings).length };
}
```

## Sanity tests

`mapping-admin-handlers.test.ts` :
- ✅ list retourne les versions seedées
- ✅ POST create → 201 + nouvelle version
- ✅ PUT clone correctement
- ✅ DELETE active → 403
- ✅ Activate transitionne correctement

## Intégration côté composants

```typescript
import { setupServer } from 'msw/node';
import { mappingAdminHandlers, resetMappingState } from '@/test/msw/mapping-admin-handlers';

const server = setupServer(...mappingAdminHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => {
  resetMappingState([FIXTURE_VERSION_ACTIVE]);
  server.resetHandlers();
});

test('MappingVersionsList affiche les versions', async () => {
  render(<MappingVersionsList />);
  expect(await screen.findByText('Test active')).toBeInTheDocument();
});
```

## Réutilisation tracking-providers-handlers

Pour le test ULTIMATE round-trip GTM, on **n'a pas besoin** de mocker les providers vendors. L'export GTM est un build local (JSON), pas un dispatch.

Pour les tests dispatcher (hors scope de ce module mais consommateur) : les handlers `tracking-providers-handlers.ts` existants vérifient que le dispatcher appelle bien Meta avec `mappedName` issu de `resolveEventMapping`.
