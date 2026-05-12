/**
 * Service de commit d'import : prend le contenu source, parse, mappe,
 * valide row-par-row, insère en PENDING avec audit `imported`.
 *
 * Cf. docs/reviews-wall/execution/13-import-system-architecture.md § 7.6
 */
import { createId } from '@/lib/ids';
import { insertAuditEvent, insertRitual } from '@/lib/db/queries/rituals';
import type { RitualSource } from '@/lib/db/types';
import { parseCSV, type CsvSeparator } from './csv-parser';
import { parseJSON } from './json-parser';
import { mapImportRow } from './row-mapper';
import {
  applyColumnMapping,
  autoDetectMapping,
  type CanonicalField,
} from './column-mapping';

export type ImportFormat = 'csv' | 'csv-comma' | 'tsv' | 'json' | 'jsonl';

export interface ImportCommitInput {
  format: ImportFormat;
  content: string;
  defaultProductKey?: string;
  /** Inclure les rows WARNING (true par défaut). */
  includeWarnings?: boolean;
  /** Exclure entièrement les rows ERROR (true par défaut — non négociable). */
  excludeErrors?: boolean;
  /** Note interne attachée à l'audit. */
  importNote?: string;
  /** Mapping explicite source → champ canonique (override de l'auto-detect). */
  columnMapping?: Record<string, CanonicalField | null>;
}

export interface ImportCommitContext {
  actorId: string;
}

export interface ImportCommitResult {
  batchId: string;
  totalParsed: number;
  totalValid: number;
  totalWarning: number;
  totalError: number;
  totalCommitted: number;
  errors: Array<{ rowIndex: number; errors: Array<{ field: string; code: string; message: string }> }>;
}

function parseSource(format: ImportFormat, content: string): Array<Record<string, unknown>> {
  if (format === 'csv' || format === 'csv-comma' || format === 'tsv') {
    const sep: CsvSeparator = format === 'csv-comma' ? ',' : format === 'tsv' ? '\t' : ';';
    return parseCSV(content, { separator: sep }).rows;
  }
  if (format === 'json') return parseJSON(content).rows;
  if (format === 'jsonl') return parseJSON(content, { jsonl: true }).rows;
  throw new Error(`Format inconnu : ${format}`);
}

function sourceForFormat(format: ImportFormat): RitualSource {
  if (format === 'csv' || format === 'csv-comma' || format === 'tsv') return 'import_csv';
  if (format === 'json' || format === 'jsonl') return 'import_json';
  return 'import_csv';
}

/**
 * Commit un batch d'import :
 *  - parse selon format
 *  - mappe chaque row vers payload normalisé
 *  - valide (errors → skip)
 *  - insère en PENDING avec source = import_csv|import_json
 *  - audit `imported` par ritual + audit global `import_committed`
 */
export async function commitImportBatch(
  input: ImportCommitInput,
  ctx: ImportCommitContext,
): Promise<ImportCommitResult> {
  const batchId = createId('rb');
  const parsedRows = parseSource(input.format, input.content);
  const source = sourceForFormat(input.format);
  const defaultProductKey = input.defaultProductKey ?? 'pack-femiglow';
  const includeWarnings = input.includeWarnings ?? true;
  // Mapping colonnes : explicite ou auto-detect basé sur les en-têtes
  const detectedHeaders =
    parsedRows.length > 0 ? Object.keys(parsedRows[0] ?? {}) : [];
  const columnMapping = input.columnMapping ?? autoDetectMapping(detectedHeaders);

  const errorsOut: ImportCommitResult['errors'] = [];
  let totalValid = 0;
  let totalWarning = 0;
  let totalError = 0;
  let totalCommitted = 0;

  for (let i = 0; i < parsedRows.length; i++) {
    const raw = parsedRows[i]!;
    const canonicalized = applyColumnMapping(raw, columnMapping);
    const map = mapImportRow(canonicalized, { defaultProductKey });

    if (map.errors.length > 0) {
      totalError += 1;
      errorsOut.push({ rowIndex: i, errors: map.errors });
      continue;
    }
    if (map.warnings.length > 0) totalWarning += 1;
    else totalValid += 1;

    if (!map.row) continue;
    if (!includeWarnings && map.warnings.length > 0) continue;

    try {
      const importRowId = createId('br');
      const ritual = await insertRitual({
        productKey: map.row.productKey,
        body: map.row.body,
        bodyOriginal: map.row.body,
        wouldRecommend: map.row.wouldRecommend,
        ritualTags: map.row.ritualTags,
        authorFirstName: map.row.authorFirstName,
        authorCity: map.row.authorCity,
        initiatedSince: map.row.initiatedSince,
        isAnonymous: map.row.isAnonymous,
        language: map.row.language,
        source,
        status: 'PENDING',
        autoFlags: map.warnings.map((w) => `import_${w.code}`),
        importBatchId: batchId,
        importRowId,
      });
      await insertAuditEvent({
        testimonialId: ritual.id,
        actorId: ctx.actorId,
        action: 'imported',
        note: input.importNote ?? null,
        payload: {
          batchId,
          rowIndex: i,
          format: input.format,
          warnings: map.warnings,
        },
      });
      totalCommitted += 1;
    } catch (e) {
      errorsOut.push({
        rowIndex: i,
        errors: [
          {
            field: 'insert',
            code: 'INSERT_FAILED',
            message: e instanceof Error ? e.message : String(e),
          },
        ],
      });
      totalError += 1;
    }
  }

  // Audit global du batch
  await insertAuditEvent({
    testimonialId: null,
    actorId: ctx.actorId,
    action: 'import_committed',
    note: input.importNote ?? null,
    payload: {
      batchId,
      format: input.format,
      totalParsed: parsedRows.length,
      totalCommitted,
      totalError,
    },
  });

  return {
    batchId,
    totalParsed: parsedRows.length,
    totalValid,
    totalWarning,
    totalError,
    totalCommitted,
    errors: errorsOut,
  };
}
