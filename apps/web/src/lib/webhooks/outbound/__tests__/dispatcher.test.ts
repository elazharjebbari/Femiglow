/**
 * CHA-260 — Tests unit du module `dispatcher.ts`.
 *
 * Couvre les helpers HMAC sans MSW (pas de HTTP réel) :
 *   - `signOutboundBody` est déterministe ;
 *   - `verifyOutboundSignature` accepte la signature attendue et
 *     rejette une signature corrompue (timing-safe).
 *   - `resolveWebhookEndpoint` applique la priorité OUTBOUND* > CHAT_LEAD*.
 *
 * Les tests d'envoi HTTP complets vivent dans
 * `src/test/integration/outbound-webhook-*.test.ts` (avec MSW).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: undefined as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: undefined as string | undefined,
}));

vi.mock('@/lib/env', () => ({ env: envMock }));

import {
  resolveWebhookEndpoint,
  signOutboundBody,
  verifyOutboundSignature,
} from '../dispatcher';

afterEach(() => {
  envMock.OUTBOUND_WEBHOOK_URL = undefined;
  envMock.OUTBOUND_WEBHOOK_SECRET = undefined;
  envMock.CHAT_LEAD_WEBHOOK_URL = undefined;
  envMock.CHAT_LEAD_WEBHOOK_SECRET = undefined;
});

describe('signOutboundBody / verifyOutboundSignature', () => {
  it('produit une signature au format sha256=<64 hex>', () => {
    const sig = signOutboundBody('{"id":"x"}', 'my-secret-16chars+');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('est déterministe pour un même couple (body, secret)', () => {
    const a = signOutboundBody('{"id":"a"}', 'secret-of-some-length');
    const b = signOutboundBody('{"id":"a"}', 'secret-of-some-length');
    expect(a).toBe(b);
  });

  it('vérifie une signature valide', () => {
    const body = '{"id":"a"}';
    const secret = 'secret-of-some-length';
    const sig = signOutboundBody(body, secret);
    expect(verifyOutboundSignature(body, sig, secret)).toBe(true);
  });

  it('rejette une signature corrompue', () => {
    const body = '{"id":"a"}';
    const secret = 'secret-of-some-length';
    const sig = signOutboundBody(body, secret);
    expect(verifyOutboundSignature(body, sig.replace(/.$/, '0'), secret)).toBe(false);
  });

  it('rejette une signature de mauvaise longueur', () => {
    expect(verifyOutboundSignature('{}', 'sha256=tooshort', 's-of-some-length')).toBe(false);
  });
});

describe('resolveWebhookEndpoint — priorités env', () => {
  it('renvoie null si rien n\u2019est configuré', () => {
    expect(resolveWebhookEndpoint()).toBeNull();
  });

  it('utilise OUTBOUND_WEBHOOK_* quand défini', () => {
    envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/out';
    envMock.OUTBOUND_WEBHOOK_SECRET = 'out-secret-16chars+';
    envMock.CHAT_LEAD_WEBHOOK_URL = 'https://hook.example.com/chat';
    envMock.CHAT_LEAD_WEBHOOK_SECRET = 'chat-secret-16chars+';
    expect(resolveWebhookEndpoint()).toEqual({
      url: 'https://hook.example.com/out',
      secret: 'out-secret-16chars+',
    });
  });

  it('retombe sur CHAT_LEAD_WEBHOOK_* si OUTBOUND absent', () => {
    envMock.CHAT_LEAD_WEBHOOK_URL = 'https://hook.example.com/chat';
    envMock.CHAT_LEAD_WEBHOOK_SECRET = 'chat-secret-16chars+';
    expect(resolveWebhookEndpoint()).toEqual({
      url: 'https://hook.example.com/chat',
      secret: 'chat-secret-16chars+',
    });
  });

  it('renvoie null si secret manquant (url seule insuffisante)', () => {
    envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/out';
    expect(resolveWebhookEndpoint()).toBeNull();
  });
});
