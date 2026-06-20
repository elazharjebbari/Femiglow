/**
 * F05 — versionnage & normalisation du payload de campagne (G15).
 * Tolérance legacy + mapping nommé d'étapes + normalisation wizard_step.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_PAYLOAD_VERSION,
  WIZARD_STEP_KEYS,
  WIZARD_STEP_COUNT,
  stepNumber,
  stepKey,
  normalizeWizardStep,
  migratePayload,
} from '@/lib/mail/campaigns/campaign-payload';

describe('F05 — mapping nommé des étapes (évolutivité)', () => {
  it('F05-U-041 — 6 étapes ordonnées ; stepNumber/stepKey sont inverses', () => {
    expect(WIZARD_STEP_COUNT).toBe(6);
    expect(WIZARD_STEP_KEYS[0]).toBe('meta');
    expect(WIZARD_STEP_KEYS[5]).toBe('review');
    for (let n = 1; n <= WIZARD_STEP_COUNT; n++) {
      const key = stepKey(n)!;
      expect(stepNumber(key)).toBe(n);
    }
    expect(stepKey(0)).toBeNull();
    expect(stepKey(99)).toBeNull();
  });
});

describe('F05 — normalizeWizardStep (tolérance legacy/corruption)', () => {
  it('F05-U-042 — null/NaN/hors-borne → 1re étape ; valide → conservé', () => {
    expect(normalizeWizardStep(null)).toBe(1);
    expect(normalizeWizardStep(undefined)).toBe(1);
    expect(normalizeWizardStep(Number.NaN)).toBe(1);
    expect(normalizeWizardStep(0)).toBe(1);
    expect(normalizeWizardStep(-3)).toBe(1);
    expect(normalizeWizardStep(99)).toBe(WIZARD_STEP_COUNT);
    expect(normalizeWizardStep(3)).toBe(3);
    expect(normalizeWizardStep(3.9)).toBe(3); // tronqué
  });
});

describe('F05 — migratePayload (versionnage, sans perte)', () => {
  it('F05-U-043 — legacy sans _v → tagué version courante, champs préservés', () => {
    const legacy = { body: '<p>x</p>', listmonkTemplateId: 7, subject: 'Hello' };
    const migrated = migratePayload(legacy);
    expect(migrated._v).toBe(CAMPAIGN_PAYLOAD_VERSION);
    expect(migrated.body).toBe('<p>x</p>');
    expect(migrated.listmonkTemplateId).toBe(7);
    expect(migrated.subject).toBe('Hello');
  });

  it('F05-U-044 — null/undefined/non-objet → payload vide versionné (jamais de crash)', () => {
    expect(migratePayload(null)).toEqual({ _v: CAMPAIGN_PAYLOAD_VERSION });
    expect(migratePayload(undefined)).toEqual({ _v: CAMPAIGN_PAYLOAD_VERSION });
    expect(migratePayload('nope')).toEqual({ _v: CAMPAIGN_PAYLOAD_VERSION });
    expect(migratePayload([1, 2])).toEqual({ _v: CAMPAIGN_PAYLOAD_VERSION });
  });

  it('F05-U-045 — déjà à jour → idempotent (champs inconnus conservés, forward-compat)', () => {
    const current = { _v: CAMPAIGN_PAYLOAD_VERSION, body: 'x', futureField: { a: 1 } };
    const migrated = migratePayload(current);
    expect(migrated._v).toBe(CAMPAIGN_PAYLOAD_VERSION);
    expect(migrated.futureField).toEqual({ a: 1 });
  });
});
