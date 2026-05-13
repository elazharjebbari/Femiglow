import { describe, expect, it } from 'vitest';
import { SentinelPingInputSchema, ValidatePairInputSchema } from './sentinel-schemas';

describe('SentinelPingInputSchema', () => {
  const valid = {
    bundleId: 'a7c4f2e9b81d',
    mappingVersion: 'v17',
    configVersion: 'v4',
    containerId: 'GTM-ABCD',
    sentAt: '2026-05-13T19:32:01.234Z',
  };

  it('accepte un payload minimal valide', () => {
    const r = SentinelPingInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejette un bundleId mal formé', () => {
    const r = SentinelPingInputSchema.safeParse({ ...valid, bundleId: 'short' });
    expect(r.success).toBe(false);
  });

  it('rejette un containerId mal formé', () => {
    const r = SentinelPingInputSchema.safeParse({ ...valid, containerId: 'invalid' });
    expect(r.success).toBe(false);
  });

  it('rejette une date sans timezone', () => {
    const r = SentinelPingInputSchema.safeParse({ ...valid, sentAt: '2026-05-13' });
    expect(r.success).toBe(false);
  });

  it('rejette un champ extra (strict)', () => {
    const r = SentinelPingInputSchema.safeParse({ ...valid, extraField: 'oops' });
    expect(r.success).toBe(false);
  });

  it('accepte manifestMismatch optionnel', () => {
    const r = SentinelPingInputSchema.safeParse({ ...valid, manifestMismatch: true });
    expect(r.success).toBe(true);
  });

  it('default false pour manifestMismatch absent', () => {
    const r = SentinelPingInputSchema.parse(valid);
    expect(r.manifestMismatch).toBe(false);
  });
});

describe('ValidatePairInputSchema', () => {
  it('accepte 2 JSON arbitraires', () => {
    const r = ValidatePairInputSchema.safeParse({ configJson: {}, mappingJson: {} });
    expect(r.success).toBe(true);
  });

  it('rejette si manque mappingJson', () => {
    const r = ValidatePairInputSchema.safeParse({ configJson: {} });
    expect(r.success).toBe(false);
  });

  it('strict mode : rejette champ extra', () => {
    const r = ValidatePairInputSchema.safeParse({ configJson: {}, mappingJson: {}, extra: true });
    expect(r.success).toBe(false);
  });
});
