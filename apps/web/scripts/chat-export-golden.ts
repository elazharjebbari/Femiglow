/**
 * CHA-230 Phase 3.5 — Export du golden-set vers `tests/golden/intent-fixtures.json`.
 *
 * Lit `chat_golden_intent_set` (curé par l'admin via /admin/chat/intent-curator)
 * et le sérialise dans un fichier JSON commité au repo. Le test CI
 * `intent-classifier.golden.test.ts` charge cette fixture et fait
 * tourner le classifier regex offline pour assurer une précision
 * minimale (cf. seuil dans le test).
 *
 * Pourquoi un fichier JSON commité plutôt qu'un appel DB depuis le
 * test : on veut que le test CI soit déterministe, hermétique, ne
 * dépende pas de l'état de la prod, et reste rapide (< 1 s).
 *
 * Usage : `pnpm tsx scripts/chat-export-golden.ts`
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Lecture .env minimale (mimique des autres scripts seed-*).
try {
  const envPath = resolve(process.cwd(), '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    if (m[1].startsWith('#')) continue;
    if (process.env[m[1]] === undefined) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
} catch {
  // .env optionnel
}

import { goldenIntentRepo } from '@/lib/chat/repos/golden-intent';

interface GoldenFixtureRow {
  text: string;
  language: 'fr' | 'ar' | 'ar-MA';
  expectedIntent: string;
  notes?: string;
}

interface GoldenFixture {
  /** Version sémantique de la fixture — bumper si le format change. */
  version: 1;
  /** ISO date d'export — pour debug, pas utilisé par les tests. */
  exportedAt: string;
  /** Compte par langue pour rendre les diffs lisibles. */
  countByLanguage: Record<'fr' | 'ar' | 'ar-MA', number>;
  /** Compte par intent. */
  countByIntent: Record<string, number>;
  /** Lignes — triées par language, puis intent, puis text alphabétique. */
  rows: GoldenFixtureRow[];
}

const OUTPUT = resolve(process.cwd(), 'tests/golden/intent-fixtures.json');

async function main(): Promise<void> {
  console.log('[golden-export] reading chat_golden_intent_set…');
  const all = await goldenIntentRepo.listAllForExport();
  console.log(`[golden-export] ${all.length} entries fetched`);

  const rows: GoldenFixtureRow[] = all
    .map((r) => ({
      text: r.text,
      language: r.language,
      expectedIntent: r.expectedIntent,
      notes: r.notes ?? undefined,
    }))
    .sort((a, b) => {
      if (a.language !== b.language) return a.language.localeCompare(b.language);
      if (a.expectedIntent !== b.expectedIntent) {
        return a.expectedIntent.localeCompare(b.expectedIntent);
      }
      return a.text.localeCompare(b.text);
    });

  const countByLanguage: Record<'fr' | 'ar' | 'ar-MA', number> = {
    fr: 0,
    ar: 0,
    'ar-MA': 0,
  };
  const countByIntent: Record<string, number> = {};
  for (const r of rows) {
    countByLanguage[r.language] += 1;
    countByIntent[r.expectedIntent] = (countByIntent[r.expectedIntent] ?? 0) + 1;
  }

  const fixture: GoldenFixture = {
    version: 1,
    exportedAt: new Date().toISOString(),
    countByLanguage,
    countByIntent,
    rows,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  console.log(`[golden-export] wrote ${rows.length} rows → ${OUTPUT}`);
  console.log(`[golden-export] countByLanguage:`, countByLanguage);
  console.log(`[golden-export] countByIntent:`, countByIntent);
}

main().catch((err) => {
  console.error('[golden-export] FAILED', err);
  process.exit(1);
});
