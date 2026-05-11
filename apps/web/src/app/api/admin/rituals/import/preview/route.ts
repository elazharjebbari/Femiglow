import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { parseCSV, CsvParseError } from '@/lib/rituals/import/csv-parser';
import { parseJSON, JsonParseError } from '@/lib/rituals/import/json-parser';
import { mapImportRow } from '@/lib/rituals/import/row-mapper';
import {
  applyColumnMapping,
  autoDetectMapping,
  hasRequiredFields,
  type CanonicalField,
} from '@/lib/rituals/import/column-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rituals/import/preview
 *
 * Accepte un body JSON :
 *   {
 *     format: 'csv' | 'csv-comma' | 'tsv' | 'json' | 'jsonl',
 *     content: string,
 *     columnMapping?: Record<sourceHeader, CanonicalField | null>
 *   }
 *
 * Renvoie :
 *  - les en-têtes détectées
 *  - le mapping auto-detecté + le mapping effectif (override admin si fourni)
 *  - preview row-par-row validée
 *  - flag requiredFieldsMissing si body ou wouldRecommend pas mappés
 *
 * Cf. docs/reviews-wall/execution/13-import-system-architecture.md § 8
 */

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  let payload: {
    format?: string;
    content?: string;
    columnMapping?: Record<string, CanonicalField | null>;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'JSON invalide' } },
      { status: 400 },
    );
  }

  const { format, content, columnMapping } = payload;
  if (!format || !content) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'format et content requis' } },
      { status: 400 },
    );
  }

  let parsedRows: Array<Record<string, unknown>>;
  try {
    if (format === 'csv' || format === 'csv-comma' || format === 'tsv') {
      const sep = format === 'csv-comma' ? ',' : format === 'tsv' ? '\t' : ';';
      const { rows } = parseCSV(content, { separator: sep });
      parsedRows = rows;
    } else if (format === 'json') {
      const { rows } = parseJSON(content);
      parsedRows = rows;
    } else if (format === 'jsonl') {
      const { rows } = parseJSON(content, { jsonl: true });
      parsedRows = rows;
    } else {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_FORMAT' } },
        { status: 400 },
      );
    }
  } catch (e) {
    if (e instanceof CsvParseError || e instanceof JsonParseError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  // Détection des en-têtes + mapping auto
  const detectedHeaders =
    parsedRows.length > 0 ? Object.keys(parsedRows[0] ?? {}) : [];
  const autoMapping = autoDetectMapping(detectedHeaders);
  const effectiveMapping = columnMapping ?? autoMapping;
  const requiredOk = hasRequiredFields(effectiveMapping);

  let valid = 0;
  let warningCount = 0;
  let errorCount = 0;
  const preview = parsedRows.map((raw, index) => {
    const canonicalized = applyColumnMapping(raw, effectiveMapping);
    const result = mapImportRow(canonicalized);
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
    if (result.errors.length > 0) {
      status = 'ERROR';
      errorCount += 1;
    } else if (result.warnings.length > 0) {
      status = 'WARNING';
      warningCount += 1;
    } else {
      valid += 1;
    }
    return {
      index,
      status,
      row: result.row,
      errors: result.errors,
      warnings: result.warnings,
    };
  });

  return NextResponse.json({
    data: {
      totalParsed: parsedRows.length,
      totalValid: valid,
      totalWarning: warningCount,
      totalError: errorCount,
      headers: detectedHeaders,
      autoMapping,
      effectiveMapping,
      requiredFieldsMissing: !requiredOk,
      preview,
    },
  });
}
