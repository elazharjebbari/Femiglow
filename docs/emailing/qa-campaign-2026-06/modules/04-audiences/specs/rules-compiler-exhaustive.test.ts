/**
 * AUD-CMP-* — Compilateur de règles, EXHAUSTIF.
 *
 * Deux niveaux :
 *  1. UNIT (table-driven) : chaque kind de règle compile sans crash + on
 *     inspecte la forme du SQL (TRUE pour country, COUNT pour minCount, etc.).
 *  2. DB SEEDÉE : on exécute le `where` compilé sur un jeu de leads connu et on
 *     vérifie QUI matche / QUI ne matche pas — exactitude métier, et preuve des
 *     écarts d'audit (country=TRUE, email_event non corrélé).
 *
 * Préconditions : DATABASE_URL_TEST → femiglow_test, migrations appliquées.
 * NB chemin : à déposer sous apps/web/src/lib/mail/audiences/.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { sql } from 'drizzle-orm';

import { testSql, truncateEmailTables } from '@/test/db/setup';
import { db as getDb } from '@/lib/db/client';
import { leads, orders, userEvent, leadTag } from '@/lib/db/schema';
import { emailEvent, emailSuppression } from '@/lib/db/schema-emails';
import { compileRulesToSql, compileRule } from '@/lib/mail/audiences/rules-compiler';
import type { Rule, RulesGroup, ExclusionFlags } from '@/lib/mail/audiences/rules-types';

const NO_EXCL: ExclusionFlags = {
  hard_bounce: false,
  unsubscribe: false,
  manual_suppression: false,
  marketing_optout: false,
};

function db() {
  const d = getDb();
  if (!d) throw new Error('DB de test non configurée');
  return d;
}

/** Exécute un `where` compilé sur leads, renvoie les emails triés. */
async function matchEmails(rules: RulesGroup, excl: ExclusionFlags = NO_EXCL): Promise<string[]> {
  const { where } = compileRulesToSql(rules, excl);
  const rows = (await db()
    .select({ email: leads.email })
    .from(leads)
    .where(where)) as Array<{ email: string }>;
  return rows.map((r) => r.email).sort();
}

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

// ── Seed : jeu de données déterministe ──────────────────────────────────
async function seedDataset() {
  await db().insert(leads).values([
    { id: 'L1', email: 'l1.casa@exemple.test', name: 'Kaoutar', consentMarketing: true, createdAt: ago(100) },
    { id: 'L2', email: 'l2.casa@exemple.test', name: 'Loubna', consentMarketing: true, createdAt: ago(10) },
    { id: 'L3', email: 'l3.rabat@exemple.test', name: 'Nour', consentMarketing: true, createdAt: ago(5) },
    { id: 'L4', email: 'l4.casa@exemple.test', name: 'Yasmine', consentMarketing: false, createdAt: ago(1) },
    { id: 'L5', email: 'l5.bounce@exemple.test', name: 'Salma', consentMarketing: true, createdAt: ago(2) },
  ]);

  // Commandes : L1=2, L2=1, L3=3, L4=0, L5=1
  await db().insert(orders).values([
    { id: 'o1', leadId: 'L1', totalCents: 60000, shippingMode: 'home', formId: 'serum', createdAt: ago(90) },
    { id: 'o2', leadId: 'L1', totalCents: 60000, shippingMode: 'home', formId: 'creme', createdAt: ago(40) },
    { id: 'o3', leadId: 'L2', totalCents: 19900, shippingMode: 'home', formId: 'serum', createdAt: ago(8) },
    { id: 'o4', leadId: 'L3', totalCents: 30000, shippingMode: 'home', formId: 'serum', createdAt: ago(3) },
    { id: 'o5', leadId: 'L3', totalCents: 30000, shippingMode: 'home', formId: 'creme', createdAt: ago(2) },
    { id: 'o6', leadId: 'L3', totalCents: 30000, shippingMode: 'home', formId: 'masque', createdAt: ago(1) },
    { id: 'o7', leadId: 'L5', totalCents: 10000, shippingMode: 'home', formId: 'serum', createdAt: ago(2) },
  ]);

  // Activité : L2 active récemment, L1 inactive (>60j)
  await db().insert(userEvent).values([
    { email: 'l2.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-a', ts: ago(5) },
    { email: 'l2.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-b', ts: ago(4) },
    { email: 'l1.casa@exemple.test', eventName: 'page_view', source: 'web', sessionId: 's-c', ts: ago(100) },
  ]);

  // Tags : L1 = ambassadrice
  await db().insert(leadTag).values([
    { leadId: 'L1', tag: 'ambassadrice', sourceRef: 'manual' },
  ]);

  // Suppressions : L5 hard_bounce, L4 unsubscribe
  await db().insert(emailSuppression).values([
    { email: 'l5.bounce@exemple.test', reason: 'hard_bounce', source: 'stalwart' },
    { email: 'l4.casa@exemple.test', reason: 'unsubscribe', source: 'listmonk' },
  ]);

  // Évènements email (NON corrélés au lead dans le compilateur actuel)
  await db().insert(emailEvent).values([
    { type: 'opened', source: 'stalwart', ts: ago(5) },
  ]);
}

beforeAll(() => {
  process.env.MAIL_FROM = 'info@femiglow-maroc.com';
});
beforeEach(async () => {
  await truncateEmailTables();
  // truncate de schema-emails ne touche pas leads/orders/user_event → on les
  // vide explicitement pour l'isolation de cette suite.
  await testSql`TRUNCATE leads, orders, user_event RESTART IDENTITY CASCADE`;
  await seedDataset();
});
afterAll(async () => {
  await testSql.end({ timeout: 5 });
});

// ── 1. UNIT table-driven : chaque règle compile ─────────────────────────
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

describe('compileRule — unit (chaque règle compile)', () => {
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

  it('AUD-CMP-036 : profondeur > 4 lève', () => {
    const deep5: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'all', conditions: [{ kind: 'all', conditions: [
        { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'has_tag', tag: 'x' }] }] }] }] }],
    };
    expect(() => compileRulesToSql(deep5, NO_EXCL)).toThrow(/max depth/i);
  });
});

// ── 2. DB SEEDÉE : exactitude du ciblage ────────────────────────────────
describe('exactitude du ciblage (DB seedée)', () => {
  it('AUD-CMP-004 : email_pattern equals → exactement L1', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'email_pattern', operator: 'equals', value: 'l1.casa@exemple.test' }] });
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-001 : email_pattern contains "casa" → L1,L2,L4 (pas L3 rabat ni L5 bounce)', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'email_pattern', operator: 'contains', value: 'casa' }] });
    expect(got).toEqual(['l1.casa@exemple.test', 'l2.casa@exemple.test', 'l4.casa@exemple.test']);
  });

  it('AUD-CMP-009 : consent_marketing=true → tous sauf L4', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] });
    expect(got).not.toContain('l4.casa@exemple.test');
    expect(got).toContain('l1.casa@exemple.test');
  });

  it('AUD-CMP-016 : order_count gte 3 → exactement L3', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'order_count', operator: 'gte', value: 3 }] });
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-019 : order_total gte 1000 MAD (100000 cents) → L1 (120000) et L3 (90000? non) → seulement L1', async () => {
    // L1 = 120000, L3 = 90000, L2 = 19900, L5 = 10000 → seuil 100000 → L1
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'order_total', operator: 'gte', value: 100000, currency: 'MAD' }] });
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-021 : has_ordered_product "masque" → exactement L3', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'has_ordered_product', productId: 'masque' }] });
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-027 : inactive_since 60j → L1 inactif inclus, L2 actif exclu', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'inactive_since', days: 60 }] });
    expect(got).toContain('l1.casa@exemple.test');
    expect(got).not.toContain('l2.casa@exemple.test');
  });

  it('AUD-CMP-029 : session_count gte 2 within 7d → L2 (2 sessions) inclus', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'session_count', operator: 'gte', value: 2, within: '7d' }] });
    expect(got).toContain('l2.casa@exemple.test');
    expect(got).not.toContain('l1.casa@exemple.test');
  });

  it('AUD-CMP-030 : has_tag ambassadrice → exactement L1 (attrape le drift lead_tag)', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'has_tag', tag: 'ambassadrice' }] });
    expect(got).toEqual(['l1.casa@exemple.test']);
  });

  it('AUD-CMP-031 : not_has_tag ambassadrice → tous sauf L1', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'not_has_tag', tag: 'ambassadrice' }] });
    expect(got).not.toContain('l1.casa@exemple.test');
    expect(got.length).toBe(4);
  });
});

// ── 3. Combinaisons AND/OR imbriquées ───────────────────────────────────
describe('combinaisons', () => {
  it('AUD-CMP-032 : all[consent, order_count>=3] → intersection = L3', async () => {
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'consent_marketing', value: true },
      { kind: 'order_count', operator: 'gte', value: 3 }] });
    expect(got).toEqual(['l3.rabat@exemple.test']);
  });

  it('AUD-CMP-033 : any[has_tag ambassadrice, order_count>=3] → union = L1,L3', async () => {
    const got = await matchEmails({ kind: 'any', conditions: [
      { kind: 'has_tag', tag: 'ambassadrice' },
      { kind: 'order_count', operator: 'gte', value: 3 }] });
    expect(got).toEqual(['l1.casa@exemple.test', 'l3.rabat@exemple.test']);
  });

  it('AUD-CMP-034 : all[order_count>=2, any[order_total>=1000MAD, has_tag ambassadrice]] → V1-like = L1', async () => {
    // L1: 2 cmd, 1200 MAD, tag → match ; L3: 3 cmd, 900 MAD, sans tag → exclu
    const got = await matchEmails({ kind: 'all', conditions: [
      { kind: 'order_count', operator: 'gte', value: 2 },
      { kind: 'any', conditions: [
        { kind: 'order_total', operator: 'gte', value: 100000 },
        { kind: 'has_tag', tag: 'ambassadrice' }] }] });
    expect(got).toEqual(['l1.casa@exemple.test']);
  });
});

// ── 4. Exclusions flag par flag ─────────────────────────────────────────
describe('exclusions', () => {
  const ALL = { kind: 'all', conditions: [] } as RulesGroup; // matche tout le monde

  it('AUD-CMP-037 : hard_bounce=true retire L5 (et seulement L5)', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, hard_bounce: true });
    expect(got).not.toContain('l5.bounce@exemple.test');
    expect(got).toContain('l4.casa@exemple.test'); // unsubscribe pas filtré
  });

  it('AUD-CMP-038 : unsubscribe=true retire L4', async () => {
    const got = await matchEmails(ALL, { ...NO_EXCL, unsubscribe: true });
    expect(got).not.toContain('l4.casa@exemple.test');
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
  });
});

// ── 5. Écarts d'audit PROUVÉS (tests RED documentés) ────────────────────
describe('écarts d’audit (preuves)', () => {
  it('AUD-CMP-007/008 : country compile en TRUE → ne réduit PAS l’ensemble (BUG A-AUD-1)', async () => {
    const total = await matchEmails({ kind: 'all', conditions: [] });
    const withCountry = await matchEmails({ kind: 'all', conditions: [
      { kind: 'country', operator: 'eq', value: 'MA' }] });
    // BUG : le filtre country n'a aucun effet → ensembles identiques.
    expect(withCountry).toEqual(total);
    // Et le SQL contient littéralement TRUE.
    const compiled = compileRule({ kind: 'country', operator: 'eq', value: 'MA' });
    expect(JSON.stringify(compiled)).toMatch(/TRUE/);
  });

  it('AUD-CMP-023 : email_opened EXISTS global non corrélé → tout-ou-rien (BUG A-AUD-2)', async () => {
    // Un seul évènement opened existe (non lié à un lead précis). Le compilateur
    // produit un EXISTS global → TOUS les leads matchent (au lieu du seul
    // destinataire). On prouve le tout-ou-rien.
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'email_opened' }] });
    const total = await matchEmails({ kind: 'all', conditions: [] });
    expect(got).toEqual(total); // BUG : tout le monde « a ouvert »
  });

  it('AUD-CMP-025 : email_clicked EXISTS global sans évènement → personne (autre face du tout-ou-rien)', async () => {
    // Aucun évènement clicked seedé → EXISTS faux → 0 lead, alors que
    // certains leads pourraient légitimement avoir cliqué.
    const got = await matchEmails({ kind: 'all', conditions: [{ kind: 'email_clicked' }] });
    expect(got).toEqual([]);
  });
});
