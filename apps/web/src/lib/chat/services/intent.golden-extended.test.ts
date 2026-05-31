/**
 * CHA-231 — Test de régression "golden-set ÉTENDU".
 *
 * Charge `tests/golden/intent-extended.json` (généré par
 * `scripts/generate-intent-golden-extended.ts`, ~850 utterances synthétiques
 * équilibrées par intent + langue, dérivées de patterns observés en prod
 * + datasets publics MASSIVE/Bitext/DODa).
 *
 * Différences vs `intent.golden.test.ts` :
 *   - 800+ cas vs 50 (couverture 16x supérieure)
 *   - Seuils SÉPARÉS par intent commercial fort vs informationnel
 *   - Couvre les variantes typographiques (élisions « l'acheter »,
 *     politesse « svp/stp », adverbes « donc/bien/au fait »…)
 *   - Couvre AR-MA (darija) et AR (MSA) à 77 + 13 cas
 *
 * Seuils CI bloquants :
 *   - intents commerciaux forts (purchase-intent, callback, negotiation,
 *     wholesaler) ≥ 95 % : un raté ici = lead perdu en prod
 *   - intents informationnels (pricing, shipping, ingredient, routine,
 *     order-status, greeting) ≥ 88 % : moins critique mais on surveille
 *   - global ≥ 90 %
 *
 * Pour ajouter des cas : éditer `scripts/generate-intent-golden-extended.ts`
 * puis `pnpm tsx scripts/generate-intent-golden-extended.ts`.
 *
 * Pour enrichir avec datasets externes (HuggingFace) : voir
 * `scripts/sync-intent-datasets.ts`.
 *
 * cf. CHA-231 plan d'action §1.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectIntent, type ChatIntent } from './intent';

interface GoldenRow {
  text: string;
  language: 'fr' | 'ar' | 'ar-MA' | 'en';
  expectedIntent: ChatIntent;
  notes?: string;
}

interface GoldenFixture {
  version: number;
  exportedAt: string;
  countByLanguage: Record<string, number>;
  countByIntent: Record<string, number>;
  rows: GoldenRow[];
}

/** Intents critiques : un raté = lead potentiellement perdu en prod. */
const STRONG_COMMERCIAL_INTENTS = new Set<ChatIntent>([
  'purchase-intent',
  'callback-request',
  'negotiation',
  'wholesaler',
]);

/** Seuil pour les intents commerciaux forts (CI bloquant si en dessous). */
const STRONG_THRESHOLD = 0.95;

/** Seuil pour les intents informationnels (moins critique). */
const INFO_THRESHOLD = 0.88;

/** Seuil global. */
const GLOBAL_THRESHOLD = 0.9;

function loadFixture(): GoldenFixture {
  const path = resolve(process.cwd(), 'tests/golden/intent-extended.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as GoldenFixture;
}

interface IntentReport {
  hits: number;
  total: number;
  ratio: number;
  failures: GoldenRow[];
}

function report(rows: GoldenRow[]): Map<ChatIntent, IntentReport> {
  const out = new Map<ChatIntent, IntentReport>();
  for (const row of rows) {
    const got = detectIntent(row.text);
    const stats = out.get(row.expectedIntent) ?? {
      hits: 0,
      total: 0,
      ratio: 0,
      failures: [] as GoldenRow[],
    };
    stats.total += 1;
    if (got === row.expectedIntent) {
      stats.hits += 1;
    } else {
      stats.failures.push(row);
    }
    stats.ratio = stats.hits / stats.total;
    out.set(row.expectedIntent, stats);
  }
  return out;
}

function logFailures(intent: ChatIntent, stats: IntentReport, max = 8): void {
  console.error(
    `[golden-extended] ${intent}: ${(stats.ratio * 100).toFixed(1)}% (${stats.hits}/${stats.total}) — ${stats.failures.length} failures`,
  );
  for (const f of stats.failures.slice(0, max)) {
    const got = detectIntent(f.text);
    console.error(`  [${f.language}] "${f.text}" → got=${got}, expected=${f.expectedIntent}`);
  }
}

describe('intent classifier — golden-extended (CHA-231)', () => {
  const fixture = loadFixture();

  it('charge un fixture étendu (≥ 800 utterances)', () => {
    expect(fixture.rows.length).toBeGreaterThanOrEqual(800);
    expect(fixture.version).toBe(1);
  });

  it('couvre les 4 langues principales (fr, ar, ar-MA, en)', () => {
    expect(fixture.countByLanguage.fr).toBeGreaterThanOrEqual(700);
    expect(fixture.countByLanguage['ar-MA']).toBeGreaterThanOrEqual(50);
    expect(fixture.countByLanguage.ar).toBeGreaterThanOrEqual(10);
  });

  it('couvre les 10 intents principaux du business', () => {
    const expectedIntents = [
      'purchase-intent',
      'callback-request',
      'negotiation',
      'wholesaler',
      'pricing',
      'shipping',
      'ingredient',
      'routine',
      'order-status',
      'greeting',
    ];
    for (const intent of expectedIntents) {
      expect(fixture.countByIntent[intent], `manque l'intent ${intent}`).toBeGreaterThanOrEqual(15);
    }
  });

  describe('seuils CI bloquants par intent commercial fort', () => {
    const reports = report(fixture.rows);

    for (const intent of STRONG_COMMERCIAL_INTENTS) {
      it(`${intent} ≥ ${(STRONG_THRESHOLD * 100).toFixed(0)}%`, () => {
        const stats = reports.get(intent);
        expect(stats, `intent ${intent} manque dans le fixture`).toBeDefined();
        if (!stats) return;
        if (stats.ratio < STRONG_THRESHOLD) logFailures(intent, stats);
        expect(stats.ratio).toBeGreaterThanOrEqual(STRONG_THRESHOLD);
      });
    }
  });

  describe('seuils par intent informationnel', () => {
    const reports = report(fixture.rows);
    const infoIntents: ChatIntent[] = [
      'pricing',
      'shipping',
      'ingredient',
      'routine',
      'order-status',
      'greeting',
    ];

    for (const intent of infoIntents) {
      it(`${intent} ≥ ${(INFO_THRESHOLD * 100).toFixed(0)}%`, () => {
        const stats = reports.get(intent);
        expect(stats, `intent ${intent} manque dans le fixture`).toBeDefined();
        if (!stats) return;
        if (stats.ratio < INFO_THRESHOLD) logFailures(intent, stats);
        expect(stats.ratio).toBeGreaterThanOrEqual(INFO_THRESHOLD);
      });
    }
  });

  it(`précision globale ≥ ${(GLOBAL_THRESHOLD * 100).toFixed(0)}%`, () => {
    let correct = 0;
    for (const row of fixture.rows) {
      if (detectIntent(row.text) === row.expectedIntent) correct += 1;
    }
    const ratio = correct / fixture.rows.length;
    if (ratio < GLOBAL_THRESHOLD) {
      console.error(
        `[golden-extended] GLOBAL: ${(ratio * 100).toFixed(1)}% (${correct}/${fixture.rows.length})`,
      );
    }
    expect(ratio).toBeGreaterThanOrEqual(GLOBAL_THRESHOLD);
  });

  it('chaque intent commercial fort a ≥ 30 cas dans le fixture', () => {
    for (const intent of STRONG_COMMERCIAL_INTENTS) {
      expect(
        fixture.countByIntent[intent],
        `${intent} sous-représenté (${fixture.countByIntent[intent] ?? 0} cas)`,
      ).toBeGreaterThanOrEqual(30);
    }
  });

  it('AR-MA (darija) couvre purchase-intent à ≥ 90 %', () => {
    const arMaPurchase = fixture.rows.filter(
      (r) => r.language === 'ar-MA' && r.expectedIntent === 'purchase-intent',
    );
    if (arMaPurchase.length === 0) {
      throw new Error('AR-MA purchase-intent: aucun cas');
    }
    const correct = arMaPurchase.filter((r) => detectIntent(r.text) === 'purchase-intent').length;
    const ratio = correct / arMaPurchase.length;
    expect(ratio, `darija purchase-intent ${ratio * 100}%`).toBeGreaterThanOrEqual(0.9);
  });
});
