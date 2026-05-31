import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // NB: `<T>` sans default — doit matcher la signature canonique vitest
  // (cf. node_modules/vitest/dist/index.d.ts:84 `interface Assertion<T>`).
  interface Assertion<T> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
