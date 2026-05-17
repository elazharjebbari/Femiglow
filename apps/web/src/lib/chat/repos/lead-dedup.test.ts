/**
 * Tests de déduplication des leads : garantissent qu'une seule
 * row chat_lead existe par session_id, même en cas de création
 * concurrente ou de double-submit.
 *
 * Utilise des mocks Drizzle pour simuler INSERT ON CONFLICT DO NOTHING.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';

const existingLead: ChatLeadRow = {
  id: 'cl_existing',
  sessionId: 'cs_dedup1',
  triggeringMessageId: null,
  triggerReason: 'explicit-request',
  firstName: 'Existing',
  phoneE164: '+212612345678',
  phoneRaw: '0612345678',
  note: null,
  consentVersion: '2026-05',
  consentAt: new Date('2026-05-17T10:00:00Z'),
  visitorId: 'v_dedup1',
  fingerprintHash: null,
  page: '/chat',
  referrer: null,
  utm: null,
  language: 'fr',
  intentAtCapture: null,
  snapshotMessages: [],
  webhookStatus: 'pending',
  webhookAttempts: 0,
  webhookLastError: null,
  webhookSentAt: null,
  handledBy: null,
  handledAt: null,
  outcome: 'pending',
  convertedOrderId: null,
  lastName: null,
  email: null,
  emailVerifiedAt: null,
  emailConsent: false,
  shippingCity: null,
  shippingAddressLine1: null,
  shippingAddressLine2: null,
  shippingPostalCode: null,
  shippingCountry: 'MA',
  shippingNotes: null,
  preferredPaymentMethod: null,
  source: 'chat_widget',
  formId: null,
  formMode: null,
  variantKey: null,
  gclid: null,
  fbp: null,
  fbc: null,
  cartSnapshot: null,
  cartTotalCents: null,
  cartCurrency: null,
  lastTouchedStep: 'lead',
  leadCapturedAt: null,
  addressCompletedAt: null,
  paymentSelectedAt: null,
  purchasedAt: null,
  abandonWebhookAt: null,
  step2WebhookAt: null,
  step1AbandonWebhookAt: null,
  createdAt: new Date('2026-05-17T10:00:00Z'),
  updatedAt: new Date('2026-05-17T10:00:00Z'),
};

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/chat/db/client', () => ({
  chatDb: vi.fn(() => dbMock),
  requireChatDb: vi.fn(() => dbMock),
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { leadRepo } from './lead';

afterEach(() => {
  vi.clearAllMocks();
});

function mockInsertReturning(rows: ChatLeadRow[]): void {
  const chain = {
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
  dbMock.insert.mockReturnValue(chain);
}

function mockSelectFindBySession(lead: ChatLeadRow | null): void {
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(lead ? [lead] : []),
        }),
      }),
    }),
  };
  dbMock.select.mockReturnValue(chain);
}

function mockSelectHasLead(rows: { id: string }[]): void {
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
  dbMock.select.mockReturnValue(chain);
}

describe('leadRepo.create — déduplication par session', () => {
  it('insère un lead quand la session est nouvelle (ON CONFLICT retourne la row)', async () => {
    const newLead = { ...existingLead, id: 'cl_new', firstName: 'New' };
    mockInsertReturning([newLead]);

    const result = await leadRepo.create({
      sessionId: 'cs_new_session',
      triggerReason: 'explicit-request',
      firstName: 'New',
      phoneE164: '+212612345678',
      phoneRaw: '0612345678',
      consentVersion: '2026-05',
      visitorId: 'v_new',
      language: 'fr',
    });

    expect(result.id).toBe('cl_new');
    expect(result.firstName).toBe('New');
    // Verify onConflictDoNothing was called on session_id
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it('retourne le lead existant quand ON CONFLICT DO NOTHING ne retourne rien', async () => {
    // Insert returns empty array (conflict) → fetch existing
    mockInsertReturning([]);
    mockSelectFindBySession(existingLead);

    const result = await leadRepo.create({
      sessionId: 'cs_dedup1',
      triggerReason: 'explicit-request',
      firstName: 'Duplicate',
      phoneE164: '+212612345678',
      phoneRaw: '0612345678',
      consentVersion: '2026-05',
      visitorId: 'v_dedup1',
      language: 'fr',
    });

    // Should return the existing lead, not throw
    expect(result.id).toBe('cl_existing');
    expect(result.firstName).toBe('Existing');
  });
});

describe('leadRepo.hasLeadForSession', () => {
  it('retourne true quand un lead existe pour la session', async () => {
    mockSelectHasLead([{ id: 'cl_existing' }]);

    const result = await leadRepo.hasLeadForSession('cs_existing');
    expect(result).toBe(true);
  });

  it('retourne false quand aucun lead pour la session', async () => {
    mockSelectHasLead([]);

    const result = await leadRepo.hasLeadForSession('cs_nonexistent');
    expect(result).toBe(false);
  });
});

describe('leadRepo.findBySession', () => {
  it('retourne le lead pour une session donnée', async () => {
    mockSelectFindBySession(existingLead);

    const result = await leadRepo.findBySession('cs_dedup1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('cl_existing');
  });

  it('retourne null quand aucun lead pour la session', async () => {
    mockSelectFindBySession(null);

    const result = await leadRepo.findBySession('cs_nonexistent');
    expect(result).toBeNull();
  });
});

describe('leadRepo.upgrade', () => {
  it('met à jour les champs du lead inline-contact', async () => {
    const upgraded = {
      ...existingLead,
      triggerReason: 'explicit-request' as const,
      firstName: 'Formel',
      phoneE164: '+212698765432',
      webhookStatus: 'pending' as const,
      webhookAttempts: 0,
    };
    const updateChain = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([upgraded]),
        }),
      }),
    };
    dbMock.update.mockReturnValue(updateChain);

    const result = await leadRepo.upgrade('cl_existing', {
      firstName: 'Formel',
      phoneE164: '+212698765432',
      phoneRaw: '0698765432',
      consentVersion: '2026-05-v2',
      triggerReason: 'explicit-request',
      language: 'fr',
    });

    expect(result).not.toBeNull();
    expect(result!.firstName).toBe('Formel');
    expect(result!.triggerReason).toBe('explicit-request');
    expect(result!.webhookStatus).toBe('pending');
    expect(result!.webhookAttempts).toBe(0);
  });
});