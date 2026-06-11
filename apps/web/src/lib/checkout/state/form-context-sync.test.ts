import { describe, expect, it } from 'vitest';

import { shouldSyncFormContext } from './form-context-sync';
import type { WizardFormContext } from './wizard-store';

const base: WizardFormContext = {
  formId: 'wizard_kit',
  formMode: 'wizard_embed',
  variantKey: 'A',
  source: 'wizard_kit',
  language: 'fr',
};

describe('shouldSyncFormContext', () => {
  it('synchronise quand le store est vide', () => {
    expect(shouldSyncFormContext(null, base)).toBe(true);
  });

  it('ne resynchronise pas un contexte identique', () => {
    expect(shouldSyncFormContext({ ...base }, { ...base })).toBe(false);
  });

  it('REGRESSION — un store persisté en fr est écrasé quand la route est ar', () => {
    const storedFr: WizardFormContext = { ...base, language: 'fr' };
    const incomingAr: WizardFormContext = { ...base, language: 'ar' };
    expect(shouldSyncFormContext(storedFr, incomingAr)).toBe(true);
  });

  it('détecte un changement de langue seul (fr → en)', () => {
    expect(
      shouldSyncFormContext({ ...base, language: 'fr' }, { ...base, language: 'en' }),
    ).toBe(true);
  });

  it('détecte un changement de formId / formMode / variantKey', () => {
    expect(shouldSyncFormContext(base, { ...base, formId: 'wizard_commander' })).toBe(
      true,
    );
    expect(shouldSyncFormContext(base, { ...base, formMode: 'wizard_cart' })).toBe(
      true,
    );
    expect(shouldSyncFormContext(base, { ...base, variantKey: 'B' })).toBe(true);
  });
});
