/**
 * Phase 0 — Validation smoke du harnais de tests.
 *
 * Ce test valide que toute la pipeline Phase 0 fonctionne :
 *  ✓ Factories chat retournent des objets valides
 *  ✓ Custom matchers chat enregistrés et opérationnels
 *  ✓ MSW server lifecycle OK
 *  ✓ Faker est seeded (reproductibilité)
 *  ✓ Helper makeChatSseStream produit le bon format
 *
 * Si CE TEST PASSE : le harnais est utilisable pour Phase 1.
 * Référence : `docs/chat-test-strategy-2026-05/04-execution-plan/01-phase-1-foundation-setup.md`
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { faker } from '@faker-js/faker';
import {
  chatSessionFactory,
  chatMessageFactory,
  chatLeadFactory,
  chatInstructionFactory,
  chatProviderFactory,
  maPhone,
  maFirstName,
} from '@/test/factories';
import { server, http, HttpResponse, makeChatSseStream } from '@/test/msw/server';

// Lifecycle MSW par-fichier (le setup global est un no-op, cf. msw.setup.ts).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Phase 0 — Harnais validation', () => {
  describe('Factories chat', () => {
    it('chatSessionFactory produces valid session with required fields', () => {
      const s = chatSessionFactory.build();
      expect(s.id).toMatch(/^cs_/);
      expect(s.visitorId).toMatch(/^vis_/);
      expect(s.language).toBe('fr');
      expect(s.status).toBe('open');
      expect(s.consent).toEqual({ essential: true, analytics: true, marketing: false });
    });

    it('chatSessionFactory.darija() sets language to ar-MA', () => {
      const s = chatSessionFactory.darija();
      expect(s.language).toBe('ar-MA');
    });

    it('chatSessionFactory.converted() populates converted fields', () => {
      const s = chatSessionFactory.converted();
      expect(s.convertedAt).toBeInstanceOf(Date);
      expect(s.convertedOrderId).toMatch(/^ord_/);
      expect(s.status).toBe('archived');
    });

    it('chatMessageFactory.userMsg + assistantMsg have distinct ordinal/role', () => {
      const session = chatSessionFactory.build();
      const u = chatMessageFactory.userMsg(session.id, 'Bonjour', { ordinal: 1 });
      const a = chatMessageFactory.assistantMsg(session.id, 'Bonjour visiteur', { ordinal: 2 });
      expect(u.role).toBe('user');
      expect(a.role).toBe('assistant');
      expect(a.providerKind).toBe('openai');
      expect(a.tokensIn).toBeGreaterThan(0);
    });

    it('chatLeadFactory uses MA-aligned data', () => {
      const l = chatLeadFactory.build();
      expect(l.phoneInternal).toMatch(/^0[67]\d{8}$/);
      expect(l.phoneE164).toMatch(/^\+212[67]\d{8}$/);
      expect(l.firstName.length).toBeGreaterThan(2);
      expect(l.outcome).toBe('pending');
    });

    it('chatProviderFactory.anthropic() sets right kind + model', () => {
      const p = chatProviderFactory.anthropic();
      expect(p.kind).toBe('anthropic');
      expect(p.model).toMatch(/claude/i);
    });

    it('chatInstructionFactory.enabled() has all 3 languages', () => {
      const i = chatInstructionFactory.enabled();
      expect(i.enabled).toBe(true);
      expect(i.body).toBeTruthy();
      expect(i.bodyAr).toBeTruthy();
      expect(i.bodyArMa).toBeTruthy();
    });

    it('factories produce distinct IDs on consecutive builds', () => {
      const a = chatSessionFactory.build();
      const b = chatSessionFactory.build();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('Faker seeded determinism', () => {
    it('maFirstName returns same first call across seeds', () => {
      faker.seed(42);
      const first = maFirstName();
      faker.seed(42);
      const second = maFirstName();
      expect(first).toBe(second);
    });

    it('maPhone matches MA mobile format', () => {
      const p = maPhone();
      expect(p).toMatch(/^0[67]\d{8}$/);
    });
  });

  describe('MSW server lifecycle', () => {
    it('intercepts HTTP via server.use(...)', async () => {
      server.use(
        http.get('https://example.com/test', () => HttpResponse.json({ ok: true })),
      );
      const r = await fetch('https://example.com/test');
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe('makeChatSseStream helper', () => {
    it('produces valid SSE format with event + data', async () => {
      const stream = makeChatSseStream([
        { event: 'start', data: { messageId: 'm1' } },
        { event: 'chunk', data: { text: 'Hello' } },
        { event: 'end', data: { messageId: 'm1', usage: { tokensIn: 5, tokensOut: 1 } } },
      ]);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value);
      }
      expect(acc).toContain('event: start');
      expect(acc).toContain('event: chunk');
      expect(acc).toContain('event: end');
      expect(acc).toContain('"text":"Hello"');
    });
  });

  describe('Custom matchers chat', () => {
    it('toBeFromLanguage works on session', () => {
      const s = chatSessionFactory.darija();
      expect(s).toBeFromLanguage('ar-MA');
      expect(s).not.toBeFromLanguage('fr');
    });

    it('toRespectBudget works on latency number', () => {
      expect(500).toRespectBudget('first-chunk');
      expect(2000).not.toRespectBudget('first-chunk');
    });

    it('toBeRedacted works on string', () => {
      expect('Mon [téléphone] est masqué').toBeRedacted('phone');
      expect('Mon [email] est masqué').toBeRedacted('email');
      expect('Mon [iban] est masqué').toBeRedacted('iban');
      expect('clear text').not.toBeRedacted('phone');
    });

    it('toBeStreamedEventOf works on event object or raw SSE string', () => {
      expect({ event: 'chunk', data: { text: 'a' } }).toBeStreamedEventOf('chunk');
      expect('event: end\ndata: {}\n\n').toBeStreamedEventOf('end');
    });

    it('toMatchIntent works on message', () => {
      const msg = chatMessageFactory.withIntent('purchase-intent', 'regex');
      expect(msg).toMatchIntent('purchase-intent');
      expect(msg).toMatchIntent('purchase-intent', 'regex');
      expect(msg).not.toMatchIntent('pricing');
    });

    it('toHaveOfferedLeadFormWithReason works on result', () => {
      const result = { leadFormOffered: true, leadFormReason: 'purchase-intent' };
      expect(result).toHaveOfferedLeadFormWithReason('purchase-intent');
      expect(result).not.toHaveOfferedLeadFormWithReason('frustration');
    });

    it('toFallbackToProvider checks fallback chain', () => {
      const result = { provider: 'anthropic', failedProviders: ['openai'] };
      expect(result).toFallbackToProvider('anthropic');
    });

    it('toServeFromCanned detects canned path', () => {
      expect({ servedFrom: 'canned' as const, cannedKey: 'price' }).toServeFromCanned();
      expect({ servedFrom: 'llm' as const }).not.toServeFromCanned();
    });
  });
});
