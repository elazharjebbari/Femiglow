import { describe, expect, it } from 'vitest';
import { validatePair } from './pair-validator';
import { makeConfigFixture, makeMappingFixture, BUNDLE_ID } from '@/test/fixtures/gtm-poka-yoke/fixtures';

describe('pair-validator — fuzz inputs malformés', () => {
  const malformedInputs = [
    { configJson: null, mappingJson: null, expect: 'invalid_config_json' },
    { configJson: undefined, mappingJson: {}, expect: 'invalid_config_json' },
    { configJson: 42, mappingJson: {}, expect: 'invalid_config_json' },
    { configJson: 'string', mappingJson: {}, expect: 'invalid_config_json' },
    { configJson: [], mappingJson: {}, expect: 'invalid_config_json' },
    { configJson: true, mappingJson: {}, expect: 'invalid_config_json' },
    { configJson: {}, mappingJson: null, expect: 'invalid_mapping_json' },
    { configJson: {}, mappingJson: 'oops', expect: 'invalid_mapping_json' },
    { configJson: {}, mappingJson: [1, 2], expect: 'invalid_mapping_json' },
  ];

  it.each(malformedInputs)(
    'rejette ($expect) sur input mal formé #%#',
    ({ configJson, mappingJson, expect: expectedCode }) => {
      const r = validatePair({ configJson, mappingJson });
      expect(r.ok).toBe(false);
      expect(r.errors[0]!.code).toBe(expectedCode);
    },
  );

  it('ne crash pas sur une structure profondément imbriquée', () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 50; i++) {
      const next = {};
      (cur as Record<string, unknown>).inner = next;
      cur = next as Record<string, unknown>;
    }
    expect(() => validatePair({ configJson: deep, mappingJson: {} })).not.toThrow();
  });

  it('ne crash pas sur un tableau circulaire-like (sans JSON.stringify crash)', () => {
    const map: Record<string, unknown> = { manifest: { schemaVersion: 'fg-mapping/2.0' }, mappings: {} };
    for (let i = 0; i < 1000; i++) (map.mappings as Record<string, unknown>)[`e${i}`] = { meta: { eventName: `E${i}` } };
    expect(() => validatePair({ configJson: makeConfigFixture(), mappingJson: map })).not.toThrow();
  });
});

describe('pair-validator — fixtures réalistes', () => {
  it('accepte le bundle canonique', () => {
    const r = validatePair({
      configJson: makeConfigFixture(),
      mappingJson: makeMappingFixture(),
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.bundleId.match).toBe(true);
    expect(r.bundleId.config).toBe(BUNDLE_ID);
  });

  it('détecte event_orphan_in_config si config a un event absent du mapping', () => {
    const config = makeConfigFixture();
    config.containerVersion.trigger!.push({
      name: 'event orphan_event',
      parameter: [{ key: 'eventName', value: 'orphan_event' }],
    });
    const r = validatePair({ configJson: config, mappingJson: makeMappingFixture() });
    expect(r.warnings.some((w) => w.code === 'event_orphan_in_config')).toBe(true);
  });

  it('détecte event_not_covered_by_config si mapping a un event absent de config', () => {
    const r = validatePair({
      configJson: makeConfigFixture(),
      mappingJson: makeMappingFixture({ extraEvents: ['ghost_event'] }),
    });
    expect(r.warnings.some((w) => w.code === 'event_not_covered_by_config')).toBe(true);
  });

  it('accepte schema version v3 (futur)', () => {
    const mapping = makeMappingFixture();
    mapping.manifest.schemaVersion = 'fg-mapping/3.0';
    // Nouveau bundleId car schemaVersion change... non, computeBundleId n'utilise pas schemaVersion
    const r = validatePair({ configJson: makeConfigFixture(), mappingJson: mapping });
    expect(r.errors.find((e) => e.code === 'invalid_schema_version')).toBeUndefined();
  });

  it('detecte requiredConfigVersion v10 > v4', () => {
    const mapping = makeMappingFixture({ requiredConfigVersion: 'v10' });
    // Re-attach même bundleId — ce qui n'est pas réaliste mais permet de tester R-006 isolément
    mapping.manifest.bundleId = BUNDLE_ID;
    const r = validatePair({ configJson: makeConfigFixture(), mappingJson: mapping });
    expect(r.errors.some((e) => e.code === 'config_too_old')).toBe(true);
  });
});

describe('pair-validator — comparateur de versions', () => {
  it.each([
    ['v1', 'v2', true],
    ['v2', 'v1', false],
    ['v10', 'v2', false], // v10 ≥ v2
    ['v1.5', 'v1.10', true],
    ['v1.10', 'v1.5', false],
    ['v1', 'v1', false],
  ])('config %s < required %s ⇒ erreur attendue: %s', (configV, requiredV, shouldError) => {
    const config = makeConfigFixture({ configVersion: configV });
    const mapping = makeMappingFixture({ requiredConfigVersion: requiredV });
    mapping.manifest.bundleId = BUNDLE_ID;
    const configVar = config.containerVersion.variable.find((v) => v.name === 'FG Config Version')!;
    configVar.parameter[0]!.value = configV;
    const r = validatePair({ configJson: config, mappingJson: mapping });
    const hasErr = r.errors.some((e) => e.code === 'config_too_old');
    expect(hasErr).toBe(shouldError);
  });
});

describe('pair-validator — bundleId edge cases', () => {
  it('warning si config a bundleId mais mapping non', () => {
    const mapping = makeMappingFixture();
    (mapping.manifest as { bundleId?: string }).bundleId = undefined;
    const r = validatePair({ configJson: makeConfigFixture(), mappingJson: mapping });
    expect(r.warnings.some((w) => w.code === 'mapping_bundle_id_missing')).toBe(true);
  });

  it('warning si mapping a bundleId mais config non', () => {
    const config = makeConfigFixture();
    config.containerVersion.variable = config.containerVersion.variable.filter((v) => v.name !== 'FG Bundle Id');
    const r = validatePair({ configJson: config, mappingJson: makeMappingFixture() });
    expect(r.warnings.some((w) => w.code === 'config_bundle_id_missing')).toBe(true);
  });

  it('bundleId mal formé côté config = ignoré (pas un bundleId valide)', () => {
    const config = makeConfigFixture({ bundleId: 'INVALID' });
    const r = validatePair({ configJson: config, mappingJson: makeMappingFixture() });
    expect(r.bundleId.config).toBeNull();
  });
});

describe('pair-validator — recommendations', () => {
  it('quand OK : recommendations standards (4-5 étapes)', () => {
    const r = validatePair({
      configJson: makeConfigFixture(),
      mappingJson: makeMappingFixture(),
    });
    expect(r.recommendations.length).toBeGreaterThanOrEqual(4);
    expect(r.recommendations[0]!.action).toMatch(/Importer la config/);
    expect(r.recommendations[1]!.action).toMatch(/Importer le mapping/);
  });

  it('quand OK avec warnings : ajoute une recommandation de surveillance', () => {
    const mapping = makeMappingFixture({ extraEvents: ['ghost_event'] });
    const r = validatePair({ configJson: makeConfigFixture(), mappingJson: mapping });
    expect(r.recommendations.some((rec) => rec.action.match(/Surveiller/))).toBe(true);
  });

  it('quand erreurs : seulement "Corriger les erreurs"', () => {
    const r = validatePair({ configJson: 'invalid' as unknown, mappingJson: {} });
    expect(r.recommendations.length).toBe(1);
    expect(r.recommendations[0]!.action).toMatch(/Corriger/);
  });
});

describe('pair-validator — performance', () => {
  it('valide une paire avec 500 events en < 500ms', () => {
    const mapping = makeMappingFixture();
    for (let i = 0; i < 500; i++) {
      (mapping.mappings as Record<string, unknown>)[`event_${i}`] = { meta: { eventName: `Event${i}` } };
    }
    const t = performance.now();
    const r = validatePair({ configJson: makeConfigFixture(), mappingJson: mapping });
    const elapsed = performance.now() - t;
    expect(elapsed).toBeLessThan(500);
    expect(r).toBeDefined();
  });

  it('output est sérialisable JSON (pas de circular)', () => {
    const r = validatePair({
      configJson: makeConfigFixture(),
      mappingJson: makeMappingFixture({ extraEvents: ['ghost'] }),
    });
    expect(() => JSON.stringify(r)).not.toThrow();
  });
});

describe('pair-validator — snapshot stable', () => {
  it('produit le même résultat sur 2 appels avec même input', () => {
    const c = makeConfigFixture();
    const m = makeMappingFixture();
    const r1 = validatePair({ configJson: c, mappingJson: m });
    const r2 = validatePair({ configJson: c, mappingJson: m });
    expect(r1).toEqual(r2);
  });
});
