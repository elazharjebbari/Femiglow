/**
 * Lot L11 — diff de config moteur (audit §5) : détecte toggle moteur, seuils,
 * et changements par profil ; tolère payloads inconnus (défauts OFF).
 */
import { describe, expect, it } from 'vitest';

import { diffEngineConfig } from './engine-config-diff';
import { DEFAULT_ENGINE_CONFIG } from './engine-config-schema';

function withEngineOn() {
  return { ...DEFAULT_ENGINE_CONFIG, engineEnabled: true };
}

describe('diffEngineConfig', () => {
  it('aucun changement → liste vide', () => {
    expect(
      diffEngineConfig(DEFAULT_ENGINE_CONFIG, DEFAULT_ENGINE_CONFIG),
    ).toEqual([]);
  });

  it('toggle moteur inactif → actif', () => {
    const changes = diffEngineConfig(DEFAULT_ENGINE_CONFIG, withEngineOn());
    expect(changes).toContainEqual({
      field: 'Moteur',
      before: 'inactif',
      after: 'actif',
    });
  });

  it('changement de seuil (impressions)', () => {
    const after = { ...DEFAULT_ENGINE_CONFIG, maxImpressionsPerVisitor: 3 };
    const changes = diffEngineConfig(DEFAULT_ENGINE_CONFIG, after);
    expect(changes).toContainEqual({
      field: 'Impressions max / visiteur',
      before: '1',
      after: '3',
    });
  });

  it('activation d’un trigger par profil', () => {
    const after = {
      ...DEFAULT_ENGINE_CONFIG,
      profiles: DEFAULT_ENGINE_CONFIG.profiles.map((p) =>
        p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
      ),
    };
    const changes = diffEngineConfig(DEFAULT_ENGINE_CONFIG, after);
    expect(changes).toContainEqual({
      field: 'TRIG-ENTRY-MISMATCH · état',
      before: 'désactivé',
      after: 'activé',
    });
  });

  it('payloads inconnus → défauts OFF des deux côtés, aucun changement', () => {
    expect(diffEngineConfig({ foo: 'bar' }, { baz: 1 })).toEqual([]);
  });

  it('before absent (1re publication) comparé aux défauts', () => {
    const changes = diffEngineConfig(undefined, withEngineOn());
    expect(changes).toContainEqual({
      field: 'Moteur',
      before: 'inactif',
      after: 'actif',
    });
  });
});
