/**
 * MSW handlers pour les routes admin event-mappings.
 *
 * Utilisable pour tests UI offline (RTL) ou Playwright en mode mock.
 * State mutable interne — utiliser `resetMappingState()` entre tests.
 */
import { http, HttpResponse } from 'msw';
import type { MappingVersion, MappingVersionListItem, Mappings } from '@/lib/tracking/mappings/types';

interface State {
  versions: Map<string, MappingVersion>;
  activeId: string | null;
}

const state: State = { versions: new Map(), activeId: null };

export function resetMappingState(initial: MappingVersion[] = []) {
  state.versions.clear();
  state.activeId = null;
  for (const v of initial) {
    state.versions.set(v.id, v);
    if (v.isActive) state.activeId = v.id;
  }
}

export function getMappingState(): Readonly<State> {
  return state;
}

function toListItem(v: MappingVersion): MappingVersionListItem {
  const { mappings, ...rest } = v;
  return { ...rest, eventsCount: Object.keys(mappings).length };
}

function err(code: string, message: string, status: number) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

const BASE = '/api/admin/tracking/events/mappings';

export const eventMappingsHandlers = [
  http.get(BASE, () => {
    return HttpResponse.json({
      versions: Array.from(state.versions.values()).map(toListItem),
      activeId: state.activeId,
      defaultId: '__default__',
    });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const v = state.versions.get(String(params.id));
    if (!v) return err('not_found', 'Version introuvable', 404);
    return HttpResponse.json(v);
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as {
      name?: string;
      notes?: string | null;
      source?: { kind: 'default' | 'clone' | 'import'; sourceId?: string; mappings?: Mappings };
    };
    if (!body.name || !body.source) return err('validation_failed', 'Body invalide', 422);
    const id = `emv_msw_${Date.now()}`;
    let mappings: Mappings = {};
    let clonedFrom: string | null = null;
    if (body.source.kind === 'clone') {
      const src = body.source.sourceId ? state.versions.get(body.source.sourceId) : null;
      if (!src) return err('not_found', 'Source introuvable', 404);
      mappings = JSON.parse(JSON.stringify(src.mappings));
      clonedFrom = src.id;
    } else if (body.source.kind === 'import') {
      mappings = body.source.mappings ?? {};
    }
    const v: MappingVersion = {
      id,
      name: body.name,
      notes: body.notes ?? null,
      status: 'draft',
      isActive: false,
      isDefault: false,
      mappings,
      clonedFrom,
      createdBy: 'msw_user',
      createdAt: new Date(),
      activatedAt: null,
      archivedAt: null,
      deletedAt: null,
    };
    state.versions.set(id, v);
    return HttpResponse.json(v, { status: 201 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const id = String(params.id);
    if (id === '__default__') return err('cannot_edit_default', "Default est read-only", 403);
    const src = state.versions.get(id);
    if (!src) return err('not_found', 'Version introuvable', 404);
    const body = (await request.json()) as { mappings: Mappings; name?: string; notes?: string | null };
    const newId = `emv_msw_${Date.now()}`;
    const v: MappingVersion = {
      ...src,
      id: newId,
      name: body.name ?? `${src.name} (édition)`,
      notes: body.notes ?? null,
      mappings: body.mappings,
      clonedFrom: id,
      status: 'draft',
      isActive: false,
      createdAt: new Date(),
      activatedAt: null,
      archivedAt: null,
      deletedAt: null,
    };
    state.versions.set(newId, v);
    return HttpResponse.json(v, { status: 201 });
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = String(params.id);
    if (id === '__default__') return err('cannot_delete_default', 'Default ne peut pas être supprimé', 403);
    const v = state.versions.get(id);
    if (!v) return err('not_found', 'Version introuvable', 404);
    if (v.isActive) return err('cannot_delete_active', 'Active ne peut pas être supprimée', 403);
    state.versions.set(id, { ...v, status: 'deleted', deletedAt: new Date() });
    return HttpResponse.json({ ok: true });
  }),

  http.post(`${BASE}/:id/activate`, ({ params }) => {
    const id = String(params.id);
    const v = state.versions.get(id);
    if (!v) return err('not_found', 'Version introuvable', 404);
    // Désactive l'active courante
    if (state.activeId && state.activeId !== id) {
      const prev = state.versions.get(state.activeId)!;
      state.versions.set(state.activeId, { ...prev, isActive: false, status: 'archived', archivedAt: new Date() });
    }
    state.versions.set(id, { ...v, isActive: true, status: 'active', activatedAt: new Date() });
    state.activeId = id;
    return HttpResponse.json(state.versions.get(id));
  }),

  http.post(`${BASE}/:id/test`, async ({ params, request }) => {
    const v = state.versions.get(String(params.id));
    if (!v) return err('not_found', 'Version introuvable', 404);
    const body = (await request.json()) as { eventName?: string };
    if (!body.eventName) return err('validation_failed', 'eventName requis', 422);
    const cells = v.mappings[body.eventName] ?? {};
    const results: Record<string, unknown> = {};
    for (const kind of ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest']) {
      const cell = (cells as Record<string, { mappedName: string | null; isCustom: boolean; isEnabled: boolean }>)[kind];
      results[kind] = cell?.isEnabled && cell?.mappedName
        ? { wouldDispatch: true, mappedName: cell.mappedName, isCustom: cell.isCustom, skipReason: null }
        : { wouldDispatch: false, mappedName: null, isCustom: false, skipReason: cell ? 'disabled' : 'no_mapping' };
    }
    return HttpResponse.json({ results });
  }),

  http.post(`${BASE}/:id/export-gtm`, async ({ params }) => {
    const v = state.versions.get(String(params.id));
    if (!v) return err('not_found', 'Version introuvable', 404);
    return HttpResponse.json({
      containerJson: { exportFormatVersion: 2, exportTime: new Date().toISOString(), containerVersion: { container: { name: 'mock', publicId: 'GTM-X', usageContext: ['WEB'] }, tag: [], trigger: [], variable: [] } },
      meta: { sha256: 'mock_sha256', eventsCount: Object.keys(v.mappings).length, tagsCount: 0, variablesCount: 0, triggersCount: 0, env: 'production' },
    });
  }),

  http.post(`${BASE}/reset-default`, () => {
    if (!state.versions.has('__default__')) return err('not_found', '__default__ introuvable', 404);
    if (state.activeId && state.activeId !== '__default__') {
      const prev = state.versions.get(state.activeId)!;
      state.versions.set(state.activeId, { ...prev, isActive: false, status: 'archived', archivedAt: new Date() });
    }
    const def = state.versions.get('__default__')!;
    state.versions.set('__default__', { ...def, isActive: true, status: 'active', activatedAt: new Date() });
    state.activeId = '__default__';
    return HttpResponse.json(state.versions.get('__default__'));
  }),

  http.get(`${BASE}/:id/diff/:otherId`, ({ params }) => {
    const a = state.versions.get(String(params.id));
    const b = state.versions.get(String(params.otherId));
    if (!a || !b) return err('not_found', 'Version(s) introuvable(s)', 404);
    return HttpResponse.json({ added: [], removed: [], changed: [] });
  }),
];
