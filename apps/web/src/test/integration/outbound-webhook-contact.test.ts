/**
 * CHA-260 — Tests d'intégration MSW pour le webhook outbound `contact`.
 *
 * Vérifie le phone-gate STRICT :
 *   - phone absent → status='skipped', AUCUN POST.
 *   - phone invalide → status='skipped', AUCUN POST.
 *   - phone valide → status='sent', payload PLAT, event=contact.submitted.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/contact' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'contact-secret-16chars+' as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: undefined as string | undefined,
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { dispatchContactWebhook } from '@/lib/webhooks/outbound/sources/from-contact';
import { resetMemoryStore } from '@/lib/db/client';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  resetMemoryStore();
});
afterAll(() => server.close());

describe('dispatchContactWebhook — phone-gate', () => {
  it('skip si phone absent (aucun POST)', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/contact', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );

    const r = await dispatchContactWebhook({
      type: 'question',
      name: 'Test User',
      email: 't@example.com',
      message: 'Bonjour, question test',
    });
    expect(r.status).toBe('skipped');
    expect(r.lastError).toContain('invalid-phone:empty');
    expect(calls).toBe(0);
  });

  it('skip si phone invalide (aucun POST)', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/contact', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );

    const r = await dispatchContactWebhook({
      type: 'question',
      name: 'Test User',
      email: 't@example.com',
      phone: 'not-a-phone',
      message: 'Bonjour, question test',
    });
    expect(r.status).toBe('skipped');
    expect(r.lastError).toContain('invalid-phone:invalid');
    expect(calls).toBe(0);
  });
});

describe('dispatchContactWebhook — phone valide', () => {
  it('envoie payload PLAT + event=contact.submitted', async () => {
    const captured: { body?: string; event?: string | null; source?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/contact', async ({ request }) => {
        captured.body = await request.text();
        captured.event = request.headers.get('x-femiglow-event');
        captured.source = request.headers.get('x-femiglow-source');
        return HttpResponse.json({ ok: true });
      }),
    );

    const r = await dispatchContactWebhook({
      type: 'professional',
      name: 'Aïcha Pro',
      email: 'aicha@pro.com',
      phone: '+212661234567',
      companyName: 'AcmeMed',
      role: 'CEO',
      message: 'Souhaite un devis pour 200 packs.',
      ip: '197.1.2.3',
    });
    expect(r.status).toBe('sent');
    expect(captured.event).toBe('contact.submitted');
    expect(captured.source).toBe('contact');

    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.full_name).toBe('Aïcha Pro');
    expect(payload.phone).toBe('0661234567');
    expect(payload.email).toBe('aicha@pro.com');
    expect(payload.source_channel).toBe('contact-form:professional');
    expect((payload.note as string)).toContain('company:AcmeMed');
    expect((payload.note as string)).toContain('role:CEO');
    expect(payload.ip).toBe('197.1.2.3');
    expect(payload.currency).toBe('MAD');
    expect(payload.quantity).toBe(1);
  });
});
