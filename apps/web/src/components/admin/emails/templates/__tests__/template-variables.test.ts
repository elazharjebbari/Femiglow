// @vitest-environment node
/**
 * F07 P3.4-c (Lot 2) — catalogue de variables : honnêteté (clés réelles) +
 * cohérence avec buildEmailContext.
 */
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_GROUPS,
  TEMPLATE_VARIABLE_KEYS,
  variablesOfGroup,
} from '../template-variables';
// NB : la cohérence catalogue ↔ buildEmailContext (résolution réelle) est
// vérifiée en INTÉGRATION (F07-I-112, context-resolver.integration.test.ts),
// car buildEmailContext requiert la DB.

describe('F07 — template-variables (catalogue)', () => {
  it('F07-U-104 — tous des jetons Handlebars {{cle}} (sans point, ≠ merge-tags Listmonk)', () => {
    for (const v of TEMPLATE_VARIABLES) {
      expect(v.token).toBe(`{{${v.key}}}`);
      expect(v.token).not.toMatch(/\{\{\s*\./); // pas de syntaxe Listmonk {{ .X }}
      expect(TEMPLATE_VARIABLE_GROUPS).toContain(v.group);
      expect(v.label.length).toBeGreaterThan(0);
    }
  });

  it('F07-U-105 — n’expose PAS les clés trompeuses retirées (lastName, orderTotal, city, address)', () => {
    for (const ghost of ['lastName', 'orderTotal', 'city', 'address']) {
      expect(TEMPLATE_VARIABLE_KEYS).not.toContain(ghost);
    }
  });

  it('F07-U-107 — les groupes partitionnent tout le catalogue', () => {
    const counted = TEMPLATE_VARIABLE_GROUPS.reduce((n, g) => n + variablesOfGroup(g).length, 0);
    expect(counted).toBe(TEMPLATE_VARIABLES.length);
  });
});
