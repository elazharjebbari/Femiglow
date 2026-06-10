/**
 * Handlers MSW pour le système emailing (admin cockpit + webhooks mail).
 *
 * Couche de contrat partagée par les tests COMPOSANT/intégration des écrans
 * /admin/emails (transactional, audiences, templates, automation, health) et
 * des endpoints publics /api/mail/* (unsubscribe + webhooks Stalwart/Listmonk).
 * Cf. docs/emailing/qa-campaign-2026-06/.
 *
 * Cycle de vie géré PAR FICHIER (jamais global) :
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * Deux exports complémentaires :
 *   - `emailsHandlers` : un handler NOMINAL réaliste par endpoint (données
 *     produites par les factories `emails.factory`). Stateless : chaque GET
 *     renvoie une liste fraîche — pour du stateful, override par endpoint.
 *   - `emailsFailWith` : grille d'échecs réutilisable construite sur
 *     `http[method](url, ...)` (unauthorized / validation / serverError /
 *     hang / network). Précédence MSW 2.x : dans UN MÊME `server.use(...)` le
 *     PREMIER handler matchant gagne ; entre deux appels `server.use(...)`
 *     SÉPARÉS, le DERNIER gagne. Donc pour qu'un échec écrase le nominal :
 *       server.use(...emailsHandlers);                              // baseline
 *       server.use(emailsFailWith.serverError('/api/.../audiences')); // override
 *     (ou placer le fail AVANT le nominal dans le même appel).
 *
 * Helpers d'override par endpoint exportés (makeSearchResult, makeSummary…)
 * pour façonner des réponses précises sans recopier la forme.
 */
import { http, HttpResponse, delay } from 'msw';
import {
  makeOutboxRow,
  makeEmailAudience,
  makeAudienceSnapshot,
  makeSnapshotMember,
  makeSuppression,
  makeTemplateCustom,
  makeTemplateCustomVersion,
} from '@/test/factories/emails.factory';
import { AUTOMATION_EVENT_CATALOG } from '@/lib/mail/automation/step-types-v2';

// ── Forme des réponses (miroir des types serveur) ────────────────────────────

/** Ligne outbox telle que renvoyée par /transactional/search (OutboxSearchRow). */
export interface SearchRow {
  id: string;
  template: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  source: string;
  createdAt: string;
  deliveredAt: string | null;
  bounceType: string | null;
}

/** Réponse /transactional/search (SearchResult). */
export interface SearchResult {
  rows: SearchRow[];
  total: number;
  window: 'matched' | 'truncated';
}

/** Réponse /transactional/summary (SummaryResult). */
export interface SummaryResult {
  window: '1h' | '24h' | '7d' | '30d';
  delivered: number;
  queued: number;
  failed: number;
  hardBounced: number;
  /** F03 : base du tri-état livraison. */
  sent: number;
  /** F03 : dernier event delivered reçu (null = webhook jamais armé). */
  webhookLastSuccessAt: string | null;
  sparkline: { delivered: number; failed: number }[];
  comparison?: { deliveredPct: number; failedPct: number };
}

// ── Override helpers (façonnent une réponse sans recopier la forme) ───────────

/** Construit une ligne de recherche outbox à partir d'une ligne factory. */
export function makeSearchRow(over: Partial<SearchRow> = {}): SearchRow {
  const row = makeOutboxRow();
  return {
    id: String(row.id),
    template: row.template,
    toEmail: row.toEmail,
    toName: row.toName ?? null,
    subject: row.subject,
    status: row.status ?? 'pending',
    attempts: row.attempts ?? 0,
    maxAttempts: row.maxAttempts ?? 5,
    lastError: row.lastError ?? null,
    source: row.source ?? 'transactional',
    createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date()).toISOString(),
    deliveredAt: row.deliveredAt instanceof Date ? row.deliveredAt.toISOString() : null,
    bounceType: row.bounceType ?? null,
    ...over,
  };
}

/** Construit une réponse /transactional/search (n lignes par défaut). */
export function makeSearchResult(over: Partial<SearchResult> = {}): SearchResult {
  const rows = over.rows ?? [makeSearchRow(), makeSearchRow({ status: 'delivered' })];
  return {
    rows,
    total: over.total ?? rows.length,
    window: over.window ?? 'matched',
  };
}

/** Construit une réponse /transactional/summary. */
export function makeSummary(over: Partial<SummaryResult> = {}): SummaryResult {
  return {
    window: over.window ?? '1h',
    delivered: over.delivered ?? 120,
    queued: over.queued ?? 8,
    failed: over.failed ?? 3,
    hardBounced: over.hardBounced ?? 1,
    sent: over.sent ?? 130,
    webhookLastSuccessAt:
      over.webhookLastSuccessAt !== undefined
        ? over.webhookLastSuccessAt
        : '2026-06-01T10:00:00.000Z',
    sparkline:
      over.sparkline ??
      Array.from({ length: 12 }, (_, i) => ({ delivered: 10 - (i % 3), failed: i % 2 })),
    ...(over.comparison ? { comparison: over.comparison } : {}),
  };
}

// ── Données nominales prêtes (sérialisables — Date→ISO via HttpResponse.json) ─

function nominalView() {
  return {
    id: 'view_sys_failures',
    ownerEmail: 'system',
    name: 'Échecs récents',
    scope: 'transactional' as const,
    filterState: { filters: { status: ['failed', 'dlq'] }, sort: 'date_desc', cols: [] },
    isSystem: true,
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
  };
}

function nominalAudienceListItem() {
  const a = makeEmailAudience();
  return {
    id: 'aud_acheteuses',
    slug: a.slug,
    name: a.name,
    description: a.description ?? null,
    evaluationMode: a.evaluationMode ?? 'dynamic',
    createdBy: a.createdBy ?? 'admin_test',
    createdAt: '2026-06-04T10:00:00.000Z',
    snapshotCount: 2,
  };
}

function nominalAudienceRow() {
  const a = makeEmailAudience();
  return {
    id: 'aud_acheteuses',
    slug: a.slug,
    name: a.name,
    description: a.description ?? null,
    rules: a.rules,
    exclusionFlags: a.exclusionFlags,
    evaluationMode: a.evaluationMode ?? 'dynamic',
    createdBy: a.createdBy ?? 'admin_test',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
    deletedAt: null,
  };
}

function nominalTemplateRow() {
  const t = makeTemplateCustom();
  return {
    id: 'tpl_promo',
    slug: t.slug,
    name: t.name,
    description: t.description ?? null,
    subjectTmpl: t.subjectTmpl,
    preheaderTmpl: t.preheaderTmpl ?? '',
    htmlSource: t.htmlSource,
    customVars: t.customVars ?? {},
    activeVersionId: null,
    createdBy: t.createdBy ?? 'admin_test',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
    deletedAt: null,
  };
}

function nominalTemplateVersion(versionNumber = 1) {
  const v = makeTemplateCustomVersion();
  return {
    id: `tplv_${versionNumber}`,
    templateId: 'tpl_promo',
    versionNumber,
    subjectTmpl: v.subjectTmpl,
    preheaderTmpl: v.preheaderTmpl ?? '',
    htmlSource: v.htmlSource,
    customVars: v.customVars ?? {},
    commitMessage: v.commitMessage ?? 'Initial version',
    createdBy: v.createdBy ?? 'admin_test',
    createdAt: '2026-06-04T10:00:00.000Z',
  };
}

function nominalHealthReport() {
  return {
    level: 'ok' as const,
    checks: {
      smtpConfigured: { ok: true, missing: [] as string[] },
      db: { ok: true },
      outboxStuck: { ok: true, stuckCount: 0 },
      dlq24h: { ok: true, count: 0 },
      pendingNow: 3,
      lastDeliveredAt: '2026-06-04T09:58:00.000Z',
    },
    timestamp: '2026-06-04T10:00:00.000Z',
  };
}

// ── Handlers nominaux (un par endpoint trouvé sous /api/admin/emails & /api/mail)

/**
 * Handlers nominaux réalistes. Stateless : chaque GET renvoie une liste fraîche
 * via les factories. Pour du stateful (create reflété au refresh), override
 * l'endpoint concerné dans le test via `server.use(http.post(...))`.
 */
export const emailsHandlers = [
  // ── Navigation (P0.2 — contrat AMONT : la route réelle arrive en F02) ───
  // Compteurs des badges d'onglets. Forme verrouillée par
  // NavCountersResponseWire (lib/mail/wire-schemas.ts) via le test de
  // conformité ; permet d'écrire EmailsTabs test-first.
  http.get('/api/admin/emails/nav-counters', () =>
    HttpResponse.json({
      dlq: 0,
      automationErrors: 0,
      listmonkSyncFailed: 0,
      generatedAt: '2026-06-06T10:00:00.000Z',
    }),
  ),
  // ── Transactional cockpit ──────────────────────────────────────────────
  http.post('/api/admin/emails/transactional/search', () =>
    HttpResponse.json(makeSearchResult()),
  ),
  http.get('/api/admin/emails/transactional/summary', ({ request }) => {
    const window = (new URL(request.url).searchParams.get('window') ?? '1h') as
      | '1h'
      | '24h'
      | '7d';
    return HttpResponse.json(makeSummary({ window }));
  }),
  http.post('/api/admin/emails/transactional/bulk-retry', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const ids = body.ids ?? [];
    return HttpResponse.json({ retried: ids.length, skipped: 0, skippedIds: [] });
  }),
  http.post('/api/admin/emails/transactional/bulk-suppress', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const ids = body.ids ?? [];
    return HttpResponse.json({ suppressed: ids.length, skipped: 0 });
  }),
  // P0.2 : nominal manquant détecté par le test de conformité (chaque suite
  // le redéfinissait localement) — forme verrouillée par ReapStuckResponseWire.
  // POST /transactional/export (CKPT-01) : CSV streamé — le nominal renvoie
  // un petit CSV BOM + en-têtes, X-Export-Capped: false (contrat d'en-têtes).
  http.post('/api/admin/emails/transactional/export', () =>
    new HttpResponse('﻿id,date,destinataire,nom,template,sujet,statut,tentatives\r\n', {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="emails-transactionnels-2026-06-10.csv"',
        'cache-control': 'no-store',
        'x-export-capped': 'false',
      },
    }),
  ),

  http.post('/api/admin/emails/transactional/reap-stuck', () =>
    HttpResponse.json({ reaped: 0 }),
  ),

  // ── Suppression (P0.2 — nominaux manquants, formes wire-schemas.ts) ─────
  // NB : HttpResponse.json sérialise les Date du factory en ISO (format wire).
  http.get('/api/admin/emails/suppression', ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const limit = Number(sp.get('limit') ?? 50);
    const offset = Number(sp.get('offset') ?? 0);
    const rows = [
      makeSuppression(),
      makeSuppression({ reason: 'unsubscribe', source: 'manual', detail: null }),
    ];
    return HttpResponse.json({ rows, total: rows.length, limit, offset });
  }),
  http.delete('/api/admin/emails/suppression', () =>
    HttpResponse.json({ removed: true }),
  ),

  // ── Saved views (CRUD) ─────────────────────────────────────────────────
  http.get('/api/admin/emails/views', () => HttpResponse.json([nominalView()])),
  http.post('/api/admin/emails/views', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      scope?: string;
      filterState?: unknown;
    };
    return HttpResponse.json({
      ...nominalView(),
      id: 'view_new',
      ownerEmail: 'admin@femiglow.local',
      name: body.name ?? 'Nouvelle vue',
      scope: (body.scope ?? 'transactional') as 'transactional',
      filterState: body.filterState ?? { filters: {}, sort: 'date_desc', cols: [] },
      isSystem: false,
    });
  }),
  http.patch('/api/admin/emails/views/:id', async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return HttpResponse.json({
      ...nominalView(),
      id: String(params.id),
      ownerEmail: 'admin@femiglow.local',
      isSystem: false,
      name: body.name ?? nominalView().name,
    });
  }),
  http.delete('/api/admin/emails/views/:id', () => HttpResponse.json({ ok: true })),

  // ── Audiences ──────────────────────────────────────────────────────────
  http.get('/api/admin/emails/audiences', () =>
    HttpResponse.json([nominalAudienceListItem()]),
  ),
  http.post('/api/admin/emails/audiences', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; name?: string };
    return HttpResponse.json({
      ...nominalAudienceRow(),
      id: 'aud_new',
      slug: body.slug ?? 'nouvelle-audience',
      name: body.name ?? 'Nouvelle audience',
    });
  }),
  http.get('/api/admin/emails/audiences/:id', ({ params }) =>
    HttpResponse.json({ ...nominalAudienceRow(), id: String(params.id) }),
  ),
  http.patch('/api/admin/emails/audiences/:id', async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return HttpResponse.json({
      ...nominalAudienceRow(),
      id: String(params.id),
      name: body.name ?? nominalAudienceRow().name,
    });
  }),
  http.delete('/api/admin/emails/audiences/:id', () => HttpResponse.json({ ok: true })),
  http.post('/api/admin/emails/audiences/preview-size', () =>
    HttpResponse.json({ size: 1234, durationMs: 42 }),
  ),
  http.post('/api/admin/emails/audiences/preview-sample', () => {
    const m1 = makeSnapshotMember();
    const m2 = makeSnapshotMember();
    return HttpResponse.json({
      samples: [
        { email: m1.email, name: 'Kaoutar Benani', createdAt: '2026-06-04T10:00:00.000Z' },
        { email: m2.email, name: null, createdAt: '2026-06-03T10:00:00.000Z' },
      ],
      size: 1234,
    });
  }),
  http.post('/api/admin/emails/audiences/:id/snapshot', ({ params }) => {
    const snap = makeAudienceSnapshot();
    return HttpResponse.json({
      snapshotId: 'snap_new',
      audienceId: String(params.id),
      size: snap.size ?? 3,
      status: 'done',
      durationMs: 87,
    });
  }),

  // ── Templates HTML custom ──────────────────────────────────────────────
  http.get('/api/admin/emails/templates', () => HttpResponse.json([nominalTemplateRow()])),
  http.post('/api/admin/emails/templates', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; name?: string };
    return HttpResponse.json({
      ...nominalTemplateRow(),
      id: 'tpl_new',
      slug: body.slug ?? 'nouveau-template',
      name: body.name ?? 'Nouveau template',
    });
  }),
  http.get('/api/admin/emails/templates/autocomplete', () =>
    HttpResponse.json({
      templates: [
        { slug: 'welcome-rituel', name: 'welcome.subject', source: 'system' },
        { slug: makeTemplateCustom().slug, name: 'Promo printemps', source: 'custom' },
      ],
    }),
  ),
  // Suggestions destinataire / source / lead (chantier FONDATION vague 4).
  http.get('/api/admin/emails/transactional/recipients-autocomplete', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const all = [
      'amal@exemple.test',
      'amine@exemple.test',
      'bouchra@exemple.test',
      'kaoutar@exemple.test',
    ];
    const recipients = (q ? all.filter((e) => e.startsWith(q)) : all).slice(0, 20);
    return HttpResponse.json({ recipients });
  }),
  http.get('/api/admin/emails/transactional/sources', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const all = ['api.contact', 'app', 'import', 'transactional'];
    const sources = (q ? all.filter((s) => s.startsWith(q)) : all).slice(0, 20);
    return HttpResponse.json({ sources });
  }),
  http.get('/api/admin/emails/leads/autocomplete', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const all = [
      { email: 'amal@exemple.test', name: 'Amal Benali' },
      { email: 'kaoutar@exemple.test', name: 'Kaoutar Idrissi' },
      { email: 'sans-nom@exemple.test', name: null },
    ];
    const leads = (q
      ? all.filter(
          (l) =>
            l.email.toLowerCase().includes(q) ||
            (l.name ?? '').toLowerCase().includes(q),
        )
      : all
    ).slice(0, 20);
    return HttpResponse.json({ leads });
  }),
  http.get('/api/admin/emails/templates/starters', () =>
    HttpResponse.json([
      {
        id: 'blank',
        name: 'Vide',
        description: 'Template minimal sans charte',
        htmlSource: '<!doctype html><html lang="fr"><body><p>{{firstName}}, …</p></body></html>',
      },
      {
        id: 'default-femiglow',
        name: 'Default FemiGlow',
        description: 'Template haut calibre conforme à la charte FemiGlow',
        htmlSource: '<!doctype html><html lang="fr"><body><h1>FemiGlow</h1></body></html>',
      },
    ]),
  ),
  http.get('/api/admin/emails/templates/:id', ({ params }) =>
    HttpResponse.json({ ...nominalTemplateRow(), id: String(params.id) }),
  ),
  http.delete('/api/admin/emails/templates/:id', () => HttpResponse.json({ ok: true })),
  http.post('/api/admin/emails/templates/:id/preview', () =>
    HttpResponse.json({
      subject: 'Bonjour Kaoutar, -90 MAD sur votre rituel',
      preheader: 'Offre limitée — profitez-en',
      html: '<html><body><p>Bonjour Kaoutar</p></body></html>',
      variablesResolved: ['firstName', 'promoMad', 'email'],
    }),
  ),
  http.get('/api/admin/emails/templates/:id/versions', () =>
    HttpResponse.json([nominalTemplateVersion(2), nominalTemplateVersion(1)]),
  ),
  http.post('/api/admin/emails/templates/:id/versions', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { commitMessage?: string };
    return HttpResponse.json({
      ...nominalTemplateVersion(3),
      commitMessage: body.commitMessage ?? 'Nouvelle version',
    });
  }),

  // ── Automation ─────────────────────────────────────────────────────────
  http.get('/api/admin/emails/automation/events-catalog', () =>
    HttpResponse.json({ events: AUTOMATION_EVENT_CATALOG }),
  ),

  // ── Health ─────────────────────────────────────────────────────────────
  http.get('/api/admin/emails/health', () => HttpResponse.json(nominalHealthReport())),

  // ── Public mail endpoints ──────────────────────────────────────────────
  http.post('/api/mail/unsubscribe', () => HttpResponse.json({ ok: true })),
  http.get('/api/mail/unsubscribe', () =>
    HttpResponse.html(
      '<!doctype html><html lang="fr"><body><h1>Désinscription confirmée ✓</h1></body></html>',
      { status: 200 },
    ),
  ),
  http.post('/api/mail/webhook/stalwart', () => HttpResponse.json({ ok: true })),
  http.post('/api/mail/webhook/listmonk', () => HttpResponse.json({ ok: true })),
];

// ── Grille d'échecs réutilisable ─────────────────────────────────────────────

type HttpMethod = 'get' | 'post' | 'patch' | 'delete' | 'put';

/**
 * Construit un handler d'échec ciblé pour une URL + méthode données.
 * Pour qu'il « gagne » sur le nominal, l'enregistrer dans un `server.use(...)`
 * SÉPARÉ (postérieur), OU en tête du même appel (cf. JSDoc du module) :
 *
 *   server.use(...emailsHandlers);                                   // baseline
 *   server.use(emailsFailWith.serverError('/api/admin/emails/audiences')); // win
 */
export const emailsFailWith = {
  /** 401 — session admin absente/expirée (forme : texte « Unauthorized »). */
  unauthorized(url: string, method: HttpMethod = 'get') {
    return http[method](url, () => new HttpResponse('Unauthorized', { status: 401 }));
  },

  /** 422 — échec de validation Zod (forme cockpit : { error, issues }). */
  validation(url: string, method: HttpMethod = 'post', detail?: string) {
    return http[method](url, () =>
      HttpResponse.json(
        {
          error: detail ?? 'Validation échouée',
          issues: { formErrors: [], fieldErrors: { _: [detail ?? 'invalid'] } },
        },
        { status: 422 },
      ),
    );
  },

  /** 500 — erreur serveur (forme : { ok: false, error }). */
  serverError(url: string, method: HttpMethod = 'get') {
    return http[method](url, () =>
      HttpResponse.json({ ok: false, error: 'forced_server_error' }, { status: 500 }),
    );
  },

  /** Requête qui ne répond jamais (timeout/loading-state infini). */
  hang(url: string, method: HttpMethod = 'get') {
    return http[method](url, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    });
  },

  /** Erreur réseau (fetch rejette : TypeError) — teste les catch réseau. */
  network(url: string, method: HttpMethod = 'get') {
    return http[method](url, () => HttpResponse.error());
  },
};
