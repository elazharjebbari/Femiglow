import { describe, expect, it } from 'vitest';
import { applyHysteresis, classifyDrift } from './drift-detector';
import type { AdminSnapshot, DriftClassification, LastPing } from './drift-detector';

const admin: AdminSnapshot = {
  mappingVersion: 'v17',
  configVersion: 'v4',
  bundleId: 'a7c4f2e9b81d',
  containerId: 'GTM-ABCD',
};

function mkPing(overrides: Partial<NonNullable<LastPing>> = {}): NonNullable<LastPing> {
  return {
    bundleId: 'a7c4f2e9b81d',
    mappingVersion: 'v17',
    configVersion: 'v4',
    containerId: 'GTM-ABCD',
    manifestMismatch: false,
    manifestMismatchDetails: null,
    receivedAt: new Date('2026-05-13T19:30:00.000Z'),
    ...overrides,
  };
}

describe('classifyDrift — idempotence', () => {
  it('100 appels avec même input → même output', () => {
    const input = { admin, lastPing: mkPing(), lastEditAt: null, now: new Date() };
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(JSON.stringify(classifyDrift(input)));
    }
    expect(seen.size).toBe(1);
  });
});

describe('classifyDrift — séquence de pings', () => {
  function chain(pings: Array<NonNullable<LastPing>>): DriftClassification[] {
    return pings.map((p) => classifyDrift({ admin, lastPing: p, lastEditAt: null, now: new Date() }));
  }

  it('séquence ok→ok→ok → 3 statuts ok', () => {
    const results = chain([mkPing(), mkPing(), mkPing()]);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
  });

  it('séquence ok→critical→ok → 1 critical au milieu', () => {
    const results = chain([
      mkPing(),
      mkPing({ mappingVersion: 'v16' }),
      mkPing(),
    ]);
    expect(results.map((r) => r.status)).toEqual(['ok', 'critical', 'ok']);
  });

  it('multi-drifts cumulés ne se chevauchent pas (reasons distinctes)', () => {
    const ping = mkPing({ mappingVersion: 'v16', configVersion: 'v3', containerId: 'GTM-OTHER' });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    const codes = r.reasons.map((rr) => rr.code).sort();
    expect(codes).toEqual(['config_version_drift', 'container_id_mismatch', 'mapping_version_drift']);
  });
});

describe('classifyDrift — seuils configurables', () => {
  it('respecte des seuils custom', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 2 * 3_600_000),
      now: new Date(),
      thresholds: { silenceWarningHours: 1, silenceCriticalHours: 3 },
    });
    expect(r.status).toBe('warning');
  });

  it('seuils 1h/3h : critical à 4h', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 4 * 3_600_000),
      now: new Date(),
      thresholds: { silenceWarningHours: 1, silenceCriticalHours: 3 },
    });
    expect(r.status).toBe('critical');
  });

  it('avec seuil critical à 0 : critical immédiat même édit récent (test cas extreme)', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() - 60_000),
      now: new Date(),
      thresholds: { silenceWarningHours: 0, silenceCriticalHours: 0 },
    });
    expect(r.status).toBe('critical');
  });
});

describe('classifyDrift — bundle_mismatch isolé', () => {
  it('warning uniquement si bundleId diffère mais reste cohérent par ailleurs', () => {
    const ping = mkPing({ bundleId: 'aaaaaaaaaaaa' });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('warning');
    expect(r.reasons[0]!.code).toBe('bundle_mismatch');
  });

  it('non remonté si autre drift critical présent (escalade)', () => {
    const ping = mkPing({ bundleId: 'aaaaaaaaaaaa', mappingVersion: 'v16' });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.map((rr) => rr.code)).toContain('mapping_version_drift');
    expect(r.reasons.find((rr) => rr.code === 'bundle_mismatch')).toBeUndefined();
  });
});

describe('classifyDrift — manifest_mismatch (couche C)', () => {
  it('manifest_mismatch=true seul → critical', () => {
    const ping = mkPing({ manifestMismatch: true, manifestMismatchDetails: 'config=undefined,mapping=abc' });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('critical');
    expect(r.reasons.some((rr) => rr.code === 'manifest_flag_mismatch')).toBe(true);
  });

  it('manifest_mismatch=true sans details → reason avec details=unknown', () => {
    const ping = mkPing({ manifestMismatch: true });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    const m = r.reasons.find((rr) => rr.code === 'manifest_flag_mismatch');
    expect(m && 'details' in m ? m.details : undefined).toBe('unknown');
  });

  it('manifest_mismatch=false n\'est pas remonté', () => {
    const ping = mkPing({ manifestMismatch: false });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    expect(r.reasons.find((rr) => rr.code === 'manifest_flag_mismatch')).toBeUndefined();
  });
});

describe('applyHysteresis — séquences complexes', () => {
  it('flapping rapide ok-critical-ok-critical → maintient critical', () => {
    let state: { status: 'ok' | 'warning' | 'critical'; since: Date } = { status: 'ok', since: new Date() };
    const sequence: Array<'ok' | 'critical'> = ['critical', 'ok', 'critical', 'ok'];
    for (const next of sequence) {
      const result = applyHysteresis({
        previous: state,
        current: { status: next, since: new Date(), reasons: [] },
        now: new Date(),
        minStableMinutes: 5,
      });
      state = { status: result.status, since: result.since };
    }
    // Critical autorisé toujours ; ok bloqué par hystérésis → state final = critical
    expect(state.status).toBe('critical');
  });

  it('transition warning → ok refusée si récente, autorisée après délai', () => {
    const now = new Date();
    const previousRecent = { status: 'warning' as const, since: new Date(now.getTime() - 60_000) };
    const previousOld = { status: 'warning' as const, since: new Date(now.getTime() - 10 * 60_000) };
    const current = { status: 'ok' as const, since: now, reasons: [] };

    expect(applyHysteresis({ previous: previousRecent, current, now }).status).toBe('warning');
    expect(applyHysteresis({ previous: previousOld, current, now }).status).toBe('ok');
  });

  it('preserve since si la valeur précédente est gardée', () => {
    const now = new Date();
    const previous = { status: 'critical' as const, since: new Date(now.getTime() - 60_000) };
    const current = { status: 'ok' as const, since: now, reasons: [] };
    const r = applyHysteresis({ previous, current, now });
    expect(r.since.getTime()).toBe(previous.since.getTime());
  });

  it('pas de previous → renvoie current directement', () => {
    const current = { status: 'critical' as const, since: new Date(), reasons: [{ code: 'silence_excess' as const, lastPingAt: null, thresholdHours: 24 }] };
    const r = applyHysteresis({ previous: null, current, now: new Date() });
    expect(r).toEqual(current);
  });

  it('même statut prev=current → renvoie current', () => {
    const previous = { status: 'critical' as const, since: new Date(Date.now() - 60_000) };
    const current = { status: 'critical' as const, since: new Date(), reasons: [] };
    const r = applyHysteresis({ previous, current, now: new Date() });
    expect(r.status).toBe('critical');
  });
});

describe('classifyDrift — robustesse temporelle', () => {
  it('ping reçu dans le futur (clock skew) → toujours classifiable', () => {
    const ping = mkPing({ receivedAt: new Date(Date.now() + 60_000) });
    expect(() => classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() })).not.toThrow();
  });

  it('ping reçu il y a 10 ans → toujours classifiable', () => {
    const ping = mkPing({ receivedAt: new Date('2016-01-01') });
    const r = classifyDrift({ admin, lastPing: ping, lastEditAt: null, now: new Date() });
    expect(r.status).toBe('ok'); // versions cohérentes
  });

  it('lastEditAt dans le futur → traité comme 0h écoulées', () => {
    const r = classifyDrift({
      admin,
      lastPing: null,
      lastEditAt: new Date(Date.now() + 3_600_000),
      now: new Date(),
    });
    expect(r.status).toBe('ok');
  });
});

describe('classifyDrift — comportement de la sortie', () => {
  it('reasons est toujours un tableau (jamais undefined)', () => {
    const r = classifyDrift({ admin, lastPing: mkPing(), lastEditAt: null, now: new Date() });
    expect(Array.isArray(r.reasons)).toBe(true);
  });

  it('since est toujours une Date', () => {
    const r = classifyDrift({ admin, lastPing: mkPing(), lastEditAt: null, now: new Date() });
    expect(r.since).toBeInstanceOf(Date);
  });

  it('sortie est sérialisable JSON', () => {
    const r = classifyDrift({
      admin,
      lastPing: mkPing({ mappingVersion: 'v16' }),
      lastEditAt: null,
      now: new Date(),
    });
    expect(() => JSON.stringify(r)).not.toThrow();
  });
});
