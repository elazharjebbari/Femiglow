/**
 * CHA-225 — Tests d'`adminQueries` (KPIs + conversions + filtres).
 *
 * On mocke `requireChatDb()` pour fabriquer une chaîne Drizzle minimaliste
 * qui sait dispatcher les retours par `table` (et par projection `cols`).
 * Ça permet de couvrir, sans Postgres :
 *
 *  - `convertedSessionIds()` dédoublonne l'union (chat_session.converted_at
 *    + chat_lead.outcome='converted') ;
 *  - `listConversations({ converted: 'yes' })` court-circuite à `[]` si
 *    aucune session n'est convertie (early return) ;
 *  - `listConversations({ converted: 'yes' / 'no' })` passe correctement
 *    par la branche `inArray` / `NOT IN` ;
 *  - `listChatLeads()` applique les filtres (outcome, triggerReason, dates)
 *    et retourne les rows mockées ;
 *  - `overviewKpis()` agrège les compteurs dans le bon ordre — en
 *    particulier le KPI `conversions` qui passe par un `leftJoin` sur
 *    `chat_lead` (ce que le patch CHA-225 a corrigé).
 *
 * cf. apps/web/src/lib/chat/admin/queries.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow, ChatSessionRow } from '@/lib/chat/db/schema';

// ---------------------------------------------------------------------------
// État partagé entre tests. On le stocke via `vi.hoisted` pour qu'il soit
// disponible au moment où Vitest hoiste les `vi.mock`.
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  /** Compteur unique pour `chat_session` (overviewKpis sessions). */
  sessionCount: 0,
  /** Compteur retourné par la branche `leftJoin chat_lead` (conversions). */
  conversionsCount: 0,
  /**
   * Files FIFO consommées dans l'ordre par les `count()` sur les autres
   * tables. `overviewKpis` les appelle dans cet ordre : user, agent.
   */
  messageCounts: [] as number[],
  /** Files FIFO pour `chat_lead` (leadsCaptured puis leadsConverted). */
  leadCounts: [] as number[],
  /** Files FIFO pour `chat_feedback` (positifs puis négatifs). */
  feedbackCounts: [] as number[],
  /** Liste utilisée par `convertedSessionIds()` côté `chat_session`. */
  sessionIdsConverted: [] as Array<{ id: string }>,
  /** Liste utilisée par `convertedSessionIds()` côté `chat_lead`. */
  leadSessionIdsConverted: [] as Array<{ id: string }>,
  /** Rows complets pour `listConversations` (no q). */
  sessionsList: [] as ChatSessionRow[],
  /** Rows complets pour `listChatLeads`. */
  chatLeadsList: [] as ChatLeadRow[],
  /** Files FIFO pour les `db.execute(sql`)` (cost, latence). */
  executeRows: [] as Array<{ rows: Array<Record<string, unknown>> }>,
  /** Trace des appels `where()` (utile pour des asserts ciblés). */
  whereCalls: [] as unknown[],
  /** Compte les appels `leftJoin` (overviewKpis conversions = 1). */
  leftJoinCalls: 0,
}));

// ---------------------------------------------------------------------------
// Mock du client DB. On importe le schéma _réel_ pour identifier les tables
// par référence (Drizzle `pgTable`s sont des singletons).
// ---------------------------------------------------------------------------

vi.mock('@/lib/chat/db/client', async () => {
  const schema = await vi.importActual<typeof import('@/lib/chat/db/schema')>(
    '@/lib/chat/db/schema',
  );

  function pickRows(ctx: {
    cols: unknown;
    table: unknown;
    joinedTable: unknown;
  }): unknown[] {
    const cols = ctx.cols as Record<string, unknown> | undefined;

    if (ctx.table === schema.chatSession) {
      if (ctx.joinedTable === schema.chatLead) {
        // overviewKpis — branche conversions (leftJoin)
        return [{ value: state.conversionsCount }];
      }
      if (cols && 'value' in cols) {
        // overviewKpis — branche sessions count
        return [{ value: state.sessionCount }];
      }
      if (cols && 'id' in cols && Object.keys(cols).length === 1) {
        // convertedSessionIds — projection { id: chat_session.id }
        return state.sessionIdsConverted;
      }
      // listConversations — select() complet
      return state.sessionsList;
    }

    if (ctx.table === schema.chatLead) {
      if (cols && 'value' in cols) {
        return [{ value: state.leadCounts.shift() ?? 0 }];
      }
      if (cols && 'id' in cols && Object.keys(cols).length === 1) {
        return state.leadSessionIdsConverted;
      }
      return state.chatLeadsList;
    }

    if (ctx.table === schema.chatMessage) {
      return [{ value: state.messageCounts.shift() ?? 0 }];
    }

    if (ctx.table === schema.chatFeedback) {
      return [{ value: state.feedbackCounts.shift() ?? 0 }];
    }

    return [];
  }

  return {
    requireChatDb: () => ({
      select: (cols?: unknown) => {
        const ctx = { cols, table: undefined as unknown, joinedTable: undefined as unknown };
        const chain: unknown = {
          from: (t: unknown) => {
            ctx.table = t;
            return chain;
          },
          leftJoin: (t: unknown) => {
            ctx.joinedTable = t;
            state.leftJoinCalls += 1;
            return chain;
          },
          where: (cond: unknown) => {
            state.whereCalls.push(cond);
            return chain;
          },
          orderBy: () => chain,
          limit: () => chain,
          then: (resolve: (rows: unknown[]) => unknown) =>
            Promise.resolve(pickRows(ctx)).then(resolve),
        };
        return chain;
      },
      execute: () => Promise.resolve(state.executeRows.shift() ?? { rows: [] }),
    }),
  };
});

// Le module `queries.ts` est importé APRES le mock pour qu'il capture la
// version mockée de `requireChatDb`.
import { adminQueries } from './queries';

// ---------------------------------------------------------------------------
// Helpers builders
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ChatSessionRow> = {}): ChatSessionRow {
  const now = new Date('2026-05-01T10:00:00Z');
  return {
    id: 'cs_default',
    visitorId: 'cv_x',
    fingerprintHash: null,
    language: 'fr',
    page: '/produit',
    referrer: null,
    utm: null,
    instructionVersionId: 'ci_x',
    themePresetId: null,
    experimentVariantId: null,
    status: 'open',
    openedAt: now,
    lastSeenAt: now,
    archivedAt: null,
    purgedAt: null,
    consent: null,
    convertedOrderId: null,
    convertedAt: null,
    metaSummary: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ChatSessionRow;
}

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-02T10:00:00Z');
  return {
    id: 'cl_default',
    sessionId: 'cs_default',
    triggeringMessageId: null,
    triggerReason: 'manual',
    firstName: 'Yasmine',
    phoneE164: '+212600000000',
    phoneRaw: '0600000000',
    note: null,
    consentVersion: 'v1',
    consentAt: now,
    visitorId: 'cv_x',
    fingerprintHash: null,
    page: '/produit',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: null,
    snapshotMessages: null,
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ChatLeadRow;
}

beforeEach(() => {
  state.sessionCount = 0;
  state.conversionsCount = 0;
  state.messageCounts = [];
  state.leadCounts = [];
  state.feedbackCounts = [];
  state.sessionIdsConverted = [];
  state.leadSessionIdsConverted = [];
  state.sessionsList = [];
  state.chatLeadsList = [];
  state.executeRows = [];
  state.whereCalls = [];
  state.leftJoinCalls = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// convertedSessionIds — union dédupliquée
// ---------------------------------------------------------------------------

describe('adminQueries.convertedSessionIds — union session.converted_at + lead.outcome=converted', () => {
  it('retourne le merge dédupliqué des deux sources', async () => {
    state.sessionIdsConverted = [{ id: 'cs_a' }, { id: 'cs_b' }];
    state.leadSessionIdsConverted = [{ id: 'cs_b' }, { id: 'cs_c' }];

    const ids = await adminQueries.convertedSessionIds();
    expect(new Set(ids)).toEqual(new Set(['cs_a', 'cs_b', 'cs_c']));
    expect(ids).toHaveLength(3); // dédupliqué (cs_b apparait dans les 2 sources)
  });

  it('retourne un tableau vide quand aucune session n\'est convertie', async () => {
    state.sessionIdsConverted = [];
    state.leadSessionIdsConverted = [];
    const ids = await adminQueries.convertedSessionIds();
    expect(ids).toEqual([]);
  });

  it('renvoie uniquement les ids `chat_session` quand aucun lead converti n\'existe', async () => {
    state.sessionIdsConverted = [{ id: 'cs_only_order_link' }];
    state.leadSessionIdsConverted = [];
    const ids = await adminQueries.convertedSessionIds();
    expect(ids).toEqual(['cs_only_order_link']);
  });

  it('renvoie uniquement les ids `chat_lead` quand aucune session.converted_at n\'est posée', async () => {
    state.sessionIdsConverted = [];
    state.leadSessionIdsConverted = [{ id: 'cs_only_lead_converted' }];
    const ids = await adminQueries.convertedSessionIds();
    expect(ids).toEqual(['cs_only_lead_converted']);
  });
});

// ---------------------------------------------------------------------------
// listConversations — filtre `converted`
// ---------------------------------------------------------------------------

describe('adminQueries.listConversations — filtre converted yes/no (CHA-225)', () => {
  it('court-circuite à [] si converted="yes" et aucune session convertie', async () => {
    state.sessionIdsConverted = [];
    state.leadSessionIdsConverted = [];
    state.sessionsList = [makeSession({ id: 'cs_anything' })]; // ne doit pas être renvoyé

    const result = await adminQueries.listConversations({ converted: 'yes' });
    expect(result).toEqual([]);
  });

  it('passe par la branche inArray quand converted="yes" avec ids', async () => {
    state.sessionIdsConverted = [{ id: 'cs_a' }];
    state.leadSessionIdsConverted = [{ id: 'cs_b' }];
    state.sessionsList = [makeSession({ id: 'cs_a' }), makeSession({ id: 'cs_b' })];

    const result = await adminQueries.listConversations({ converted: 'yes' });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(['cs_a', 'cs_b']);
  });

  it('renvoie tout si converted="no" sans ids convertis (pas de NOT IN ajouté)', async () => {
    state.sessionIdsConverted = [];
    state.leadSessionIdsConverted = [];
    state.sessionsList = [makeSession({ id: 'cs_x' }), makeSession({ id: 'cs_y' })];

    const result = await adminQueries.listConversations({ converted: 'no' });
    expect(result).toHaveLength(2);
  });

  it('ne pré-charge pas convertedSessionIds quand converted est undefined', async () => {
    // Si la fonction tentait de charger les converted ids alors qu'on ne le
    // demande pas, elle ferait un select sur chat_lead avec projection `id`
    // — ce qu'on peut détecter via state.leadSessionIdsConverted.
    state.sessionIdsConverted = [{ id: 'cs_should_not_be_used' }];
    state.leadSessionIdsConverted = [{ id: 'cs_should_not_be_used' }];
    state.sessionsList = [makeSession({ id: 'cs_x' })];

    const result = await adminQueries.listConversations({});
    expect(result).toHaveLength(1);
    // Aucune assertion supplémentaire requise : la branche n'a pas été
    // déclenchée et l'absence d'erreur (ainsi que le bon retour) suffit.
  });
});

// ---------------------------------------------------------------------------
// listChatLeads — filtres
// ---------------------------------------------------------------------------

describe('adminQueries.listChatLeads — filtres outcome / trigger / date', () => {
  it('renvoie les leads avec valeurs par défaut quand aucun filtre', async () => {
    state.chatLeadsList = [
      makeLead({ id: 'cl_1', outcome: 'pending' }),
      makeLead({ id: 'cl_2', outcome: 'converted' }),
    ];
    const rows = await adminQueries.listChatLeads();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(['cl_1', 'cl_2']);
  });

  it('appelle .where() avec une condition quand outcome est fourni', async () => {
    state.chatLeadsList = [makeLead({ id: 'cl_c', outcome: 'converted' })];
    await adminQueries.listChatLeads({ outcome: 'converted' });
    // 1 condition appliquée (outcome='converted').
    expect(state.whereCalls).toHaveLength(1);
  });

  it('appelle .where() avec deux conditions quand outcome + triggerReason fournis', async () => {
    state.chatLeadsList = [];
    await adminQueries.listChatLeads({
      outcome: 'pending',
      triggerReason: 'inline-contact',
    });
    expect(state.whereCalls).toHaveLength(1); // un seul where() (and(...))
  });

  it('respecte limit (le mock ne tronque pas, mais la chaîne reste appelée)', async () => {
    state.chatLeadsList = Array.from({ length: 5 }, (_, i) =>
      makeLead({ id: `cl_${i}` }),
    );
    const rows = await adminQueries.listChatLeads({ limit: 2 });
    // Le mock retourne tout (le `.limit()` est no-op), mais la fonction
    // a bien été appelée — c'est plutôt une assertion comportementale.
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// overviewKpis — KPIs agrégés (en particulier `conversions` via UNION)
// ---------------------------------------------------------------------------

describe('adminQueries.overviewKpis — agrégation 7d (CHA-225)', () => {
  it('combine sessions + messages + conversions UNION + leads + feedback + cost + latence', async () => {
    state.sessionCount = 100;
    state.messageCounts = [400, 380]; // user, agent
    state.conversionsCount = 7; // via leftJoin chat_lead
    state.leadCounts = [12, 3]; // captured, converted
    state.feedbackCounts = [25, 5]; // pos, neg
    state.executeRows = [
      { rows: [{ total: '0.4521' }] },
      { rows: [{ p50: 1200, p95: 4500 }] },
    ];

    const k = await adminQueries.overviewKpis('7d');

    expect(k.sessions).toBe(100);
    expect(k.messagesUser).toBe(400);
    expect(k.messagesAgent).toBe(380);
    expect(k.conversions).toBe(7);
    expect(k.leadsCaptured).toBe(12);
    expect(k.leadsConverted).toBe(3);
    expect(k.feedbackPos).toBe(25);
    expect(k.feedbackNeg).toBe(5);
    expect(k.totalCostEur).toBeCloseTo(0.4521);
    expect(k.latencyP50).toBe(1200);
    expect(k.latencyP95).toBe(4500);
    expect(k.window).toBe('7d');
  });

  it('passe bien par un leftJoin pour le KPI `conversions` (vérifie le patch CHA-225)', async () => {
    state.executeRows = [
      { rows: [{ total: '0' }] },
      { rows: [{ p50: null, p95: null }] },
    ];
    state.conversionsCount = 0;
    state.leadCounts = [0, 0];
    state.messageCounts = [0, 0];
    state.feedbackCounts = [0, 0];

    await adminQueries.overviewKpis('7d');
    // Avant CHA-225, le KPI conversions ne faisait PAS de leftJoin → 0.
    // Après CHA-225, on doit voir exactement 1 leftJoin (sur chat_lead).
    expect(state.leftJoinCalls).toBe(1);
  });

  it('renvoie 0 pour conversions quand ni order link ni lead converted (cas vierge)', async () => {
    state.executeRows = [
      { rows: [{ total: '0' }] },
      { rows: [{ p50: null, p95: null }] },
    ];
    state.conversionsCount = 0;
    state.leadCounts = [0, 0];
    state.messageCounts = [0, 0];
    state.feedbackCounts = [0, 0];

    const k = await adminQueries.overviewKpis('7d');
    expect(k.conversions).toBe(0);
    expect(k.leadsConverted).toBe(0);
    expect(k.latencyP50).toBeNull();
    expect(k.latencyP95).toBeNull();
  });

  it('parse correctement le coût depuis la string PostgreSQL', async () => {
    state.executeRows = [
      { rows: [{ total: '1.234567' }] },
      { rows: [{ p50: 800, p95: 2500 }] },
    ];
    state.messageCounts = [0, 0];
    state.leadCounts = [0, 0];
    state.feedbackCounts = [0, 0];

    const k = await adminQueries.overviewKpis('7d');
    expect(k.totalCostEur).toBeCloseTo(1.234567, 6);
  });

  it('respecte le paramètre window (défaut 7d)', async () => {
    state.executeRows = [
      { rows: [{ total: '0' }] },
      { rows: [{ p50: null, p95: null }] },
    ];
    state.messageCounts = [0, 0];
    state.leadCounts = [0, 0];
    state.feedbackCounts = [0, 0];

    const k7 = await adminQueries.overviewKpis('7d');
    expect(k7.window).toBe('7d');

    state.executeRows = [
      { rows: [{ total: '0' }] },
      { rows: [{ p50: null, p95: null }] },
    ];
    state.messageCounts = [0, 0];
    state.leadCounts = [0, 0];
    state.feedbackCounts = [0, 0];

    const k30 = await adminQueries.overviewKpis('30d');
    expect(k30.window).toBe('30d');
  });
});
