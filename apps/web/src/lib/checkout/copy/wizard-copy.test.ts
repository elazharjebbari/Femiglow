/**
 * Tests du module wizard-copy — résolution copy + feature flags.
 */
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_WIZARD_COPY,
  DEFAULT_WIZARD_FEATURES,
  resolveWizardCopy,
  resolveWizardFeatures,
} from './wizard-copy';

describe('resolveWizardCopy', () => {
  it('retourne defaults si override absent', () => {
    expect(resolveWizardCopy(undefined)).toEqual(DEFAULT_WIZARD_COPY);
    expect(resolveWizardCopy(null)).toEqual(DEFAULT_WIZARD_COPY);
  });

  it('merge partiel : seuls les champs override sont appliqués', () => {
    const r = resolveWizardCopy({ ctaLead: 'Custom' });
    expect(r.ctaLead).toBe('Custom');
    expect(r.ctaAddress).toBe(DEFAULT_WIZARD_COPY.ctaAddress);
  });

  it('ignore les champs override vides', () => {
    const r = resolveWizardCopy({ ctaLead: '' });
    expect(r.ctaLead).toBe(DEFAULT_WIZARD_COPY.ctaLead);
  });

  it('expose 11 champs dans defaults', () => {
    expect(Object.keys(DEFAULT_WIZARD_COPY)).toHaveLength(11);
  });
});

describe('resolveWizardFeatures', () => {
  it('retourne defaults si override absent', () => {
    expect(resolveWizardFeatures(undefined)).toEqual(DEFAULT_WIZARD_FEATURES);
    expect(resolveWizardFeatures(null)).toEqual(DEFAULT_WIZARD_FEATURES);
  });

  it('merge : un flag à false override le défaut', () => {
    const r = resolveWizardFeatures({ resumeBanner: false });
    expect(r.resumeBanner).toBe(false);
    expect(r.cartRecap).toBe(true);
  });

  it('tous les defaults sont true', () => {
    for (const value of Object.values(DEFAULT_WIZARD_FEATURES)) {
      expect(value).toBe(true);
    }
  });
});
