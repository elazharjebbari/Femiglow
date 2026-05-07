/**
 * Diff utility — compare 2 field values pour la timeline P11.
 *
 * Deux modes :
 *   - `text` : ligne par ligne (LCS) pour les types text/multiline/rich-text.
 *     On rend les lignes ajoutées / supprimées / inchangées (préfixées
 *     visuellement côté UI).
 *   - `json` : récursif sur la structure (objets/arrays/scalaires) pour les
 *     types `cta`, `link`, `list`, `record`, `kicker`, `quote`,
 *     `breadcrumb-segment`. On retourne une liste de chemins modifiés
 *     `[{ path, before, after, op }]`.
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
import type { FieldType } from '@/lib/db/types';

/* ---------- TEXT DIFF (LCS-based, line granularity) -------------------- */

export type TextDiffOp = 'eq' | 'add' | 'del';

export interface TextDiffLine {
  op: TextDiffOp;
  /** Numéro de ligne « gauche » (avant). null si la ligne est « add ». */
  beforeNo: number | null;
  /** Numéro de ligne « droite » (après). null si la ligne est « del ». */
  afterNo: number | null;
  text: string;
}

function splitLines(s: string): string[] {
  // On normalise les EOL pour éviter les diffs spurieux entre \r\n et \n.
  return s.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Diff line-by-line via LCS classique. O(n*m) — borne raisonnable pour
 * du texte éditorial (≤ quelques centaines de lignes).
 *
 * Retourne une séquence d'ops `eq | add | del` permettant de rendre un
 * panneau side-by-side ou inline.
 */
export function textDiff(before: string, after: string): TextDiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const m = a.length;
  const n = b.length;

  // Table LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const out: TextDiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ op: 'eq', beforeNo: i, afterNo: j, text: a[i - 1]! });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push({ op: 'del', beforeNo: i, afterNo: null, text: a[i - 1]! });
      i--;
    } else {
      out.push({ op: 'add', beforeNo: null, afterNo: j, text: b[j - 1]! });
      j--;
    }
  }
  while (i > 0) {
    out.push({ op: 'del', beforeNo: i, afterNo: null, text: a[i - 1]! });
    i--;
  }
  while (j > 0) {
    out.push({ op: 'add', beforeNo: null, afterNo: j, text: b[j - 1]! });
    j--;
  }
  return out.reverse();
}

/* ---------- JSON DIFF (path-based) ------------------------------------- */

export type JsonDiffOp = 'add' | 'del' | 'change';

export interface JsonDiffEntry {
  op: JsonDiffOp;
  path: string; // ex. "items[0].label"
  before: unknown;
  after: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function joinPath(parent: string, child: string | number): string {
  if (typeof child === 'number') return `${parent}[${child}]`;
  if (parent === '') return child;
  return `${parent}.${child}`;
}

export function jsonDiff(
  before: unknown,
  after: unknown,
  path = '',
  out: JsonDiffEntry[] = [],
): JsonDiffEntry[] {
  if (deepEqual(before, after)) return out;

  // Cas terminal : un des deux est scalaire / tableau vs objet, ou
  // simplement deux scalaires différents.
  const bothObj = isPlainObject(before) && isPlainObject(after);
  const bothArr = Array.isArray(before) && Array.isArray(after);

  if (!bothObj && !bothArr) {
    out.push({ op: 'change', path: path || '$', before, after });
    return out;
  }

  if (bothArr) {
    const a = before as unknown[];
    const b = after as unknown[];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (i >= a.length) {
        out.push({ op: 'add', path: joinPath(path, i), before: undefined, after: b[i] });
      } else if (i >= b.length) {
        out.push({ op: 'del', path: joinPath(path, i), before: a[i], after: undefined });
      } else if (!deepEqual(a[i], b[i])) {
        jsonDiff(a[i], b[i], joinPath(path, i), out);
      }
    }
    return out;
  }

  // Both objects.
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  for (const k of keys) {
    const inA = k in a;
    const inB = k in b;
    if (inA && !inB) {
      out.push({ op: 'del', path: joinPath(path, k), before: a[k], after: undefined });
    } else if (!inA && inB) {
      out.push({ op: 'add', path: joinPath(path, k), before: undefined, after: b[k] });
    } else if (!deepEqual(a[k], b[k])) {
      jsonDiff(a[k], b[k], joinPath(path, k), out);
    }
  }
  return out;
}

/* ---------- Mode resolver ---------------------------------------------- */

export type DiffMode = 'text' | 'json';

const TEXT_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'text',
  'multiline',
  'rich-text',
  'kicker',
  'quote',
]);

export function diffModeFor(type: FieldType): DiffMode {
  return TEXT_TYPES.has(type) ? 'text' : 'json';
}

/**
 * Convertit une valeur potentiellement non-string en string lisible pour
 * `textDiff` (les types `kicker` / `quote` peuvent être des objets {value, …}).
 */
export function valueToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isPlainObject(value)) {
    // Forme `{ value: '…' }` (kicker) ou `{ text: '…' }` (quote).
    if (typeof value.value === 'string') return value.value;
    if (typeof value.text === 'string') return value.text;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
