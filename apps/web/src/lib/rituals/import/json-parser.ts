/**
 * Parser JSON / JSONL pour l'import de rituels.
 * Cf. docs/reviews-wall/execution/15-import-templates-formats.md § 3-4
 */

export interface JsonParseResult {
  rows: Array<Record<string, unknown>>;
}

export class JsonParseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'JsonParseError';
  }
}

export interface JsonParseOptions {
  maxRows?: number;
  /** Si true : accepter format JSONL (un objet par ligne). */
  jsonl?: boolean;
}

export function parseJSON(raw: string, options: JsonParseOptions = {}): JsonParseResult {
  const maxRows = options.maxRows ?? 500;

  if (options.jsonl) {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length > maxRows) {
      throw new JsonParseError(
        `Trop de lignes (${lines.length}). Maximum : ${maxRows}.`,
        'TOO_MANY_ROWS',
      );
    }
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < lines.length; i += 1) {
      try {
        const obj = JSON.parse(lines[i]!);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          rows.push(obj as Record<string, unknown>);
        } else {
          throw new JsonParseError(`Ligne ${i + 1} : objet attendu.`, 'INVALID_ROW');
        }
      } catch (e) {
        throw new JsonParseError(
          `Ligne ${i + 1} mal formée : ${e instanceof Error ? e.message : String(e)}`,
          'INVALID_JSON_LINE',
        );
      }
    }
    return { rows };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new JsonParseError(
      `JSON invalide : ${e instanceof Error ? e.message : String(e)}`,
      'INVALID_JSON',
    );
  }

  let array: unknown;
  if (Array.isArray(parsed)) {
    array = parsed;
  } else if (parsed && typeof parsed === 'object' && 'rituals' in parsed) {
    array = (parsed as { rituals: unknown }).rituals;
  } else {
    throw new JsonParseError(
      'Format attendu : array ou objet { rituals: [...] }',
      'INVALID_SHAPE',
    );
  }

  if (!Array.isArray(array)) {
    throw new JsonParseError('Le champ rituals doit être un array.', 'INVALID_SHAPE');
  }

  if (array.length > maxRows) {
    throw new JsonParseError(
      `Trop de rituels (${array.length}). Maximum : ${maxRows}.`,
      'TOO_MANY_ROWS',
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < array.length; i += 1) {
    const item = array[i];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      rows.push(item as Record<string, unknown>);
    } else {
      throw new JsonParseError(`Entrée ${i} : objet attendu.`, 'INVALID_ROW');
    }
  }

  return { rows };
}
