import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/errors/http-error';
import { decodeSession, SESSION_COOKIE, type AdminSession } from '@/lib/auth/session';

export function requireContentStudioEnabled(): void {
  if (env.CONTENT_STUDIO_ENABLED !== 'true') {
    throw new HttpError('forbidden', 'Content Studio désactivé.');
  }
}

export async function requireAdminApi(): Promise<AdminSession> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);
  if (!session) {
    throw new HttpError('unauthorized', 'Session expirée. Veuillez vous reconnecter.');
  }
  return session;
}

