/**
 * Diff naïf line-by-line entre deux body_md (versions historiques d'une
 * page légale). Sortie : tableau de hunks JSON consommables côté UI.
 *
 * On évite une dépendance externe (jsdiff ~30kb) puisque le besoin est
 * purement visuel pour le drawer historique. L'algo est un LCS basique
 * (Hunt-McIlroy) suffisant pour des textes de pages légales (≤ 20kb).
 */
export type DiffOp = 'equal' | 'add' | 'remove';

export interface DiffLine {
  op: DiffOp;
  /** Numéro de ligne dans la version source (1-indexed) si op != 'add' */
  fromLine?: number;
  /** Numéro de ligne dans la version cible (1-indexed) si op != 'remove' */
  toLine?: number;
  text: string;
}

export interface DiffHunk {
  fromStart: number;
  toStart: number;
  lines: DiffLine[];
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }
  return dp;
}

export function diffLines(from: string, to: string): DiffLine[] {
  const a = from.split('\n');
  const b = to.split('\n');
  const dp = lcsTable(a, b);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: 'equal', fromLine: i + 1, toLine: j + 1, text: a[i]! });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ op: 'remove', fromLine: i + 1, text: a[i]! });
      i += 1;
    } else {
      out.push({ op: 'add', toLine: j + 1, text: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) {
    out.push({ op: 'remove', fromLine: i + 1, text: a[i]! });
    i += 1;
  }
  while (j < b.length) {
    out.push({ op: 'add', toLine: j + 1, text: b[j]! });
    j += 1;
  }
  return out;
}

/**
 * Regroupe les lignes en hunks autour des changements (3 lignes de
 * contexte avant/après).
 */
export function groupHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const changeIdx: number[] = [];
  for (let k = 0; k < lines.length; k += 1) {
    if (lines[k]!.op !== 'equal') changeIdx.push(k);
  }
  if (changeIdx.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let curStart = Math.max(0, changeIdx[0]! - context);
  let curEnd = Math.min(lines.length - 1, changeIdx[0]! + context);
  for (let n = 1; n < changeIdx.length; n += 1) {
    const idx = changeIdx[n]!;
    if (idx - curEnd <= context) {
      curEnd = Math.min(lines.length - 1, idx + context);
    } else {
      hunks.push(buildHunk(lines, curStart, curEnd));
      curStart = Math.max(0, idx - context);
      curEnd = Math.min(lines.length - 1, idx + context);
    }
  }
  hunks.push(buildHunk(lines, curStart, curEnd));
  return hunks;
}

function buildHunk(lines: DiffLine[], start: number, end: number): DiffHunk {
  const slice = lines.slice(start, end + 1);
  const first = slice[0]!;
  return {
    fromStart: first.fromLine ?? first.toLine ?? 1,
    toStart: first.toLine ?? first.fromLine ?? 1,
    lines: slice,
  };
}

export interface DiffSummary {
  added: number;
  removed: number;
  hunks: DiffHunk[];
}

export function diffBodies(from: string, to: string, context = 3): DiffSummary {
  const lines = diffLines(from, to);
  const added = lines.filter((l) => l.op === 'add').length;
  const removed = lines.filter((l) => l.op === 'remove').length;
  return { added, removed, hunks: groupHunks(lines, context) };
}
