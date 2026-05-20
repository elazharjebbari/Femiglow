import type { TrackingPlan } from './types';

export interface ChangeEntry {
  path: string;
  before: unknown;
  after: unknown;
  kind: 'added' | 'removed' | 'changed';
}

export interface ChangeSet {
  changes: ChangeEntry[];
  hasBreakingChange: boolean;
}

const BREAKING_PATHS = [/^providers\.\d+\.active$/, /^envProfiles\.\d+\.config\.\w+Id$/];

export function diffPlans(planA: TrackingPlan, planB: TrackingPlan): ChangeSet {
  const changes: ChangeEntry[] = [];
  collectDiff('', planA as unknown, planB as unknown, changes);
  const filtered = changes.filter((c) => !c.path.startsWith('updatedAt') && !c.path.startsWith('createdAt') && !c.path.startsWith('version'));
  const hasBreakingChange = filtered.some((c) => BREAKING_PATHS.some((re) => re.test(c.path)));
  return { changes: filtered, hasBreakingChange };
}

function collectDiff(path: string, a: unknown, b: unknown, out: ChangeEntry[]): void {
  if (a === b) return;
  if (a === null || a === undefined) {
    out.push({ path, before: a, after: b, kind: 'added' });
    return;
  }
  if (b === null || b === undefined) {
    out.push({ path, before: a, after: b, kind: 'removed' });
    return;
  }
  if (typeof a !== typeof b) {
    out.push({ path, before: a, after: b, kind: 'changed' });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      collectDiff(path ? `${path}.${i}` : String(i), a[i], b[i], out);
    }
    return;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const subA = (a as Record<string, unknown>)[key];
      const subB = (b as Record<string, unknown>)[key];
      collectDiff(path ? `${path}.${key}` : key, subA, subB, out);
    }
    return;
  }
  out.push({ path, before: a, after: b, kind: 'changed' });
}
