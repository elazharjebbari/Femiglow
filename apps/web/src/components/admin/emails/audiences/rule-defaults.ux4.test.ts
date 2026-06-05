/**
 * UX4-AUDIENCES-010/014 — helpers rule-defaults (vague 4).
 *
 * Oracles :
 *  - madToCents / centsToMad : conversion exacte (500 MAD ↔ 50000 centimes) ;
 *  - ruleToText : rendu FR lisible d'une règle (pays traduit, MAD formaté,
 *    cents non exposés à l'opérateur) ;
 *  - rulesGroupToLines : aplatit un groupe en lignes lisibles avec indentation.
 */
import { describe, it, expect } from 'vitest';
import {
  madToCents,
  centsToMad,
  ruleToText,
  rulesGroupToLines,
} from './rule-defaults';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

describe('madToCents / centsToMad — UX4-AUDIENCES-010', () => {
  it('500 MAD = 50000 centimes', () => {
    expect(madToCents(500)).toBe(50000);
    expect(centsToMad(50000)).toBe(500);
  });
  it('arrondit au centime (round-trip)', () => {
    expect(madToCents(199.99)).toBe(19999);
    expect(centsToMad(19999)).toBe(199.99);
  });
  it('tolère les valeurs non finies', () => {
    expect(madToCents(NaN)).toBe(0);
    expect(centsToMad(Infinity)).toBe(0);
  });
});

describe('ruleToText — UX4-AUDIENCES-014', () => {
  it('pays : traduit le code en nom FR', () => {
    expect(ruleToText({ kind: 'country', operator: 'eq', value: 'MA' })).toMatch(/Maroc/);
    expect(ruleToText({ kind: 'country', operator: 'in', value: ['MA', 'FR'] })).toMatch(
      /Maroc.*France/,
    );
  });
  it('order_total : affiche en MAD, jamais en centimes bruts', () => {
    const txt = ruleToText({ kind: 'order_total', operator: 'gte', value: 50000 });
    expect(txt).toMatch(/500\s+MAD/);
    expect(txt).not.toMatch(/50000/);
  });
  it('order_count : opérateur + bornes since/until', () => {
    const txt = ruleToText({
      kind: 'order_count',
      operator: 'between',
      value: [2, 5],
      since: '2026-01-01',
      until: '2026-03-31',
    });
    expect(txt).toMatch(/entre 2 et 5/);
    expect(txt).toMatch(/2026-01-01/);
    expect(txt).toMatch(/2026-03-31/);
  });
  it('email_clicked : mentionne urlPattern', () => {
    const txt = ruleToText({ kind: 'email_clicked', urlPattern: '/promo', within: '30d' });
    expect(txt).toMatch(/promo/);
  });
});

describe('rulesGroupToLines — UX4-AUDIENCES-014', () => {
  it('aplatit un groupe ET avec deux critères', () => {
    const group: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'country', operator: 'eq', value: 'MA' },
        { kind: 'order_count', operator: 'gte', value: 1 },
      ],
    };
    const lines = rulesGroupToLines(group);
    expect(lines[0]!.combinator).toBe('all');
    expect(lines[0]!.text).toMatch(/TOUS/);
    expect(lines.some((l) => l.text.includes('Maroc'))).toBe(true);
    expect(lines.some((l) => /Nombre de commandes/.test(l.text))).toBe(true);
  });
  it('gère la récursion (sous-groupe OU) avec indentation', () => {
    const group: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'has_tag', tag: 'vip' },
        {
          kind: 'any',
          conditions: [
            { kind: 'has_tag', tag: 'a' },
            { kind: 'has_tag', tag: 'b' },
          ],
        },
      ],
    };
    const lines = rulesGroupToLines(group);
    const sub = lines.find((l) => l.combinator === 'any');
    expect(sub).toBeDefined();
    expect(sub!.depth).toBe(1);
  });
});
