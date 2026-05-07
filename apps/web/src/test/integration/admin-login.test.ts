/**
 * Suite d'intégration MSW — POST /api/admin/login.
 * Couvre :
 *  - scenario-login-success     → 200 + cookie session posé
 *  - scenario-login-failure     → 401 sur mauvais mot de passe
 *  - scenario-login-rate-limit  → 429 après 5 échecs
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { POST } from '@/app/api/admin/login/route';
import { resetMemoryStore } from '@/lib/db/client';
import { createAdmin } from '@/lib/db/queries/admin-users';
import { hashPassword } from '@/lib/auth/password';

const setMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ set: setMock }),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  setMock.mockClear();
});
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

function buildLoginRequest(email: string, password: string) {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify({ email, password }),
  });
}

describe('POST /api/admin/login (MSW intégration)', () => {
  it('login-success : credentials corrects → 200 + cookie session', async () => {
    const passwordHash = await hashPassword('Mot2pass3OK!');
    await createAdmin({
      email: 'fondatrice@femiglow.ma',
      passwordHash,
      name: 'Fondatrice',
    });
    const res = await POST(buildLoginRequest('fondatrice@femiglow.ma', 'Mot2pass3OK!'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock.mock.calls[0]?.[0]).toMatchObject({
      name: 'femiglow_admin_session',
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('login-failure : mauvais mot de passe → 401', async () => {
    const passwordHash = await hashPassword('Mot2pass3OK!');
    await createAdmin({
      email: 'fondatrice@femiglow.ma',
      passwordHash,
      name: 'Fondatrice',
    });
    const res = await POST(buildLoginRequest('fondatrice@femiglow.ma', 'wrongpass'));
    expect(res.status).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('login-failure : email inconnu → 401 (timing-safe : on hashe quand même)', async () => {
    const res = await POST(buildLoginRequest('inconnu@example.com', 'whatever12'));
    expect(res.status).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('login-rate-limit : >= 5 échecs en 15 min → 429', async () => {
    const passwordHash = await hashPassword('Mot2pass3OK!');
    await createAdmin({
      email: 'fondatrice@femiglow.ma',
      passwordHash,
      name: 'Fondatrice',
    });
    for (let i = 0; i < 5; i++) {
      await POST(buildLoginRequest('fondatrice@femiglow.ma', 'wrongpass'));
    }
    const res = await POST(buildLoginRequest('fondatrice@femiglow.ma', 'wrongpass'));
    expect(res.status).toBe(429);
  });
});
