/**
 * Tests — pipeline de seed i18n bindings (AR + EN CSVs).
 *
 * Couvre :
 *   - parser CSV (RFC 4180 minimal — quotes, escapes, multi-line)
 *   - validation Zod (slug, fieldKey, locale)
 *   - lookup orphans (slug CSV absent du registre site_components)
 *   - invariant I0 (admin priorité — skip si draft/published existe)
 *   - force-update (override I0)
 *   - dry-run (aucune écriture)
 *   - idempotence (2e run = 0 insertion)
 *   - exit codes pré-flight (CSV absent, slug map vide)
 *
 * Cf. `docs/i18n-strategy-2026-05/PHASE-6-SEED-RUNBOOK.md`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { SiteComponent } from '@/lib/db/types';
import {
  ensureCsvHeaders,
  parseBindingsCsv,
  parseCsvRaw,
  PreflightError,
  runI18nBindingsSeed,
  toBindingRow,
} from './seed-bindings';

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */

const HEADER = 'component_slug,field_key,locale,value,status,notes\n';

function seedComponent(key: string, pageGroup = 'home'): SiteComponent {
  const id = createId('cmp');
  const now = new Date();
  const cmp: SiteComponent = {
    id,
    key,
    name: key,
    description: null,
    category: 'section',
    pageGroup,
    filePath: null,
    slots: [],
    fields: [],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: true,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  memoryStore().siteComponents.set(id, cmp);
  return cmp;
}

async function makeTmpCsvDir(
  files: Record<string, string>,
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-i18n-'));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, 'utf8');
  }
  return dir;
}

let tmpDirs: string[] = [];

async function tmpCsvDir(
  files: Record<string, string>,
): Promise<string> {
  const dir = await makeTmpCsvDir(files);
  tmpDirs.push(dir);
  return dir;
}

beforeEach(() => {
  resetMemoryStore();
});

afterEach(async () => {
  for (const d of tmpDirs) {
    await fs.rm(d, { recursive: true, force: true });
  }
  tmpDirs = [];
});

/* ────────────────────────────────────────────────────────────────
 * 1. parseCsvRaw — RFC 4180 minimal
 * ────────────────────────────────────────────────────────────── */

describe('parseCsvRaw', () => {
  it('parses simple comma-separated rows', () => {
    const out = parseCsvRaw('a,b,c\n1,2,3\n');
    expect(out).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const out = parseCsvRaw('a,b\n"hello, world","x"\n');
    expect(out).toEqual([
      ['a', 'b'],
      ['hello, world', 'x'],
    ]);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const out = parseCsvRaw('a,b\n"He said ""hi""","y"\n');
    expect(out).toEqual([
      ['a', 'b'],
      ['He said "hi"', 'y'],
    ]);
  });

  it('handles CRLF line endings and trailing newline absence', () => {
    const out = parseCsvRaw('a,b\r\n1,2\r\n3,4');
    expect(out).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

/* ────────────────────────────────────────────────────────────────
 * 2. ensureCsvHeaders + toBindingRow
 * ────────────────────────────────────────────────────────────── */

describe('ensureCsvHeaders', () => {
  it('throws PreflightError when a column is missing', () => {
    expect(() =>
      ensureCsvHeaders(['component_slug', 'field_key', 'locale', 'value']),
    ).toThrow(PreflightError);
  });

  it('passes when all 6 expected columns are present', () => {
    expect(() =>
      ensureCsvHeaders([
        'component_slug',
        'field_key',
        'locale',
        'value',
        'status',
        'notes',
      ]),
    ).not.toThrow();
  });
});

describe('toBindingRow', () => {
  const HEADERS = [
    'component_slug',
    'field_key',
    'locale',
    'value',
    'status',
    'notes',
  ];

  it('parses a well-formed row', () => {
    const row = toBindingRow(
      HEADERS,
      ['home-hero', 'title', 'ar', 'مرحبا', 'draft', 'icu'],
      2,
    );
    expect(row).toEqual({
      componentSlug: 'home-hero',
      fieldKey: 'title',
      locale: 'ar',
      value: 'مرحبا',
      status: 'draft',
      notes: 'icu',
      lineNo: 2,
    });
  });

  it('rejects an unknown locale', () => {
    expect(() =>
      toBindingRow(
        HEADERS,
        ['home-hero', 'title', 'de', 'Hallo', 'draft', ''],
        3,
      ),
    ).toThrow(/L3/);
  });

  it('rejects a malformed slug (uppercase forbidden)', () => {
    expect(() =>
      toBindingRow(
        HEADERS,
        ['HomeHero', 'title', 'ar', 'مرحبا', 'draft', ''],
        4,
      ),
    ).toThrow(/component_slug/);
  });

  it('rejects an empty value', () => {
    expect(() =>
      toBindingRow(
        HEADERS,
        ['home-hero', 'title', 'ar', '', 'draft', ''],
        5,
      ),
    ).toThrow(/value/);
  });
});

/* ────────────────────────────────────────────────────────────────
 * 3. parseBindingsCsv — integration parser + validator
 * ────────────────────────────────────────────────────────────── */

describe('parseBindingsCsv', () => {
  it('extracts valid rows and reports validation errors', () => {
    const csv =
      HEADER +
      'home-hero,title,ar,مرحبا,draft,\n' +
      'BAD,title,ar,X,draft,\n' + // slug malformé
      'home-hero,subtitle,en,Hello,draft,\n';
    const { rows, errors } = parseBindingsCsv(csv, 'ar');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fieldKey).toBe('title');
    // Erreur 1 : slug invalide, Erreur 2 : locale 'en' inattendue dans CSV ar
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('skips comment lines (lines starting with #)', () => {
    const csv =
      HEADER +
      '# comment\n' +
      'home-hero,title,ar,مرحبا,draft,\n';
    const { rows, errors } = parseBindingsCsv(csv, 'ar');
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});

/* ────────────────────────────────────────────────────────────────
 * 4. runI18nBindingsSeed — orchestrateur (memoryStore)
 * ────────────────────────────────────────────────────────────── */

describe('runI18nBindingsSeed — happy path', () => {
  it('inserts AR + EN bindings as draft', async () => {
    seedComponent('home-hero');
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,مرحبا,draft,\n',
      'component-bindings-en.csv':
        HEADER + 'home-hero,title,en,Welcome,draft,\n',
    });
    const report = await runI18nBindingsSeed({
      locales: ['ar', 'en'],
      csvDir: dir,
      skipReportWrite: true,
    });
    expect(report.totals.parsed).toBe(2);
    expect(report.totals.inserted).toBe(2);
    expect(report.totals.skipped).toBe(0);
    expect(report.totals.errors).toBe(0);
    // Vérifier en mémoire
    const bindings = Array.from(memoryStore().componentFieldBindings.values());
    expect(bindings).toHaveLength(2);
    for (const b of bindings) {
      expect(b.status).toBe('draft');
      expect(['ar', 'en']).toContain(b.locale);
    }
  });
});

describe('runI18nBindingsSeed — orphans', () => {
  it('reports rows pointing to a slug not in site_components', async () => {
    // Note : pas de seedComponent — slug map vide → 'home-hero' est orphelin.
    seedComponent('other-cmp'); // au moins 1 cmp pour passer le pré-flight
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,مرحبا,draft,\n',
    });
    const report = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      skipReportWrite: true,
    });
    expect(report.totals.inserted).toBe(0);
    expect(report.totals.orphans).toBe(1);
    expect(report.perLocale[0]?.orphans).toEqual([
      { componentSlug: 'home-hero', rows: 1 },
    ]);
  });
});

describe('runI18nBindingsSeed — invariant I0', () => {
  it('skips rows whose draft already exists (admin a priorité)', async () => {
    const cmp = seedComponent('home-hero');
    // Pré-existant draft
    const now = new Date();
    memoryStore().componentFieldBindings.set('cfb_existing', {
      id: 'cfb_existing',
      componentId: cmp.id,
      fieldKey: 'title',
      locale: 'ar',
      value: 'valeur admin',
      status: 'draft',
      version: 1,
      publishedAt: null,
      scheduledAt: null,
      notes: null,
      authorId: 'admin_X',
      createdAt: now,
      updatedAt: now,
    });
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,valeur seed,draft,\n',
    });
    const report = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      skipReportWrite: true,
    });
    expect(report.totals.inserted).toBe(0);
    expect(report.totals.skipped).toBe(1);
    // La valeur admin doit être préservée.
    const b = memoryStore().componentFieldBindings.get('cfb_existing');
    expect(b?.value).toBe('valeur admin');
  });

  it('overrides existing values when forceUpdate=true', async () => {
    const cmp = seedComponent('home-hero');
    const now = new Date();
    memoryStore().componentFieldBindings.set('cfb_existing', {
      id: 'cfb_existing',
      componentId: cmp.id,
      fieldKey: 'title',
      locale: 'ar',
      value: 'valeur admin',
      status: 'draft',
      version: 1,
      publishedAt: null,
      scheduledAt: null,
      notes: null,
      authorId: 'admin_X',
      createdAt: now,
      updatedAt: now,
    });
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,valeur seed forcée,draft,\n',
    });
    const report = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      forceUpdate: true,
      skipReportWrite: true,
    });
    expect(report.totals.skipped).toBe(0);
    expect(report.totals.updated).toBe(1);
    const b = memoryStore().componentFieldBindings.get('cfb_existing');
    expect(b?.value).toBe('valeur seed forcée');
  });
});

describe('runI18nBindingsSeed — dry-run', () => {
  it('does not write to the store when dryRun=true', async () => {
    seedComponent('home-hero');
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,مرحبا,draft,\n',
    });
    const report = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      dryRun: true,
      skipReportWrite: true,
    });
    expect(report.totals.parsed).toBe(1);
    // En dry-run, `inserted` reflète ce qui SERAIT inséré.
    expect(report.totals.inserted).toBe(1);
    // Mais la map est vide.
    expect(memoryStore().componentFieldBindings.size).toBe(0);
  });
});

describe('runI18nBindingsSeed — idempotence', () => {
  it('second run inserts 0 new bindings (D2)', async () => {
    seedComponent('home-hero');
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,مرحبا,draft,\n',
    });
    const r1 = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      skipReportWrite: true,
    });
    expect(r1.totals.inserted).toBe(1);
    const r2 = await runI18nBindingsSeed({
      locales: ['ar'],
      csvDir: dir,
      skipReportWrite: true,
    });
    expect(r2.totals.inserted).toBe(0);
    expect(r2.totals.skipped).toBe(1);
    expect(memoryStore().componentFieldBindings.size).toBe(1);
  });
});

describe('runI18nBindingsSeed — pré-flight errors', () => {
  it('throws PreflightError when no site_component exists', async () => {
    const dir = await tmpCsvDir({
      'component-bindings-ar.csv':
        HEADER + 'home-hero,title,ar,مرحبا,draft,\n',
    });
    await expect(
      runI18nBindingsSeed({
        locales: ['ar'],
        csvDir: dir,
        skipReportWrite: true,
      }),
    ).rejects.toBeInstanceOf(PreflightError);
  });

  it('throws PreflightError when CSV is missing for the requested locale', async () => {
    seedComponent('home-hero');
    const dir = await tmpCsvDir({}); // dossier vide
    await expect(
      runI18nBindingsSeed({
        locales: ['ar'],
        csvDir: dir,
        skipReportWrite: true,
      }),
    ).rejects.toBeInstanceOf(PreflightError);
  });

  it('refuses to seed FR (handled by seed:components-fields)', async () => {
    seedComponent('home-hero');
    const dir = await tmpCsvDir({
      'component-bindings-fr.csv':
        HEADER + 'home-hero,title,fr,Bonjour,draft,\n',
    });
    // 'fr' est un Locale valide côté types, mais le guard runtime le rejette
    // (FR est seedé par scripts/seed-components-fields.ts).
    await expect(
      runI18nBindingsSeed({
        locales: ['fr'],
        csvDir: dir,
        skipReportWrite: true,
      }),
    ).rejects.toBeInstanceOf(PreflightError);
  });
});
