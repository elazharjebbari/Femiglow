import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { submitRitual } from './submit-service';
import { generateEmailToken } from './email-tokens';
import { hashCustomerEmail } from './customer-hash';

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.RITUAL_EMAIL_SECRET = 'test-secret-32chars-aaaaaaaaaaaaa';
  process.env.RITUAL_PEPPER = 'test-pepper';
  resetMemoryStore();
});

afterEach(() => {
  resetMemoryStore();
  delete process.env.RITUAL_EMAIL_SECRET;
  delete process.env.RITUAL_PEPPER;
});

describe('submitRitual', () => {
  const baseInput = {
    productKey: 'pack-femiglow',
    body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
    wouldRecommend: 'oui' as const,
    ritualTags: [] as never[],
    authorFirstName: null,
    authorCity: null,
    initiatedSince: null,
    isAnonymous: false,
    language: 'fr' as const,
    photos: [],
    emailToken: null,
    consentMarketing: false,
  } satisfies Parameters<typeof submitRitual>[0];

  it('insère un témoignage en PENDING', async () => {
    const result = await submitRitual(baseInput);
    expect(result.status).toBe('PENDING');
    expect(result.publicSlug).toMatch(/^[a-z0-9]{8}$/);
  });

  it('sanitization du body avec emoji → flag', async () => {
    const result = await submitRitual({
      ...baseInput,
      body: 'Wow 😊 ' + 'a'.repeat(50),
    });
    const store = memoryStore();
    const ritual = Array.from(store.ritualTestimonials.values()).find(
      (r) => r.publicSlug === result.publicSlug,
    );
    expect(ritual?.body).not.toContain('😊');
    expect(ritual?.autoFlags).toContain('emoji_detected');
  });

  it('auto-flag link_external détecté', async () => {
    const result = await submitRitual({
      ...baseInput,
      body: 'Visitez https://exemple.com pour plus ' + 'a'.repeat(40),
    });
    const ritual = Array.from(memoryStore().ritualTestimonials.values()).find(
      (r) => r.publicSlug === result.publicSlug,
    );
    expect(ritual?.autoFlags).toContain('link_external');
  });

  it('email token valide → verifiedPurchase + source email_j45', async () => {
    const customerHash = hashCustomerEmail('amal@example.com');
    const token = generateEmailToken({
      orderId: 'order-test',
      customerHash,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400 * 1000,
    });
    const result = await submitRitual({ ...baseInput, emailToken: token });
    const ritual = Array.from(memoryStore().ritualTestimonials.values()).find(
      (r) => r.publicSlug === result.publicSlug,
    );
    expect(ritual?.source).toBe('email_j45');
    expect(ritual?.verifiedPurchase).toBe(true);
    expect(ritual?.customerHash).toBe(customerHash);
  });

  it('email token invalide → source web, non-verified', async () => {
    const result = await submitRitual({
      ...baseInput,
      emailToken: 'invalid-token',
    });
    const ritual = Array.from(memoryStore().ritualTestimonials.values()).find(
      (r) => r.publicSlug === result.publicSlug,
    );
    expect(ritual?.source).toBe('web');
    expect(ritual?.verifiedPurchase).toBe(false);
  });

  it('audit log écrit avec action created', async () => {
    await submitRitual(baseInput);
    const store = memoryStore();
    const events = Array.from(store.ritualAuditLog.values());
    expect(events.some((e) => e.action === 'created')).toBe(true);
  });
});
