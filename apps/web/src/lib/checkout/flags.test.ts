import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOptimisticWizardClientEnabled } from './flags';

const ORIG = process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED;
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED;
  else process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = ORIG;
});

describe('isOptimisticWizardClientEnabled (OWBS, TST-U-00)', () => {
  it('défaut OFF (variable absente)', () => {
    expect(isOptimisticWizardClientEnabled()).toBe(false);
  });
  it('OFF si "false"', () => {
    process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'false';
    expect(isOptimisticWizardClientEnabled()).toBe(false);
  });
  it('ON si "true"', () => {
    process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
    expect(isOptimisticWizardClientEnabled()).toBe(true);
  });
});
