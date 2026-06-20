/**
 * F05 — schéma Zod de saveWizardProgress (U-034/035). Pur, sans DB.
 */
import { describe, expect, it } from 'vitest';
import { saveWizardProgressInput } from '@/lib/admin/emails/campaigns-shared';

describe('F05 — saveWizardProgressInput (Zod)', () => {
  it('F05-U-034 — wizardStep borné 1..6 (0 et 7 rejetés)', () => {
    for (const ok of [1, 2, 3, 4, 5, 6]) {
      expect(saveWizardProgressInput.safeParse({ id: 'c1', wizardStep: ok }).success, `step ${ok}`).toBe(true);
    }
    for (const ko of [0, 7, -1, 1.5]) {
      expect(saveWizardProgressInput.safeParse({ id: 'c1', wizardStep: ko }).success, `step ${ko}`).toBe(false);
    }
  });

  it('F05-U-035 — name 3..120 caractères (hors bornes rejeté)', () => {
    expect(saveWizardProgressInput.safeParse({ id: 'c1', name: 'abc' }).success).toBe(true);
    expect(saveWizardProgressInput.safeParse({ id: 'c1', name: 'a'.repeat(120) }).success).toBe(true);
    expect(saveWizardProgressInput.safeParse({ id: 'c1', name: 'ab' }).success).toBe(false);
    expect(saveWizardProgressInput.safeParse({ id: 'c1', name: 'a'.repeat(121) }).success).toBe(false);
  });

  it('patch partiel : tous les champs optionnels sauf id (U-033 — contrat)', () => {
    expect(saveWizardProgressInput.safeParse({ id: 'c1' }).success).toBe(true);
    expect(saveWizardProgressInput.safeParse({}).success).toBe(false); // id requis
  });

  it('expectedRev (optimistic-lock) : entier ≥ 0', () => {
    expect(saveWizardProgressInput.safeParse({ id: 'c1', expectedRev: 0 }).success).toBe(true);
    expect(saveWizardProgressInput.safeParse({ id: 'c1', expectedRev: -1 }).success).toBe(false);
  });
});
