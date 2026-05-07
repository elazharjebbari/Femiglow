import { sealData, unsealData } from 'iron-session';
import { env } from '@/lib/env';

export interface AdminSession {
  adminId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

export const SESSION_COOKIE = 'femiglow_admin_session';
export const SESSION_MAX_AGE_S = 60 * 60 * 8;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_PASSWORD;
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_PASSWORD non défini');
  return secret;
}

export async function encodeSession(session: AdminSession): Promise<string> {
  return sealData(session, { password: getSecret(), ttl: SESSION_MAX_AGE_S });
}

export async function decodeSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const session = await unsealData<AdminSession>(token, {
      password: getSecret(),
      ttl: SESSION_MAX_AGE_S,
    });
    if (!session || typeof session !== 'object') return null;
    if (typeof session.adminId !== 'string' || typeof session.email !== 'string') return null;
    if (typeof session.expiresAt !== 'number' || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function createSession(adminId: string, email: string): AdminSession {
  const now = Date.now();
  return {
    adminId,
    email,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_S * 1000,
  };
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NEXT_PUBLIC_ENV !== 'development',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  };
}
