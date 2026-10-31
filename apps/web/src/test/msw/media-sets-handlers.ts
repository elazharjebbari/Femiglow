/**
 * Handlers MSW des routes « médias par audience »
 * (`/api/admin/components/[key]/media-sets/**`), avec un état en mémoire
 * entre les requêtes (brouillon → publication → historique…). Même
 * principe que `component-fields-handlers.ts`.
 *
 * La couverture est recalculée à chaque `GET` avec la VRAIE fonction
 * `computeMediaSetCoverage` (et donc `selectMediaSet`) : la matrice des
 * tests affiche ce que calculerait le serveur.
 *
 * Usage :
 * ```ts
 * const scenario = setupMediaSetsScenario({ sets: [makeAdminSet({...})] });
 * server.use(...scenario.handlers);
 * // … puis scenario.calls, scenario.state, scenario.failNext(...)
 * ```
 */
import { http, HttpResponse } from 'msw';
import { computeMediaSetCoverage } from '@/lib/components/media-variants/coverage';
import type { MediaSetDTO } from '@/lib/components/media-variants/types';
import { KIT_HERO_MEDIA_VARIANTS, type MediaVariantPolicy } from '@/lib/components/registry';
import type {
  AdminMediaSetItemJson,
  AdminMediaSetJson,
  MediaSetHistoryEntryJson,
  StuckScheduledJson,
} from '@/components/admin/components/media-variants/types';

export const MEDIA_SETS_COMPONENT = 'kit-hero-produit';

export interface RecordedCall {
  method: string;
  path: string;
  ifMatch: string | null;
  ifNoneMatch: string | null;
  body: unknown;
}

/**
 * Réponses d'écriture = ensemble NON enrichi (`ComponentMediaSetWithItems`
 * sérialisé) : ni `media`/`mobileMedia` sur les items ni
 * `hasUnavailableMedia` — seul `GET /` enrichit (vignettes, état).
 */
function bare(set: AdminMediaSetJson): AdminMediaSetJson {
  const { hasUnavailableMedia: _h, ...rest } = set;
  return {
    ...rest,
    items: set.items.map(({ media: _m, mobileMedia: _mm, ...item }) => item),
  };
}

/** `If-Match` comparé en instant (comme `sameInstant` côté requêtes), pas en chaîne. */
function sameInstant(a: string, b: string): boolean {
  const ta = Date.parse(a.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1'));
  return !Number.isNaN(ta) && ta === Date.parse(b);
}

let seq = 1;
const nextId = (prefix: string) => `${prefix}_${(seq++).toString().padStart(3, '0')}`;
/** Horloge monotone (deux écritures n'ont jamais le même `updatedAt`). */
let clock = Date.parse('2026-10-30T08:00:00.000Z');
const tick = () => new Date((clock += 1000)).toISOString();

export const thumbFor = (mediaId: string) => `https://cdn.test/${mediaId}-xs.webp`;

export interface AdminSetInput {
  id?: string;
  slot?: string;
  variantDim?: string;
  variantKey?: string;
  locale?: string;
  status?: AdminMediaSetJson['status'];
  version?: number;
  crossLocale?: boolean;
  source?: 'admin' | 'import';
  scheduledAt?: string | null;
  mediaIds?: string[];
  alt?: Partial<Record<'fr' | 'ar' | 'en', string>>;
  notes?: string | null;
}

export function makeAdminSet(input: AdminSetInput = {}): AdminMediaSetJson {
  const id = input.id ?? nextId('cms');
  const updatedAt = tick();
  const mediaIds = input.mediaIds ?? ['me_a'];
  return {
    id,
    componentId: 'sc_kit_hero',
    slot: input.slot ?? 'primary',
    variantDim: input.variantDim ?? 'default',
    variantKey: input.variantKey ?? '*',
    locale: input.locale ?? '*',
    crossLocale: input.crossLocale ?? false,
    status: input.status ?? 'published',
    version: input.version ?? 1,
    publishedAt: (input.status ?? 'published') === 'published' ? updatedAt : null,
    scheduledAt: input.scheduledAt ?? null,
    source: input.source ?? 'admin',
    notes: input.notes ?? null,
    authorId: null,
    createdAt: updatedAt,
    updatedAt,
    hasUnavailableMedia: false,
    items: mediaIds.map((mediaId, position) => makeItem(id, mediaId, position, input.alt ?? {})),
  };
}

function makeItem(
  setId: string,
  mediaId: string,
  position: number,
  alt: Partial<Record<'fr' | 'ar' | 'en', string>>,
  extra: Partial<AdminMediaSetItemJson> = {},
): AdminMediaSetItemJson {
  const mobileMediaId = extra.mobileMediaId ?? null;
  return {
    id: nextId('cmsi'),
    setId,
    position,
    mediaId,
    mobileMediaId,
    alt,
    objectPosition: extra.objectPosition ?? null,
    focalX: extra.focalX ?? null,
    focalY: extra.focalY ?? null,
    createdAt: tick(),
    media: { id: mediaId, state: 'ok', thumbUrl: thumbFor(mediaId), alt: null },
    mobileMedia: mobileMediaId
      ? { id: mobileMediaId, state: 'ok', thumbUrl: thumbFor(mobileMediaId), alt: null }
      : null,
  };
}

function toDTO(s: AdminMediaSetJson): MediaSetDTO {
  return {
    id: s.id,
    slot: s.slot,
    variantDim: s.variantDim,
    variantKey: s.variantKey,
    locale: s.locale,
    crossLocale: s.crossLocale,
    version: s.version,
    status: s.status,
    publishedAt: s.publishedAt,
    updatedAt: s.updatedAt,
    items: s.items.map((i) => ({
      setId: s.id,
      position: i.position,
      desktop: { src: thumbFor(i.mediaId), width: 800, height: 1000 },
      mobile: null,
      alt: i.alt,
      mediaAlt: null,
      objectPosition: i.objectPosition,
      focalX: i.focalX,
      focalY: i.focalY,
    })),
  };
}

export interface ScenarioInput {
  componentKey?: string;
  policy?: MediaVariantPolicy;
  sets?: AdminMediaSetJson[];
  stuckScheduled?: StuckScheduledJson[];
  history?: MediaSetHistoryEntryJson[];
}

type FailMode =
  | { kind: 'conflict' }
  | { kind: 'validation'; issues: Array<{ code: string; path: (string | number)[]; message: string }> }
  | { kind: 'state'; message: string };

export function setupMediaSetsScenario(input: ScenarioInput = {}) {
  const componentKey = input.componentKey ?? MEDIA_SETS_COMPONENT;
  const policy = input.policy ?? KIT_HERO_MEDIA_VARIANTS;
  const state = {
    sets: [...(input.sets ?? [])],
    stuckScheduled: [...(input.stuckScheduled ?? [])],
    history: [...(input.history ?? [])] as Array<MediaSetHistoryEntryJson & { tuple: string }>,
    calls: [] as RecordedCall[],
    failNext: null as FailMode | null,
  };
  const base = `*/api/admin/components/${componentKey}/media-sets`;
  const tupleOf = (s: { slot: string; variantDim: string; variantKey: string; locale: string }) =>
    [s.slot, s.variantDim, s.variantKey, s.locale].join('|');

  function record(request: Request, body: unknown): void {
    const url = new URL(request.url);
    state.calls.push({
      method: request.method,
      path: url.pathname + url.search,
      ifMatch: request.headers.get('if-match'),
      ifNoneMatch: request.headers.get('if-none-match'),
      body,
    });
  }

  async function readBody(request: Request): Promise<Record<string, unknown>> {
    const text = await request.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }

  function consumeFailure(): Response | null {
    const f = state.failNext;
    // Les conflits sont consommés par `checkIfMatch` / `PUT /draft`.
    if (!f || f.kind === 'conflict') return null;
    state.failNext = null;
    if (f.kind === 'validation') {
      return HttpResponse.json(
        { error: { code: 'validation_failed', message: 'Ensemble de médias invalide', details: { issues: f.issues } } },
        { status: 422 },
      );
    }
    if (f.kind === 'state') {
      return HttpResponse.json({ error: { code: 'invalid_state', message: f.message } }, { status: 409 });
    }
    return null;
  }

  function conflict(current: AdminMediaSetJson | null): Response {
    return HttpResponse.json(
      {
        error: {
          code: 'version_conflict',
          message: 'Une autre modification a eu lieu sur cet ensemble',
          details: { current, remoteUpdatedAt: current?.updatedAt ?? null },
        },
      },
      { status: 409 },
    );
  }

  function pushHistory(set: AdminMediaSetJson, action: string): void {
    state.history.unshift({
      id: nextId('cmsh'),
      setId: set.id,
      version: set.version,
      status: set.status,
      action,
      crossLocale: set.crossLocale,
      actorId: null,
      notes: null,
      createdAt: tick(),
      items: set.items.map((i) => ({
        position: i.position,
        mediaId: i.mediaId,
        mobileMediaId: i.mobileMediaId,
        alt: i.alt,
        objectPosition: i.objectPosition,
        focalX: i.focalX,
        focalY: i.focalY,
        thumbUrl: thumbFor(i.mediaId),
        mobileThumbUrl: i.mobileMediaId ? thumbFor(i.mobileMediaId) : null,
      })),
      tuple: tupleOf(set),
    });
  }

  function live(): AdminMediaSetJson[] {
    return state.sets.filter((s) => s.status !== 'archived');
  }

  function findSet(id: string): AdminMediaSetJson | undefined {
    return state.sets.find((s) => s.id === id);
  }

  function checkIfMatch(request: Request, set: AdminMediaSetJson): Response | null {
    if (state.failNext?.kind === 'conflict') {
      state.failNext = null;
      return conflict(bare(set));
    }
    const ifMatch = request.headers.get('if-match');
    if (ifMatch && !sameInstant(ifMatch, set.updatedAt)) return conflict(bare(set));
    return null;
  }

  function publish(set: AdminMediaSetJson): AdminMediaSetJson {
    const tuple = tupleOf(set);
    const previous = state.sets.find((s) => s.status === 'published' && tupleOf(s) === tuple);
    if (previous) previous.status = 'archived';
    for (const s of state.sets) {
      if (s.status === 'scheduled' && tupleOf(s) === tuple && s.id !== set.id) s.status = 'archived';
    }
    set.status = 'published';
    set.version = (previous?.version ?? 0) + 1;
    set.publishedAt = tick();
    set.scheduledAt = null;
    set.updatedAt = tick();
    pushHistory(set, 'publish');
    return set;
  }

  const handlers = [
    http.get(base, () => {
      const published = live().filter((s) => s.status === 'published');
      return HttpResponse.json({
        componentKey,
        policy,
        dimensions: policy.dimensions.map((id) => ({
          id,
          label: id === 'angle' ? 'Angle publicitaire' : id,
          values: id === 'angle' ? ['a', 'b', 'c', 'd', 'e', 'temoin'] : null,
        })),
        locales: ['*', 'fr', 'ar', 'en'],
        sets: live(),
        page: null,
        stuckScheduled: state.stuckScheduled,
        coverage: computeMediaSetCoverage(published.map(toDTO), policy),
      });
    }),

    http.put(`${base}/draft`, async ({ request }) => {
      const body = await readBody(request);
      record(request, body);
      const failure = consumeFailure();
      if (failure) return failure;
      const tuple = tupleOf(body as never);
      const existing = state.sets.find((s) => s.status === 'draft' && tupleOf(s) === tuple);
      const ifMatch = request.headers.get('if-match');
      const noneMatch = request.headers.get('if-none-match') === '*';
      if (state.failNext?.kind === 'conflict') {
        state.failNext = null;
        return conflict(existing ? bare(existing) : null);
      }
      if (existing && noneMatch) return conflict(bare(existing));
      if (existing && ifMatch && !sameInstant(ifMatch, existing.updatedAt)) return conflict(bare(existing));
      if (!existing && ifMatch) return conflict(null);
      const items = (body.items as Array<Record<string, unknown>>) ?? [];
      const set: AdminMediaSetJson =
        existing ??
        makeAdminSet({
          slot: body.slot as string,
          variantDim: body.variantDim as string,
          variantKey: body.variantKey as string,
          locale: body.locale as string,
          status: 'draft',
          mediaIds: [],
        });
      set.crossLocale = Boolean(body.crossLocale);
      set.notes = (body.notes as string | null) ?? null;
      set.items = items.map((it, i) =>
        makeItem(set.id, it.mediaId as string, i, (it.alt as Record<string, string>) ?? {}, {
          mobileMediaId: (it.mobileMediaId as string | null) ?? null,
          objectPosition: (it.objectPosition as AdminMediaSetItemJson['objectPosition']) ?? null,
          focalX: (it.focalX as number | null) ?? null,
          focalY: (it.focalY as number | null) ?? null,
        }),
      );
      set.updatedAt = tick();
      if (!existing) state.sets.push(set);
      pushHistory(set, existing ? 'update' : 'create');
      return HttpResponse.json({ set: bare(set) }, { status: existing ? 200 : 201 });
    }),

    http.post(`${base}/bulk-publish`, async ({ request }) => {
      const body = await readBody(request);
      record(request, body);
      const filter = (body.filter ?? {}) as Record<string, string>;
      // Garde-fou du vrai schéma : filtre non vide OU `all: true`.
      if (Object.keys(filter).length === 0 && body.all !== true) {
        return HttpResponse.json(
          { error: { code: 'invalid_input', message: 'Payload invalide' } },
          { status: 400 },
        );
      }
      const drafts = live().filter(
        (s) =>
          s.status === 'draft' &&
          Object.entries(filter).every(([k, v]) => (s as unknown as Record<string, unknown>)[k] === v),
      );
      const summary = (s: AdminMediaSetJson) => ({
        setId: s.id,
        slot: s.slot,
        variantDim: s.variantDim,
        variantKey: s.variantKey,
        locale: s.locale,
        source: s.source,
        version: s.version,
        itemCount: s.items.length,
        updatedAt: s.updatedAt,
      });
      if (body.dryRun) {
        return HttpResponse.json({
          dryRun: true,
          filter,
          all: false,
          matched: drafts.length,
          truncated: false,
          results: drafts.map((s) => {
            const pub = live().find((p) => p.status === 'published' && tupleOf(p) === tupleOf(s));
            return {
              ...summary(s),
              replacesPublished: pub ? { setId: pub.id, version: pub.version } : null,
              supersedesScheduled: null,
              warnings: s.items.length === 0 ? ['items.empty'] : [],
            };
          }),
        });
      }
      const expected = body.expected as Array<{ setId: string; updatedAt: string }> | undefined;
      if (expected) {
        const reviewed = new Map(expected.map((e) => [e.setId, e.updatedAt]));
        const unchanged =
          reviewed.size === drafts.length &&
          drafts.every((d) => reviewed.has(d.id) && sameInstant(reviewed.get(d.id)!, d.updatedAt));
        if (!unchanged) {
          return HttpResponse.json(
            {
              error: {
                code: 'invalid_state',
                message: 'La liste des brouillons a changé depuis la vérification : relancez l’essai à blanc avant de publier.',
                details: { reason: 'bulk.plan_changed', matched: drafts.length },
              },
            },
            { status: 409 },
          );
        }
      }
      const results = drafts.map((s) => {
        const before = summary(s);
        const p = publish(s);
        return { ...before, ok: true as const, publishedVersion: p.version };
      });
      return HttpResponse.json({
        dryRun: false,
        filter,
        all: false,
        matched: drafts.length,
        truncated: false,
        published: results.length,
        failed: 0,
        results,
        revalidated: [],
      });
    }),

    http.get(`${base}/history`, ({ request }) => {
      record(request, null);
      const url = new URL(request.url);
      const tuple = [
        url.searchParams.get('slot'),
        url.searchParams.get('variantDim'),
        url.searchParams.get('variantKey'),
        url.searchParams.get('locale'),
      ].join('|');
      return HttpResponse.json({
        componentKey,
        tuple: {},
        entries: state.history.filter((h) => h.tuple === tuple).map(({ tuple: _t, ...rest }) => rest),
      });
    }),

    http.post(`${base}/restore`, async ({ request }) => {
      const body = await readBody(request);
      record(request, body);
      const entry = state.history.find((h) => h.id === body.historyId);
      if (!entry) return HttpResponse.json({ error: { code: 'not_found', message: 'Entrée introuvable' } }, { status: 404 });
      const [slot, variantDim, variantKey, locale] = entry.tuple.split('|') as [string, string, string, string];
      let draft = live().find((s) => s.status === 'draft' && tupleOf(s) === entry.tuple);
      if (draft) {
        if (request.headers.get('if-none-match') === '*') return conflict(bare(draft));
        const c = checkIfMatch(request, draft);
        if (c) return c;
      } else {
        draft = makeAdminSet({ slot, variantDim, variantKey, locale, status: 'draft', mediaIds: [] });
        state.sets.push(draft);
      }
      draft.items = entry.items.map((i, pos) => makeItem(draft!.id, i.mediaId, pos, i.alt));
      draft.crossLocale = entry.crossLocale;
      draft.updatedAt = tick();
      pushHistory(draft, 'restore');
      return HttpResponse.json({ set: bare(draft), restoredFromVersion: entry.version });
    }),

    http.get(`${base}/resolve`, ({ request }) => {
      record(request, null);
      const url = new URL(request.url);
      const locale = url.searchParams.get('locale') ?? 'fr';
      const angle = url.searchParams.get('angle');
      return HttpResponse.json({
        componentKey,
        context: { locale, variants: { angle }, draft: url.searchParams.get('draft') === '1' },
        trackingValue: angle ? `angle-${angle}.${locale}.v1` : `default.${locale}.v1`,
        slots: policy.slots.map((s) => ({
          slot: s.key,
          level: angle ? 1 : 4,
          delegated: false,
          trace: {
            slot: s.key,
            level: angle ? 1 : 4,
            setId: 'cms_resolved',
            variantDim: angle ? 'angle' : 'default',
            variantKey: angle ?? '*',
            locale,
            version: 1,
          },
          trackingValue: angle ? `angle-${angle}.${locale}.v1` : `default.${locale}.v1`,
          images: [{ id: 'me_r', src: thumbFor('me_r'), width: 800, height: 1000, alt: 'résolue', mobile: null }],
        })),
      });
    }),

    http.post(`${base}/:setId/publish`, async ({ request, params }) => {
      const body = await readBody(request);
      record(request, body);
      const set = findSet(params.setId as string);
      if (!set) return HttpResponse.json({ error: { code: 'not_found', message: 'Introuvable' } }, { status: 404 });
      const c = checkIfMatch(request, set);
      if (c) return c;
      const failure = consumeFailure();
      if (failure) return failure;
      return HttpResponse.json({ set: bare(publish(set)), revalidated: [] });
    }),

    http.post(`${base}/:setId/schedule`, async ({ request, params }) => {
      const body = await readBody(request);
      record(request, body);
      const set = findSet(params.setId as string);
      if (!set) return HttpResponse.json({ error: { code: 'not_found', message: 'Introuvable' } }, { status: 404 });
      const c = checkIfMatch(request, set);
      if (c) return c;
      const failure = consumeFailure();
      if (failure) return failure;
      set.status = 'scheduled';
      set.scheduledAt = body.scheduledAt as string;
      set.updatedAt = tick();
      pushHistory(set, 'schedule');
      return HttpResponse.json({ set: bare(set), revalidated: [] });
    }),

    http.post(`${base}/:setId/cancel-schedule`, async ({ request, params }) => {
      const body = await readBody(request);
      record(request, body);
      const set = findSet(params.setId as string);
      if (!set) return HttpResponse.json({ error: { code: 'not_found', message: 'Introuvable' } }, { status: 404 });
      const c = checkIfMatch(request, set);
      if (c) return c;
      set.status = 'draft';
      set.scheduledAt = null;
      set.updatedAt = tick();
      pushHistory(set, 'unschedule');
      return HttpResponse.json({ set: bare(set), revalidated: [] });
    }),

    http.post(`${base}/:setId/unpublish`, async ({ request, params }) => {
      const body = await readBody(request);
      record(request, body);
      const set = findSet(params.setId as string);
      if (!set) return HttpResponse.json({ error: { code: 'not_found', message: 'Introuvable' } }, { status: 404 });
      const c = checkIfMatch(request, set);
      if (c) return c;
      set.status = 'archived';
      set.updatedAt = tick();
      pushHistory(set, 'unpublish');
      return HttpResponse.json({ set: bare(set), revalidated: [] });
    }),

    http.delete(`${base}/:setId`, async ({ request, params }) => {
      const body = await readBody(request);
      record(request, body);
      const set = findSet(params.setId as string);
      if (!set) return HttpResponse.json({ error: { code: 'not_found', message: 'Introuvable' } }, { status: 404 });
      const c = checkIfMatch(request, set);
      if (c) return c;
      state.sets = state.sets.filter((s) => s.id !== set.id);
      pushHistory(set, 'archive');
      return HttpResponse.json({ set: bare(set), revalidated: [] });
    }),
  ];

  return {
    handlers,
    state,
    /** Calls enregistrés (hors `GET /`), filtrables par méthode + suffixe de chemin. */
    callsTo(method: string, pathSuffix: string): RecordedCall[] {
      return state.calls.filter((c) => c.method === method && c.path.split('?')[0]!.endsWith(pathSuffix));
    },
    failNext(mode: FailMode): void {
      state.failNext = mode;
    },
  };
}
