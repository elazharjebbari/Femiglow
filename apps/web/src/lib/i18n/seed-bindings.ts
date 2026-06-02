/**
 * Pipeline pur — seed des CSV `component-bindings-{ar,en}.csv` vers
 * `component_field_bindings` (locale = AR ou EN, status = draft).
 *
 * Architecture :
 *   1. **parseBindingsCsv** : transforme un string CSV en `BindingCsvRow[]`
 *      (parser RFC 4180 minimal supportant `""` escapes + multi-lignes).
 *   2. **validateRow** : Zod schema sur chaque row — fail fast sur malformés.
 *   3. **runI18nBindingsSeed** : orchestrateur (lit CSV, pré-flight, upsert
 *      par batches de 100, écrit rapport JSON).
 *
 * Invariants :
 *   - **I0 — Admin priorité** : un `draft` existant pour le triplet n'est
 *     pas sur-écrit sauf `forceUpdate: true`.
 *   - **D2 — Idempotence** : 2 runs successifs ⇒ 0 changement (sauf force).
 *   - **Status** : tous les bindings sont seedés en `draft`. Le founder
 *     publie via admin (`/admin/components/<slug>` → `Publier`).
 *
 * Cf. `apps/web/scripts/seed-i18n-bindings.ts` (CLI wrapper).
 * Cf. `docs/i18n-strategy-2026-05/PHASE-6-SEED-RUNBOOK.md`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { db, memoryStore } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import { LOCALES, type Locale } from '@/i18n.config';
import { logger } from '@/lib/logging/logger';
import { listSiteComponents } from '@/lib/db/queries/site-components';
import {
  getDraftBinding,
  getPublishedBinding,
  listBindingsByComponent,
} from '@/lib/db/queries/component-fields';
import type { ComponentFieldBinding } from '@/lib/db/types';
import { eq } from 'drizzle-orm';

/* ────────────────────────────────────────────────────────────────
 * Constantes
 * ────────────────────────────────────────────────────────────── */

/** Locales seedables via CSV (FR est seedé par `seed:components-fields`). */
export const SEEDABLE_LOCALES: readonly Locale[] = LOCALES.filter(
  (l) => l !== 'fr',
);

/** Taille des batchs d'insertion Drizzle (compromis perf/lock). */
export const BATCH_SIZE = 100;

/** Chemin par défaut du dossier CSV (relatif à la racine du repo). */
export const DEFAULT_CSV_DIR = path.resolve(
  // apps/web/src/lib/i18n/ → repo root
  // 5 niveaux : i18n/ → lib/ → src/ → web/ → apps/ → root
  new URL('../../../../../docs/i18n-content-2026-05/03-seed-data', import.meta.url)
    .pathname,
);

/* ────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────── */

export interface RunOptions {
  locales: Locale[];
  dryRun?: boolean;
  forceUpdate?: boolean;
  csvDir?: string;
  reportPath?: string;
  /** Si true, n'écrit pas le rapport sur disque (utile en tests). */
  skipReportWrite?: boolean;
  /**
   * Statut des bindings nouvellement insérés. `draft` (défaut) = workflow CLI
   * (le founder publie via l'admin). `published` = provisioning (seeder
   * `i18n-bindings`) → le contenu localisé est live immédiatement, à parité
   * avec les bindings FR (eux aussi seedés `published`). N'affecte QUE les
   * insertions : l'invariant I0 (admin priorité) préserve tout binding existant.
   */
  status?: 'draft' | 'published';
}

export interface BindingCsvRow {
  componentSlug: string;
  fieldKey: string;
  locale: Locale;
  value: string;
  status: string;
  notes: string;
  /** Numéro de ligne 1-indexed dans le CSV original (pour reporting). */
  lineNo: number;
}

export interface SeedLocaleReport {
  locale: Locale;
  csvPath: string;
  parsed: number;
  inserted: number;
  skipped: number;
  updated: number;
  orphans: { componentSlug: string; rows: number }[];
  errors: { lineNo: number; reason: string }[];
  durationMs: number;
}

export interface SeedI18nReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  forceUpdate: boolean;
  locales: Locale[];
  perLocale: SeedLocaleReport[];
  totals: {
    parsed: number;
    inserted: number;
    skipped: number;
    updated: number;
    errors: number;
    orphans: number;
  };
  reportPath: string | null;
}

export class PreflightError extends Error {
  override readonly name = 'PreflightError';
  constructor(message: string) {
    super(message);
  }
}

/* ────────────────────────────────────────────────────────────────
 * 1. CSV parser (RFC 4180 minimal — quotes, escapes, multi-line)
 * ────────────────────────────────────────────────────────────── */

/**
 * Parse un texte CSV en lignes de cellules. Gère :
 *   - guillemets doubles autour des champs contenant `,` ou `\n`
 *   - escape `""` à l'intérieur d'un champ quoté
 *   - line endings `\n` et `\r\n`
 *   - dernière ligne sans newline final
 *
 * N'effectue aucune validation sémantique (cf. {@link toBindingRow}).
 */
export function parseCsvRaw(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.length > 0)) rows.push(row);
  }
  return rows;
}

/* ────────────────────────────────────────────────────────────────
 * 2. Row validation (Zod)
 * ────────────────────────────────────────────────────────────── */

const SLUG_RE = /^[a-z][a-z0-9-]{1,80}$/;
const FIELD_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,200}$/;

const csvRowSchema = z.object({
  componentSlug: z.string().regex(SLUG_RE, 'component_slug malformé'),
  fieldKey: z
    .string()
    .regex(FIELD_KEY_RE, 'field_key malformé (alphanum + `_` seuls)'),
  locale: z.enum(LOCALES),
  value: z.string().min(1, 'value vide'),
  status: z.string(),
  notes: z.string(),
});

/**
 * Convertit une ligne brute (cells) en `BindingCsvRow` validé. Throw avec
 * un message lisible si la row est mal formée.
 */
export function toBindingRow(
  headers: string[],
  cells: string[],
  lineNo: number,
): BindingCsvRow {
  const idx = (k: string): number => headers.indexOf(k);
  const get = (k: string): string => cells[idx(k)] ?? '';
  const raw = {
    componentSlug: get('component_slug').trim(),
    fieldKey: get('field_key').trim(),
    locale: get('locale').trim(),
    value: get('value'),
    status: get('status').trim(),
    notes: get('notes'),
  };
  const parsed = csvRowSchema.safeParse(raw);
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || '(row)'}: ${iss.message}`)
      .join(' | ');
    throw new Error(`L${lineNo} ${reason}`);
  }
  return { ...parsed.data, lineNo };
}

/**
 * Vérifie qu'un CSV a bien les 6 colonnes attendues, lance si pas.
 */
export function ensureCsvHeaders(headers: string[]): void {
  const expected = [
    'component_slug',
    'field_key',
    'locale',
    'value',
    'status',
    'notes',
  ];
  const missing = expected.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new PreflightError(
      `CSV header invalide — colonnes manquantes : ${missing.join(', ')}`,
    );
  }
}

/**
 * Lit et parse un CSV de bindings pour une locale donnée. Filtre les rows
 * dont la locale ne matche pas (sécurité). Skip silencieusement les lignes
 * commençant par `#` (commentaires).
 */
export function parseBindingsCsv(
  csvText: string,
  expectedLocale: Locale,
): { rows: BindingCsvRow[]; errors: { lineNo: number; reason: string }[] } {
  const raw = parseCsvRaw(csvText);
  if (raw.length === 0) {
    return { rows: [], errors: [] };
  }
  const headers = raw[0]!.map((h) => h.trim());
  ensureCsvHeaders(headers);
  const rows: BindingCsvRow[] = [];
  const errors: { lineNo: number; reason: string }[] = [];
  for (let i = 1; i < raw.length; i += 1) {
    const cells = raw[i]!;
    // ligne vide (toutes cellules vides → déjà filtré par parseCsvRaw)
    if (cells.every((c) => c.trim() === '')) continue;
    // commentaire (1ère cellule commence par `#`)
    if (cells[0]?.trim().startsWith('#')) continue;
    const lineNo = i + 1; // 1-indexed + skip header
    try {
      const row = toBindingRow(headers, cells, lineNo);
      if (row.locale !== expectedLocale) {
        errors.push({
          lineNo,
          reason: `locale '${row.locale}' inattendue (CSV pour '${expectedLocale}')`,
        });
        continue;
      }
      rows.push(row);
    } catch (err) {
      errors.push({
        lineNo,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { rows, errors };
}

/* ────────────────────────────────────────────────────────────────
 * 3. DB helpers (Drizzle + memoryStore fallback)
 * ────────────────────────────────────────────────────────────── */

/**
 * Pré-charge la map `slug → componentId` depuis `site_components`.
 * Une seule query DB pour les ~22 composants existants — bien plus
 * rapide qu'un lookup par row.
 */
export async function buildSlugMap(): Promise<Map<string, string>> {
  const all = await listSiteComponents();
  const map = new Map<string, string>();
  for (const c of all) {
    map.set(c.key, c.id);
  }
  return map;
}

/**
 * Insère un batch de bindings via Drizzle (ou memoryStore en fallback).
 * Tous les bindings sont en `draft` (status = 'draft', version = nextVersion).
 *
 * Préfère la voie Drizzle bulk insert si DATABASE_URL est défini.
 */
async function insertBatch(
  bindings: ComponentFieldBinding[],
): Promise<void> {
  if (bindings.length === 0) return;
  const drizzle = db();
  if (drizzle) {
    // Drizzle accepte un array — bulk insert en 1 round-trip.
    await drizzle.insert(schema.componentFieldBindings).values(bindings);
    return;
  }
  const store = memoryStore();
  for (const b of bindings) store.componentFieldBindings.set(b.id, b);
}

/**
 * Met à jour la `value` d'un binding existant (utilisé par `--force-update`).
 * Préserve `id`, `version`, `status`, `createdAt` — change `value`, `notes`,
 * `updatedAt`.
 */
async function updateBindingValue(
  binding: ComponentFieldBinding,
  newValue: unknown,
  newNotes: string | null,
): Promise<void> {
  const now = new Date();
  const updated: ComponentFieldBinding = {
    ...binding,
    value: newValue,
    notes: newNotes,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.componentFieldBindings)
      .set({ value: newValue, notes: newNotes, updatedAt: now })
      .where(eq(schema.componentFieldBindings.id, binding.id));
    return;
  }
  memoryStore().componentFieldBindings.set(binding.id, updated);
}

/* ────────────────────────────────────────────────────────────────
 * 4. Per-locale seeding
 * ────────────────────────────────────────────────────────────── */

interface SeedLocaleContext {
  locale: Locale;
  csvPath: string;
  slugMap: Map<string, string>;
  dryRun: boolean;
  forceUpdate: boolean;
  /** Statut des bindings insérés (`draft` par défaut). */
  status: 'draft' | 'published';
}

/**
 * Seed une locale donnée. Lit le CSV, valide chaque row, regroupe par
 * triplet `(componentId, fieldKey, locale)`, applique l'invariant I0
 * (admin priorité), insère par batches.
 *
 * Retourne un rapport par-locale (parsed/inserted/skipped/errors/orphans).
 */
export async function seedOneLocale(
  ctx: SeedLocaleContext,
): Promise<SeedLocaleReport> {
  const start = Date.now();
  const csvText = await fs.readFile(ctx.csvPath, 'utf8');
  const { rows, errors } = parseBindingsCsv(csvText, ctx.locale);

  const report: SeedLocaleReport = {
    locale: ctx.locale,
    csvPath: ctx.csvPath,
    parsed: rows.length,
    inserted: 0,
    skipped: 0,
    updated: 0,
    orphans: [],
    errors: [...errors],
    durationMs: 0,
  };

  // Orphans : slugs CSV absents de site_components. Comptés par slug.
  const orphanCounts = new Map<string, number>();
  const validRows: BindingCsvRow[] = [];
  for (const row of rows) {
    if (!ctx.slugMap.has(row.componentSlug)) {
      orphanCounts.set(
        row.componentSlug,
        (orphanCounts.get(row.componentSlug) ?? 0) + 1,
      );
      continue;
    }
    validRows.push(row);
  }
  for (const [slug, n] of orphanCounts.entries()) {
    report.orphans.push({ componentSlug: slug, rows: n });
  }
  report.orphans.sort((a, b) => b.rows - a.rows);

  // Préparer la liste à insérer (avec contrôle I0 par row).
  const toInsert: ComponentFieldBinding[] = [];
  const seenTriplets = new Set<string>(); // duplicate guard intra-CSV
  for (const row of validRows) {
    const componentId = ctx.slugMap.get(row.componentSlug)!;
    const triplet = `${componentId}|${row.fieldKey}|${ctx.locale}`;
    if (seenTriplets.has(triplet)) {
      report.errors.push({
        lineNo: row.lineNo,
        reason: `doublon intra-CSV (componentSlug=${row.componentSlug}, fieldKey=${row.fieldKey})`,
      });
      continue;
    }
    seenTriplets.add(triplet);

    // Invariant I0 — admin priorité.
    const existingDraft = await getDraftBinding(
      componentId,
      row.fieldKey,
      ctx.locale,
    );
    const existingPublished = await getPublishedBinding(
      componentId,
      row.fieldKey,
      ctx.locale,
    );

    if (existingDraft || existingPublished) {
      if (!ctx.forceUpdate) {
        report.skipped += 1;
        continue;
      }
      // force-update : remplace la valeur du draft (sinon du published).
      const target = existingDraft ?? existingPublished!;
      if (!ctx.dryRun) {
        await updateBindingValue(
          target,
          row.value,
          row.notes ? row.notes : null,
        );
      }
      report.updated += 1;
      continue;
    }

    // Pas d'existant — préparer le binding (jsonb accepte la string directement).
    const now = new Date();
    const all = await listBindingsByComponent(componentId, ctx.locale);
    const nextVersion =
      all.length > 0 ? Math.max(...all.map((b) => b.version)) + 1 : 1;
    toInsert.push({
      id: createId('cfb'),
      componentId,
      fieldKey: row.fieldKey,
      locale: ctx.locale,
      value: row.value,
      status: ctx.status,
      version: nextVersion,
      publishedAt: ctx.status === 'published' ? now : null,
      scheduledAt: null,
      notes: row.notes ? row.notes : null,
      authorId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Bulk insert par batches de BATCH_SIZE.
  if (!ctx.dryRun && toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const slice = toInsert.slice(i, i + BATCH_SIZE);
      try {
        await insertBatch(slice);
        report.inserted += slice.length;
      } catch (err) {
        // Si la batch échoue d'un coup (FK, contrainte unique), on
        // dégrade en row-by-row pour pouvoir reporter les erreurs précises.
        for (const b of slice) {
          try {
            await insertBatch([b]);
            report.inserted += 1;
          } catch (errRow) {
            report.errors.push({
              lineNo: 0,
              reason: `insert failed for ${b.componentId}.${b.fieldKey} : ${
                errRow instanceof Error ? errRow.message : String(errRow)
              }`,
            });
          }
        }
      }
    }
  } else if (ctx.dryRun) {
    report.inserted = toInsert.length;
  }

  report.durationMs = Date.now() - start;
  return report;
}

/* ────────────────────────────────────────────────────────────────
 * 5. Orchestrateur public
 * ────────────────────────────────────────────────────────────── */

/**
 * Orchestrateur principal — appelé par le CLI ou directement en tests.
 *
 * Pré-flight :
 *   1. Vérifie que le `csvDir` existe.
 *   2. Vérifie qu'il y a au moins 1 site_component en DB (sinon le seed
 *      n'a rien à matcher).
 *   3. Pour chaque locale demandée, vérifie que le CSV existe.
 *
 * Pour chaque locale : appelle `seedOneLocale` et accumule.
 *
 * Écrit un rapport JSON timestampé sauf si `skipReportWrite=true`.
 */
export async function runI18nBindingsSeed(
  opts: RunOptions,
): Promise<SeedI18nReport> {
  const startedAt = new Date();

  // ── Pré-flight ──
  const csvDir = opts.csvDir ?? DEFAULT_CSV_DIR;
  try {
    const stat = await fs.stat(csvDir);
    if (!stat.isDirectory()) {
      throw new PreflightError(`csv-dir n'est pas un dossier : ${csvDir}`);
    }
  } catch (err) {
    if (err instanceof PreflightError) throw err;
    throw new PreflightError(`csv-dir inaccessible : ${csvDir}`);
  }

  const slugMap = await buildSlugMap();
  if (slugMap.size === 0) {
    throw new PreflightError(
      "Aucun site_component trouvé en DB (rouler `pnpm seed:components` avant).",
    );
  }

  // Pour chaque locale, on s'assure que le CSV est présent et lisible.
  const csvPaths = new Map<Locale, string>();
  for (const loc of opts.locales) {
    if (!(SEEDABLE_LOCALES as readonly Locale[]).includes(loc)) {
      throw new PreflightError(
        `locale '${loc}' non seedable via CSV (FR via seed:components-fields).`,
      );
    }
    const p = path.join(csvDir, `component-bindings-${loc}.csv`);
    try {
      await fs.access(p);
    } catch {
      throw new PreflightError(`CSV introuvable : ${p}`);
    }
    csvPaths.set(loc, p);
  }

  // ── Run par locale ──
  const perLocale: SeedLocaleReport[] = [];
  for (const loc of opts.locales) {
    logger.info('seed.i18n-bindings.locale.start', {
      locale: loc,
      csvPath: csvPaths.get(loc),
    });
    const r = await seedOneLocale({
      locale: loc,
      csvPath: csvPaths.get(loc)!,
      slugMap,
      dryRun: opts.dryRun ?? false,
      forceUpdate: opts.forceUpdate ?? false,
      status: opts.status ?? 'draft',
    });
    perLocale.push(r);
    logger.info('seed.i18n-bindings.locale.end', {
      locale: loc,
      parsed: r.parsed,
      inserted: r.inserted,
      skipped: r.skipped,
      updated: r.updated,
      errors: r.errors.length,
      orphans: r.orphans.length,
      durationMs: r.durationMs,
    });
  }

  const finishedAt = new Date();
  const totals = perLocale.reduce(
    (acc, r) => ({
      parsed: acc.parsed + r.parsed,
      inserted: acc.inserted + r.inserted,
      skipped: acc.skipped + r.skipped,
      updated: acc.updated + r.updated,
      errors: acc.errors + r.errors.length,
      orphans: acc.orphans + r.orphans.reduce((s, o) => s + o.rows, 0),
    }),
    { parsed: 0, inserted: 0, skipped: 0, updated: 0, errors: 0, orphans: 0 },
  );

  const report: SeedI18nReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    dryRun: opts.dryRun ?? false,
    forceUpdate: opts.forceUpdate ?? false,
    locales: opts.locales,
    perLocale,
    totals,
    reportPath: null,
  };

  // ── Écriture du rapport JSON ──
  if (!opts.skipReportWrite) {
    const reportPath =
      opts.reportPath ??
      path.join(
        process.cwd(),
        '.seed-reports',
        `seed-i18n-bindings-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`,
      );
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      report.reportPath = reportPath;
    } catch (err) {
      logger.warn('seed.i18n-bindings.report-write-failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}
