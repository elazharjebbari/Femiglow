// @vitest-environment node
/**
 * AUD-CMP-* — Compilateur de règles, EXHAUSTIF sur VRAIE DB (R-011).
 *
 * On NE valide PAS la forme de la string SQL (fragile) : on EXÉCUTE le `where`
 * compilé sur un jeu de leads contrastés et on prouve QUI matche / QUI ne
 * matche pas. C'est la garantie métier centrale : « le ciblage est exact ».
 *
 * Couvre aussi les entrées hostiles (quotes / SQL dans les opérandes →
 * paramétrage, aucune injection) et la profondeur max (erreur propre).
 *
 * R-011 — le rouge→fix→vert de la règle `country` : avant le fix, `country`
 * compilait en `TRUE` (matche TOUTE la base = envoi de masse hors cible).
 * Après le fix (dérivation du pays via le préfixe E.164 de `leads.phone`),
 * l'oracle est le ciblage EXACT.
 *
 * Lancement (DB dédiée femiglow_test_m04audiences) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism src/lib/mail/audiences/rules-compiler.integration.test.ts
 */
import { afterAll, beforeEach, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { leads, orders, userEvent, leadTag } from '@/lib/db/schema';
import {
  emailEvent,
  emailOutbox,
  emailSubscriberLink,
  emailSuppression,
} from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { compileRulesToSql, compileRule } from './rules-compiler';
import type { ExclusionFlags, Rule, RulesGroup } from './rules-types';

// Init PARESSEUSE : emailsTestDb()/emailsTestSql() throw sans URL femiglow_test.
// Un appel module-level casserait le run global (le skip describeEmailsDb
// n'intervient qu'au moment du describe). Proxies → résolution au 1er accès.
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const NO_EXCL: ExclusionFlags = {
  hard_bounce: false,
  unsubscribe: false,
  manual_suppression: false,
  marketing_optout: false,
};

const ANCHOR = Date.now();
const ago = (days: number) => new Date(ANCHOR - days * 86_400_000);

/** Exécute un `where` compilé sur leads, renvoie les emails triés. */
async function matchEmails(
  rules: RulesGroup,
  excl: ExclusionFlags = NO_EXCL,
): Promise<string[]> {
  const { where } = compileRulesToSql(rules, excl);
  const rows = (await db
    .select({ email: leads.email })
    .from(leads)
    .where(where)) as Array<{ email: string }>;
  return rows.map((r) => r.email).sort();
}

const one = (kind: Rule): RulesGroup => ({ kind: 'all', conditions: [kind] });

/**
 * Jeu déterministe contrasté.
 *
 *  L1 casa  : MA (+212), consent, 2 cmd (1200 MAD), tag ambassadrice,
 *             inactif (>60j), opened email récemment.
 *  L2 casa  : MA (+212), consent, 1 cmd (199 MAD), 2 sessions récentes.
 *  L3 rabat : FR (+33),  consent, 3 cmd (900 MAD), produit masque.
 *  L4 casa  : MA (+212), NON consent, 0 cmd, unsubscribe.
 *  L5 bounce: pas de téléphone, consent, 1 cmd, hard_bounce.
 */
async function seedDataset() {
  await db.insert(leads).values([
    { id: 'L1', email: 'l1.casa@exemple.test', name: "O'Brien", phone: '+212600000001', consentMarketing: true, createdAt: ago(100) },
    { id: 'L2', email: 'l2.casa@exemple.test', name: 'Loubna', phone: '+212600000002', consentMarketing: true, createdAt: ago(10) },
    { id: 'L3', email: 'l3.rabat@exemple.test', name: 'Nour', phone: '+33600000003', consentMarketing: true, createdAt: ago(5) },
    { id: 'L4', email: 'l4.casa@exemple.test', name: 'Yasmine', phone: '+212600000004', consentMarketing: false, createdAt: ago(1) },
    { id: 'L5', email: 'l5.bounce@exemple.test', name: 'Salma', phone: null, consentMarketing: true, createdAt: ago(2) },
  ]);

  // Commandes : L1=2 (120000), L2=1 (19900), L3=3 (90000), L4=0, L5=1 (10000)
  await db.insert(orders).values([
    { id: 'o1', leadId: 'L1', totalCents: 60000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'serum', createdAt: ago(90) },
    { id: 'o2', leadId: 'L1', totalCents: 60000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'creme', createdAt: ago(40) },
    { id: 'o3', leadId: 'L2', totalCents: 19900, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'serum', createdAt: ago(8) },
    { id: 'o4', leadId: 'L3', totalCents: 30000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'serum', createdAt: ago(3) },
    { id: 'o5', leadId: 'L3', totalCents: 30000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'creme', createdAt: ago(2) },
    { id: 'o6', leadId: 'L3', totalCents: 30000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'masque', createdAt: ago(1) },
    { id: 'o7', leadId: 'L5', totalCents: 10000, currency: 'MAD', shippingMode: 'standard', paymentMethod: 'cod', formId: 'serum', createdAt: ago(2) },
  ]);

  // Activité : L2 active récemment (2 sessions), L1 inactive (>60j)
  await db.insert(userEvent).values([
    { email: 'l2.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-a', ts: ago(5) },
    { email: 'l2.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-b', ts: ago(4) },
    { email: 'l1.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-c', ts: ago(100) },
  ]);

  // Tag : L1 ambassadrice
  await db.insert(leadTag).values([{ leadId: 'L1', tag: 'ambassadrice', source: 'manual' }]);

  // Suppressions : L5 hard_bounce, L4 unsubscribe
  await db.insert(emailSuppression).values([
    { email: 'l5.bounce@exemple.test', reason: 'hard_bounce', source: 'stalwart' },
    { email: 'l4.casa@exemple.test', reason: 'unsubscribe', source: 'listmonk' },
  ]);

  // Engagement email (corrélé depuis le fix A-AUD-2) :
  //  - L1 a ouvert un transactionnel (chemin outbox.to_email) ;
  //  - L2 a ouvert + cliqué une campagne (chemin subscriber_link) ;
  //  - un évènement ORPHELIN (sans outbox_id ni subscriber_id) ne doit
  //    matcher PERSONNE (c'était le tout-ou-rien de l'écart A-AUD-2).
  await db.insert(emailOutbox).values([
    {
      id: 'ob-l1',
      idempotencyKey: 'idem-ob-l1',
      template: 'order-confirmation',
      templateVersion: 1,
      toEmail: 'l1.casa@exemple.test',
      fromEmail: 'info@femiglow-maroc.com',
      subject: 'Votre commande',
      status: 'sent',
      createdAt: ago(6),
    },
  ]);
  await db.insert(emailSubscriberLink).values([
    { email: 'l2.casa@exemple.test', listmonkSubscriberId: 4242, status: 'enabled' },
  ]);
  await db.insert(emailEvent).values([
    { type: 'opened', source: 'stalwart', outboxId: 'ob-l1', ts: ago(5) },
    { type: 'opened', source: 'listmonk', subscriberId: '4242', ts: ago(4) },
    { type: 'clicked', source: 'listmonk', subscriberId: '4242', linkUrl: 'https://femiglow-maroc.com/produits/serum', ts: ago(4) },
    { type: 'opened', source: 'stalwart', ts: ago(5) }, // orphelin
  ]);
}

beforeEach(async () => {
  await truncateEmailTables();
  // truncateEmailTables ne touche pas leads/orders/user_event → on les vide.
  await pg`TRUNCATE leads, orders, user_event RESTART IDENTITY CASCADE`;
  await seedDataset();
});

afterAll(async () => {
  await closeTestDb();
});

// ── 1. Chaque règle compile sans crash (unit, sur le harnais DB) ─────────
const UNIT_CASES: Array<{ id: string; rule: Rule }> = [
  { id: 'AUD-CMP-001', rule: { kind: 'email_pattern', operator: 'contains', value: 'casa' } },
  { id: 'AUD-CMP-004', rule: { kind: 'email_pattern', operator: 'equals', value: 'l1.casa@exemple.test' } },
  { id: 'AUD-CMP-005', rule: { kind: 'email_pattern', operator: 'in', value: ['a@b.c'] } },
  { id: 'AUD-CMP-007', rule: { kind: 'country', operator: 'eq', value: 'MA' } },
  { id: 'AUD-CMP-009', rule: { kind: 'consent_marketing', value: true } },
  { id: 'AUD-CMP-011', rule: { kind: 'created_at', operator: 'after', value: '2025-01-01' } },
  { id: 'AUD-CMP-016', rule: { kind: 'order_count', operator: 'gte', value: 3 } },
  { id: 'AUD-CMP-019', rule: { kind: 'order_total', operator: 'gte', value: 100000, currency: 'MAD' } },
  { id: 'AUD-CMP-021', rule: { kind: 'has_ordered_product', productId: 'serum' } },
  { id: 'AUD-CMP-022', rule: { kind: 'last_order_at', operator: 'within', value: '30d' } },
  { id: 'AUD-CMP-024', rule: { kind: 'email_opened', minCount: 3, within: '14d' } },
  { id: 'AUD-CMP-026', rule: { kind: 'received_without_open', threshold: 5, within: '14d' } },
  { id: 'AUD-CMP-027', rule: { kind: 'inactive_since', days: 60 } },
  { id: 'AUD-CMP-029', rule: { kind: 'session_count', operator: 'gte', value: 2, within: '7d' } },
  { id: 'AUD-CMP-030', rule: { kind: 'has_tag', tag: 'ambassadrice' } },
  { id: 'AUD-CMP-031', rule: { kind: 'not_has_tag', tag: 'ambassadrice' } },
];

describeEmailsDb('rules-compiler — chaque règle compile (unit)', () => {
  it.each(UNIT_CASES)('$id compile sans crash', ({ rule }) => {
    const out = compileRule(rule);
    expect(out).toBeDefined();
    expect(typeof out).toBe('object');
  });

  it('AUD-CMP-015 : created_at invalide lève', () => {
    expect(() => compileRule({ kind: 'created_at', operator: 'after', value: 'not-a-date' })).toThrow();
  });

  it('AUD-CMP-028 : inactive_since bornes 0 et 3650 compilent', () => {
    expect(() => compileRule({ kind: 'inactive_since', days: 0 })).not.toThrow();
    expect(() => compileRule({ kind: 'inactive_since', days: 3650 })).not.toThrow();
  });

  it('AUD-CMP-036 : profondeur > 4 lève une erreur propre (max depth)', () => {
    const deep5: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'all', conditions: [{ kind: 'all', conditions: [
        { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'has_tag', tag: 'x' }] }] }] }] }],
    };
    expect(() => compileRulesToSql(deep5, NO_EXCL)).toThrow(/max depth/i);
  });

  it('AUD-CMP-035 : groupe all vide → TRUE (tout le monde), any vide → FALSE (personne)', async () => {
    const all = await matchEmails({ kind: 'all', conditions: [] });
    expect(all).toHaveLength(5); // tous les leads
    const any = await matchEmails({ kind: 'any', conditions: [] });
    expect(any).toEqual([]); // personne
  });
});

// ── 2. Exactitude du ciblage par règle (DB seedée) ──────────────────────
describeEmailsDb('rules-compiler — exactitude du ciblage (DB seedée)', () => {
  it('AUD-CMP-001 : email_pattern contains "casa" → L1,L2,L4 (pas L3 rabat ni L5 bounce)', async () => {
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'contains', value: 'casa' }));
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test', 'l4.casa@exemple.test']);
  });

  it('AUD-CMP-002 : email_pattern starts "l1" → exactement L1', async () => {
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'starts', value: 'l1' }));
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-003 : email_pattern ends ".test" → tous', async () => {
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'ends', value: '.test' }));
    expect(got).toHaveLength(5);
  });

  it('AUD-CMP-004 : email_pattern equals → exactement L1', async () => {
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'equals', value: 'l1.casa@exemple.test' }));
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-005 : email_pattern in [L1,L3] → exactement L1,L3', async () => {
    const got = await matchEmails(one({
      kind: 'email_pattern', operator: 'in',
      value: ['l1.casa@exemple.test', 'l3.rabat@exemple.test'],
    }));
    expect(got).toEqual(['l1.casa@exemple.test', 'l3.rabat@exemple.test']);
  });

  it('AUD-CMP-009 : consent_marketing=true → tous sauf L4', async () => {
    const got = await matchEmails(one({ kind: 'consent_marketing', value: true }));
    expect(got).not.toContain('l4.casa@exemple.test');
    expect(got).toHaveLength(4);
  });

  it('AUD-CMP-010 : consent_marketing=false → exactement L4', async () => {
    const got = await matchEmails(one({ kind: 'consent_marketing', value: false }));
    expect(got).toEqual(['l4.casa@exemple.test']);
  });

  it('AUD-CMP-011 : created_at after (récent) → exclut L1 (créé il y a 100j)', async () => {
    const after = new Date(ANCHOR - 50 * 86_400_000).toISOString();
    const got = await matchEmails(one({ kind: 'created_at', operator: 'after', value: after }));
    expect(got).not.toContain('l1.casa@exemple.test');
    expect(got).toContain('l3.rabat@exemple.test');
  });

  it('AUD-CMP-012 : created_at before (ancien) → seulement L1', async () => {
    const before = new Date(ANCHOR - 50 * 86_400_000).toISOString();
    const got = await matchEmails(one({ kind: 'created_at', operator: 'before', value: before }));
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-013 : created_at between → bornes correctes', async () => {
    const lo = new Date(ANCHOR - 12 * 86_400_000).toISOString();
    const hi = new Date(ANCHOR - 3 * 86_400_000).toISOString();
    // L2 (10j) et L3 (5j) sont dans [3j..12j] ; L4 (1j) et L5 (2j) trop récents ; L1 (100j) trop vieux.
    const got = await matchEmails(one({ kind: 'created_at', operator: 'between', value: [lo, hi] }));
    expect(got).toEqual(['l2.casa@exemple.test', 'l3.rabat@exemple.test']);
  });

  it('AUD-CMP-014 : created_at within 7d → leads créés dans les 7 derniers jours', async () => {
    // L3 (5j), L4 (1j), L5 (2j) ; pas L1 (100j) ni L2 (10j)
    const got = await matchEmails(one({ kind: 'created_at', operator: 'within', value: '7d' }));
    expect(got).toEqual(['l3.rabat@exemple.test', 'l4.casa@exemple.test', 'l5.bounce@exemple.test']);
  });

  it('AUD-CMP-016 : order_count gte 3 → exactement L3', async () => {
    const got = await matchEmails(one({ kind: 'order_count', operator: 'gte', value: 3 }));
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-017 : order_count between [1,2] → L1(2),L2(1),L5(1) ; pas L3(3) ni L4(0)', async () => {
    const got = await matchEmails(one({ kind: 'order_count', operator: 'between', value: [1, 2] }));
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test', 'l5.bounce@exemple.test']);
  });

  it('AUD-CMP-018 : order_count gte 1 since 30j → fenêtre restreinte exclut les vieilles commandes de L1', async () => {
    const since = new Date(ANCHOR - 30 * 86_400_000).toISOString();
    // L1 : ses 2 cmd sont à 90j et 40j → 0 commande dans la fenêtre 30j → exclu.
    const got = await matchEmails(one({ kind: 'order_count', operator: 'gte', value: 1, since }));
    expect(got).not.toContain('l1.casa@exemple.test');
    expect(got).toContain('l3.rabat@exemple.test'); // cmd à 1/2/3j
  });

  it('AUD-CMP-019 : order_total gte 100000 (1000 MAD) → exactement L1 (120000)', async () => {
    const got = await matchEmails(one({ kind: 'order_total', operator: 'gte', value: 100000, currency: 'MAD' }));
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-020 : order_total gt 0 → exclut L4 (aucune commande, SUM=0)', async () => {
    const got = await matchEmails(one({ kind: 'order_total', operator: 'gt', value: 0 }));
    expect(got).not.toContain('l4.casa@exemple.test');
    expect(got).toHaveLength(4);
  });

  it('AUD-CMP-021 : has_ordered_product "masque" → exactement L3', async () => {
    const got = await matchEmails(one({ kind: 'has_ordered_product', productId: 'masque' }));
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-022 : last_order_at within 30d → exclut L1 (dernière cmd à 40j)', async () => {
    const got = await matchEmails(one({ kind: 'last_order_at', operator: 'within', value: '30d' }));
    expect(got).not.toContain('l1.casa@exemple.test');
    expect(got).toContain('l3.rabat@exemple.test');
  });

  it('AUD-CMP-027 : inactive_since 60j → L1 inactif inclus, L2 actif exclu', async () => {
    const got = await matchEmails(one({ kind: 'inactive_since', days: 60 }));
    expect(got).toContain('l1.casa@exemple.test');
    expect(got).not.toContain('l2.casa@exemple.test');
  });

  it('AUD-CMP-029 : session_count gte 2 within 7d → L2 (2 sessions) inclus, L1 exclu', async () => {
    const got = await matchEmails(one({ kind: 'session_count', operator: 'gte', value: 2, within: '7d' }));
    expect(got).toContain('l2.casa@exemple.test');
    expect(got).not.toContain('l1.casa@exemple.test');
  });

  // AUD-01 / F08 étape 1 — les tags sont NEUTRALISÉS (FALSE) tant que M5.5
  // n'est pas livré : les oracles d'origine (ciblage via lead_tag) sont
  // remplacés par « personne », et surtout JAMAIS « tout le monde ».
  it('AUD-CMP-030 (amendé F08) : has_tag ambassadrice → PERSONNE (neutralisé)', async () => {
    const got = await matchEmails(one({ kind: 'has_tag', tag: 'ambassadrice' }));
    expect(got).toEqual([]);
  });

  it('AUD-CMP-031 (amendé F08) : not_has_tag ambassadrice → PERSONNE (jamais toute la base)', async () => {
    const got = await matchEmails(one({ kind: 'not_has_tag', tag: 'ambassadrice' }));
    expect(got).toEqual([]); // l'ancien NOT EXISTS aurait renvoyé les 5 leads
  });
});

// ── 3. Règle country — R-011 (le fix prouvé sur DB) ─────────────────────
describeEmailsDb('rules-compiler — country (R-011 : ciblage réel, pas TRUE)', () => {
  it('AUD-CMP-007/008 : country eq MA → SEULEMENT les leads MA (+212), pas toute la base', async () => {
    const total = await matchEmails({ kind: 'all', conditions: [] });
    const got = await matchEmails(one({ kind: 'country', operator: 'eq', value: 'MA' }));
    // Le filtre RÉDUIT l'ensemble : L1,L2,L4 ont +212 ; L3 est FR ; L5 sans tel.
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test', 'l4.casa@exemple.test']);
    expect(got.length).toBeLessThan(total.length); // ANTI-RÉGRESSION du bug A-AUD-1
  });

  it('country eq FR → exactement L3 (+33)', async () => {
    const got = await matchEmails(one({ kind: 'country', operator: 'eq', value: 'FR' }));
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('country in [MA,FR] → union MA ∪ FR (pas L5 sans téléphone)', async () => {
    const got = await matchEmails(one({ kind: 'country', operator: 'in', value: ['MA', 'FR'] }));
    expect(got).toEqual([
      'l1.casa@exemple.test', 'l2.casa@exemple.test', 'l3.rabat@exemple.test', 'l4.casa@exemple.test',
    ]);
    expect(got).not.toContain('l5.bounce@exemple.test');
  });

  it('country eq sur un pays sans lead (DZ) → personne (FALSE), pas toute la base', async () => {
    const got = await matchEmails(one({ kind: 'country', operator: 'eq', value: 'DZ' }));
    expect(got).toEqual([]);
  });

  it('country avec code inconnu ("XX") → personne (FALSE), jamais toute la base', async () => {
    const got = await matchEmails(one({ kind: 'country', operator: 'eq', value: 'XX' }));
    expect(got).toEqual([]);
  });
});

// ── 4. Combinaisons AND/OR imbriquées + négations ───────────────────────
describeEmailsDb('rules-compiler — combinaisons & négations', () => {
  it('AUD-CMP-032 : all[consent, order_count>=3] → intersection = L3', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'consent_marketing', value: true },
      { kind: 'order_count', operator: 'gte', value: 3 }] });
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-033 (amendé F08) : any[has_tag, order_count>=3] → seule la branche non-tag matche (L3)', async () => {
    const got = await matchEmails({ kind: 'any', conditions: [
      { kind: 'has_tag', tag: 'ambassadrice' },
      { kind: 'order_count', operator: 'gte', value: 3 }] });
    expect(got).toEqual(['l3.rabat@exemple.test']); // has_tag neutralisé → FALSE dans le OR
  });

  it('AUD-CMP-034 (amendé F08) : all[order_count>=2, any[order_total>=1000MAD, has_tag]] → L1 (via la branche montant)', async () => {
    // L1 : 2 cmd, 120000 → matche via order_total (la branche tag, neutralisée,
    // n'apporte plus rien) ; L3 : 3 cmd mais 90000 → exclu.
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'order_count', operator: 'gte', value: 2 },
      { kind: 'any', conditions: [
        { kind: 'order_total', operator: 'gte', value: 100000 },
        { kind: 'has_tag', tag: 'ambassadrice' }] }] });
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('negation (amendé F08) : all[consent, not_has_tag] → PERSONNE (not_has_tag = FALSE, pas TRUE)', async () => {
    // Avant neutralisation : NOT EXISTS sur table quasi vide → quasi toute la
    // base (défaut critique AUD-01). Désormais : FALSE → l'intersection est vide.
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'consent_marketing', value: true },
      { kind: 'not_has_tag', tag: 'ambassadrice' }] });
    expect(got).toEqual([]);
  });

  it('country combiné : all[country MA, consent] → MA consentants (L1,L2 ; pas L4 non-consent, pas L3 FR)', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'country', operator: 'eq', value: 'MA' },
      { kind: 'consent_marketing', value: true }] });
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test']);
  });
});

// ── 5. Exclusions flag par flag ─────────────────────────────────────────
describeEmailsDb('rules-compiler — exclusions', () => {
  const ALL: RulesGroup = { kind: 'all', conditions: [] };

  it('AUD-CMP-037 : hard_bounce=true retire L5 (et seulement L5)', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, hard_bounce: true });
    expect(got).not.toContain('l5.bounce@exemple.test');
    expect(got).toContain('l4.casa@exemple.test'); // unsubscribe non filtré ici
    expect(got).toHaveLength(4);
  });

  it('AUD-CMP-038 : unsubscribe=true retire L4', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, unsubscribe: true });
    expect(got).not.toContain('l4.casa@exemple.test');
    expect(got).toContain('l5.bounce@exemple.test');
  });

  it('AUD-CMP-039 : manual_suppression retire reason=manual_admin', async () => {
    await pg`INSERT INTO email_suppression (email, reason, source) VALUES ('l2.casa@exemple.test', 'manual_admin', 'manual')`;
    const got = await matchEmails(ALL, { ...NO_EXCL, manual_suppression: true });
    expect(got).not.toContain('l2.casa@exemple.test');
    // n'enlève PAS hard_bounce/unsubscribe (autres raisons)
    expect(got).toContain('l5.bounce@exemple.test');
  });

  it('AUD-CMP-040 : marketing_optout=true retire les non-consentants (L4)', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, marketing_optout: true });
    expect(got).not.toContain('l4.casa@exemple.test');
  });

  it('AUD-CMP-041 : hard_bounce + unsubscribe retire l’union L4,L5', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, hard_bounce: true, unsubscribe: true });
    expect(got).not.toContain('l4.casa@exemple.test');
    expect(got).not.toContain('l5.bounce@exemple.test');
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test', 'l3.rabat@exemple.test']);
  });

  it('AUD-CMP-042 : tous flags false → aucune exclusion (base inchangée)', async () => {
    const got = await matchEmails(ALL, NO_EXCL);
    expect(got).toHaveLength(5);
  });
});

// ── 6. Entrées hostiles : aucune injection (paramétrage prouvé en DB) ────
describeEmailsDb('rules-compiler — entrées hostiles (anti-injection)', () => {
  it('AUD-CMP-043 : email_pattern equals avec quote SQL ne s’injecte pas et ne matche personne', async () => {
    // Si la valeur était concaténée, le `'; DROP` casserait la requête ou
    // matcherait tout. Bindée → matche littéralement cette string inexistante.
    const evil = "x'; DROP TABLE leads; --@exemple.test";
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'equals', value: evil }));
    expect(got).toEqual([]);
    // La table existe toujours : un SELECT répond → preuve qu'aucun DROP n'a eu lieu.
    const survivors = await matchEmails({ kind: 'all', conditions: [] });
    expect(survivors).toHaveLength(5);
  });

  it("email_pattern contains avec apostrophe (O'Brien-like) est bindé, pas concaténé", async () => {
    // Insère un email avec apostrophe et prouve que le contains l'attrape exactement.
    await pg`INSERT INTO leads (id, email, phone, consent_marketing, created_at)
             VALUES ('L6', 'quote''d@exemple.test', '+212600000006', true, now())`;
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'contains', value: "quote'd" }));
    expect(got).toEqual(["quote'd@exemple.test"]);
  });

  it('email_pattern contains avec wildcard % est échappé (pas de match large)', async () => {
    // Le motif "%" ne doit PAS matcher tout le monde : il est escaped en \%.
    const got = await matchEmails(one({ kind: 'email_pattern', operator: 'contains', value: '%' }));
    expect(got).toEqual([]); // aucun email ne contient littéralement un '%'
  });

  it('country eq avec opérande hostile ("MA\'; DROP") → personne, table intacte', async () => {
    const got = await matchEmails(one({ kind: 'country', operator: 'eq', value: "MA'; DROP TABLE leads; --" }));
    expect(got).toEqual([]); // code inconnu après normalisation → FALSE
    const survivors = await matchEmails({ kind: 'all', conditions: [] });
    expect(survivors).toHaveLength(5); // pas de DROP
  });

  it('has_tag avec opérande hostile est bindé → personne, pas d’injection', async () => {
    const got = await matchEmails(one({ kind: 'has_tag', tag: "ambassadrice' OR '1'='1" }));
    expect(got).toEqual([]); // bindé : aucun tag littéral ne vaut cette string
  });

  it('profondeur > 4 → erreur propre AVANT toute requête (anti-DoS)', () => {
    const deep5: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'all', conditions: [{ kind: 'all', conditions: [
        { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'has_tag', tag: 'x' }] }] }] }] }],
    };
    expect(() => compileRulesToSql(deep5, NO_EXCL)).toThrow(/max depth/i);
  });
});

// ── 7. Engagement email corrélé au lead (A-AUD-2 CORRIGÉ) ───────────────
//
// Historique : avant le fix, l'EXISTS était GLOBAL — l'oracle AUD-CMP-023
// (version bug) prouvait « un seul opened orphelin ⇒ TOUTE la base matche ».
// Depuis le fix, la corrélation passe par outbox.to_email (transactionnel)
// OU subscriber_link.listmonk_subscriber_id (campagne).
describeEmailsDb('rules-compiler — engagement email corrélé (A-AUD-2 corrigé)', () => {
  it('AUD-CMP-023 : email_opened ne matche QUE les leads ayant ouvert (outbox L1 + subscriber L2), jamais l’orphelin', async () => {
    // Seed : opened corrélé L1 (via ob-l1), opened corrélé L2 (via subscriber
    // 4242), opened ORPHELIN (ni outbox_id ni subscriber_id). L3/L4/L5 : rien.
    const got = await matchEmails(one({ kind: 'email_opened' }));
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test']);
  });

  it('AUD-CMP-025 : email_clicked corrélé → seul L2 (clic campagne), pas tout-ou-rien', async () => {
    const got = await matchEmails(one({ kind: 'email_clicked' }));
    expect(got).toEqual(['l2.casa@exemple.test']);
  });

  it('AUD-CMP-023b : email_opened + templateSlug restreint au volet transactionnel (L2 campagne exclu)', async () => {
    const gotMatch = await matchEmails(
      one({ kind: 'email_opened', templateSlug: 'order-confirmation' }),
    );
    expect(gotMatch).toEqual(['l1.casa@exemple.test']);
    // Slug inexistant → personne (pas de repli silencieux sur « tout template »).
    const gotNone = await matchEmails(
      one({ kind: 'email_opened', templateSlug: 'newsletter-hebdo' }),
    );
    expect(gotNone).toEqual([]);
  });

  it('AUD-CMP-025b : email_clicked + urlPattern filtre sur link_url (bindé, wildcard échappé)', async () => {
    const gotMatch = await matchEmails(
      one({ kind: 'email_clicked', urlPattern: '/produits/serum' }),
    );
    expect(gotMatch).toEqual(['l2.casa@exemple.test']);
    // Pattern hostile : '%' littéral échappé → ne matche pas tout.
    const gotNone = await matchEmails(one({ kind: 'email_clicked', urlPattern: '%' }));
    expect(gotNone).toEqual([]);
  });

  it('AUD-CMP-026b : received_without_open corrélé — L1 a reçu ET ouvert → exclu ; relance ciblée exacte', async () => {
    // L1 : sent (ob-l1) + opened → ne matche PAS received_without_open(1).
    // On ajoute un envoi à L3 SANS ouverture → L3 matche, et lui seul.
    await db.insert(emailOutbox).values([
      {
        id: 'ob-l3',
        idempotencyKey: 'idem-ob-l3',
        template: 'order-confirmation',
        templateVersion: 1,
        toEmail: 'l3.rabat@exemple.test',
        fromEmail: 'info@femiglow-maroc.com',
        subject: 'Votre commande',
        status: 'sent',
        createdAt: ago(3),
      },
    ]);
    await db.insert(emailEvent).values([
      { type: 'sent', source: 'stalwart', outboxId: 'ob-l1', ts: ago(6) },
      { type: 'sent', source: 'stalwart', outboxId: 'ob-l3', ts: ago(3) },
    ]);
    const got = await matchEmails(
      one({ kind: 'received_without_open', threshold: 1, within: '30d' }),
    );
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-024b : email_opened minCount=2 — L2 (1 seul opened) exclu tant que le compte n’y est pas', async () => {
    const before = await matchEmails(one({ kind: 'email_opened', minCount: 2 }));
    expect(before).toEqual([]);
    await db.insert(emailEvent).values([
      { type: 'opened', source: 'listmonk', subscriberId: '4242', ts: ago(2) },
    ]);
    const after = await matchEmails(one({ kind: 'email_opened', minCount: 2 }));
    expect(after).toEqual(['l2.casa@exemple.test']);
  });
});
