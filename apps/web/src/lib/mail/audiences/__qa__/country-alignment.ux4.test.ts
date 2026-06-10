// @vitest-environment node
/**
 * UX4-AUDIENCES-009 (garde-fou compilateur) — alignement de la liste pays UI
 * (COUNTRIES) sur la table d'indicatifs du compilateur (COUNTRY_CALLING_CODE).
 *
 * Un code proposé dans le multi-select mais absent de COUNTRY_CALLING_CODE
 * compile en `FALSE` (rules-compiler.ts) → audience VIDE silencieuse. On compile
 * chaque code de la liste UI et on prouve que le prédicat n'est pas la
 * constante `FALSE` (donc qu'il dérive bien un préfixe d'appel).
 *
 * Test pur (compilation SQL, aucune DB).
 */
import { describe, it, expect } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { compileRule, COUNTRY_CALLING_CODE } from '../rules-compiler';
import { COUNTRIES } from '@/components/admin/emails/audiences/countries';

/**
 * Vrai si le fragment SQL est la constante littérale `FALSE` (code pays inconnu).
 * Le `sql\`FALSE\`` a `queryChunks = [StringChunk{ value: ['FALSE'] }]`. Un
 * préfixe valide contient une référence colonne (PgColumn) + ' LIKE '.
 */
function isBareFalse(s: SQL): boolean {
  const chunks = (s as unknown as { queryChunks?: Array<{ value?: unknown }> }).queryChunks ?? [];
  if (chunks.length !== 1) return false;
  const v = chunks[0]?.value;
  return Array.isArray(v) && v.length === 1 && v[0] === 'FALSE';
}

describe('country UI ↔ compilateur — UX4-AUDIENCES-009', () => {
  it('F08-U-012 (ex UX4-AUDIENCES-009) — alignement COUNTRIES ↔ COUNTRY_CALLING_CODE (bidirectionnel)', () => {
    for (const c of COUNTRIES) {
      const compiled = compileRule({ kind: 'country', operator: 'eq', value: c.code });
      expect(isBareFalse(compiled), `pays ${c.code} compile en FALSE`).toBe(false);
    }
    // Inversement : chaque code du compilateur est proposé dans l'UI (aucun
    // pays ciblable « caché » que le multi-select ne saurait restituer).
    const uiCodes = new Set(COUNTRIES.map((c) => c.code));
    for (const code of Object.keys(COUNTRY_CALLING_CODE)) {
      expect(uiCodes.has(code), `code compilateur ${code} absent de l'UI`).toBe(true);
    }
  });

  it('un code hors liste (ZZ) compile bien en FALSE (oracle inverse)', () => {
    const compiled = compileRule({ kind: 'country', operator: 'eq', value: 'ZZ' });
    expect(isBareFalse(compiled)).toBe(true);
  });
});
