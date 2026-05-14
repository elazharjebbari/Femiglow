/**
 * Step path utilities — addresses a step within the nested AutomationStep tree.
 *
 * Path examples :
 *   [5]                                 → top-level step #5
 *   [3, 'ifTrue', 0]                    → branch #3 → ifTrue branch → sub-step #0
 *   [3, 'ifFalse', 2, 'ifTrue', 1]      → nested branch (depth 2)
 *
 * The runner uses this to navigate steps including arbitrary branch nesting,
 * without flattening the tree eagerly (which would prevent late condition
 * evaluation).
 */
import type { AutomationStep } from '../step-types-v2';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

export type StepPath = Array<number | 'ifTrue' | 'ifFalse'>;

const MAX_PATH_DEPTH = 12; // limite raisonnable (4 branches imbriquées max)

export function isValidPath(path: unknown): path is StepPath {
  if (!Array.isArray(path)) return false;
  if (path.length > MAX_PATH_DEPTH) return false;
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (typeof seg === 'number') {
      if (!Number.isInteger(seg) || seg < 0) return false;
    } else if (seg === 'ifTrue' || seg === 'ifFalse') {
      // branch segment must be preceded by a number
      if (i === 0 || typeof path[i - 1] !== 'number') return false;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Resolves the step at `path` in `steps`. Returns null if the path is invalid
 * or points past the end.
 */
export function getStepAtPath(
  steps: AutomationStep[],
  path: StepPath,
): AutomationStep | null {
  let currentList: AutomationStep[] = steps;
  let resolved: AutomationStep | null = null;

  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (typeof seg === 'number') {
      if (seg < 0 || seg >= currentList.length) return null;
      resolved = currentList[seg]!;
    } else {
      // 'ifTrue' / 'ifFalse'
      if (!resolved || resolved.kind !== 'branch') return null;
      currentList = seg === 'ifTrue' ? resolved.ifTrue : resolved.ifFalse;
      resolved = null;
    }
  }
  return resolved;
}

/**
 * Computes the next path after the step at `path` completes.
 * Returns null if exhausted (entire flow done).
 *
 * The logic :
 *  - Increment the last numeric segment
 *  - If that goes past the end of its containing list :
 *    - If we are in a branch's sub-list → pop the branch (ifTrue/ifFalse) + numeric segment, and try to advance the parent
 *    - Else → done
 */
export function nextPath(
  steps: AutomationStep[],
  path: StepPath,
): StepPath | null {
  let cur: StepPath = [...path];

  while (cur.length > 0) {
    const lastIdx = cur[cur.length - 1];
    if (typeof lastIdx !== 'number') {
      // Shouldn't happen — path always ends in a number
      return null;
    }
    // Replace last numeric with +1
    const candidate: StepPath = [...cur.slice(0, -1), lastIdx + 1];
    if (getStepAtPath(steps, candidate) !== null) return candidate;

    // Past end of current list → pop number + branch segment to parent's frame
    cur = cur.slice(0, -1); // drop the number
    if (cur.length > 0 && typeof cur[cur.length - 1] === 'string') {
      cur = cur.slice(0, -1); // drop the branch segment ('ifTrue'/'ifFalse')
    } else {
      // No parent branch frame → flow done
      return null;
    }
  }
  return null;
}

/**
 * Descends into branches by evaluating conditions, returning the executable
 * step path (where the step is NOT a branch).
 *
 * `condEvaluator` is called for each branch encountered; it must return a
 * boolean indicating which side to take.
 *
 * Returns null if descent overflows or hits an empty branch.
 */
export async function descendToExecutable(
  steps: AutomationStep[],
  startPath: StepPath,
  condEvaluator: (condition: RulesGroup) => Promise<boolean>,
): Promise<StepPath | null> {
  let path: StepPath = [...startPath];
  for (let safety = 0; safety < MAX_PATH_DEPTH; safety++) {
    const step = getStepAtPath(steps, path);
    if (!step) return null;
    if (step.kind !== 'branch') return path;
    // Evaluate condition + descend
    const goTrue = await condEvaluator(step.condition as RulesGroup);
    const subList = goTrue ? step.ifTrue : step.ifFalse;
    if (subList.length === 0) {
      // empty side → skip to next path past this branch
      const np = nextPath(steps, path);
      if (!np) return null;
      path = np;
      continue;
    }
    path = [...path, goTrue ? 'ifTrue' : 'ifFalse', 0];
  }
  return null;
}
