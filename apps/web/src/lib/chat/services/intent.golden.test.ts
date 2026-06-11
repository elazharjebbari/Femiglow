/**
 * CHA-230 Phase 3.5 — Test de régression "golden-set".
 *
 * Charge `tests/golden/intent-fixtures.json` (curé manuellement par
 * l'admin via /admin/chat/intent-curator, exporté par
 * `pnpm chat:export-golden`) et fait tourner le classifier regex
 * offline contre chaque exemple. Vérifie :
 *   1. Taux de bonne classification global ≥ TARGET_PRECISION
 *   2. Aucun intent n'est totalement raté (recall > 0 par intent
 *      présent dans le fixture)
 *
 * Pourquoi un test offline plutôt qu'un appel LLM live :
 *   - déterministe → évite les flakes CI
 *   - rapide (< 1 s) → tourne à chaque commit
 *   - capture les régressions regex dès qu'on touche les RULES,
 *     ce qui est exactement le cas critique en prod
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.5
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectIntent } from './intent';

interface GoldenRow {
  text: string;
  language: 'fr' | 'ar' | 'ar-MA';
  expectedIntent: string;
  notes?: string;
}

interface GoldenFixture {
  version: number;
  exportedAt: string;
  countByLanguage: Record<string, number>;
  countByIntent: Record<string, number>;
  rows: GoldenRow[];
}

// Seuil de précision globale du classifier regex sur le golden-set.
// Le pipeline complet (regex → LLM → fallback regex) a une précision
// supérieure ; ce seuil mesure UNIQUEMENT le regex offline pour
// détecter les régressions sur les patterns committés.
//
// Si on ajoute un nouvel intent ambigu, on peut abaisser temporairement
// ce seuil ; doit revenir ≥ 95 % une fois les patterns stabilisés.
const TARGET_PRECISION = 0.95;

function loadFixture(): GoldenFixture {
  const path = resolve(process.cwd(), 'tests/golden/intent-fixtures.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as GoldenFixture;
}

describe('intent classifier — golden-set regression', () => {
  const fixture = loadFixture();

  it('charge un fixture non-vide', () => {
    expect(fixture.version).toBe(1);
    expect(fixture.rows.length).toBeGreaterThan(20);
  });

  it(`atteint ≥ ${(TARGET_PRECISION * 100).toFixed(0)} % de précision globale`, () => {
    let correct = 0;
    const failures: Array<{
      text: string;
      expected: string;
      got: string;
      language: string;
    }> = [];

    for (const row of fixture.rows) {
      const got = detectIntent(row.text);
      if (got === row.expectedIntent) {
        correct += 1;
      } else {
        failures.push({
          text: row.text,
          expected: row.expectedIntent,
          got,
          language: row.language,
        });
      }
    }

    const precision = correct / fixture.rows.length;

    if (precision < TARGET_PRECISION) {
      // Affiche les 10 premières erreurs pour faciliter le debug.
      console.error(
        `[golden-test] FAILED — precision=${(precision * 100).toFixed(1)}% (${correct}/${fixture.rows.length})`,
      );
      console.error('First failures:');
      for (const f of failures.slice(0, 10)) {
        console.error(
          `  [${f.language}] "${f.text}" → expected=${f.expected}, got=${f.got}`,
        );
      }
    }

    expect(precision).toBeGreaterThanOrEqual(TARGET_PRECISION);
  });

  it('chaque intent présent dans le fixture est détecté au moins 1 fois', () => {
    const intentsInFixture = new Set(fixture.rows.map((r) => r.expectedIntent));
    // On accepte qu'un intent ait un recall partiel — mais pas zéro,
    // sinon ça veut dire que la regex ne match jamais cette classe.
    const recallByIntent = new Map<string, { hits: number; total: number }>();
    for (const intent of intentsInFixture) {
      recallByIntent.set(intent, { hits: 0, total: 0 });
    }
    for (const row of fixture.rows) {
      const stats = recallByIntent.get(row.expectedIntent);
      if (!stats) continue;
      stats.total += 1;
      if (detectIntent(row.text) === row.expectedIntent) {
        stats.hits += 1;
      }
    }

    const dead: string[] = [];
    for (const [intent, stats] of recallByIntent.entries()) {
      if (stats.hits === 0 && stats.total > 0) {
        dead.push(`${intent} (0/${stats.total})`);
      }
    }
    expect(dead, `Intents jamais détectés : ${dead.join(', ')}`).toEqual([]);
  });

  it('couvre les nouveaux intents CHA-230 (negotiation + wholesaler)', () => {
    const intents = new Set(fixture.rows.map((r) => r.expectedIntent));
    expect(intents.has('negotiation')).toBe(true);
    expect(intents.has('wholesaler')).toBe(true);
    // Au moins quelques exemples par langue dans chaque nouvel intent.
    const negs = fixture.rows.filter((r) => r.expectedIntent === 'negotiation');
    const whs = fixture.rows.filter((r) => r.expectedIntent === 'wholesaler');
    expect(negs.length).toBeGreaterThanOrEqual(3);
    expect(whs.length).toBeGreaterThanOrEqual(3);
  });
});
