/**
 * Lot L10 — schéma de config moteur : parse valide, fail-safe OFF (INV-13),
 * bornes (INV-16), clés strictes, priorités uniques. Inclut un test négatif
 * par garde clé.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ENGINE_CONFIG,
  engineConfigSchema,
  safeParseEngineConfig,
} from './engine-config-schema';
import { evaluateSuggestionPolicy } from './suggestion-policy';
import { withSafeDefaults } from './suggestion-types';

describe('DEFAULT_ENGINE_CONFIG', () => {
  it('moteur OFF par défaut (INV-13)', () => {
    expect(DEFAULT_ENGINE_CONFIG.engineEnabled).toBe(false);
  });

  it('tous les triggers sont désactivés par défaut (INV-13)', () => {
    const triggers = DEFAULT_ENGINE_CONFIG.profiles.filter(
      (p) => p.kind === 'trigger',
    );
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers.every((t) => t.enabled === false)).toBe(true);
  });

  it('les never-profiles comportementaux sont actifs', () => {
    const never = DEFAULT_ENGINE_CONFIG.profiles.filter(
      (p) => p.kind === 'never',
    );
    expect(never.every((n) => n.enabled === true)).toBe(true);
  });

  it('round-trip : parse(defaults) === defaults', () => {
    const parsed = engineConfigSchema.parse(DEFAULT_ENGINE_CONFIG);
    expect(parsed).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('est consommable par evaluateSuggestionPolicy (compat L9)', () => {
    const signals = withSafeDefaults({ servedLocale: 'fr', guessedLocale: 'ar' });
    // Défauts conservateurs → suppress immédiat (inCheckout=true).
    const d = evaluateSuggestionPolicy(signals, DEFAULT_ENGINE_CONFIG);
    expect(d.decision).toBe('suppress');
  });
});

describe('safeParseEngineConfig — fail-safe (INV-13)', () => {
  it('payload absent/null → défauts OFF', () => {
    expect(safeParseEngineConfig(null).engineEnabled).toBe(false);
    expect(safeParseEngineConfig(undefined)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('schemaVersion inconnue → défauts OFF', () => {
    const bad = { ...DEFAULT_ENGINE_CONFIG, schemaVersion: 2 };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('clé inconnue (strict) → défauts OFF', () => {
    const bad = { ...DEFAULT_ENGINE_CONFIG, foo: 'bar' };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('globalConfidenceFloor hors borne → défauts OFF', () => {
    const bad = { ...DEFAULT_ENGINE_CONFIG, globalConfidenceFloor: 1.5 };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('maxImpressionsPerVisitor négatif → défauts OFF (INV-16)', () => {
    const bad = { ...DEFAULT_ENGINE_CONFIG, maxImpressionsPerVisitor: -1 };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('signal de condition inexistant → défauts OFF', () => {
    const bad = {
      ...DEFAULT_ENGINE_CONFIG,
      profiles: [
        {
          id: 'TRIG-X',
          kind: 'trigger',
          enabled: false,
          priority: 200,
          conditions: [{ signal: 'foo', op: 'truthy' }],
        },
      ],
    };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('priorités dupliquées → défauts OFF', () => {
    const dup = {
      ...DEFAULT_ENGINE_CONFIG,
      profiles: [
        { id: 'A', kind: 'never', enabled: true, priority: 1, conditions: [] },
        { id: 'B', kind: 'never', enabled: true, priority: 1, conditions: [] },
      ],
    };
    expect(safeParseEngineConfig(dup)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('trigger activé sans surface → rejeté (défauts OFF)', () => {
    const bad = {
      ...DEFAULT_ENGINE_CONFIG,
      profiles: [
        {
          id: 'TRIG-NO-SURFACE',
          kind: 'trigger',
          enabled: true,
          priority: 200,
          conditions: [],
          minConfidence: 0.6,
        },
      ],
    };
    expect(safeParseEngineConfig(bad)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('payload valide moteur ON → conservé', () => {
    const on = { ...DEFAULT_ENGINE_CONFIG, engineEnabled: true };
    const parsed = safeParseEngineConfig(on);
    expect(parsed.engineEnabled).toBe(true);
  });
});
