import { axe as runAxe, type RunOptions } from 'jest-axe';
import { expect } from 'vitest';

export async function expectNoAxeViolations(
  element: Element | Document,
  options?: RunOptions,
) {
  const results = await runAxe(element, options);
  if (results.violations.length > 0) {
    const detail = results.violations
      .map((v) => `[${v.impact}] ${v.id} (${v.nodes.length}) — ${v.help}`)
      .join('\n');
    throw new Error(`axe violations:\n${detail}`);
  }
  expect(results.violations).toHaveLength(0);
}
