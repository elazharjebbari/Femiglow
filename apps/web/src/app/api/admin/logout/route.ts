import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const session = await getAdminSession();
  cookies().set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NEXT_PUBLIC_ENV !== 'development',
    path: '/',
    maxAge: 0,
  });
  if (session) {
    await logAuditEvent({ action: 'admin.logout', actorId: session.adminId });
  }
  return NextResponse.json({ ok: true });
}
