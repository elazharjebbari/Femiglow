import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeSession, SESSION_COOKIE, type AdminSession } from '@/lib/auth/session';

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return decodeSession(token);
}

export async function requireAdmin(redirectTo?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : '';
    redirect(`/admin/login${next}`);
  }
  return session;
}
