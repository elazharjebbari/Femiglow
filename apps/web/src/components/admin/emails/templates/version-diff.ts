/**
 * Diff de lignes (LCS) entre deux sources de template (F07 P3.4-j, Lot 6) — PUR.
 *
 * Sans dépendance (la lib `diff` n'est que transitive → fragile). LCS borné
 * ligne-à-ligne : suffisant pour des sources HTML d'e-mail, déterministe et
 * testable. Produit des lignes typées (context/add/remove) pour un rendu à
 * gouttière +/- côté composant.
 */
export type DiffRow = { type: 'context' | 'add' | 'remove'; text: string };

export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const m = a.length;
  const n = b.length;

  // Table LCS (longueurs), remplie depuis la fin.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({ type: 'context', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      rows.push({ type: 'remove', text: a[i]! });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j]! });
      j++;
    }
  }
  while (i < m) rows.push({ type: 'remove', text: a[i++]! });
  while (j < n) rows.push({ type: 'add', text: b[j++]! });
  return rows;
}

/** Compteurs +/- pour l'en-tête du diff. */
export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === 'add') added++;
    else if (r.type === 'remove') removed++;
  }
  return { added, removed };
}
