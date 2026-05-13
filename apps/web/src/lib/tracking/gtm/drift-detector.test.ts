import { describe, expect, it } from 'vitest';
import { applyHysteresis, classifyDrift } from './drift-detector';
import type { AdminSnapshot, LastPing } from './drift-detector';

const admin: AdminSnapshot = {
  mappingVersion: 'v17',
  configVersion: 'v4',
  bundleId: 'a7c4f2e9b81d',
  containerId: 'GTM-ABCD',
};

const matchingPing = (): NonNullable<LastPing> => ({
  bundleId: 'a7c4f2e9b81d',
  mappingVersion: 'v17',
  configVersion: 'v4',
  containerId: 'GTM-ABCD',
  manifestMismatch: false,
  manifestMismatchDetails: null,
  receivedAt: new Date('2026-05-13T19:30:00.000Z'),
});

describe('classifyDrift — silence', () => {
  it('aucun ping, édit récent → ok', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 30 * 60_000),
      now: new Date(),
    });
    expect(r.status).toBe('ok');
  });

  it('aucun ping, édit > 6h → warning silence_excess', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 8 * 3_600_000),
      now: new Date(),
    });
    expect(r.status).toBe('warning');
    expect(r.reasons[0]!.code).toBe('silence_excess');
  });

  it('aucun ping, édit > 24h → critical silence_excess', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 48 * 3_600_000),
      now: new Date(),
    });
    expect(r.status).toBe('critical');
    expect(r.reasons[0]!.code).toBe('silence_excess');
  });
});

describe('classifyDrift — drifts', () => {
  it('ping cohérent → ok', () => {
    const r = classifyDrift({ admin, lastPing: matchingPing(), lastEditAt: null, now: new Date() });
    expect(r.status).toBe('ok');
    expect(r.reasons).toEqual([]);
  });

  it('mapping_version drift → critical', () => {
    const p = matchingPing();
    p.mappingVersion = 'v16';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.some((rr) => rr.code === 'mapping_version_drift')).toBe(true);
  });

  it('config_version drift → critical', () => {
    const p = matchingPing();
    p.configVersion = 'v3';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.some((rr) => rr.code === 'config_version_drift')).toBe(true);
  });

  it('container_id mismatch → critical', () => {
    const p = matchingPing();
    p.containerId = 'GTM-OTHER';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
  });

  it('bundle mismatch isolé → warning', () => {
    const p = matchingPing();
    p.bundleId = 'aaaaaaaaaaaa';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('warning');
    expect(r.reasons[0]!.code).toBe('bundle_mismatch');
  });

  it('manifest_mismatch flag → critical', () => {
    const p = matchingPing();
    p.manifestMismatch = true;
    p.manifestMismatchDetails = 'config=abc,mapping=def';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.some((rr) => rr.code === 'manifest_flag_mismatch')).toBe(true);
  });

  it('multiples drifts → critical avec plusieurs raisons', () => {
    const p = matchingPing();
    p.mappingVersion = 'v16';
    p.configVersion = 'v3';
    const r = classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('applyHysteresis', () => {
  it('garde le critical précédent si < 5 min et current ok', () => {
    const previous = { status: 'critical' as const, since: new Date(Date.now() - 60_000) };
    const current = { status: 'ok' as const, since: new Date(), reasons: [] };
    const r = applyHysteresis({ previous, current, now: new Date() });
    expect(r.status).toBe('critical');
  });

  it('autorise la transition vers ok après 5 min', () => {
    const previous = { status: 'critical' as const, since: new Date(Date.now() - 10 * 60_000) };
    const current = { status: 'ok' as const, since: new Date(), reasons: [] };
    const r = applyHysteresis({ previous, current, now: new Date() });
    expect(r.status).toBe('ok');
  });

  it('autorise toujours la transition vers critical', () => {
    const previous = { status: 'ok' as const, since: new Date(Date.now() - 1_000) };
    const current = { status: 'critical' as const, since: new Date(), reasons: [] };
    const r = applyHysteresis({ previous, current, now: new Date() });
    expect(r.status).toBe('critical');
  });
});
