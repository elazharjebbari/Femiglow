/**
 * Lot L9 — table de vérité de `evaluateSuggestionPolicy` + tests négatifs.
 * Couvre INV-13 (off défaut), INV-14 (never prime), INV-16 (budget),
 * INV-17 (moment opportun / defer), INV-18 (profil custom).
 */
import { describe, expect, it } from 'vitest';

import { evaluateSuggestionPolicy } from './suggestion-policy';
import {
  type EngineConfig,
  type Profile,
  withSafeDefaults,
} from './suggestion-types';

const TRIGGER_ENTRY_MISMATCH: Profile = {
  id: 'TRIG-ENTRY-MISMATCH',
  kind: 'trigger',
  enabled: true,
  priority: 100,
  minConfidence: 0.6,
  opportuneRequired: true,
  conditions: [{ signal: 'guessedLocale', op: 'neq', value: 'fr' }],
};

const NEVER_DEEP_READ: Profile = {
  id: 'NEVER-DEEP-READ',
  kind: 'never',
  enabled: true,
  priority: 3,
  conditions: [{ signal: 'isDeepReading', op: 'truthy' }],
};

function config(overrides: Partial<EngineConfig> = {}): EngineConfig {
  return {
    engineEnabled: true,
    globalConfidenceFloor: 0.5,
    maxImpressionsPerVisitor: 1,
    profiles: [TRIGGER_ENTRY_MISMATCH, NEVER_DEEP_READ],
    ...overrides,
  };
}

/** Signaux « idéalement éligibles » : AR deviné sur page FR, au breakpoint. */
function eligibleSignals(over: Record<string, unknown> = {}) {
  return withSafeDefaults({
    servedLocale: 'fr',
    guessedLocale: 'ar',
    confidence: 0.9,
    inCheckout: false,
    formFocused: false,
    isDeepReading: false,
    modalOpen: false,
    videoPlaying: false,
    atBreakpoint: true,
    cooldownActive: false,
    impressionsThisVisitor: 0,
    dismissedPersistent: false,
    ...over,
  });
}

describe('INV-13 — off par défaut', () => {
  it('moteur off → suppress(engine-off)', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals(),
      config({ engineEnabled: false }),
    );
    expect(d).toMatchObject({ decision: 'suppress', reason: 'engine-off' });
  });
});

describe('INV-14 — zones calmes priment (même moteur off)', () => {
  it('checkout → NEVER-CHECKOUT, pas engine-off', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ inCheckout: true }),
      config({ engineEnabled: false }),
    );
    expect(d).toMatchObject({
      decision: 'suppress',
      reason: 'NEVER-CHECKOUT',
      neverProfile: 'NEVER-CHECKOUT',
    });
  });
  it('formulaire actif → NEVER-FORM', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ formFocused: true }),
      config(),
    );
    expect(d.reason).toBe('NEVER-FORM');
  });
  it('NEVER prime un trigger actif (deep-read)', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ isDeepReading: true }),
      config(),
    );
    expect(d).toMatchObject({ decision: 'suppress', reason: 'NEVER-DEEP-READ' });
  });
});

describe('INV-16 — budget / refus', () => {
  it('dismiss persistant → suppress', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ dismissedPersistent: true }),
      config(),
    );
    expect(d.reason).toBe('dismissed-persistent');
  });
  it('cap atteint → budget', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ impressionsThisVisitor: 1 }),
      config(),
    );
    expect(d.reason).toBe('budget');
  });
  it('cooldown actif → budget', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ cooldownActive: true }),
      config(),
    );
    expect(d.reason).toBe('budget');
  });
});

describe('pertinence', () => {
  it('même langue → same-locale', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ guessedLocale: 'fr' }),
      config(),
    );
    expect(d.reason).toBe('same-locale');
  });
  it('confiance < floor → low-confidence', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ confidence: 0.2 }),
      config(),
    );
    expect(d.reason).toBe('low-confidence');
  });
});

describe('INV-17 — moment opportun', () => {
  it('éligible mais pas de breakpoint → defer', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ atBreakpoint: false }),
      config(),
    );
    expect(d).toMatchObject({
      decision: 'defer',
      profileMatched: 'TRIG-ENTRY-MISMATCH',
      suggested: 'ar',
    });
  });
  it('au breakpoint → show', () => {
    const d = evaluateSuggestionPolicy(eligibleSignals(), config());
    expect(d).toMatchObject({
      decision: 'show',
      profileMatched: 'TRIG-ENTRY-MISMATCH',
      suggested: 'ar',
    });
  });
});

describe('aucun trigger', () => {
  it('aucun trigger activé → no-trigger', () => {
    const d = evaluateSuggestionPolicy(
      eligibleSignals(),
      config({ profiles: [{ ...TRIGGER_ENTRY_MISMATCH, enabled: false }] }),
    );
    expect(d.reason).toBe('no-trigger');
  });
});

describe('INV-18 — profil custom honoré', () => {
  it('un trigger custom (hover switcher) déclenche le show', () => {
    const custom: Profile = {
      id: 'TRIG-CUSTOM-HOVER',
      kind: 'trigger',
      enabled: true,
      priority: 130,
      minConfidence: 0.5,
      opportuneRequired: false,
      conditions: [{ signal: 'hoverSwitcher', op: 'truthy' }],
    };
    const d = evaluateSuggestionPolicy(
      eligibleSignals({ hoverSwitcher: true, atBreakpoint: false }),
      config({ profiles: [custom, NEVER_DEEP_READ] }),
    );
    expect(d).toMatchObject({
      decision: 'show',
      profileMatched: 'TRIG-CUSTOM-HOVER',
    });
  });
});

describe('fail-safe — signaux manquants', () => {
  it('signaux minimaux (défauts sûrs) → jamais show', () => {
    const minimal = withSafeDefaults({
      servedLocale: 'fr',
      guessedLocale: 'ar',
    });
    const d = evaluateSuggestionPolicy(minimal, config());
    // défauts conservateurs : inCheckout=true → suppress immédiat
    expect(d.decision).toBe('suppress');
  });
});
