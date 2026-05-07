import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, decodeSession, encodeSession } from './session';

describe('admin session encoding', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_PASSWORD = 'a'.repeat(32);
  });

  it('encode et décode une session valide', async () => {
    const session = createSession('u_abc', 'fondatrice@femiglow.ma');
    const token = await encodeSession(session);
    const decoded = await decodeSession(token);
    expect(decoded?.adminId).toBe('u_abc');
    expect(decoded?.email).toBe('fondatrice@femiglow.ma');
  });

  it('rejette un token complètement invalide', async () => {
    expect(await decodeSession('not-a-valid-iron-session-token')).toBeNull();
  });

  it('rejette une session expirée', async () => {
    const expired = {
      adminId: 'u_abc',
      email: 'a@b.co',
      issuedAt: Date.now() - 1_000_000,
      expiresAt: Date.now() - 1000,
    };
    const token = await encodeSession(expired);
    expect(await decodeSession(token)).toBeNull();
  });

  it('retourne null pour un token absent', async () => {
    expect(await decodeSession(undefined)).toBeNull();
    expect(await decodeSession('')).toBeNull();
  });
});
