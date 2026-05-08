/**
 * CHA-225 — Tests d'unification `leads` + `chat_lead` côté lecture.
 *
 * On mocke les deux clients DB (`@/lib/db/client` et `@/lib/chat/db/client`)
 * pour que `listLeads()` et `getLeadById()` empruntent la branche drizzle,
 * sans avoir besoin d'un Postgres réel. Le but est de verrouiller :
 *  - le mapping `chat_lead.outcome` → `LeadStatus`
 *  - le source-tagging `chat:${triggerReason}`
 *  - le merge + tri par date entre les deux sources
 *  - la pagination cohérente sur la liste fusionnée
 *  - la branche `cl_xxx` de `getLeadById`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';

// -----------------------------------------------------------------------------
// Stubs DB. On mocke via `vi.hoisted` pour pouvoir muter les jeux de données
// d'un test à l'autre. Les chaînes Drizzle utilisées dans `leads.ts` sont :
//   • drizzle.select().from(schema.leads).where(...).orderBy(...)
//   • drizzle.select().from(chatLead).orderBy(...)
//   • drizzle.select().from(schema.leads).where(...).limit(1)
//   • drizzle.insert(schema.leads).values(...)
//   • drizzle.update(schema.leads).set(...).where(...).returning()
// On n'a besoin que des chemins read pour ces tests.
// -----------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  ecommerceLeads: [] as Array<Record<string, unknown>>,
  chatLeads: [] as ChatLeadRow[],
}));

function makeChainable<T>(rows: T[]) {
  // Drizzle expose un PromiseLike ; on imite juste assez de méthodes pour
  // couvrir les usages réels dans `leads.ts`.
  const chain = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (rows: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>(
    '@/lib/db/client',
  );
  return {
    ...actual,
    db: () => ({
      select: () => ({
        from: (_table: unknown) => makeChainable(state.ecommerceLeads),
      }),
    }),
  };
});

vi.mock('@/lib/chat/db/client', () => ({
  chatDb: () => ({
    select: () => ({
      from: (_table: unknown) => makeChainable(state.chatLeads),
    }),
  }),
}));

// Import APRES les mocks pour que `leads.ts` capture les versions mockées.
import { listLeads, getLeadById } from './leads';

// -----------------------------------------------------------------------------
// Helpers builders
// -----------------------------------------------------------------------------

function makeEcommerceLead(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-05-01T10:00:00Z');
  return {
    id: 'l_ecom_001',
    email: 'shop@example.com',
    phone: null,
    name: 'Sara Shop',
    status: 'new',
    source: 'checkout',
    consentMarketing: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeChatLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-02T10:00:00Z');
  return {
    id: 'cl_chat_001',
    sessionId: 'cs_x',
    triggeringMessageId: 'cm_x',
    triggerReason: 'purchase-intent',
    firstName: 'Hamid',
    phoneE164: '+212600000000',
    phoneRaw: '0600000000',
    note: null,
    consentVersion: 'v1',
    consentAt: now,
    visitorId: 'v_x',
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
  state.ecommerceLeads = [];
  state.chatLeads = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('listLeads — union ecommerce + chat_lead', () => {
  it('fusionne les deux sources et trie par date desc par défaut', async () => {
    state.ecommerceLeads = [
      makeEcommerceLead({ id: 'l_old', createdAt: new Date('2026-04-01T10:00:00Z') }),
    ];
    state.chatLeads = [
      makeChatLead({ id: 'cl_recent', createdAt: new Date('2026-05-05T10:00:00Z') }),
    ];

    const result = await listLeads();
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => r.id)).toEqual(['cl_recent', 'l_old']);
  });

  it('mappe outcome→status (pending→new, reached→contacted, converted→converted, discarded→lost)', async () => {
    state.chatLeads = [
      makeChatLead({ id: 'cl_p', outcome: 'pending' }),
      makeChatLead({ id: 'cl_r', outcome: 'reached' }),
      makeChatLead({ id: 'cl_n', outcome: 'no-answer' }),
      makeChatLead({ id: 'cl_c', outcome: 'converted' }),
      makeChatLead({ id: 'cl_d', outcome: 'discarded' }),
    ];

    const result = await listLeads();
    const map = Object.fromEntries(result.rows.map((r) => [r.id, r.status]));
    expect(map).toEqual({
      cl_p: 'new',
      cl_r: 'contacted',
      cl_n: 'contacted',
      cl_c: 'converted',
      cl_d: 'lost',
    });
  });

  it("préfixe la source avec 'chat:' pour les leads venus du chat", async () => {
    state.chatLeads = [
      makeChatLead({ id: 'cl_pi', triggerReason: 'purchase-intent' }),
      makeChatLead({ id: 'cl_ic', triggerReason: 'inline-contact' }),
    ];

    const result = await listLeads();
    const map = Object.fromEntries(result.rows.map((r) => [r.id, r.source]));
    expect(map).toEqual({
      cl_pi: 'chat:purchase-intent',
      cl_ic: 'chat:inline-contact',
    });
  });

  it('email vaut null pour les chat leads (capture phone-only)', async () => {
    state.chatLeads = [makeChatLead({ id: 'cl_x', firstName: 'Yasmine', phoneE164: '+212611111111' })];

    const result = await listLeads();
    expect(result.rows[0]?.email).toBeNull();
    expect(result.rows[0]?.phone).toBe('+212611111111');
    expect(result.rows[0]?.name).toBe('Yasmine');
  });

  it('filtre par statut transverse (chat + ecommerce)', async () => {
    state.ecommerceLeads = [makeEcommerceLead({ id: 'l_a', status: 'new' })];
    state.chatLeads = [
      makeChatLead({ id: 'cl_a', outcome: 'pending' }),     // → new
      makeChatLead({ id: 'cl_b', outcome: 'converted' }),    // → converted
    ];

    const result = await listLeads({ status: 'new' });
    expect(result.rows.map((r) => r.id).sort()).toEqual(['cl_a', 'l_a']);
  });

  it('paginate à travers la liste fusionnée', async () => {
    // 5 leads ecommerce + 5 chat leads, on veut page 2 pageSize 4.
    const baseDate = new Date('2026-05-01T00:00:00Z').getTime();
    state.ecommerceLeads = Array.from({ length: 5 }, (_, i) =>
      makeEcommerceLead({
        id: `l_${i}`,
        createdAt: new Date(baseDate + i * 1000),
      }),
    );
    state.chatLeads = Array.from({ length: 5 }, (_, i) =>
      makeChatLead({
        id: `cl_${i}`,
        createdAt: new Date(baseDate + (i + 5) * 1000),
      }),
    );

    const page1 = await listLeads({ page: 1, pageSize: 4 });
    const page2 = await listLeads({ page: 2, pageSize: 4 });
    expect(page1.total).toBe(10);
    expect(page1.rows).toHaveLength(4);
    expect(page2.rows).toHaveLength(4);
    // Pas de chevauchement.
    const ids1 = new Set(page1.rows.map((r) => r.id));
    const ids2 = new Set(page2.rows.map((r) => r.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });

  it('tri ASC respecté sur la liste fusionnée', async () => {
    state.ecommerceLeads = [
      makeEcommerceLead({ id: 'l_old', createdAt: new Date('2026-01-01T00:00:00Z') }),
    ];
    state.chatLeads = [
      makeChatLead({ id: 'cl_new', createdAt: new Date('2026-06-01T00:00:00Z') }),
    ];

    const result = await listLeads({ sort: 'created_asc' });
    expect(result.rows.map((r) => r.id)).toEqual(['l_old', 'cl_new']);
  });

  it("filtre par recherche libre couvre prénom et téléphone du chat lead", async () => {
    state.chatLeads = [
      makeChatLead({ id: 'cl_h', firstName: 'Hamid', phoneE164: '+212751592310' }),
      makeChatLead({ id: 'cl_y', firstName: 'Yasmine', phoneE164: '+212600000000' }),
    ];

    const byName = await listLeads({ search: 'hamid' });
    expect(byName.rows.map((r) => r.id)).toEqual(['cl_h']);

    // Recherche par téléphone : la valeur stockée est E.164 (`+212…`),
    // le substring match ne normalise pas. Le caller doit donc taper une
    // sous-chaîne reconnaissable. L'amélioration UX (normalisation côté
    // serveur) est traçable séparément.
    const byPhone = await listLeads({ search: '212751592310' });
    expect(byPhone.rows.map((r) => r.id)).toEqual(['cl_h']);
  });
});

describe('getLeadById — branche cl_xxx', () => {
  it('retourne le chat lead mappé sans commande pour un id cl_*', async () => {
    state.chatLeads = [
      makeChatLead({
        id: 'cl_target',
        firstName: 'Inès',
        phoneE164: '+212611223344',
        triggerReason: 'inline-contact',
        outcome: 'reached',
      }),
    ];

    const found = await getLeadById('cl_target');
    expect(found).not.toBeNull();
    expect(found?.lead.id).toBe('cl_target');
    expect(found?.lead.email).toBeNull();
    expect(found?.lead.phone).toBe('+212611223344');
    expect(found?.lead.name).toBe('Inès');
    expect(found?.lead.status).toBe('contacted');
    expect(found?.lead.source).toBe('chat:inline-contact');
    expect(found?.order).toBeNull();
    expect(found?.items).toEqual([]);
  });

  it('retourne null pour un id cl_* inconnu', async () => {
    state.chatLeads = [];
    const found = await getLeadById('cl_unknown');
    expect(found).toBeNull();
  });
});
