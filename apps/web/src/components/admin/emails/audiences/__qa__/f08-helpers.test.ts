/**
 * F08 — unitaires purs (étapes 2 et 3) :
 *  - validateBetween / swapBounds (AUD-02)            → F08-U-005..009
 *  - isKnownCountry (AUD-07)                          → F08-U-010/011
 *  - driftPct / relativeAge (AUD-03)                  → F08-U-021/022/023
 *  - snapshotMembersToCsv (AUD-06, échappement)       → F08-U-024
 *  - defaultRule couvre les 15 kinds (AUD-08)         → F08-U-025
 */
import { describe, expect, it } from 'vitest';
import {
  BETWEEN_ERROR,
  swapBounds,
  validateBetween,
  toPatternChips,
} from '../rule-validation';
import { isKnownCountry } from '../countries';
import { driftPct, driftLabel, relativeAge } from '../drift';
import { defaultRule, RULE_CATEGORIES } from '../rule-defaults';
import { RuleSchema, type RuleKind } from '@/lib/mail/audiences/rules-types';
import { snapshotMembersToCsv } from '@/lib/mail/audiences/snapshot-members';

describe('validateBetween / swapBounds — AUD-02', () => {
  it('F08-U-005 — between numérique lo<=hi valide', () => {
    expect(validateBetween([100, 500]).ok).toBe(true);
    expect(validateBetween([100, 100]).ok).toBe(true); // égalité = valide
  });

  it('F08-U-006 — between numérique lo>hi invalide (erreur borne)', () => {
    const res = validateBetween([500, 100]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(BETWEEN_ERROR);
  });

  it('F08-U-007 — between date début<=fin valide', () => {
    expect(validateBetween(['2025-01-01', '2025-03-01']).ok).toBe(true);
  });

  it('F08-U-008 — between date début>fin invalide', () => {
    const res = validateBetween(['2025-03-01', '2025-01-01']);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(BETWEEN_ERROR);
  });

  it('F08-U-009 — swapBounds permute les bornes ([500,100] → [100,500])', () => {
    expect(swapBounds([500, 100])).toEqual([100, 500]);
    expect(swapBounds(['2025-03-01', '2025-01-01'])).toEqual(['2025-01-01', '2025-03-01']);
    // la valeur permutée redevient valide (boucle de correction fermée)
    expect(validateBetween(swapBounds([500, 100]) as [number, number]).ok).toBe(true);
  });

  it('une borne vide n’est PAS une inversion (cas « borne manquante » séparé)', () => {
    expect(validateBetween(['', '2025-01-01']).ok).toBe(true);
  });
});

describe('isKnownCountry — AUD-07', () => {
  it('F08-U-010 — code pays valide accepté (MA, insensible à la casse)', () => {
    expect(isKnownCountry('MA')).toBe(true);
    expect(isKnownCountry(' ma ')).toBe(true);
  });

  it('F08-U-011 — code pays inconnu rejeté (XX)', () => {
    expect(isKnownCountry('XX')).toBe(false);
    expect(isKnownCountry('')).toBe(false);
  });
});

describe('toPatternChips — AUD-09 (migration tolérante CSV → chips)', () => {
  it('trim + anti-doublon + vide ignoré ; legacy CSV string splitté', () => {
    expect(toPatternChips([' foo ', 'foo', '', 'bar'])).toEqual(['foo', 'bar']);
    expect(toPatternChips('a@x.com, b@y.com , ,a@x.com')).toEqual(['a@x.com', 'b@y.com']);
  });
});

describe('drift — AUD-03', () => {
  it('F08-U-021 — driftPct(size=1100, live=1234) === 12 (arrondi)', () => {
    expect(driftPct(1100, 1234)).toBe(12);
    expect(driftLabel(1100, 1234)).toBe('▲ +134 (+12 %)');
  });

  it('F08-U-022 — size=0 ne divise pas par zéro (max(1, size))', () => {
    expect(driftPct(0, 5)).toBe(500);
    expect(Number.isFinite(driftPct(0, 5))).toBe(true);
    expect(driftPct(0, 0)).toBe(0);
  });

  it('F08-U-023 — relativeAge(J-3) === « il y a 3 j »', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    expect(relativeAge('2026-06-07T12:00:00Z', now)).toBe('il y a 3 j');
    expect(relativeAge('2026-06-10T07:00:00Z', now)).toBe('il y a 5 h');
    expect(relativeAge('2026-06-10T11:59:30Z', now)).toBe('à l’instant');
  });
});

describe('snapshotMembersToCsv — AUD-06', () => {
  it('F08-U-024 — un name avec virgule est encadré et les guillemets doublés', () => {
    const csv = snapshotMembersToCsv([
      { email: 'a@x.com', payload: { name: 'Doe, Jane' } },
      { email: 'b@y.com', payload: { name: 'Said "Sisi"' } },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('email,name');
    expect(lines[1]).toBe('a@x.com,"Doe, Jane"');
    expect(lines[2]).toBe('b@y.com,"Said ""Sisi"""');
  });
});

describe('defaultRule — AUD-08', () => {
  // AMENDEMENT d'oracle (consigné en batterie) : `has_ordered_product` garde
  // VOLONTAIREMENT un productId vide (placeholder — l'opératrice choisit via
  // l'autocomplete ; un slug pré-rempli créerait un ciblage plausible mais
  // faux). Il ne parse donc pas (Zod min 1) : l'étape 2 le BLOQUE avant tout
  // POST (PRODUCT_EMPTY_ERROR), ce que ce test verrouille. Les 14 autres
  // kinds parsent tels quels.
  it('F08-U-025 — defaultRule couvre les 15 kinds (14 parsent ; produit vide bloqué étape 2)', async () => {
    const kinds = RULE_CATEGORIES.flatMap((c) => c.items.map((i) => i.kind));
    expect(kinds).toHaveLength(15);
    for (const kind of kinds) {
      const rule = defaultRule(kind as RuleKind);
      const parsed = RuleSchema.safeParse(rule);
      if (kind === 'has_ordered_product') {
        expect(parsed.success).toBe(false);
        const { validateRulesForSave, PRODUCT_EMPTY_ERROR } = await import('../rule-validation');
        expect(validateRulesForSave({ kind: 'all', conditions: [rule] })).toContain(
          PRODUCT_EMPTY_ERROR,
        );
      } else {
        expect(parsed.success, `defaultRule(${kind}) doit parser`).toBe(true);
      }
    }
  });
});
