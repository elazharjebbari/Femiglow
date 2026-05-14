import { describe, expect, it } from 'vitest';
import { validatePair } from './pair-validator';
import { computeBundleId } from './bundle-id';

function makeValidPair() {
  const bundleId = computeBundleId({
    mappingVersion: 'v17',
    configVersion: 'v4',
    containerId: 'GTM-ABCD',
    events: [
      { name: 'purchase', resolvedNames: { meta: 'Purchase', google_ga4: 'purchase' } },
    ],
    generatedAt: '2026-05-13T19:30:00.000Z',
  });

  const config = {
    containerVersion: {
      container: { publicId: 'GTM-ABCD' },
      variable: [
        {
          name: 'FG Bundle Id',
          type: 'c',
          parameter: [{ type: 'TEMPLATE', key: 'value', value: bundleId }],
        },
        {
          name: 'FG Config Version',
          type: 'c',
          parameter: [{ type: 'TEMPLATE', key: 'value', value: 'v4' }],
        },
      ],
      trigger: [
        {
          name: 'event purchase',
          parameter: [{ key: 'eventName', value: 'purchase' }],
        },
      ],
    },
  };

  const mapping = {
    manifest: {
      schemaVersion: 'fg-mapping/2.0',
      bundleId,
      mappingVersion: 'v17',
      requiredConfigVersion: 'v4',
      containerId: 'GTM-ABCD',
      generatedAt: '2026-05-13T19:30:00.000Z',
    },
    mappings: {
      purchase: { meta: { eventName: 'Purchase' } },
    },
  };

  return { config, mapping, bundleId };
}

describe('validatePair — happy path', () => {
  it('valide une paire cohérente sans erreurs', () => {
    const { config, mapping } = makeValidPair();
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.bundleId.match).toBe(true);
  });

  it('génère les 4 recommandations standard quand OK', () => {
    const { config, mapping } = makeValidPair();
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.recommendations.length).toBeGreaterThanOrEqual(4);
    expect(r.recommendations[0]!.action).toMatch(/Importer la config/);
  });
});

describe('validatePair — R-001 bundle mismatch', () => {
  it('détecte un bundleId différent entre config et mapping', () => {
    const { config, mapping } = makeValidPair();
    (mapping.manifest as { bundleId: string }).bundleId = 'aaaaaaaaaaaa';
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === 'bundle_mismatch')).toBe(true);
    expect(r.bundleId.match).toBe(false);
  });
});

describe('validatePair — R-002 schema version', () => {
  it('rejette un schema version inconnu', () => {
    const { config, mapping } = makeValidPair();
    (mapping.manifest as { schemaVersion: string }).schemaVersion = 'fg-mapping/99.9.invalid';
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.errors.some((e) => e.code === 'invalid_schema_version')).toBe(true);
  });
});

describe('validatePair — R-003 container id mismatch', () => {
  it('détecte des container id différents', () => {
    const { config, mapping } = makeValidPair();
    (mapping.manifest as { containerId: string }).containerId = 'GTM-OTHER';
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.errors.some((e) => e.code === 'container_id_mismatch')).toBe(true);
  });
});

describe('validatePair — R-005 missing variable', () => {
  it('détecte une variable référencée mais absente', () => {
    const { config, mapping } = makeValidPair();
    (mapping.mappings as Record<string, unknown>).foo = { ref: '{{FG Locale}}' };
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.errors.some((e) => e.code === 'missing_variable' && e.message.includes('FG Locale'))).toBe(true);
  });
});

describe('validatePair — R-006 required config version', () => {
  it('détecte une config trop ancienne', () => {
    const { config, mapping } = makeValidPair();
    (mapping.manifest as { requiredConfigVersion: string }).requiredConfigVersion = 'v5';
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.errors.some((e) => e.code === 'config_too_old')).toBe(true);
  });

  it('accepte une config plus récente', () => {
    const { config, mapping } = makeValidPair();
    const configVar = (config.containerVersion.variable as Array<{ name: string; parameter: Array<{ key: string; value: string }> }>).find((v) => v.name === 'FG Config Version');
    if (configVar) configVar.parameter[0]!.value = 'v6';
    (mapping.manifest as { requiredConfigVersion: string }).requiredConfigVersion = 'v4';
    const r = validatePair({ configJson: config, mappingJson: mapping });
    expect(r.errors.find((e) => e.code === 'config_too_old')).toBeUndefined();
  });
});

describe('validatePair — R-009 JSON invalide', () => {
  it('rejette une config non-objet', () => {
    const r = validatePair({ configJson: 'not json', mappingJson: {} });
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.code).toBe('invalid_config_json');
  });

  it('rejette un mapping non-objet', () => {
    const r = validatePair({ configJson: {}, mappingJson: null });
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.code).toBe('invalid_mapping_json');
  });
});

describe('validatePair — performance', () => {
  it('valide une paire en moins de 200ms', () => {
    const { config, mapping } = makeValidPair();
    // gonfler le mapping
    const m = mapping.mappings as Record<string, unknown>;
    for (let i = 0; i < 100; i++) m[`event_${i}`] = { meta: { eventName: `Event${i}` } };
    const t = performance.now();
    validatePair({ configJson: config, mappingJson: mapping });
    expect(performance.now() - t).toBeLessThan(200);
  });
});
