import { describe, expect, it } from 'vitest';
import { createLeadInputSchema } from './lead';

/**
 * OWBS — TST-U-02 : le schéma de création accepte un leadId client valide,
 * rejette un leadId malformé, et reste valide sans leadId (back-compat legacy).
 */
const base = {
  formContext: { formId: 'wizard_kit', formMode: 'wizard_cart', source: 'wizard_kit' },
  firstName: 'Salma',
  phone: '600000000',
  consent: true as const,
  consentVersion: '2025-11-01',
  visitorId: 'vis_test_0001',
  sessionId: 'cs_test_00001',
  language: 'fr' as const,
};

describe('createLeadInputSchema — leadId client (OWBS)', () => {
  it('accepte un leadId bien formé', () => {
    const r = createLeadInputSchema.safeParse({ ...base, leadId: 'cl_3xq7m2k9v4b1n8p0w5tz' });
    expect(r.success).toBe(true);
  });

  it('reste valide SANS leadId (legacy : id généré serveur)', () => {
    const r = createLeadInputSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('rejette un leadId malformé', () => {
    for (const bad of ['cl_SHORT', 'cl_UPPER0000000000000000', 'xx_3xq7m2k9v4b1n8p0w5tz', 'cl-3xq7m2k9v4b1n8p0w5tz']) {
      const r = createLeadInputSchema.safeParse({ ...base, leadId: bad });
      expect(r.success, `devrait rejeter: ${bad}`).toBe(false);
    }
  });
});
