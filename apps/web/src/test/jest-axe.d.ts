declare module 'jest-axe' {
  import type { Result, RunOptions } from 'axe-core';
  export interface AxeResults {
    violations: Result[];
    passes: Result[];
    incomplete: Result[];
    inapplicable: Result[];
  }
  export function axe(
    element: Element | Document,
    options?: RunOptions,
  ): Promise<AxeResults>;
  export const toHaveNoViolations: unknown;
  export type { RunOptions };
}
