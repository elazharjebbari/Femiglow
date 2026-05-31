/**
 * Parser CSV minimaliste pour l'import de rituels.
 * Gère :
 *  - séparateur point-virgule (par défaut) ou virgule ou tabulation
 *  - quoting double-guillemets avec échappement `""`
 *  - sauts de ligne dans cellules quotées
 *  - BOM UTF-8 en début
 *
 * Cf. docs/reviews-wall/execution/15-import-templates-formats.md § 2
 */

export type CsvSeparator = ';' | ',' | '\t';

export interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface CsvParseOptions {
  separator?: CsvSeparator | 'auto';
  /** Limite stricte sur le nombre de lignes acceptées. */
  maxRows?: number;
  /** Limite stricte sur la taille brute (octets). */
  maxBytes?: number;
}

export class CsvParseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

function detectSeparator(firstLine: string): CsvSeparator {
  const counts: Record<CsvSeparator, number> = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as CsvSeparator) ?? ';';
}

function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

/**
 * Parse une chaîne CSV en utilisant un automate caractère par caractère
 * pour gérer correctement les cellules quotées avec sauts de ligne.
 */
function parseRows(input: string, sep: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === sep) {
      current.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      current.push(cell);
      cell = '';
      rows.push(current);
      current = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].length > 0));
}

export function parseCSV(raw: string, options: CsvParseOptions = {}): CsvParseResult {
  if (options.maxBytes !== undefined && Buffer.byteLength(raw, 'utf8') > options.maxBytes) {
    throw new CsvParseError(
      `Fichier trop volumineux (limite ${options.maxBytes} octets).`,
      'FILE_TOO_BIG',
    );
  }
  const stripped = stripBom(raw);
  const firstLine = stripped.split(/\r?\n/, 1)[0] ?? '';
  const separator =
    options.separator && options.separator !== 'auto'
      ? options.separator
      : detectSeparator(firstLine);

  const matrix = parseRows(stripped, separator);
  if (matrix.length === 0) {
    throw new CsvParseError('CSV vide.', 'EMPTY');
  }
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow || headerRow.length === 0) {
    throw new CsvParseError('Aucune en-tête.', 'NO_HEADERS');
  }

  const headers = headerRow.map((h) => h.trim());
  // doublons d'en-têtes
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) {
      throw new CsvParseError(`En-tête en doublon : "${h}".`, 'DUPLICATE_HEADER');
    }
    seen.add(h);
  }

  const maxRows = options.maxRows ?? 500;
  if (dataRows.length > maxRows) {
    throw new CsvParseError(
      `Trop de lignes (${dataRows.length}). Maximum : ${maxRows}.`,
      'TOO_MANY_ROWS',
    );
  }

  const rows: Array<Record<string, string>> = dataRows.map((row) => {
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      record[headers[j]!] = (row[j] ?? '').trim();
    }
    return record;
  });

  return { headers, rows };
}
