/**
 * Handlers MSW pour les routes Components-CMS, à brancher dans les tests
 * front (éditeurs P6, formulaire P7, panneau admin P8). Stocke un état en
 * mémoire entre les requêtes pour permettre des scénarios multi-step
 * (PATCH puis publish, etc.).
 *
 * Usage :
 * ```ts
 * import { server } from '@/test/msw/server';
 * import { setupComponentFieldsScenario } from '@/test/msw/component-fields-handlers';
 *
 * beforeEach(() => {
 *   const ctx = setupComponentFieldsScenario({ componentKey: 'home-hero', fields: [...] });
 *   server.use(...ctx.handlers);
 * });
 * ```
 */
import { http, HttpResponse } from 'msw';
import type { ComponentFieldDefinition, FieldBindingStatus } from '@/lib/db/types';

interface ScenarioBinding {
  id: string;
  fieldKey: string;
  value: unknown;
  version: number;
  status: FieldBindingStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  authorId: string | null;
}

interface ScenarioState {
  componentKey: string;
  fields: ComponentFieldDefinition[];
  bindings: Map<string, { published?: ScenarioBinding; draft?: ScenarioBinding; scheduled?: ScenarioBinding }>;
  history: Array<{ id: string; fieldKey: string; version: number; value: unknown; status: string; action: string; createdAt: string; actorId: string | null }>;
  /** Mode démo : provoquer un 409 sur le prochain PATCH pour tester le modal de conflit. */
  triggerConflictOnNextPatch?: boolean;
}

let nextId = 1;
const id = (prefix: string) => `${prefix}_${(nextId++).toString().padStart(3, '0')}`;

export interface ScenarioInput {
  componentKey: string;
  fields: ComponentFieldDefinition[];
  initialPublished?: Record<string, unknown>;
  initialDrafts?: Record<string, unknown>;
}

export function setupComponentFieldsScenario(input: ScenarioInput) {
  const state: ScenarioState = {
    componentKey: input.componentKey,
    fields: input.fields,
    bindings: new Map(),
    history: [],
  };

  for (const field of input.fields) {
    const slot: ScenarioState['bindings'] extends Map<string, infer T> ? T : never = {};
    if (input.initialPublished && field.key in input.initialPublished) {
      slot.published = {
        id: id('cfb'),
        fieldKey: field.key,
        value: input.initialPublished[field.key],
        version: 1,
        status: 'published',
        publishedAt: new Date().toISOString(),
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
        authorId: null,
      };
    }
    if (input.initialDrafts && field.key in input.initialDrafts) {
      slot.draft = {
        id: id('cfb'),
        fieldKey: field.key,
        value: input.initialDrafts[field.key],
        version: (slot.published?.version ?? 0) + 1,
        status: 'draft',
        publishedAt: null,
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
        authorId: null,
      };
    }
    state.bindings.set(field.key, slot);
  }

  const base = `/api/admin/components/${input.componentKey}/fields`;

  const handlers = [
    http.get(base, () => {
      const fields = state.fields.map((f) => {
        const b = state.bindings.get(f.key) ?? {};
        return {
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          ...(f.config ? { config: f.config } : {}),
          ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}),
          published: b.published ?? null,
          draft: b.draft ?? null,
        };
      });
      return HttpResponse.json({
        componentKey: state.componentKey,
        locale: 'fr',
        fields,
      });
    }),

    http.patch(`${base}/:fieldKey`, async ({ params, request }) => {
      if (state.triggerConflictOnNextPatch) {
        state.triggerConflictOnNextPatch = false;
        return HttpResponse.json(
          {
            error: {
              code: 'version_conflict',
              message: 'Une autre modification a eu lieu',
              details: { remoteUpdatedAt: new Date().toISOString() },
            },
          },
          { status: 409 },
        );
      }
      const fieldKey = String(params.fieldKey);
      const body = (await request.json()) as { value: unknown; locale?: string };
      const slot = state.bindings.get(fieldKey) ?? {};
      const draft: ScenarioBinding = {
        id: slot.draft?.id ?? id('cfb'),
        fieldKey,
        value: body.value,
        version: (slot.published?.version ?? 0) + 1,
        status: 'draft',
        publishedAt: null,
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
        authorId: 'adm_test',
      };
      slot.draft = draft;
      state.bindings.set(fieldKey, slot);
      state.history.unshift({
        id: id('cfh'),
        fieldKey,
        version: draft.version,
        value: draft.value,
        status: 'draft',
        action: slot.draft ? 'update' : 'create',
        createdAt: draft.updatedAt,
        actorId: draft.authorId,
      });
      return HttpResponse.json({ binding: draft });
    }),

    http.post(`${base}/:fieldKey/publish`, ({ params }) => {
      const fieldKey = String(params.fieldKey);
      const slot = state.bindings.get(fieldKey) ?? {};
      if (!slot.draft) {
        return HttpResponse.json(
          { error: { code: 'not_found', message: 'Aucun draft à publier' } },
          { status: 404 },
        );
      }
      const previous = slot.published ?? null;
      const promoted: ScenarioBinding = {
        ...slot.draft,
        status: 'published',
        publishedAt: new Date().toISOString(),
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
      };
      slot.published = promoted;
      slot.draft = undefined;
      state.bindings.set(fieldKey, slot);
      state.history.unshift({
        id: id('cfh'),
        fieldKey,
        version: promoted.version,
        value: promoted.value,
        status: 'published',
        action: 'publish',
        createdAt: promoted.updatedAt,
        actorId: 'adm_test',
      });
      return HttpResponse.json({
        binding: promoted,
        previousPublishedId: previous?.id ?? null,
      });
    }),

    http.post(`${base}/:fieldKey/schedule`, async ({ params, request }) => {
      const fieldKey = String(params.fieldKey);
      const slot = state.bindings.get(fieldKey) ?? {};
      if (!slot.draft) {
        return HttpResponse.json(
          { error: { code: 'not_found', message: 'Aucun draft à programmer' } },
          { status: 404 },
        );
      }
      const body = (await request.json()) as { scheduledAt: string };
      if (new Date(body.scheduledAt).getTime() < Date.now() + 60_000) {
        return HttpResponse.json(
          {
            error: {
              code: 'schedule_in_past',
              message: 'La date de publication doit être dans le futur.',
            },
          },
          { status: 400 },
        );
      }
      const scheduled: ScenarioBinding = {
        ...slot.draft,
        status: 'scheduled',
        scheduledAt: body.scheduledAt,
        updatedAt: new Date().toISOString(),
      };
      slot.scheduled = scheduled;
      slot.draft = undefined;
      state.bindings.set(fieldKey, slot);
      return HttpResponse.json({ binding: scheduled });
    }),

    http.post(`${base}/:fieldKey/cancel-schedule`, ({ params }) => {
      const fieldKey = String(params.fieldKey);
      const slot = state.bindings.get(fieldKey) ?? {};
      if (!slot.scheduled) {
        return HttpResponse.json(
          { error: { code: 'not_found', message: 'Aucune publication programmée' } },
          { status: 404 },
        );
      }
      const draft: ScenarioBinding = {
        ...slot.scheduled,
        status: 'draft',
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
      };
      slot.draft = draft;
      slot.scheduled = undefined;
      state.bindings.set(fieldKey, slot);
      return HttpResponse.json({ binding: draft });
    }),

    http.post(`${base}/:fieldKey/restore`, async ({ params, request }) => {
      const fieldKey = String(params.fieldKey);
      const body = (await request.json()) as { historyId: string };
      const snapshot = state.history.find((h) => h.id === body.historyId && h.fieldKey === fieldKey);
      if (!snapshot) {
        return HttpResponse.json(
          { error: { code: 'not_found', message: 'Entrée d’historique introuvable' } },
          { status: 404 },
        );
      }
      const slot = state.bindings.get(fieldKey) ?? {};
      const draft: ScenarioBinding = {
        id: id('cfb'),
        fieldKey,
        value: snapshot.value,
        version: (slot.published?.version ?? 0) + 1,
        status: 'draft',
        publishedAt: null,
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
        authorId: 'adm_test',
      };
      slot.draft = draft;
      state.bindings.set(fieldKey, slot);
      return HttpResponse.json({ binding: draft, restoredFromVersion: snapshot.version });
    }),

    http.get(`${base}/:fieldKey/history`, ({ params }) => {
      const fieldKey = String(params.fieldKey);
      const entries = state.history.filter((h) => h.fieldKey === fieldKey);
      return HttpResponse.json({ entries, nextCursor: null });
    }),
  ];

  return { handlers, state };
}
