import { beforeEach, describe, expect, it, vi } from 'vitest';

// Env mutable (le service lit env.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED).
const { envMock, repoMock, sessionMock } = vi.hoisted(() => ({
  envMock: { CHECKOUT_OPTIMISTIC_WIZARD_ENABLED: 'false' as 'true' | 'false' },
  repoMock: {
    getById: vi.fn(),
    upsertWizardLead: vi.fn(),
    createWizardLead: vi.fn(),
  },
  sessionMock: { ensureForWizard: vi.fn() },
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/checkout/repos/lead-repo', () => ({ wizardLeadRepo: repoMock }));
vi.mock('@/lib/checkout/repos/session-repo', () => ({ wizardSessionRepo: sessionMock }));

import { leadService, LeadVisitorMismatchError } from './lead-service';
import type { CreateLeadInput } from '@/lib/checkout/schemas/lead';

const LEAD_ID = 'cl_3xq7m2k9v4b1n8p0w5tz';

function makeInput(over: Partial<CreateLeadInput> = {}): CreateLeadInput {
  return {
    formContext: { formId: 'wizard_kit', formMode: 'wizard_cart', source: 'wizard_kit' },
    firstName: 'Salma',
    phone: '600000000',
    consent: true,
    consentVersion: '2025-11-01',
    visitorId: 'vis_test_0001',
    sessionId: 'cs_test_00001',
    language: 'fr',
    ...over,
  } as CreateLeadInput;
}

beforeEach(() => {
  envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'false';
  repoMock.getById.mockReset();
  repoMock.upsertWizardLead.mockReset();
  repoMock.createWizardLead.mockReset();
  sessionMock.ensureForWizard.mockReset().mockResolvedValue(undefined);
});

describe('leadService.applyLeadCreate (OWBS P1)', () => {
  // TST-R-OFF — parité legacy : flag OFF → createWizardLead, jamais upsert.
  it('flag OFF → chemin legacy (createWizardLead, id serveur)', async () => {
    repoMock.createWizardLead.mockResolvedValue({ id: 'cl_serverGenerated00000' });
    const res = await leadService.applyLeadCreate(makeInput({ leadId: LEAD_ID }));
    expect(repoMock.createWizardLead).toHaveBeenCalledOnce();
    expect(repoMock.upsertWizardLead).not.toHaveBeenCalled();
    expect(res).toEqual({ leadId: 'cl_serverGenerated00000', upserted: false });
    expect(sessionMock.ensureForWizard).toHaveBeenCalledOnce();
  });

  it('flag ON mais SANS leadId → legacy (createWizardLead)', async () => {
    envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
    repoMock.createWizardLead.mockResolvedValue({ id: 'cl_serverGenerated00000' });
    const res = await leadService.applyLeadCreate(makeInput());
    expect(repoMock.createWizardLead).toHaveBeenCalledOnce();
    expect(repoMock.upsertWizardLead).not.toHaveBeenCalled();
    expect(res.upserted).toBe(false);
  });

  // TST-U-03 — chemin optimiste : flag ON + leadId → upsert idempotent.
  it('flag ON + leadId → upsert-by-leadId', async () => {
    envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
    repoMock.getById.mockResolvedValue(null);
    repoMock.upsertWizardLead.mockResolvedValue({ id: LEAD_ID });
    const res = await leadService.applyLeadCreate(makeInput({ leadId: LEAD_ID }));
    expect(repoMock.upsertWizardLead).toHaveBeenCalledWith(LEAD_ID, expect.objectContaining({ visitorId: 'vis_test_0001' }));
    expect(repoMock.createWizardLead).not.toHaveBeenCalled();
    expect(res).toEqual({ leadId: LEAD_ID, upserted: true });
  });

  // TST-I-04 (au niveau service) — anti-collision inter-visiteurs.
  it('flag ON + leadId déjà associé à un AUTRE visiteur → rejet', async () => {
    envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
    repoMock.getById.mockResolvedValue({ id: LEAD_ID, visitorId: 'vis_AUTRE' });
    await expect(
      leadService.applyLeadCreate(makeInput({ leadId: LEAD_ID })),
    ).rejects.toBeInstanceOf(LeadVisitorMismatchError);
    expect(repoMock.upsertWizardLead).not.toHaveBeenCalled();
  });

  it('flag ON + leadId du MÊME visiteur (réentrée) → upsert autorisé', async () => {
    envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
    repoMock.getById.mockResolvedValue({ id: LEAD_ID, visitorId: 'vis_test_0001' });
    repoMock.upsertWizardLead.mockResolvedValue({ id: LEAD_ID });
    const res = await leadService.applyLeadCreate(makeInput({ leadId: LEAD_ID }));
    expect(res.upserted).toBe(true);
  });
});
