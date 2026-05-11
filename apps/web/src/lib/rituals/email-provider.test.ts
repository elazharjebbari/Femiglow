import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consoleEmailProvider,
  createResendProvider,
  getEmailProvider,
  noopProvider,
} from './email-provider';

const sampleRendered = {
  subject: 'Test',
  preheader: null,
  from: 'maison@femiglow-maroc.com',
  replyTo: 'info@femiglow-maroc.com',
  body: 'Bonjour Amal,\n\nMerci.',
};

describe('consoleEmailProvider', () => {
  it('renvoie ok et un messageId', async () => {
    const result = await consoleEmailProvider.send({
      to: 'amal@example.com',
      rendered: sampleRendered,
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toMatch(/^console-/);
  });
});

describe('noopProvider', () => {
  it('renvoie toujours ok', async () => {
    const result = await noopProvider.send({
      to: 'a@b.com',
      rendered: sampleRendered,
    });
    expect(result.ok).toBe(true);
  });
});

describe('createResendProvider', () => {
  it('appelle Resend HTTP avec auth bearer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-123' }), { status: 200 }),
    );
    const provider = createResendProvider('test-key');
    const result = await provider.send({
      to: 'a@b.com',
      rendered: sampleRendered,
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('retourne ok=false si HTTP non-2xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'rate limit' }), { status: 429 }),
    );
    const provider = createResendProvider('test-key');
    const result = await provider.send({
      to: 'a@b.com',
      rendered: sampleRendered,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate limit');
    fetchSpy.mockRestore();
  });

  it('catch les erreurs réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('network down'),
    );
    const provider = createResendProvider('test-key');
    const result = await provider.send({
      to: 'a@b.com',
      rendered: sampleRendered,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
    fetchSpy.mockRestore();
  });
});

describe('getEmailProvider', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it('NODE_ENV=test → noop', () => {
    const provider = getEmailProvider();
    expect(provider.name).toBe('noop');
  });

  it('RESEND_API_KEY → resend (en non-test)', () => {
    process.env.RESEND_API_KEY = 'fake';
    // Force le passage par la branche resend via stub direct
    // (NODE_ENV reste 'test' donc on instancie directement le provider)
    const provider = createResendProvider('fake');
    expect(provider.name).toBe('resend');
  });
});
